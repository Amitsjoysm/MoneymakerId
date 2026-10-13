-- T02b: api.record_events and api.submit_feedback (CONTRACTS section 5 and 7).
-- record_events adds daily aggregates, stores an absent dimension as '' and counts demand once per
-- (day, visitor, subject, locality) for verified calls only. submit_feedback is rate-limited.
-- 22023 = invalid input, MM429 = rate limited (stable message prefix mm_rate_limited), 42501 = privilege.
begin;
select plan(72);

create function pg_temp.today() returns text language sql as $$
  select ((now() at time zone 'Asia/Kolkata')::date)::text;
$$;

-- One valid EventAggregate; 'over' replaces keys (shallow)
create function pg_temp.ev(over jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object(
    'day', pg_temp.today(), 'host', 'food', 'page_type', 'dish_locality', 'event', 'recommendation_click',
    'locality_id', 'baner', 'subject_id', 'chicken-biryani', 'entity_id', '', 'ranking_run_id', '', 'slot', '',
    'campaign_id', '', 'variant', '', 'referrer_class', 'search', 'device', 'mobile', 'landing_path', null, 'count', 1
  ) || over;
$$;

create function pg_temp.call(hmac text, verified boolean, events jsonb) returns jsonb language sql as $$
  select jsonb_build_object('visitor_hmac', hmac, 'verified', verified, 'events', events);
$$;

create temp table obs_before as select count(*)::int as n from app.observations;

-- ---------------------------------------------------------------------------
-- record_events: allow
-- ---------------------------------------------------------------------------
select lives_ok(
  $$select api.record_events(pg_temp.call('hmac-a', false, jsonb_build_array(
      pg_temp.ev(), pg_temp.ev('{"event": "session_start", "locality_id": null, "subject_id": null, "count": 3, "landing_path": "/pune/baner/"}'))))$$,
  'allow: a call with two aggregates succeeds'
);
select results_eq(
  $$select event, locality_id, subject_id, entity_id, landing_path, count from app.events_daily order by event$$,
  $$values ('recommendation_click', 'baner', 'chicken-biryani', '', '', 1::bigint),
           ('session_start', '', '', '', '/pune/baner/', 3::bigint)$$,
  'aggregates are stored, and an absent dimension is stored as the empty string'
);
select lives_ok($$select api.record_events(pg_temp.call('hmac-a', false, '[]'::jsonb))$$, 'allow: an empty events array is accepted');

select lives_ok(
  $$select api.record_events(pg_temp.call('hmac-b', false, jsonb_build_array(pg_temp.ev('{"count": 4}'), pg_temp.ev('{"count": 2}'))))$$,
  'allow: the same dimensions twice in one call'
);
select is(
  (select count from app.events_daily where event = 'recommendation_click'),
  7::bigint,
  'counts add up across calls and within a call (1 + 4 + 2)'
);
select is((select count(*)::int from app.events_daily), 2, 'and the primary key keeps it to one row per dimension set');
select is((select count(*)::int from app.demand_daily), 0, 'an unverified call counts no demand');

-- ---------------------------------------------------------------------------
-- Demand: verified calls only, once per (day, visitor, subject, locality)
-- ---------------------------------------------------------------------------
select lives_ok(
  $$select api.record_events(pg_temp.call('hmac-c', true, jsonb_build_array(pg_temp.ev())))$$,
  'allow: a verified call'
);
select results_eq(
  $$select vertical, locality_id, subject_id, distinct_visitors from app.demand_daily$$,
  $$values ('food', 'baner', 'chicken-biryani', 1)$$,
  'a verified call with a subject adds one distinct visitor for its vertical'
);
select is(
  (select count(*)::int from app.rate_buckets
    where key = 'demand:' || pg_temp.today() || ':hmac-c:chicken-biryani:baner'),
  1,
  'the dedupe key is demand:{day}:{hmac}:{subject}:{locality} in rate_buckets'
);
select lives_ok(
  $$select api.record_events(pg_temp.call('hmac-c', true, jsonb_build_array(pg_temp.ev('{"event": "filter"}'), pg_temp.ev())))$$,
  'allow: the same visitor again, with more events'
);
select is((select distinct_visitors from app.demand_daily), 1, 'the same visitor, subject and locality counts once per day');
select lives_ok(
  $$select api.record_events(pg_temp.call('hmac-d', true, jsonb_build_array(pg_temp.ev())))$$,
  'allow: a second visitor'
);
select is((select distinct_visitors from app.demand_daily), 2, 'a different visitor adds one');
select lives_ok(
  $$select api.record_events(pg_temp.call('hmac-c', true, jsonb_build_array(pg_temp.ev('{"locality_id": "wakad"}'))))$$,
  'allow: the same visitor and subject in another locality'
);
select is((select count(*)::int from app.demand_daily), 2, 'another locality is its own demand row');
select lives_ok(
  $$select api.record_events(pg_temp.call('hmac-e', true, jsonb_build_array(
      pg_temp.ev('{"host": "main", "page_type": "home", "subject_id": "chicken-biryani"}'),
      pg_temp.ev('{"event": "web_vital", "subject_id": "veg-thali"}'),
      pg_temp.ev('{"event": "ad_click", "subject_id": "veg-thali"}'),
      pg_temp.ev('{"subject_id": null}'))))$$,
  'allow: events that are not demand signals'
);
select is(
  (select sum(distinct_visitors)::int from app.demand_daily),
  3,
  'no demand from the main host, from web_vital or ad events, or from an event without a subject'
);
select lives_ok(
  $$select api.record_events(pg_temp.call('hmac-f', true, jsonb_build_array(
      pg_temp.ev('{"host": "construction", "page_type": "locality_service", "subject_id": "terrace-waterproofing"}'))))$$,
  'allow: a construction event'
);
select is(
  (select distinct_visitors from app.demand_daily where vertical = 'construction' and subject_id = 'terrace-waterproofing'),
  1,
  'the construction host counts under the construction vertical'
);

-- ---------------------------------------------------------------------------
-- record_events: deny (and a rejected call changes nothing)
-- ---------------------------------------------------------------------------
create temp table events_before as select coalesce(sum(count), 0)::bigint as n from app.events_daily;
create temp table demand_before as select coalesce(sum(distinct_visitors), 0)::bigint as n from app.demand_daily;

select throws_ok($$select api.record_events('[]'::jsonb)$$, '22023', 'mm_invalid: record_events: the argument must be a JSON object', 'deny: an array argument');
select throws_ok($$select api.record_events('{"verified": true, "events": []}'::jsonb)$$, '22023', 'mm_invalid: record_events: visitor_hmac is required', 'deny: no visitor_hmac');
select throws_ok($$select api.record_events('{"visitor_hmac": "h", "events": []}'::jsonb)$$, '22023', 'mm_invalid: record_events: verified is required', 'deny: no verified flag');
select throws_ok($$select api.record_events('{"visitor_hmac": "h", "verified": true, "events": {}}'::jsonb)$$, '22023', null, 'deny: events is not an array');
select throws_ok(
  format($$select api.record_events(pg_temp.call('h', true, %L::jsonb))$$, (select jsonb_agg(pg_temp.ev()) from generate_series(1, 51))::text),
  '22023', null, 'deny: more than 50 aggregates');
select throws_ok(
  format($$select api.record_events(pg_temp.call('h', true, %L::jsonb))$$, jsonb_build_array(pg_temp.ev('{"day": "2020-01-01"}'))::text),
  '22023', null, 'deny: a day far in the past');
select throws_ok(
  format($$select api.record_events(pg_temp.call('h', true, %L::jsonb))$$,
    jsonb_build_array(pg_temp.ev(jsonb_build_object('day', ((now() at time zone 'Asia/Kolkata')::date + 5)::text)))::text),
  '22023', null, 'deny: a day in the future');
select throws_ok(
  format($$select api.record_events(pg_temp.call('h', true, %L::jsonb))$$, jsonb_build_array(pg_temp.ev('{"day": "2026-02-30"}'))::text),
  '22023', null, 'deny: a day that is not a real date');
select throws_ok(
  format($$select api.record_events(pg_temp.call('h', true, %L::jsonb))$$, jsonb_build_array(pg_temp.ev('{"count": 0}'))::text),
  '22023', null, 'deny: count 0');
select throws_ok(
  format($$select api.record_events(pg_temp.call('h', true, %L::jsonb))$$, jsonb_build_array(pg_temp.ev('{"count": 101}'))::text),
  '22023', null, 'deny: count over 100');
select throws_ok(
  format($$select api.record_events(pg_temp.call('h', true, %L::jsonb))$$, jsonb_build_array(pg_temp.ev('{"count": 1.5}'))::text),
  '22023', null, 'deny: a fractional count');
select throws_ok(
  format($$select api.record_events(pg_temp.call('h', true, %L::jsonb))$$, jsonb_build_array(pg_temp.ev('{"count": "5"}'))::text),
  '22023', null, 'deny: a count sent as a string');
select throws_ok(
  format($$select api.record_events(pg_temp.call('h', true, %L::jsonb))$$,
    (select jsonb_agg(pg_temp.ev(jsonb_build_object('count', 100, 'slot', 's' || g))) from generate_series(1, 3) g)::text),
  '22023', null, 'deny: more than 200 events in one call');
select throws_ok(
  format($$select api.record_events(pg_temp.call('h', true, %L::jsonb))$$, jsonb_build_array(pg_temp.ev('{"host": "mars"}'))::text),
  '22023', null, 'deny: a host outside the vocabulary');
select throws_ok(
  format($$select api.record_events(pg_temp.call('h', true, %L::jsonb))$$, jsonb_build_array(pg_temp.ev('{"event": "keylog"}'))::text),
  '22023', null, 'deny: an event outside the vocabulary');
select throws_ok(
  format($$select api.record_events(pg_temp.call('h', true, %L::jsonb))$$, jsonb_build_array(pg_temp.ev('{"device": "fridge"}'))::text),
  '22023', null, 'deny: a device outside the vocabulary');
select throws_ok(
  format($$select api.record_events(pg_temp.call('h', true, %L::jsonb))$$,
    jsonb_build_array(pg_temp.ev(jsonb_build_object('locality_id', repeat('l', 101))))::text),
  '22023', null, 'deny: an id-like dimension over 100 characters');
select lives_ok(
  format($$select api.record_events(pg_temp.call('h', false, %L::jsonb))$$,
    jsonb_build_array(pg_temp.ev(jsonb_build_object('locality_id', repeat('l', 100), 'landing_path', repeat('p', 300))))::text),
  'allow: an id-like dimension of exactly 100 characters and a 300-character landing path');
select throws_ok(
  format($$select api.record_events(pg_temp.call('h', true, %L::jsonb))$$,
    jsonb_build_array(pg_temp.ev(jsonb_build_object('landing_path', repeat('p', 301))))::text),
  '22023', null, 'deny: a landing path over 300 characters');
select throws_ok(
  format($$select api.record_events(pg_temp.call(%L, true, %L::jsonb))$$, repeat('h', 129), jsonb_build_array(pg_temp.ev())::text),
  '22023', null, 'deny: a visitor_hmac over 128 characters');
select throws_ok(
  format($$select api.record_events(pg_temp.call('h', true, %L::jsonb))$$, jsonb_build_array(pg_temp.ev(), pg_temp.ev('{"host": "mars"}'))::text),
  '22023', null, 'deny: one bad aggregate rejects the whole call');

select is(
  (select coalesce(sum(count), 0)::bigint from app.events_daily) - (select n from events_before),
  1::bigint,
  'a rejected call changes nothing (the only addition is the one accepted call with the 100-character dimension)'
);
select is((select coalesce(sum(distinct_visitors), 0)::bigint from app.demand_daily), (select n from demand_before), 'and no demand was counted by rejected calls');

-- ---------------------------------------------------------------------------
-- record_events: privileges
-- ---------------------------------------------------------------------------
select ok(has_function_privilege('anon', 'api.record_events(jsonb)', 'execute'), 'allow: anon can execute api.record_events');
select ok(not has_function_privilege('authenticated', 'api.record_events(jsonb)', 'execute'), 'deny: authenticated cannot execute api.record_events');
do $$ begin perform set_config('t.events', pg_temp.call('hmac-z', true, jsonb_build_array(pg_temp.ev('{"slot": "as-anon"}')))::text, true); end $$;
set local role anon;
select lives_ok($$select api.record_events(current_setting('t.events')::jsonb)$$, 'allow: a call made as anon succeeds');
reset role;
select is((select count(*)::int from app.events_daily where slot = 'as-anon'), 1, 'and the aggregate was written');
set local role authenticated;
select throws_ok($$select api.record_events('{}'::jsonb)$$, '42501', null, 'deny: authenticated gets insufficient privilege');
reset role;

-- ---------------------------------------------------------------------------
-- submit_feedback: allow
-- ---------------------------------------------------------------------------
select lives_ok(
  $$select api.submit_feedback('{"page_key": "dish_locality:chicken-biryani:baner", "entity_id": "00000000-0000-4000-8000-0000000000b1",
                                 "kind": "outdated", "note": "The price is Rs 20 higher now", "visitor_hmac": "fb-1"}'::jsonb)$$,
  'allow: feedback with an entity and a note'
);
select results_eq(
  $$select page_key, entity_id, kind, note from app.feedback$$,
  $$values ('dish_locality:chicken-biryani:baner', '00000000-0000-4000-8000-0000000000b1'::uuid, 'outdated', 'The price is Rs 20 higher now')$$,
  'the report is stored'
);
select lives_ok(
  $$select api.submit_feedback('{"page_key": "/pune/baner/", "entity_id": null, "kind": "useful", "note": null, "visitor_hmac": "fb-1"}'::jsonb)$$,
  'allow: no entity and no note');
select is((select count(*)::int from app.feedback where kind = 'useful' and entity_id is null and note is null), 1, 'and both are stored as null');
select lives_ok(
  format($$select api.submit_feedback(%L::jsonb)$$, jsonb_build_object('page_key', repeat('k', 300), 'kind', 'not_useful', 'note', repeat('n', 500), 'visitor_hmac', 'fb-1')::text),
  'allow: a 300-character page key and a 500-character note');

-- ---------------------------------------------------------------------------
-- submit_feedback: rate limit, five reports per visitor per hour
-- ---------------------------------------------------------------------------
select lives_ok(
  $$select api.submit_feedback('{"page_key": "/a/", "kind": "useful", "visitor_hmac": "fb-1"}'::jsonb),
           api.submit_feedback('{"page_key": "/b/", "kind": "useful", "visitor_hmac": "fb-1"}'::jsonb)$$,
  'allow: the fourth and fifth report from one visitor in an hour');
select throws_ok(
  $$select api.submit_feedback('{"page_key": "/c/", "kind": "useful", "visitor_hmac": "fb-1"}'::jsonb)$$,
  'MM429', 'mm_rate_limited: submit_feedback: too many reports, try again later', 'deny: the sixth report from one visitor in an hour');
select is((select count(*)::int from app.feedback), 5, 'and nothing was stored for it');
select lives_ok(
  $$select api.submit_feedback('{"page_key": "/c/", "kind": "useful", "visitor_hmac": "fb-2"}'::jsonb)$$,
  'allow: another visitor has their own allowance');
update app.rate_buckets set window_start = window_start - interval '2 hours' where key = 'feedback:fb-1';
select lives_ok(
  $$select api.submit_feedback('{"page_key": "/c/", "kind": "useful", "visitor_hmac": "fb-1"}'::jsonb)$$,
  'allow: the allowance returns in the next hour window');

-- ---------------------------------------------------------------------------
-- submit_feedback: deny
-- ---------------------------------------------------------------------------
create temp table feedback_before as select count(*)::int as n from app.feedback;
select throws_ok($$select api.submit_feedback('[]'::jsonb)$$, '22023', 'mm_invalid: submit_feedback: the argument must be a JSON object', 'deny: an array argument');
select throws_ok($$select api.submit_feedback('{"kind": "useful", "visitor_hmac": "x"}'::jsonb)$$, '22023', 'mm_invalid: submit_feedback: page_key is required', 'deny: no page_key');
select throws_ok($$select api.submit_feedback('{"page_key": "/a/", "kind": "love", "visitor_hmac": "x"}'::jsonb)$$, '22023', null, 'deny: kind outside the vocabulary');
select throws_ok($$select api.submit_feedback('{"page_key": "/a/", "kind": "useful"}'::jsonb)$$, '22023', 'mm_invalid: submit_feedback: visitor_hmac is required', 'deny: no visitor_hmac');
select throws_ok($$select api.submit_feedback('{"page_key": "/a/", "kind": "useful", "visitor_hmac": "x", "entity_id": "nope"}'::jsonb)$$, '22023', null, 'deny: entity_id is not a uuid');
select throws_ok(
  format($$select api.submit_feedback(%L::jsonb)$$, jsonb_build_object('page_key', '/a/', 'kind', 'useful', 'visitor_hmac', 'x', 'note', repeat('n', 501))::text),
  '22023', null, 'deny: a note over 500 characters');
select throws_ok(
  format($$select api.submit_feedback(%L::jsonb)$$, jsonb_build_object('page_key', repeat('k', 301), 'kind', 'useful', 'visitor_hmac', 'x')::text),
  '22023', null, 'deny: a page key over 300 characters');
select is((select count(*)::int from app.feedback), (select n from feedback_before), 'rejected feedback stored nothing');

-- ---------------------------------------------------------------------------
-- submit_feedback: privileges
-- ---------------------------------------------------------------------------
select ok(has_function_privilege('anon', 'api.submit_feedback(jsonb)', 'execute'), 'allow: anon can execute api.submit_feedback');
select ok(not has_function_privilege('authenticated', 'api.submit_feedback(jsonb)', 'execute'), 'deny: authenticated cannot execute api.submit_feedback');
set local role anon;
select lives_ok($$select api.submit_feedback('{"page_key": "/as-anon/", "kind": "useful", "visitor_hmac": "fb-anon"}'::jsonb)$$, 'allow: a call made as anon succeeds');
reset role;
select is((select count(*)::int from app.feedback where page_key = '/as-anon/'), 1, 'and the report was written');
set local role authenticated;
select throws_ok($$select api.submit_feedback('{}'::jsonb)$$, '42501', null, 'deny: authenticated gets insufficient privilege');
reset role;

select is((select count(*)::int from app.observations), (select n from obs_before), 'neither function writes observations');

select * from finish();
rollback;
