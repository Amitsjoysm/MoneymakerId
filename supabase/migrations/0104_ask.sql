-- 0104_ask: api.ask_search, ask_begin, ask_commit, ask_result (CONTRACTS section 5 and 6a, plan section 9).
-- Owner: T02b. The Ask Workers hold only the publishable key, so everything they need from the database
-- is behind these four functions:
--
--   ask_search  the instant answer: published entities, active unexpired evidence, the newest finished run
--   ask_begin   one round trip before a live lookup: cached/coalesced? visitor burst? daily cap? provider
--               budgets? which keys are usable?
--   ask_commit  the one batched write after a lookup: result, key outcomes, candidates
--   ask_result  the page polls this for the lookup's state
--
-- Trust boundary: these are callable by anyone who has the publishable key, not only by our Workers. They
-- therefore validate everything, accept a commit once per pending lookup, refuse URLs that are not http(s)
-- or a site path (a stored result is shown to other visitors), never register a key (only update known ones), and
-- never publish a business: candidates are recorded and handed to the catalogue writer (app.ask_apply_candidates).
-- ask_commit also requires a signature: commit_sig = hex(HMAC-SHA256(ASK_COMMIT_SECRET, lookup_id)), checked against
-- the secret stored by admin_api.ask_secret_set (0105_ask_commit_secret.sql) before anything else is read or written.
-- ask_begin hands the usable key fingerprints and the lookup id to anyone, so without the signature a holder of the
-- publishable key could cool or disable a registered key, spend the budget, or settle a pending lookup with a forged
-- result that other visitors would then be shown.
--
-- Search history: ask_begin writes one app.queries row for every search it accepts (vertical, parsed intent, locality,
-- where the answer came from, the lookup). It stores no IP address, no user agent and no visitor hash, and nothing
-- the caller adds beyond the nine ParsedIntent fields. A signed ask_commit that settles a lookup from a live fetch
-- flips served_from to 'live' on the rows that waited for it. ask_search stays a pure read and logs nothing.

-- ---------------------------------------------------------------------------
-- Helpers (schema app: not callable by any API role)
-- ---------------------------------------------------------------------------

-- Is a place open at an instant? opening_hours is {"mon": [["11:00","23:30"]], ...} in IST. A range whose
-- close is not after its open runs past midnight, so it also covers the start of the next day. Anything that
-- cannot be read counts as closed rather than as an error.
create function app.is_open_at(p_hours jsonb, p_at timestamptz)
returns boolean
language plpgsql
stable
set search_path = ''
as $$
declare
  c_days constant text[] := array['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  v_time time := (p_at at time zone 'Asia/Kolkata')::time;
  v_dow integer := extract(dow from p_at at time zone 'Asia/Kolkata')::integer;
  iv jsonb;
  v_open time;
  v_close time;
begin
  if p_hours is null or jsonb_typeof(p_hours) <> 'object' then
    return false;
  end if;

  for iv in select e from jsonb_array_elements(coalesce(p_hours -> c_days[v_dow + 1], '[]'::jsonb)) as e loop
    v_open := (iv ->> 0)::time;
    v_close := (iv ->> 1)::time;
    if v_close > v_open then
      if v_time >= v_open and v_time < v_close then
        return true;
      end if;
    elsif v_time >= v_open then
      return true;
    end if;
  end loop;

  -- yesterday's ranges that ran past midnight
  for iv in select e from jsonb_array_elements(coalesce(p_hours -> c_days[((v_dow + 6) % 7) + 1], '[]'::jsonb)) as e loop
    v_open := (iv ->> 0)::time;
    v_close := (iv ->> 1)::time;
    if v_close <= v_open and v_time < v_close then
      return true;
    end if;
  end loop;
  return false;
exception
  when data_exception then
    return false;
end;
$$;

-- A URL that may be stored in an Ask result and shown to other visitors: http(s), or a path on this site.
create function app.is_safe_url(p_url text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_url ~* '^https?://[^[:space:]]+$' or p_url ~ '^/([^/[:space:]][^[:space:]]*)?$';
$$;

-- Active, unexpired evidence about one business: its own claims and those about its dishes.
create function app.live_evidence(p_business uuid, p_now timestamptz)
returns table (evidence_id uuid, claim_type text, retrieved_at timestamptz, source_url text, source_title text)
language sql
stable
set search_path = ''
as $$
  select e.id, e.claim_type, e.retrieved_at, s.url, s.title
    from app.evidence e
    join app.sources s on s.id = e.source_id
   where e.status = 'active'
     and app.evidence_expires_at(e.claim_type, e.retrieved_at, e.valid_until) > p_now
     and (   (e.entity_type = 'business' and e.entity_id = p_business::text)
          or (e.entity_type = 'restaurant_dish'
              and e.entity_id in (select rd.id::text from app.restaurant_dishes rd where rd.business_id = p_business)));
$$;

-- What the live evidence of one business adds up to: how many claims, the newest date, whether hours are
-- among them, and up to five distinct source URLs (newest first) as AskItem sources.
create function app.ask_evidence_summary(p_business uuid, p_now timestamptz)
returns table (n bigint, newest timestamptz, has_hours boolean, sources jsonb)
language sql
stable
set search_path = ''
as $$
  select
    (select count(*) from app.live_evidence(p_business, p_now)),
    (select max(le.retrieved_at) from app.live_evidence(p_business, p_now) le),
    coalesce((select bool_or(le.claim_type = 'hours') from app.live_evidence(p_business, p_now) le), false),
    coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'url', u.source_url,
                 'title', coalesce(nullif(u.source_title, ''), u.source_url),
                 'retrieved_at', to_char(u.retrieved_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
               order by u.retrieved_at desc, u.source_url)
        from (select d.*
                from (select distinct on (x.source_url) x.source_url, x.source_title, x.retrieved_at
                        from app.live_evidence(p_business, p_now) x
                       where x.source_url is not null
                       order by x.source_url, x.retrieved_at desc) d
               order by d.retrieved_at desc, d.source_url
               limit 5) u
    ), '[]'::jsonb);
$$;

-- Recommendation labels that are in the vocabulary (BadgeLabel and TempLabel), in their stored order.
create function app.ask_labels(p_labels jsonb)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(l.v order by l.o), '[]'::jsonb)
    from jsonb_array_elements_text(coalesce(p_labels, '[]'::jsonb)) with ordinality as l(v, o)
   where l.v in ('hidden_gem', 'best_value', 'late_night', 'family', 'office_lunch', 'hot', 'trending', 'warm', 'cold');
$$;

-- Trust labels (plan section 8) from what the database knows: verified by an admin, checked within 30 days,
-- backed by a source, price and hours claims that are still live.
create function app.ask_trust(
  p_verified boolean, p_last_verified timestamptz, p_newest timestamptz, p_evidence bigint,
  p_has_price boolean, p_has_hours boolean, p_now timestamptz
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(t.label order by t.o), '[]'::jsonb)
    from (values
      (1, 'verified', p_verified),
      (2, 'recently_checked', greatest(p_last_verified, p_newest) >= p_now - interval '30 days'),
      (3, 'source_backed', p_evidence > 0),
      (4, 'price_checked', p_has_price),
      (5, 'hours_checked', p_has_hours)
    ) as t(o, label, ok)
   where t.ok;
$$;

-- The best rank of each business among the newest finished run of every page key (a page key is the page a
-- ranking was made for). Only page keys that mention the subject and locality of the intent count; labels
-- come from the best-ranked row.
create function app.ask_recommendations(p_run_kind text, p_subject text, p_locality text)
returns table (entity_id uuid, best_rank integer, labels jsonb)
language sql
stable
set search_path = ''
as $$
  with latest as (
    select distinct on (r.page_key) r.page_key, r.run_id
      from app.recommendations r
      join app.ranking_runs rr on rr.id = r.run_id
     where rr.kind = p_run_kind and rr.finished_at is not null
     order by r.page_key, rr.finished_at desc, rr.id
  )
  select r.entity_id, min(r.rank)::integer, (array_agg(r.labels order by r.rank))[1]
    from latest lt
    join app.recommendations r on r.run_id = lt.run_id and r.page_key = lt.page_key
   where (p_subject is null or strpos(lt.page_key, p_subject) > 0)
     and (p_locality is null or strpos(lt.page_key, p_locality) > 0)
   group by r.entity_id;
$$;

-- A ParsedIntent (CONTRACTS section 6a), validated and normalised: exactly its nine fields and nothing else, so
-- anything else a caller adds is dropped, with an absent value stored as JSON null (open_now as false). Shared by
-- api.ask_search and api.ask_begin so both accept the same intents. Every free-text value is capped (slugs at 100
-- characters, intent_key at 200), which keeps the stored history under the 200 character rule.
create function app.ask_read_intent(p_intent jsonb, p_fn text)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  c_slug constant text := '^[a-z0-9]+(-[a-z0-9]+)*$';
  v_vertical text;
  v_subject text;
  v_locality text;
  v_craving text;
  v_diet text;
  v_budget numeric;
  v_open_now boolean;
  v_key text;
  v_confidence numeric;
begin
  v_vertical := app.in_enum(p_intent, 'vertical', p_fn, array['food', 'construction'], true, 'intent.vertical');
  v_subject := app.in_text(p_intent, 'subject_id', p_fn, 100, false, 'intent.subject_id');
  v_locality := app.in_text(p_intent, 'locality_id', p_fn, 100, false, 'intent.locality_id');
  if v_subject is not null and v_subject !~ c_slug then
    perform app.raise_invalid(p_fn, 'intent.subject_id must be a lowercase slug');
  end if;
  if v_locality is not null and v_locality !~ c_slug then
    perform app.raise_invalid(p_fn, 'intent.locality_id must be a lowercase slug');
  end if;
  v_craving := app.in_enum(p_intent, 'craving', p_fn,
    array['spicy', 'sweet', 'savoury', 'light', 'filling', 'street', 'breakfast', 'late_night', 'healthy'], false, 'intent.craving');
  v_diet := app.in_enum(p_intent, 'diet', p_fn, array['veg', 'non_veg', 'egg', 'both'], false, 'intent.diet');
  v_budget := app.in_num(p_intent, 'budget_inr', p_fn, 0, 100000000, false, false, 'intent.budget_inr');
  v_open_now := coalesce(app.in_bool(p_intent, 'open_now', p_fn, false, 'intent.open_now'), false);
  v_key := app.in_text(p_intent, 'intent_key', p_fn, 200, false, 'intent.intent_key');
  v_confidence := app.in_num(p_intent, 'confidence', p_fn, 0, 1, false, false, 'intent.confidence');

  return jsonb_build_object(
    'vertical', v_vertical, 'subject_id', v_subject, 'craving', v_craving, 'locality_id', v_locality,
    'budget_inr', v_budget, 'diet', v_diet, 'open_now', v_open_now, 'intent_key', v_key, 'confidence', v_confidence);
end;
$$;

-- The lookup an intent can join: a finished one from the last 24 hours (the cache) or one still in flight that
-- started less than five minutes ago (identical concurrent misses share one lookup). Null when there is none.
create function app.ask_find_lookup(p_intent_key text)
returns uuid
language sql
stable
set search_path = ''
as $$
  select l.id
    from app.ask_lookups l
   where l.intent_key = p_intent_key
     and ((l.status = 'done' and l.created_at > now() - interval '24 hours')
       or (l.status = 'pending' and l.created_at > now() - interval '5 minutes'))
   order by l.created_at desc
   limit 1;
$$;

create function app.ask_search_food(
  p_subject text, p_craving text, p_locality text, p_budget numeric, p_diet text,
  p_open_now boolean, p_limit integer, p_now timestamptz
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with dish_set as (
    select d.id, d.name
      from app.dishes d
     where case
             when p_subject is not null then d.id = p_subject or d.parent_id = p_subject
             when p_craving is not null then p_craving = any (d.cravings)
             else false
           end
  ),
  -- one row per place: its cheapest dish with a live price, else any matching dish
  places as (
    select distinct on (b.id)
           b.id, b.name, b.slug, b.locality_id, b.verification_status, b.last_verified_at, r.opening_hours,
           ds.name as dish_name,
           case when pe.id is not null then rd.price_inr end as price_inr
      from app.businesses b
      join app.restaurants r on r.business_id = b.id
      join app.restaurant_dishes rd on rd.business_id = b.id
      join dish_set ds on ds.id = rd.dish_id
      left join app.evidence pe
        on pe.id = rd.evidence_id and pe.status = 'active'
       and app.evidence_expires_at(pe.claim_type, pe.retrieved_at, pe.valid_until) > p_now
     where b.status = 'published' and b.kind = 'restaurant'
       and (p_locality is null or b.locality_id = p_locality)
       and (p_diet is null or r.diet = p_diet or r.diet = 'both')
     order by b.id, (case when pe.id is not null then rd.price_inr end) nulls last, ds.name
  ),
  ranked as (
    select pl.*, rec.best_rank, rec.labels as rec_labels, ev.n, ev.newest, ev.has_hours, ev.sources
      from places pl
      left join app.ask_recommendations('food', p_subject, p_locality) rec on rec.entity_id = pl.id
      cross join lateral app.ask_evidence_summary(pl.id, p_now) ev
     where ev.n > 0
       and (p_budget is null or pl.price_inr <= p_budget)
       and (not p_open_now or (ev.has_hours and app.is_open_at(pl.opening_hours, p_now)))
  )
  select coalesce(jsonb_agg(x.item order by x.ord), '[]'::jsonb)
    from (
      select jsonb_build_object(
               'entity_id', rk.id,
               'name', rk.name,
               'locality_id', rk.locality_id,
               'url', '/place/' || rk.slug || '/',
               'summary', format('%s at %s, %s', rk.dish_name, rk.name, loc.name),
               'price_inr', round(rk.price_inr)::integer,
               'labels', app.ask_labels(rk.rec_labels),
               'trust', app.ask_trust(rk.verification_status = 'verified', rk.last_verified_at, rk.newest, rk.n,
                                      rk.price_inr is not null, rk.has_hours, p_now),
               'sources', rk.sources,
               'unverified', rk.verification_status <> 'verified') as item,
             row_number() over (order by rk.best_rank nulls last, rk.newest desc, rk.name, rk.id) as ord
        from ranked rk
        join app.localities loc on loc.id = rk.locality_id
       order by ord
       limit p_limit
    ) x;
$$;

create function app.ask_search_construction(
  p_subject text, p_locality text, p_budget numeric, p_limit integer, p_now timestamptz
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with providers as (
    select b.id, b.name, b.slug, b.locality_id, b.verification_status, b.last_verified_at,
           (select s.name
              from app.provider_services ps
              join app.services s on s.id = ps.service_id
             where ps.business_id = b.id
               and (p_subject is null or ps.service_id = p_subject or s.parent_id = p_subject)
             order by (ps.service_id = p_subject) desc nulls last, s.name
             limit 1) as service_name
      from app.businesses b
      join app.providers pr on pr.business_id = b.id
     where b.status = 'published' and b.kind = 'provider'
       and (p_locality is null or b.locality_id = p_locality or p_locality = any (pr.service_localities))
       and (p_budget is null or pr.min_job_inr is null or pr.min_job_inr <= p_budget)
  ),
  ranked as (
    select pv.*, rec.best_rank, rec.labels as rec_labels, ev.n, ev.newest, ev.has_hours, ev.sources
      from providers pv
      left join app.ask_recommendations('provider', p_subject, p_locality) rec on rec.entity_id = pv.id
      cross join lateral app.ask_evidence_summary(pv.id, p_now) ev
     where pv.service_name is not null and ev.n > 0
  )
  select coalesce(jsonb_agg(x.item order by x.ord), '[]'::jsonb)
    from (
      select jsonb_build_object(
               'entity_id', rk.id,
               'name', rk.name,
               'locality_id', rk.locality_id,
               'url', '/provider/' || rk.slug || '/',
               'summary', format('%s provider in %s', rk.service_name, loc.name),
               'price_inr', null,
               'labels', app.ask_labels(rk.rec_labels),
               'trust', app.ask_trust(rk.verification_status = 'verified', rk.last_verified_at, rk.newest, rk.n,
                                      false, rk.has_hours, p_now),
               'sources', rk.sources,
               'unverified', rk.verification_status <> 'verified') as item,
             row_number() over (order by rk.best_rank nulls last, rk.newest desc, rk.name, rk.id) as ord
        from ranked rk
        join app.localities loc on loc.id = rk.locality_id
       order by ord
       limit p_limit
    ) x;
$$;

-- Candidates a live lookup found. They are validated by api.ask_commit and arrive here for the catalogue
-- writer. T02b cannot apply them itself: the one door into the catalogue is T02c's upsert_business (tiered
-- dedup, slug allocation, the publish rules), and a candidate arriving through a public function must not
-- publish anything. So this is a seam: here it only checks its arguments, and T02c replaces it (CREATE OR REPLACE in a 02*
-- migration) to go through upsert_business + evidence_insert with actor 'ask' and a server-side publish decision.
-- ask_commit keeps every candidate whole in a system event itself, whatever this does, so nothing is lost.
create function app.ask_apply_candidates(p_lookup uuid, p_candidates jsonb)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_lookup is null or jsonb_typeof(p_candidates) is distinct from 'array' then
    perform app.raise_invalid('ask_apply_candidates', 'a lookup id and an array of candidates are required');
  end if;
end;
$$;

comment on function app.ask_apply_candidates(uuid, jsonb) is
  'Seam between api.ask_commit and the catalogue writer. T02b: only checks its arguments. T02c replaces the body to go through upsert_business + evidence_insert with actor ask and a server-side publish decision. Candidates are already kept in a system event by ask_commit.';

-- ---------------------------------------------------------------------------
-- api.ask_search
-- ---------------------------------------------------------------------------
create function api.ask_search(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_fn constant text := 'ask_search';
  v_intent jsonb;
  v_limit integer;
begin
  perform app.require_object(p, c_fn);
  v_intent := app.in_obj(p, 'intent', c_fn);
  v_limit := coalesce(app.in_num(p, 'limit', c_fn, 1, 10, false, true), 10)::integer;
  v_intent := app.ask_read_intent(v_intent, c_fn);

  if v_intent ->> 'vertical' = 'food' then
    return app.ask_search_food(
      v_intent ->> 'subject_id', v_intent ->> 'craving', v_intent ->> 'locality_id', (v_intent ->> 'budget_inr')::numeric,
      v_intent ->> 'diet', (v_intent ->> 'open_now')::boolean, v_limit, now());
  end if;
  return app.ask_search_construction(
    v_intent ->> 'subject_id', v_intent ->> 'locality_id', (v_intent ->> 'budget_inr')::numeric, v_limit, now());
end;
$$;

revoke all on function api.ask_search(jsonb) from public;
grant execute on function api.ask_search(jsonb) to anon, service_role;

comment on function api.ask_search(jsonb) is
  '{ intent: ParsedIntent, limit <= 10 } -> AskItem[]. Published entities only, active unexpired evidence, the newest finished ranking run; no phone numbers. A read: it logs nothing.';

-- ---------------------------------------------------------------------------
-- api.ask_begin
-- ---------------------------------------------------------------------------
create function api.ask_begin(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_fn constant text := 'ask_begin';
  c_burst_limit constant integer := 10;      -- live lookups per visitor per window (CGNAT-friendly, plan section 9)
  c_burst_window constant interval := interval '10 minutes';
  v_none constant jsonb := '{"groq": [], "exa": [], "firecrawl": []}'::jsonb;
  v_intent_key text;
  v_hmac text;
  v_live boolean;
  v_intent jsonb;
  v_verdict text;
  v_lookup uuid;
  v_usable jsonb := v_none;
  v_groq text[];
  v_exa text[];
  v_gov_groq app.governor;
  v_gov_exa app.governor;
  v_cap integer;
  v_started integer;
begin
  perform set_config('mm.actor', 'ask', true);
  perform app.require_object(p, c_fn);
  v_intent_key := app.in_text(p, 'intent_key', c_fn, 200);
  v_hmac := app.in_text(p, 'visitor_hmac', c_fn, 128);
  v_live := app.in_bool(p, 'want_live', c_fn);
  -- Validated before anything is written, with the same readers as ask_search. What is kept is the normalised
  -- ParsedIntent (nine fields): no IP, no user agent, no visitor hash, nothing the caller adds.
  v_intent := app.ask_read_intent(app.in_obj(p, 'intent', c_fn), c_fn);

  <<decide>>
  begin
    -- not asking for a live lookup: report what exists and start nothing
    if not v_live then
      v_lookup := app.ask_find_lookup(v_intent_key);
      v_verdict := 'cached';
      exit decide;
    end if;

    -- One lock serialises live starts, so identical concurrent misses join one lookup and the daily cap holds.
    perform pg_advisory_xact_lock(hashtextextended('mm:ask_begin', 0));

    v_lookup := app.ask_find_lookup(v_intent_key);
    if v_lookup is not null then
      v_verdict := 'cached';
      exit decide;
    end if;

    -- Providers: a budget, a closed breaker and a usable key for both Groq and Exa (Firecrawl is not part of Ask).
    v_groq := app.provider_keys_usable('groq', true);
    v_exa := app.provider_keys_usable('exa', true);
    if cardinality(v_groq) = 0 or cardinality(v_exa) = 0 then
      v_verdict := 'budget_exhausted';
      exit decide;
    end if;

    -- The daily cap on live lookups is the smaller Ask share of Groq and Exa (50 by default, plan section 9).
    v_gov_groq := app.governor_today('groq');
    v_gov_exa := app.governor_today('exa');
    v_cap := least(v_gov_groq.reserved_ask, v_gov_exa.reserved_ask);
    select count(*)::integer into v_started
      from app.ask_lookups l
     where l.created_at >= (app.today_ist()::timestamp at time zone 'Asia/Kolkata');
    if v_started >= v_cap then
      v_verdict := 'budget_exhausted';
      exit decide;
    end if;

    if not app.rate_hit('ask:' || v_hmac, c_burst_window, c_burst_limit) then
      v_verdict := 'rate_limited';
      exit decide;
    end if;

    insert into app.ask_lookups (intent_key) values (v_intent_key) returning id into v_lookup;
    v_verdict := 'allow';
    v_usable := jsonb_build_object(
      'groq', to_jsonb(v_groq),
      'exa', to_jsonb(v_exa),
      'firecrawl', to_jsonb(app.provider_keys_usable('firecrawl', true)));
  end decide;

  -- The search history: one row for every accepted call, whatever the verdict. It starts as served from the
  -- database, or from the cache when the verdict is cached; a signed ask_commit flips it to live.
  insert into app.queries (vertical, intent, locality_id, served_from, lookup_id)
  values (v_intent ->> 'vertical', v_intent, v_intent ->> 'locality_id',
          case when v_verdict = 'cached' then 'cache' else 'db' end, v_lookup);

  return jsonb_build_object('verdict', v_verdict, 'lookup_id', v_lookup, 'usable', v_usable);
end;
$$;

revoke all on function api.ask_begin(jsonb) from public;
grant execute on function api.ask_begin(jsonb) to anon, service_role;

comment on function api.ask_begin(jsonb) is
  '{ intent: ParsedIntent, intent_key, visitor_hmac, want_live } -> { verdict, lookup_id, usable }. cached also covers a lookup already in flight; want_live = false never starts one (cached with a null lookup_id when none exists). budget_exhausted covers the daily cap, a spent budget, an open breaker and no usable key. Writes one app.queries row per accepted call (vertical, the nine ParsedIntent fields, locality_id, served_from db, or cache when the verdict is cached, and the lookup id); no IP, no user agent, no visitor hash.';

-- ---------------------------------------------------------------------------
-- api.ask_commit
-- ---------------------------------------------------------------------------
create function api.ask_commit(p jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_fn constant text := 'ask_commit';
  c_max_bytes constant integer := 65536;
  c_slug constant text := '^[a-z0-9]+(-[a-z0-9]+)*$';
  v_id uuid;
  v_result jsonb;
  v_items jsonb;
  v_item jsonb;
  v_outcomes jsonb;
  v_candidates jsonb;
  v_cand jsonb;
  v_label text;
  v_lookup app.ask_lookups%rowtype;
begin
  perform set_config('mm.actor', 'ask', true);
  perform app.require_object(p, c_fn);
  if octet_length(p::text) > c_max_bytes then
    perform app.raise_invalid(c_fn, 'the payload is larger than 64 KB');
  end if;
  v_id := app.in_uuid(p, 'lookup_id', c_fn);
  -- The signature comes first. Nothing below is read, validated or written for a caller who cannot sign the lookup
  -- id with the shared secret: no key outcome, no budget, no lookup, no candidate.
  perform app.require_ask_commit_sig(c_fn, v_id, app.in_text(p, 'commit_sig', c_fn, 64));

  -- result: an AskResult, or null when the lookup failed
  if not (p ? 'result') then
    perform app.raise_invalid(c_fn, 'result is required (null marks the lookup failed)');
  end if;
  v_result := p -> 'result';
  if jsonb_typeof(v_result) = 'null' then
    v_result := null;
  elsif jsonb_typeof(v_result) <> 'object' then
    perform app.raise_invalid(c_fn, 'result must be an object or null');
  else
    v_items := app.in_arr(v_result, 'items', c_fn, 10, true, 'result.items');
    perform app.in_enum(v_result, 'served_from', c_fn, array['db', 'live'], true, 'result.served_from');
    perform app.in_arr(v_result, 'citations', c_fn, 30, true, 'result.citations');
    for i in 0 .. jsonb_array_length(v_items) - 1 loop
      v_item := v_items -> i;
      v_label := format('result.items[%s]', i);
      if jsonb_typeof(v_item) <> 'object' then
        perform app.raise_invalid(c_fn, v_label || ' must be an object');
      end if;
      perform app.in_text(v_item, 'name', c_fn, 200, true, v_label || '.name');
      perform app.in_text(v_item, 'summary', c_fn, 1000, false, v_label || '.summary');
      perform app.in_arr(v_item, 'sources', c_fn, 10, false, v_label || '.sources');
      perform app.in_arr(v_item, 'labels', c_fn, 20, false, v_label || '.labels');
      perform app.in_arr(v_item, 'trust', c_fn, 20, false, v_label || '.trust');
    end loop;
    -- Every URL in a stored result is shown to other visitors: http(s) or a path on the site, nothing else.
    if exists (
         select 1
           from jsonb_path_query(v_result, '$.items[*].url') as u
          where jsonb_typeof(u) <> 'null' and (jsonb_typeof(u) <> 'string' or not app.is_safe_url(u #>> '{}')))
       or exists (
         select 1
           from jsonb_path_query(v_result, '$.items[*].sources[*].url') as u
          where jsonb_typeof(u) <> 'string' or u #>> '{}' !~* '^https?://[^[:space:]]+$')
       or exists (
         select 1
           from jsonb_path_query(v_result, '$.citations[*].url') as u
          where jsonb_typeof(u) <> 'string' or u #>> '{}' !~* '^https?://[^[:space:]]+$') then
      perform app.raise_invalid(c_fn, 'result URLs must be http(s) or a path on this site');
    end if;
  end if;

  v_outcomes := coalesce(app.in_arr(p, 'key_outcomes', c_fn, 50, false), '[]'::jsonb);

  -- candidates: a BusinessUpsert + evidence + decision. Shape only here; what they become is decided server-side.
  v_candidates := coalesce(app.in_arr(p, 'candidates', c_fn, 10, false), '[]'::jsonb);
  for i in 0 .. jsonb_array_length(v_candidates) - 1 loop
    v_cand := v_candidates -> i;
    v_label := format('candidates[%s]', i);
    if jsonb_typeof(v_cand) <> 'object' then
      perform app.raise_invalid(c_fn, v_label || ' must be an object');
    end if;
    perform app.in_enum(v_cand, 'kind', c_fn, array['restaurant', 'provider'], true, v_label || '.kind');
    perform app.in_text(v_cand, 'name', c_fn, 200, true, v_label || '.name');
    if app.in_text(v_cand, 'locality_id', c_fn, 100, true, v_label || '.locality_id') !~ c_slug then
      perform app.raise_invalid(c_fn, v_label || '.locality_id must be a lowercase slug');
    end if;
    perform app.in_enum(v_cand, 'decision', c_fn, array['publish', 'queue'], true, v_label || '.decision');
    perform app.in_arr(v_cand, 'evidence', c_fn, 20, true, v_label || '.evidence');
    if v_cand ? 'actor' and v_cand -> 'actor' is distinct from '"ask"'::jsonb then
      perform app.raise_invalid(c_fn, v_label || '.actor must be ask');
    end if;
  end loop;

  -- The lookup: settled once. A second commit (a retry after a lost response, or someone else holding the id)
  -- changes nothing.
  select l.* into v_lookup from app.ask_lookups l where l.id = v_id for update;
  if not found then
    raise exception 'mm_not_found: %: lookup not found', c_fn using errcode = 'P0002';
  end if;
  if v_lookup.status <> 'pending' then
    return;
  end if;

  -- a public call never registers a key: only keys the secret-key path already knows are updated
  perform app.apply_key_outcomes(v_outcomes, c_fn, false);

  update app.ask_lookups l
     set status = case when v_result is null then 'failed' else 'done' end,
         result = v_result
   where l.id = v_id;

  -- the searches that waited for this lookup (the visitor who started it and any who joined it) were answered by a
  -- live fetch; one answered from the database stays as it is
  if v_result is not null and v_result ->> 'served_from' = 'live' then
    update app.queries q set served_from = 'live' where q.lookup_id = v_id and q.served_from <> 'live';
  end if;

  if jsonb_array_length(v_candidates) > 0 then
    insert into app.system_events (level, kind, message, data)
    values ('info', 'ask_candidates_received',
            format('%s candidate(s) from live lookup %s', jsonb_array_length(v_candidates), v_id),
            jsonb_build_object('lookup_id', v_id, 'candidates', v_candidates));
    perform app.ask_apply_candidates(v_id, v_candidates);
  end if;
end;
$$;

revoke all on function api.ask_commit(jsonb) from public;
grant execute on function api.ask_commit(jsonb) to anon, service_role;

comment on function api.ask_commit(jsonb) is
  '{ lookup_id, commit_sig, result: AskResult | null, key_outcomes, candidates } -> void. commit_sig = hex(HMAC-SHA256(secret stored by admin_api.ask_secret_set, lookup_id)); a missing or wrong signature, or no stored secret, is refused with mm_invalid before anything else is read or written. Settles a pending lookup once (null result = failed), applies the key outcomes of keys already registered (never registers one), flips the search history of a live result to served_from live, records the candidates in a system event and hands them to app.ask_apply_candidates. Validates every field; publishes nothing.';

-- ---------------------------------------------------------------------------
-- api.ask_result
-- ---------------------------------------------------------------------------
create function api.ask_result(id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c_stuck_minutes constant integer := 10;  -- a lookup still pending after this is reported as failed
  v_lookup app.ask_lookups%rowtype;
  v_status text;
begin
  select l.* into v_lookup from app.ask_lookups l where l.id = ask_result.id;
  if not found then
    return null;
  end if;
  v_status := case
    when v_lookup.status = 'pending' and v_lookup.created_at < now() - make_interval(mins => c_stuck_minutes) then 'failed'
    else v_lookup.status
  end;
  return jsonb_build_object('status', v_status, 'result', case when v_status = 'done' then v_lookup.result end);
end;
$$;

revoke all on function api.ask_result(uuid) from public;
grant execute on function api.ask_result(uuid) to anon, service_role;

comment on function api.ask_result(uuid) is
  'lookup id -> { status, result } or null when unknown. result is set only when status is done; a lookup pending for over ten minutes reads as failed so the page stops polling.';
