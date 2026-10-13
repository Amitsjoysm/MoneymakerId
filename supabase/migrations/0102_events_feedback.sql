-- 0102_events_feedback: api.record_events and api.submit_feedback (CONTRACTS section 5 and 7). Owner: T02b.
--
-- record_events adds the Worker's per-request aggregates to events_daily, and counts demand: a distinct
-- visitor per (day, subject, locality), at most once, and only when the Worker marked the request verified
-- (Turnstile or a confirmed interaction, plan section 16). No IP address or user agent ever reaches these
-- tables, and an absent dimension is stored as '' because a primary key cannot hold NULL (CONTRACTS 5).

create function api.record_events(p jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_fn constant text := 'record_events';
  c_max_events constant integer := 50;       -- aggregates per call (the Worker sends at most 20 events per request)
  c_max_count constant integer := 100;       -- per aggregate
  c_max_total constant integer := 200;       -- per call: the public key makes this callable without the Worker
  c_days_back constant integer := 7;         -- an aggregate may be dated up to a week ago, or one day ahead
  v_today date := app.today_ist();
  v_hmac text;
  v_verified boolean;
  v_events jsonb;
  e jsonb;
  v_label text;
  v_day date;
  v_host text;
  v_page_type text;
  v_event text;
  v_locality text;
  v_subject text;
  v_entity text;
  v_run text;
  v_slot text;
  v_campaign text;
  v_variant text;
  v_referrer text;
  v_device text;
  v_landing text;
  v_count integer;
  v_total integer := 0;
  v_constraint text;
  v_rows integer;
begin
  perform app.require_object(p, c_fn);
  v_hmac := app.in_text(p, 'visitor_hmac', c_fn, 128);
  v_verified := app.in_bool(p, 'verified', c_fn);
  v_events := app.in_arr(p, 'events', c_fn, c_max_events);

  for i in 0 .. jsonb_array_length(v_events) - 1 loop
    e := v_events -> i;
    v_label := format('events[%s]', i);
    if jsonb_typeof(e) <> 'object' then
      perform app.raise_invalid(c_fn, v_label || ' must be an object');
    end if;

    v_day := app.in_date(e, 'day', c_fn, true, v_label || '.day');
    if v_day < v_today - c_days_back or v_day > v_today + 1 then
      perform app.raise_invalid(c_fn, v_label || '.day is outside the accepted window');
    end if;
    v_host := app.in_text(e, 'host', c_fn, 40, true, v_label || '.host');
    v_page_type := app.in_text(e, 'page_type', c_fn, 40, true, v_label || '.page_type');
    v_event := app.in_text(e, 'event', c_fn, 40, true, v_label || '.event');
    v_referrer := app.in_text(e, 'referrer_class', c_fn, 40, true, v_label || '.referrer_class');
    v_device := app.in_text(e, 'device', c_fn, 40, true, v_label || '.device');
    -- the other dimensions: at most 100 characters (landing_path 300); absent is ''
    v_locality := coalesce(app.in_text(e, 'locality_id', c_fn, 100, false, v_label || '.locality_id'), '');
    v_subject := coalesce(app.in_text(e, 'subject_id', c_fn, 100, false, v_label || '.subject_id'), '');
    v_entity := coalesce(app.in_text(e, 'entity_id', c_fn, 100, false, v_label || '.entity_id'), '');
    v_run := coalesce(app.in_text(e, 'ranking_run_id', c_fn, 100, false, v_label || '.ranking_run_id'), '');
    v_slot := coalesce(app.in_text(e, 'slot', c_fn, 100, false, v_label || '.slot'), '');
    v_campaign := coalesce(app.in_text(e, 'campaign_id', c_fn, 100, false, v_label || '.campaign_id'), '');
    v_variant := coalesce(app.in_text(e, 'variant', c_fn, 100, false, v_label || '.variant'), '');
    v_landing := coalesce(app.in_text(e, 'landing_path', c_fn, 300, false, v_label || '.landing_path'), '');
    v_count := app.in_num(e, 'count', c_fn, 1, c_max_count, true, true, v_label || '.count')::integer;
    v_total := v_total + v_count;
    if v_total > c_max_total then
      perform app.raise_invalid(c_fn, format('the call counts more than %s events', c_max_total));
    end if;

    begin
      insert into app.events_daily as d
        (day, host, page_type, event, locality_id, subject_id, entity_id, ranking_run_id, slot, campaign_id,
         variant, referrer_class, device, landing_path, count)
      values
        (v_day, v_host, v_page_type, v_event, v_locality, v_subject, v_entity, v_run, v_slot, v_campaign,
         v_variant, v_referrer, v_device, v_landing, v_count)
      on conflict (day, host, page_type, event, locality_id, subject_id, entity_id, ranking_run_id, slot,
                   campaign_id, variant, referrer_class, device, landing_path)
      do update set count = d.count + excluded.count;
    exception
      when check_violation then
        get stacked diagnostics v_constraint = constraint_name;
        perform app.raise_invalid(c_fn, format('%s has a value outside the vocabulary (%s)', v_label, coalesce(v_constraint, 'check')));
    end;

    -- Demand: food and construction pages only, for an interest signal (not web vitals or ads), from a verified
    -- request, with a subject. One distinct visitor per (day, hmac, subject, locality): the bucket key is the
    -- dedupe, so a repeat finds the key already there and counts nothing.
    if v_verified
       and v_host in ('food', 'construction')
       and v_subject <> ''
       and v_event not in ('web_vital', 'ad_impression', 'ad_click') then
      insert into app.rate_buckets (key, window_start, count)
      values (format('demand:%s:%s:%s:%s', v_day, v_hmac, v_subject, v_locality),
              v_day::timestamp at time zone 'Asia/Kolkata', 1)
      on conflict (key, window_start) do nothing;
      get diagnostics v_rows = row_count;
      if v_rows = 1 then
        insert into app.demand_daily as dd (day, vertical, locality_id, subject_id, distinct_visitors)
        values (v_day, v_host, v_locality, v_subject, 1)
        on conflict (day, vertical, locality_id, subject_id)
        do update set distinct_visitors = dd.distinct_visitors + 1;
      end if;
    end if;
  end loop;
end;
$$;

revoke all on function api.record_events(jsonb) from public;
grant execute on function api.record_events(jsonb) to anon, service_role;

comment on function api.record_events(jsonb) is
  '{ visitor_hmac, verified, events: EventAggregate[] } -> void. Adds daily aggregates (absent dimension = empty string); counts demand once per day, visitor, subject and locality, verified calls only.';

-- ---------------------------------------------------------------------------
-- submit_feedback: "Was this useful?" / "Report outdated info". Five reports per visitor per hour.
-- ---------------------------------------------------------------------------
create function api.submit_feedback(p jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_fn constant text := 'submit_feedback';
  c_per_hour constant integer := 5;
  v_page_key text;
  v_entity uuid;
  v_kind text;
  v_note text;
  v_hmac text;
begin
  perform app.require_object(p, c_fn);
  v_page_key := app.in_text(p, 'page_key', c_fn, 300);
  v_entity := app.in_uuid(p, 'entity_id', c_fn, false);
  v_kind := app.in_enum(p, 'kind', c_fn, array['useful', 'not_useful', 'outdated']);
  v_note := app.in_text(p, 'note', c_fn, 500, false);
  v_hmac := app.in_text(p, 'visitor_hmac', c_fn, 128);

  if not app.rate_hit('feedback:' || v_hmac, interval '1 hour', c_per_hour) then
    raise exception 'mm_rate_limited: %: too many reports, try again later', c_fn using errcode = 'MM429';
  end if;

  insert into app.feedback (page_key, entity_id, kind, note)
  values (v_page_key, v_entity, v_kind, v_note);
end;
$$;

revoke all on function api.submit_feedback(jsonb) from public;
grant execute on function api.submit_feedback(jsonb) to anon, service_role;

comment on function api.submit_feedback(jsonb) is
  '{ page_key, entity_id, kind, note, visitor_hmac } -> void. Rate-limited to five reports per visitor per hour (SQLSTATE MM429).';
