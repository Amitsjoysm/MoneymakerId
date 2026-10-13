-- 0100_function_helpers: input validation and small helpers shared by the T02b functions.
-- CONTRACTS section 5. Owner: T02b.
--
-- Everything here lives in schema app. No API role can execute it (functions start with no EXECUTE for
-- PUBLIC, anon or authenticated, see 0001), and app has no USAGE for them. The api.* and admin_api.*
-- functions are SECURITY DEFINER and owned by postgres, so they can call these.
--
-- Error vocabulary used by every T02b function (the Workers match on the stable prefix):
--   mm_invalid:      <function>: <detail>     SQLSTATE 22023  the input is not acceptable
--   mm_not_found:    <function>: <detail>     SQLSTATE P0002  a referenced row does not exist
--   mm_rate_limited: <function>: <detail>     SQLSTATE MM429  the caller is over a limit

create function app.raise_invalid(p_fn text, p_detail text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'mm_invalid: %: %', p_fn, p_detail using errcode = '22023';
end;
$$;

-- "Today" for daily counters (governor, key usage, events window): the calendar day in IST.
create function app.today_ist()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Kolkata')::date;
$$;

-- ---------------------------------------------------------------------------
-- Readers for jsonb arguments. `p` is the object, `k` the key, `fn` the calling function for the message,
-- `label` the name shown in a message (defaults to the key). An absent key and a JSON null are the same.
-- ---------------------------------------------------------------------------
create function app.require_object(p jsonb, fn text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    perform app.raise_invalid(fn, 'the argument must be a JSON object');
  end if;
end;
$$;

create function app.in_text(p jsonb, k text, fn text, max_len integer, required boolean default true, label text default null)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v jsonb := p -> k;
  l text := coalesce(label, k);
  t text;
begin
  if v is null or jsonb_typeof(v) = 'null' then
    if required then
      perform app.raise_invalid(fn, l || ' is required');
    end if;
    return null;
  end if;
  if jsonb_typeof(v) <> 'string' then
    perform app.raise_invalid(fn, l || ' must be a string');
  end if;
  t := btrim(v #>> '{}');
  if t = '' then
    if required then
      perform app.raise_invalid(fn, l || ' must not be empty');
    end if;
    return null;
  end if;
  if char_length(t) > max_len then
    perform app.raise_invalid(fn, l || ' is longer than ' || max_len || ' characters');
  end if;
  return t;
end;
$$;

create function app.in_uuid(p jsonb, k text, fn text, required boolean default true, label text default null)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  t text := app.in_text(p, k, fn, 36, required, label);
begin
  if t is null then
    return null;
  end if;
  if t !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    perform app.raise_invalid(fn, coalesce(label, k) || ' must be a uuid');
  end if;
  return t::uuid;
end;
$$;

create function app.in_num(
  p jsonb, k text, fn text, p_min numeric, p_max numeric,
  required boolean default true, int_only boolean default false, label text default null
)
returns numeric
language plpgsql
set search_path = ''
as $$
declare
  v jsonb := p -> k;
  l text := coalesce(label, k);
  n numeric;
begin
  if v is null or jsonb_typeof(v) = 'null' then
    if required then
      perform app.raise_invalid(fn, l || ' is required');
    end if;
    return null;
  end if;
  if jsonb_typeof(v) <> 'number' then
    perform app.raise_invalid(fn, l || ' must be a number');
  end if;
  n := (v #>> '{}')::numeric;
  if int_only and n <> trunc(n) then
    perform app.raise_invalid(fn, l || ' must be a whole number');
  end if;
  if n < p_min or n > p_max then
    perform app.raise_invalid(fn, format('%s must be between %s and %s', l, p_min, p_max));
  end if;
  return n;
end;
$$;

create function app.in_bool(p jsonb, k text, fn text, required boolean default true, label text default null)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v jsonb := p -> k;
  l text := coalesce(label, k);
begin
  if v is null or jsonb_typeof(v) = 'null' then
    if required then
      perform app.raise_invalid(fn, l || ' is required');
    end if;
    return null;
  end if;
  if jsonb_typeof(v) <> 'boolean' then
    perform app.raise_invalid(fn, l || ' must be true or false');
  end if;
  return (v #>> '{}')::boolean;
end;
$$;

create function app.in_enum(p jsonb, k text, fn text, allowed text[], required boolean default true, label text default null)
returns text
language plpgsql
set search_path = ''
as $$
declare
  t text := app.in_text(p, k, fn, 100, required, label);
begin
  if t is not null and not (t = any (allowed)) then
    perform app.raise_invalid(fn, format('%s must be one of %s', coalesce(label, k), array_to_string(allowed, ', ')));
  end if;
  return t;
end;
$$;

create function app.in_obj(p jsonb, k text, fn text, required boolean default true, label text default null)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v jsonb := p -> k;
  l text := coalesce(label, k);
begin
  if v is null or jsonb_typeof(v) = 'null' then
    if required then
      perform app.raise_invalid(fn, l || ' is required');
    end if;
    return null;
  end if;
  if jsonb_typeof(v) <> 'object' then
    perform app.raise_invalid(fn, l || ' must be an object');
  end if;
  return v;
end;
$$;

create function app.in_arr(p jsonb, k text, fn text, max_items integer, required boolean default true, label text default null)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v jsonb := p -> k;
  l text := coalesce(label, k);
begin
  if v is null or jsonb_typeof(v) = 'null' then
    if required then
      perform app.raise_invalid(fn, l || ' is required');
    end if;
    return null;
  end if;
  if jsonb_typeof(v) <> 'array' then
    perform app.raise_invalid(fn, l || ' must be an array');
  end if;
  if jsonb_array_length(v) > max_items then
    perform app.raise_invalid(fn, format('%s has more than %s items', l, max_items));
  end if;
  return v;
end;
$$;

-- A date written YYYY-MM-DD that exists on the calendar.
create function app.in_date(p jsonb, k text, fn text, required boolean default true, label text default null)
returns date
language plpgsql
set search_path = ''
as $$
declare
  t text := app.in_text(p, k, fn, 10, required, label);
begin
  if t is null then
    return null;
  end if;
  if t !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    perform app.raise_invalid(fn, coalesce(label, k) || ' must be a date written YYYY-MM-DD');
  end if;
  begin
    return t::date;
  exception
    when datetime_field_overflow or invalid_datetime_format then
      perform app.raise_invalid(fn, coalesce(label, k) || ' is not a real calendar date');
  end;
  return null;
end;
$$;

-- A timestamp in any ISO 8601 form Postgres reads.
create function app.in_timestamptz(p jsonb, k text, fn text, required boolean default true, label text default null)
returns timestamptz
language plpgsql
set search_path = ''
as $$
declare
  t text := app.in_text(p, k, fn, 40, required, label);
begin
  if t is null then
    return null;
  end if;
  begin
    return t::timestamptz;
  exception
    when datetime_field_overflow or invalid_datetime_format or invalid_text_representation then
      perform app.raise_invalid(fn, coalesce(label, k) || ' must be an ISO 8601 timestamp');
  end;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Fixed-window rate limit on app.rate_buckets (PRIMARY KEY (key, window_start)).
-- Returns true and counts the hit when the window still has room; false, counting nothing, when it is full.
-- Windows are aligned to the clock (a 1 hour window runs from :00 to :00).
-- ---------------------------------------------------------------------------
create function app.rate_hit(p_key text, p_window interval, p_limit integer)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_start timestamptz := date_bin(p_window, now(), timestamptz '2000-01-01 00:00:00+00');
  v_count integer;
begin
  if p_limit < 1 then
    return false;
  end if;
  insert into app.rate_buckets as b (key, window_start, count)
  values (p_key, v_start, 1)
  on conflict (key, window_start) do update set count = b.count + 1 where b.count < p_limit
  returning b.count into v_count;
  return v_count is not null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Evidence freshness (CONTRACTS section 8a: CLAIM_TIER and TIER_TTL_DAYS).
-- valid_until wins; otherwise retrieved_at plus the time-to-live of the claim's tier:
-- HOT 14 days (price, hours, offer, availability), WARM 60 (dish, service, phone, rating, mention),
-- COLD 365 (address, locality_fact), COST 180 (cost_rate).
-- ---------------------------------------------------------------------------
create function app.evidence_expires_at(p_claim_type text, p_retrieved_at timestamptz, p_valid_until timestamptz)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select coalesce(
    p_valid_until,
    p_retrieved_at + make_interval(days => case p_claim_type
      when 'price' then 14 when 'hours' then 14 when 'offer' then 14 when 'availability' then 14
      when 'dish' then 60 when 'service' then 60 when 'phone' then 60 when 'rating' then 60 when 'mention' then 60
      when 'address' then 365 when 'locality_fact' then 365
      when 'cost_rate' then 180
    end)
  );
$$;

comment on function app.evidence_expires_at(text, timestamptz, timestamptz) is
  'When a claim stops counting: valid_until, else retrieved_at + the TTL of its freshness tier (CONTRACTS 8a). Reused by T02c.';
