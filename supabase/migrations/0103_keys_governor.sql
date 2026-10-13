-- 0103_keys_governor: admin_api.key_report, credentials_usable, governor_set_budget (CONTRACTS section 5).
-- Owner: T02b. Plan section 10 (provider gateway and key pool) is the behaviour; these functions hold
-- the shared state so every isolate and the pipeline see the same picture.
--
-- Keys are known only by their fingerprint (first 12 hex characters of the sha256), never by the key.
--
-- Governor model (chosen here, the contract names the columns only):
--   budget        calls the provider may be asked for on the day, for the pipeline and the live Ask together
--   used          calls made today. key_report adds one for every outcome it is given (any outcome is a call)
--   reserved_ask  the part of budget held back for the live Ask. The pipeline stops at budget - reserved_ask
--                 (admin_api.credentials_usable); the live Ask may use the whole budget (api.ask_begin).
--                 It is also the daily cap on live lookups: the smaller of Groq's and Exa's share (plan section 9).
--   breaker_open_until  set for five minutes after five consecutive timeout/server failures of one provider
-- A day with no row starts from the most recent earlier row (same budget and share, used = 0). A provider
-- with no row at all has no budget, and so no usable key: it fails closed until governor_set_budget runs.
-- "Day" is the IST calendar day (app.today_ist), the same day the pipeline's night window belongs to.

-- ---------------------------------------------------------------------------
-- Helpers (schema app: not callable by any API role)
-- ---------------------------------------------------------------------------

-- Today's governor row for a provider, created from the latest earlier row when missing.
-- Returns a row of NULLs (day is null) when the provider has never had a budget.
create function app.governor_today(p_provider text)
returns app.governor
language plpgsql
set search_path = ''
as $$
declare
  v_today date := app.today_ist();
  v_row app.governor;
begin
  insert into app.governor (day, provider, budget, used, reserved_ask)
  select v_today, p_provider, prev.budget, 0, prev.reserved_ask
    from app.governor prev
   where prev.provider = p_provider and prev.day < v_today
   order by prev.day desc
   limit 1
  on conflict (day, provider) do nothing;

  select g.* into v_row from app.governor g where g.day = v_today and g.provider = p_provider;
  return v_row;
end;
$$;

-- The fingerprints a caller may use now, least used first. p_for_ask = true is the live Ask, which may spend the
-- whole budget; false is the pipeline, which leaves the Ask its share. Empty when there is no budget, the budget
-- is spent, or the breaker is open. A cooling key is usable again once its cooldown has passed, and so is a key
-- disabled for credits once the provider's reset time has passed; a key disabled for auth never is.
create function app.provider_keys_usable(p_provider text, p_for_ask boolean)
returns text[]
language plpgsql
set search_path = ''
as $$
declare
  v_gov app.governor := app.governor_today(p_provider);
  v_today date := app.today_ist();
  v_limit integer;
begin
  if v_gov.day is null then
    return '{}'::text[];
  end if;
  if v_gov.breaker_open_until is not null and v_gov.breaker_open_until > now() then
    return '{}'::text[];
  end if;
  v_limit := case when p_for_ask then v_gov.budget else v_gov.budget - v_gov.reserved_ask end;
  if v_gov.used >= v_limit then
    return '{}'::text[];
  end if;

  return coalesce((
    select array_agg(c.fingerprint order by case when c.day = v_today then c.daily_used else 0 end, c.last_used_at nulls first, c.fingerprint)
      from app.api_credentials c
     where c.provider = p_provider
       and (   (c.status = 'active' and (c.cooldown_until is null or c.cooldown_until <= now()))
            or (c.status = 'cooling' and c.cooldown_until is not null and c.cooldown_until <= now())
            or (c.status = 'disabled' and c.disabled_reason = 'credits' and c.cooldown_until is not null and c.cooldown_until <= now()))
  ), '{}'::text[]);
end;
$$;

-- Applies KeyOutcome[] (CONTRACTS section 6a) in order. Shared by admin_api.key_report and api.ask_commit.
-- p_register = true (the secret-key path) registers a key the first time it is seen; false (the public path, where
-- anyone holding the publishable key could name any fingerprint) only updates keys that are already registered
-- and silently skips the rest, so a public call can neither add credentials nor flood the table.
-- Returns { applied, disabled: [{provider, fingerprint, reason}], breakers_opened: [provider] } so the caller
-- can alert. Any invalid outcome raises, and the whole call (every earlier outcome with it) is rolled back.
create function app.apply_key_outcomes(p jsonb, p_fn text, p_register boolean default true)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  c_max_outcomes constant integer := 50;
  c_breaker_failures constant integer := 5;     -- consecutive timeout/server failures that open the breaker
  c_breaker_minutes constant integer := 5;
  c_default_cooldown_s constant integer := 60;  -- a 429 without Retry-After
  c_max_cooldown_s constant integer := 86400;
  c_streak_window constant timestamptz := timestamptz '2000-01-01 00:00:00+00';
  v_today date := app.today_ist();
  o jsonb;
  v_label text;
  v_provider text;
  v_fp text;
  v_account text;
  v_status_code integer;
  v_outcome text;
  v_retry numeric;
  v_cred app.api_credentials%rowtype;
  v_gov app.governor;
  v_status text;
  v_cooldown timestamptz;
  v_reason text;
  v_errors integer;
  v_used integer;
  v_streak integer;
  v_reset timestamptz;
  v_applied integer := 0;
  v_disabled jsonb := '[]'::jsonb;
  v_breakers jsonb := '[]'::jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'array' then
    perform app.raise_invalid(p_fn, 'key outcomes must be a JSON array');
  end if;
  if jsonb_array_length(p) > c_max_outcomes then
    perform app.raise_invalid(p_fn, format('more than %s key outcomes in one call', c_max_outcomes));
  end if;

  for i in 0 .. jsonb_array_length(p) - 1 loop
    o := p -> i;
    v_label := format('key_outcomes[%s]', i);
    if jsonb_typeof(o) <> 'object' then
      perform app.raise_invalid(p_fn, v_label || ' must be an object');
    end if;
    v_provider := app.in_enum(o, 'provider', p_fn, array['groq', 'exa', 'firecrawl'], true, v_label || '.provider');
    v_fp := app.in_text(o, 'fingerprint', p_fn, 12, true, v_label || '.fingerprint');
    if v_fp !~ '^[0-9a-f]{12}$' then
      perform app.raise_invalid(p_fn, v_label || '.fingerprint must be 12 lowercase hex characters');
    end if;
    v_account := app.in_text(o, 'account_label', p_fn, 80, true, v_label || '.account_label');
    v_status_code := app.in_num(o, 'status_code', p_fn, 100, 599, false, true, v_label || '.status_code')::integer;
    v_outcome := app.in_enum(o, 'outcome', p_fn,
      array['ok', 'timeout', 'auth', 'credits', 'rate_limited', 'server', 'bad_request', 'schema'], true, v_label || '.outcome');
    v_retry := app.in_num(o, 'retry_after_s', p_fn, 0, 31536000, false, false, v_label || '.retry_after_s');
    perform app.in_num(o, 'tokens', p_fn, 0, 100000000, false, true, v_label || '.tokens');

    -- the key: registered on first sight (secret-key path only), then locked for this update
    if p_register then
      insert into app.api_credentials (fingerprint, provider, account_label, day)
      values (v_fp, v_provider, v_account, v_today)
      on conflict (fingerprint) do nothing;
    end if;
    select c.* into v_cred from app.api_credentials c where c.fingerprint = v_fp for update;
    if not found then
      continue;
    end if;
    if v_cred.provider <> v_provider then
      perform app.raise_invalid(p_fn, 'fingerprint belongs to another provider');
    end if;

    v_status := v_cred.status;
    v_cooldown := v_cred.cooldown_until;
    v_reason := v_cred.disabled_reason;
    v_errors := v_cred.error_count;
    v_used := case when v_cred.day = v_today then v_cred.daily_used else 0 end + 1;

    if v_outcome = 'ok' then
      v_errors := 0;
      if v_status = 'cooling' and (v_cooldown is null or v_cooldown <= now()) then
        v_status := 'active';
        v_cooldown := null;
      elsif v_status = 'disabled' and v_reason = 'credits' and v_cooldown is not null and v_cooldown <= now() then
        v_status := 'active';
        v_cooldown := null;
        v_reason := null;
      end if;
    elsif v_outcome = 'rate_limited' then
      if v_status <> 'disabled' then
        v_status := 'cooling';
        v_cooldown := greatest(
          coalesce(v_cooldown, now()),
          now() + make_interval(secs => least(coalesce(v_retry, c_default_cooldown_s), c_max_cooldown_s)::double precision));
      end if;
    elsif v_outcome in ('timeout', 'server') then
      v_errors := v_errors + 1;
    elsif v_outcome = 'auth' then
      -- 401/403: disabled until a person re-enables it; one alert
      if not (v_status = 'disabled' and v_reason = 'auth') then
        v_disabled := v_disabled || jsonb_build_array(jsonb_build_object('provider', v_provider, 'fingerprint', v_fp, 'reason', 'auth'));
        insert into app.system_events (level, kind, message, data)
        values ('error', 'key_disabled',
                format('%s key %s was disabled: authentication failed', v_provider, v_account),
                jsonb_build_object('provider', v_provider, 'fingerprint', v_fp, 'account_label', v_account,
                                   'reason', 'auth', 'status_code', v_status_code));
      end if;
      v_status := 'disabled';
      v_reason := 'auth';
      v_cooldown := null;
    elsif v_outcome = 'credits' then
      -- 402: disabled until the provider's credits reset. Exa and Firecrawl reset monthly (Firecrawl's billing
      -- day is not known here, so the first of the month is assumed; a person can re-enable sooner). Groq has
      -- daily limits, so it comes back at the next UTC midnight.
      v_reset := case v_provider
        when 'groq' then (date_trunc('day', now() at time zone 'UTC') + interval '1 day') at time zone 'UTC'
        else (date_trunc('month', now() at time zone 'UTC') + interval '1 month') at time zone 'UTC'
      end;
      if not (v_status = 'disabled' and v_reason = 'credits') then
        v_disabled := v_disabled || jsonb_build_array(jsonb_build_object('provider', v_provider, 'fingerprint', v_fp, 'reason', 'credits'));
        insert into app.system_events (level, kind, message, data)
        values ('error', 'key_disabled',
                format('%s key %s was disabled: out of credits until %s', v_provider, v_account, v_reset),
                jsonb_build_object('provider', v_provider, 'fingerprint', v_fp, 'account_label', v_account,
                                   'reason', 'credits', 'status_code', v_status_code, 'until', v_reset));
      end if;
      v_status := 'disabled';
      v_reason := 'credits';
      v_cooldown := v_reset;
    end if;
    -- 'bad_request' and 'schema' are our fault, not the key's or the provider's: counted as a call only

    update app.api_credentials c
       set status = v_status, cooldown_until = v_cooldown, disabled_reason = v_reason,
           error_count = v_errors, daily_used = v_used, day = v_today, last_used_at = now()
     where c.fingerprint = v_fp;

    -- the provider's day: one call used (only once a budget exists)
    v_gov := app.governor_today(v_provider);
    if v_gov.day is not null then
      update app.governor g set used = g.used + 1 where g.day = v_gov.day and g.provider = v_provider;
    end if;

    -- the circuit breaker: consecutive timeout/server failures across all of the provider's keys
    if v_outcome in ('timeout', 'server') then
      insert into app.rate_buckets as b (key, window_start, count)
      values ('breaker:' || v_provider, c_streak_window, 1)
      on conflict (key, window_start) do update set count = b.count + 1
      returning b.count into v_streak;
      if v_streak >= c_breaker_failures then
        if v_gov.day is not null then
          update app.governor g
             set breaker_open_until = now() + make_interval(mins => c_breaker_minutes)
           where g.day = v_gov.day and g.provider = v_provider;
          v_breakers := v_breakers || to_jsonb(v_provider);
          insert into app.system_events (level, kind, message, data)
          values ('warn', 'provider_breaker_open',
                  format('%s circuit breaker open for %s minutes after %s consecutive failures', v_provider, c_breaker_minutes, v_streak),
                  jsonb_build_object('provider', v_provider, 'failures', v_streak));
        end if;
        update app.rate_buckets b set count = 0 where b.key = 'breaker:' || v_provider and b.window_start = c_streak_window;
      end if;
    elsif v_outcome = 'ok' then
      update app.rate_buckets b set count = 0 where b.key = 'breaker:' || v_provider and b.window_start = c_streak_window;
    end if;

    v_applied := v_applied + 1;
  end loop;

  return jsonb_build_object('applied', v_applied, 'disabled', v_disabled, 'breakers_opened', v_breakers);
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_api: secret key (service_role) only
-- ---------------------------------------------------------------------------

create function admin_api.key_report(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('mm.actor', 'admin', true);
  return app.apply_key_outcomes(p, 'key_report');
end;
$$;

revoke all on function admin_api.key_report(jsonb) from public, anon, authenticated;
grant execute on function admin_api.key_report(jsonb) to service_role;

comment on function admin_api.key_report(jsonb) is
  'KeyOutcome[] -> { applied, disabled, breakers_opened }. Applies the plan section 10 error matrix to api_credentials and the governor. Fingerprints only, never a key.';

create function admin_api.credentials_usable(provider text)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('mm.actor', 'admin', true);
  if provider is null or provider not in ('groq', 'exa', 'firecrawl') then
    perform app.raise_invalid('credentials_usable', 'provider must be one of groq, exa, firecrawl');
  end if;
  return app.provider_keys_usable(provider, false);
end;
$$;

revoke all on function admin_api.credentials_usable(text) from public, anon, authenticated;
grant execute on function admin_api.credentials_usable(text) to service_role;

comment on function admin_api.credentials_usable(text) is
  'Fingerprints of the provider''s usable keys for the pipeline, least used first. Empty when there is no budget, the budget less the Ask share is spent, or the breaker is open.';

create function admin_api.governor_set_budget(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_fn constant text := 'governor_set_budget';
  v_provider text;
  v_budget integer;
  v_reserved integer;
  v_set_breaker boolean;
  v_breaker timestamptz;
  v_row app.governor;
begin
  perform set_config('mm.actor', 'admin', true);
  perform app.require_object(p, c_fn);
  v_provider := app.in_enum(p, 'provider', c_fn, array['groq', 'exa', 'firecrawl']);
  v_budget := app.in_num(p, 'budget', c_fn, 0, 1000000, true, true)::integer;
  v_reserved := app.in_num(p, 'reserved_ask', c_fn, 0, 1000000, false, true)::integer;
  v_set_breaker := p ? 'breaker_open_until';
  if v_set_breaker then
    v_breaker := app.in_timestamptz(p, 'breaker_open_until', c_fn, false);
  end if;

  -- today's row, from the latest earlier one when the day has none yet
  v_row := app.governor_today(v_provider);
  if v_row.day is null then
    insert into app.governor (day, provider, budget, used, reserved_ask)
    values (app.today_ist(), v_provider, v_budget, 0, 0)
    on conflict (day, provider) do nothing;
    v_row := app.governor_today(v_provider);
  end if;

  v_reserved := coalesce(v_reserved, v_row.reserved_ask);
  if v_reserved > v_budget then
    perform app.raise_invalid(c_fn, 'reserved_ask cannot exceed budget');
  end if;

  update app.governor g
     set budget = v_budget,
         reserved_ask = v_reserved,
         breaker_open_until = case when v_set_breaker then v_breaker else g.breaker_open_until end
   where g.day = v_row.day and g.provider = v_provider
   returning g.* into v_row;

  insert into app.system_events (level, kind, message, data)
  values ('info', 'governor_budget_set',
          format('%s budget set to %s (Ask share %s)', v_provider, v_budget, v_reserved),
          jsonb_build_object('provider', v_provider, 'budget', v_budget, 'reserved_ask', v_reserved,
                             'breaker_open_until', v_row.breaker_open_until));

  return jsonb_build_object('day', v_row.day, 'provider', v_row.provider, 'budget', v_row.budget, 'used', v_row.used,
                            'reserved_ask', v_row.reserved_ask, 'breaker_open_until', v_row.breaker_open_until);
end;
$$;

revoke all on function admin_api.governor_set_budget(jsonb) from public, anon, authenticated;
grant execute on function admin_api.governor_set_budget(jsonb) to service_role;

comment on function admin_api.governor_set_budget(jsonb) is
  '{ provider, budget, reserved_ask?, breaker_open_until? } -> today''s governor row. Later days start from this row. Every change is audited as a governor_budget_set system event.';
