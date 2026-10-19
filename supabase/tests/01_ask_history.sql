-- T02b fix round 1: api.ask_begin writes the search history (CONTRACTS section 5, amended 2026-10-19).
-- Every accepted call writes ONE app.queries row: vertical, the parsed intent, locality_id, served_from
-- ('db' to start, 'cache' when the verdict is cached) and the lookup id. A signed ask_commit that settles
-- the lookup from a live fetch flips served_from to 'live'. No IP address, no user agent, no visitor hash, and
-- no string over 200 characters. The owner wants recommendations based on search history, so this table
-- must fill up. 22023 = invalid input (mm_invalid), 42501 = insufficient privilege.
begin;
select plan(70);

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------
create function pg_temp.pi(intent_key text, over jsonb default '{}') returns jsonb language sql as $$
  select $j${
    "vertical": "food", "subject_id": "chicken-biryani", "craving": null, "locality_id": "baner",
    "budget_inr": null, "diet": null, "open_now": false, "confidence": 0.9
  }$j$::jsonb || jsonb_build_object('intent_key', intent_key) || over;
$$;

create function pg_temp.begin_(intent text, hmac text default 'v1', live boolean default true, over jsonb default '{}')
returns jsonb language sql as $$
  select api.ask_begin(jsonb_build_object('intent', pg_temp.pi(intent, over), 'intent_key', intent, 'visitor_hmac', hmac, 'want_live', live));
$$;

create function pg_temp.sig(id uuid, secret text default 'example-ask-commit-secret-not-real-0001') returns text
language sql as $$
  select encode(extensions.hmac(id::text, secret, 'sha256'), 'hex');
$$;

create function pg_temp.commit_(id uuid, served_from text default 'live', over jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object(
    'lookup_id', id,
    'commit_sig', pg_temp.sig(id),
    'result', jsonb_build_object('items', '[]'::jsonb, 'served_from', served_from, 'citations', '[]'::jsonb),
    'key_outcomes', '[]'::jsonb,
    'candidates', '[]'::jsonb) || over;
$$;

create function pg_temp.nq() returns int language sql as $$ select count(*)::int from app.queries; $$;
create function pg_temp.nl() returns int language sql as $$ select count(*)::int from app.ask_lookups; $$;

insert into app.localities (id, name, kind, lat, lng, geo_source, jurisdiction) values ('baner', 'Baner', 'locality', 18.559, 73.786, '{}', 'PMC');
do $$ begin perform admin_api.ask_secret_set('example-ask-commit-secret-not-real-0001'); end $$;

-- ---------------------------------------------------------------------------
-- before any budget exists the verdict is budget_exhausted: the search is still recorded
-- ---------------------------------------------------------------------------
select is(pg_temp.nq(), 0, 'the history starts empty');
select is(pg_temp.begin_('h-none') ->> 'verdict', 'budget_exhausted', 'with no budget the verdict is budget_exhausted');
select results_eq(
  $$select vertical, locality_id, served_from, lookup_id from app.queries$$,
  $$values ('food', 'baner', 'db', null::uuid)$$,
  'allow: and the search is recorded anyway: served from the database, no lookup');

do $$ begin perform admin_api.governor_set_budget('{"provider": "groq", "budget": 150, "reserved_ask": 30}'::jsonb); end $$;
do $$ begin perform admin_api.governor_set_budget('{"provider": "exa", "budget": 50, "reserved_ask": 30}'::jsonb); end $$;
insert into app.api_credentials (fingerprint, provider, account_label) values
  ('aaaaaaaaaaaa', 'groq', 'acct-groq'), ('111111111111', 'exa', 'acct-exa');
delete from app.queries;

-- ---------------------------------------------------------------------------
-- allow: a live start
-- ---------------------------------------------------------------------------
create temp table b1 as select pg_temp.begin_('h-1', 'v-secret-visitor') as r;
select is((select r ->> 'verdict' from b1), 'allow', 'a miss is allowed a live lookup');
select is(pg_temp.nq(), 1, 'allow: one call wrote exactly one queries row');
select results_eq(
  $$select vertical, locality_id, served_from, lookup_id from app.queries$$,
  $$select 'food', 'baner', 'db', (select (r ->> 'lookup_id')::uuid from b1)$$,
  'with the vertical, the locality, served_from = db and the lookup id');
select is(
  (select intent from app.queries),
  '{"vertical": "food", "subject_id": "chicken-biryani", "craving": null, "locality_id": "baner", "budget_inr": null,
    "diet": null, "open_now": false, "intent_key": "h-1", "confidence": 0.9}'::jsonb,
  'and the parsed intent, field by field');
select results_eq(
  $$select candidate_ids, ranks from app.queries$$,
  $$select '{}'::uuid[], '{}'::int[]$$,
  'no candidates are claimed at this point');
select is(
  (select count(*)::int from app.queries q where to_jsonb(q)::text like '%v-secret-visitor%'),
  0,
  'the visitor hash is not stored in the history');

-- ---------------------------------------------------------------------------
-- allow: cached (a lookup already in flight is joined)
-- ---------------------------------------------------------------------------
create temp table b1b as select pg_temp.begin_('h-1', 'v-other') as r;
select is((select r ->> 'verdict' from b1b), 'cached', 'the same intent from another visitor joins the lookup in flight');
select results_eq(
  $$select served_from, lookup_id from app.queries order by served_from desc$$,
  $$values ('db', (select (r ->> 'lookup_id')::uuid from b1)), ('cache', (select (r ->> 'lookup_id')::uuid from b1))$$,
  'allow: a cached verdict gives served_from = cache with the joined lookup id (a second row, the first is untouched)');

-- want_live = false and nothing cached: still verdict cached (CONTRACTS), served_from follows the verdict
create temp table b0 as select pg_temp.begin_('h-nothing', 'v-other', false) as r;
select results_eq(
  $$select r ->> 'verdict', r -> 'lookup_id' from b0$$,
  $$select 'cached', 'null'::jsonb$$,
  'want_live = false with nothing cached answers cached with no lookup');
select results_eq(
  $$select served_from, lookup_id from app.queries where intent ->> 'intent_key' = 'h-nothing'$$,
  $$select 'cache', null::uuid$$,
  'and is recorded as served_from = cache (the verdict is cached), without a lookup id');
select is((select count(*)::int from app.ask_lookups where intent_key = 'h-nothing'), 0, 'and starts no lookup');

-- ---------------------------------------------------------------------------
-- allow: other shapes of intent
-- ---------------------------------------------------------------------------
create temp table b2 as select pg_temp.begin_('h-2', 'v-3', true, '{"vertical": "construction", "subject_id": "terrace-waterproofing", "locality_id": null, "budget_inr": 150000, "diet": "veg", "craving": "spicy", "open_now": true, "confidence": 0.5}') as r;
select results_eq(
  $$select vertical, locality_id, served_from, lookup_id from app.queries where intent ->> 'intent_key' = 'h-2'$$,
  $$select 'construction', null::text, 'db', (select (r ->> 'lookup_id')::uuid from b2)$$,
  'allow: a construction intent without a locality is recorded with a null locality_id');
select is(
  (select intent from app.queries where intent ->> 'intent_key' = 'h-2'),
  '{"vertical": "construction", "subject_id": "terrace-waterproofing", "craving": "spicy", "locality_id": null, "budget_inr": 150000,
    "diet": "veg", "open_now": true, "intent_key": "h-2", "confidence": 0.5}'::jsonb,
  'with budget, diet, craving, open_now and confidence as sent');
create temp table b3 as select pg_temp.begin_('h-3', 'v-3', true, '{"subject_id": null, "locality_id": null, "confidence": null, "budget_inr": null}') as r;
select is(
  (select intent from app.queries where intent ->> 'intent_key' = 'h-3'),
  '{"vertical": "food", "subject_id": null, "craving": null, "locality_id": null, "budget_inr": null,
    "diet": null, "open_now": false, "intent_key": "h-3", "confidence": null}'::jsonb,
  'allow: an intent with nothing but a vertical is recorded as it is, with nulls');

-- a finished lookup is served from cache
update app.ask_lookups set status = 'done', result = '{"items": [], "served_from": "live", "citations": []}' where intent_key = 'h-3';
create temp table b3c as select pg_temp.begin_('h-3', 'v-4') as r;
select results_eq(
  $$select r ->> 'verdict' from b3c$$, $$values ('cached')$$, 'a lookup finished within 24 hours is cached');
select is(
  (select count(*)::int from app.queries where intent ->> 'intent_key' = 'h-3' and served_from = 'cache' and lookup_id = (select (r ->> 'lookup_id')::uuid from b3)),
  1,
  'and that search is recorded as served_from = cache against the finished lookup');

-- ---------------------------------------------------------------------------
-- allow: rate_limited and budget_exhausted are searches too
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int from generate_series(1, 10) g where pg_temp.begin_('burst-' || g, 'v-burst') ->> 'verdict' = 'allow'),
  10,
  'ten live lookups from one visitor are allowed');
create temp table before_rl as select pg_temp.nq() as n, pg_temp.nl() as l;
create temp table rl as select pg_temp.begin_('burst-11', 'v-burst') as r;
select is((select r ->> 'verdict' from rl), 'rate_limited', 'the eleventh is rate_limited');
select results_eq(
  $$select (select count(*)::int from app.queries), (select count(*)::int from app.ask_lookups)$$,
  $$select n + 1, l from before_rl$$,
  'allow: it still wrote a queries row, and no lookup');
select results_eq(
  $$select served_from, lookup_id from app.queries where intent ->> 'intent_key' = 'burst-11'$$,
  $$select 'db', null::uuid$$,
  'served from the database, with no lookup id');
update app.governor set used = budget where provider = 'groq';
create temp table before_be as select pg_temp.nq() as n;
select is(pg_temp.begin_('be-1', 'v-be') ->> 'verdict', 'budget_exhausted', 'a spent Groq budget gives budget_exhausted');
select is(pg_temp.nq(), (select n + 1 from before_be), 'allow: and the search is recorded');
update app.governor set used = 0 where provider = 'groq';

-- ---------------------------------------------------------------------------
-- privacy: no IP, no user agent, nothing the caller adds, no string over 200 characters
-- ---------------------------------------------------------------------------
select is(
  (select array_agg(column_name::text order by column_name collate "C")
     from information_schema.columns where table_schema = 'app' and table_name = 'queries'),
  array['candidate_ids', 'created_at', 'id', 'intent', 'locality_id', 'lookup_id', 'ranks', 'served_from', 'updated_at', 'vertical'],
  'the table has no column for an IP address, a user agent or a visitor');
create temp table b4 as select pg_temp.begin_('h-4', 'v-4', true,
  jsonb_build_object('ip', '203.0.113.9', 'user_agent', 'Example/1.0', 'note', repeat('n', 5000), 'nested', jsonb_build_object('x', repeat('y', 500)))) as r;
select is((select count(*)::int from app.queries where intent ->> 'intent_key' = 'h-4'), 1, 'allow: a call with extra fields still writes one row');
select is(
  (select array_agg(k order by k collate "C") from app.queries q, jsonb_object_keys(q.intent) k where q.intent ->> 'intent_key' = 'h-4'),
  array['budget_inr', 'confidence', 'craving', 'diet', 'intent_key', 'locality_id', 'open_now', 'subject_id', 'vertical']::text[],
  'but stores only the nine ParsedIntent fields: the extra ones are dropped');
create temp table b5 as select pg_temp.begin_(repeat('k', 200), 'v-5', true, jsonb_build_object('subject_id', repeat('a', 100))) as r;
select is(
  (select count(*)::int from app.queries where length(intent ->> 'intent_key') = 200 and length(intent ->> 'subject_id') = 100),
  1,
  'allow: values at the limits (intent_key 200, subject_id 100 characters) are stored');
select ok(
  not exists (select 1 from app.queries q where jsonb_path_exists(q.intent, '$.** ? (@.type() == "string" && @ like_regex "^.{201,}$" flag "s")')),
  'and no string in any stored intent is longer than 200 characters');

-- ---------------------------------------------------------------------------
-- deny: nothing is written for a rejected call
-- ---------------------------------------------------------------------------
create temp table before_bad as select pg_temp.nq() as n, pg_temp.nl() as l;
select throws_ok(
  format($$select pg_temp.begin_('h-bad', 'v-bad', true, %L::jsonb)$$, t.over), '22023', t.msg, 'deny: ' || t.label)
  from (values
    ('an unknown vertical', '{"vertical": "cafe"}', 'mm_invalid: ask_begin: intent.vertical must be one of food, construction'),
    ('no vertical', '{"vertical": null}', 'mm_invalid: ask_begin: intent.vertical is required'),
    ('a subject that is not a slug', '{"subject_id": "Chicken Biryani"}', 'mm_invalid: ask_begin: intent.subject_id must be a lowercase slug'),
    ('a locality that is not a slug', '{"locality_id": "BANER"}', 'mm_invalid: ask_begin: intent.locality_id must be a lowercase slug'),
    ('a locality with a path in it', '{"locality_id": "../baner"}', 'mm_invalid: ask_begin: intent.locality_id must be a lowercase slug'),
    ('a subject over 100 characters', jsonb_build_object('subject_id', repeat('a', 101))::text, 'mm_invalid: ask_begin: intent.subject_id is longer than 100 characters'),
    ('a locality over 100 characters', jsonb_build_object('locality_id', repeat('a', 101))::text, 'mm_invalid: ask_begin: intent.locality_id is longer than 100 characters'),
    ('an intent_key over 200 characters inside the intent', jsonb_build_object('intent_key', repeat('k', 201))::text, 'mm_invalid: ask_begin: intent.intent_key is longer than 200 characters'),
    ('a craving outside the vocabulary', '{"craving": "salty"}', null),
    ('a diet outside the vocabulary', '{"diet": "vegan"}', null),
    ('a negative budget', '{"budget_inr": -5}', null),
    ('a budget that is not a number', '{"budget_inr": "cheap"}', 'mm_invalid: ask_begin: intent.budget_inr must be a number'),
    ('open_now that is not a boolean', '{"open_now": "yes"}', 'mm_invalid: ask_begin: intent.open_now must be true or false'),
    ('a confidence above 1', '{"confidence": 1.5}', null),
    ('a confidence that is not a number', '{"confidence": "high"}', null),
    ('a subject that is not a string', '{"subject_id": 7}', 'mm_invalid: ask_begin: intent.subject_id must be a string')
  ) as t(label, over, msg);
select throws_ok(
  $$select api.ask_begin('{"intent_key": "k", "visitor_hmac": "v", "want_live": true, "intent": []}'::jsonb)$$,
  '22023', 'mm_invalid: ask_begin: intent must be an object', 'deny: an intent that is an array');
select throws_ok(
  $$select api.ask_begin('{"intent_key": "k", "visitor_hmac": "v", "want_live": true, "intent": "food"}'::jsonb)$$,
  '22023', 'mm_invalid: ask_begin: intent must be an object', 'deny: an intent that is a string');
select throws_ok(
  $$select api.ask_begin('{"intent_key": "k", "visitor_hmac": "v", "want_live": true, "intent": null}'::jsonb)$$,
  '22023', 'mm_invalid: ask_begin: intent is required', 'deny: a null intent');
select throws_ok(
  $$select api.ask_begin('{"intent_key": "k", "visitor_hmac": "v", "want_live": false}'::jsonb)$$,
  '22023', 'mm_invalid: ask_begin: intent is required', 'deny: no intent, even when no live lookup is wanted');
select results_eq(
  $$select pg_temp.nq(), pg_temp.nl()$$,
  $$select n, l from before_bad$$,
  'none of the rejected calls wrote a history row or a lookup');

-- ---------------------------------------------------------------------------
-- a signed commit flips served_from to live (only for a live result)
-- ---------------------------------------------------------------------------
create temp table live1 as select pg_temp.begin_('live-1', 'v-live') as r;              -- allow: db
create temp table live1b as select pg_temp.begin_('live-1', 'v-live-2') as r;            -- joins: cache
create temp table live2 as select pg_temp.begin_('live-2', 'v-live') as r;               -- a different lookup
create temp table live3 as select pg_temp.begin_('live-3', 'v-live') as r;               -- will be answered from the database
create temp table live4 as select pg_temp.begin_('live-4', 'v-live') as r;               -- will fail
create temp table live5 as select pg_temp.begin_('live-5', 'v-live') as r;               -- will get a bad signature
select results_eq(
  $$select intent ->> 'intent_key', served_from from app.queries where intent ->> 'intent_key' like 'live-%' order by 1, 2$$,
  $$values ('live-1', 'cache'), ('live-1', 'db'), ('live-2', 'db'), ('live-3', 'db'), ('live-4', 'db'), ('live-5', 'db')$$,
  'before any commit the rows are db, and cache for the visitor who joined');

select throws_ok(
  format($$select api.ask_commit(%L::jsonb)$$, (pg_temp.commit_((select (r ->> 'lookup_id')::uuid from live5)) || '{"commit_sig": "00"}')::text),
  '22023', 'mm_invalid: ask_commit: commit_sig is not valid', 'deny: a commit with a bad signature');
select is(
  (select served_from from app.queries where intent ->> 'intent_key' = 'live-5'), 'db',
  'and it did not flip the row to live');

select lives_ok(
  format($$select api.ask_commit(%L::jsonb)$$, pg_temp.commit_((select (r ->> 'lookup_id')::uuid from live1))::text),
  'allow: a signed commit whose result came from a live fetch');
select results_eq(
  $$select served_from, count(*)::int from app.queries where lookup_id = (select (r ->> 'lookup_id')::uuid from live1) group by 1$$,
  $$values ('live', 2)$$,
  'flips every row of that lookup to live: the visitor who started it and the one who joined');
select results_eq(
  $$select served_from from app.queries where intent ->> 'intent_key' = 'live-2'$$,
  $$values ('db')$$,
  'and no row of another lookup');

select lives_ok(
  format($$select api.ask_commit(%L::jsonb)$$, pg_temp.commit_((select (r ->> 'lookup_id')::uuid from live3), 'db')::text),
  'allow: a signed commit whose result came from the database');
select is(
  (select served_from from app.queries where intent ->> 'intent_key' = 'live-3'), 'db',
  'leaves the row at db (nothing was fetched live)');

select lives_ok(
  format($$select api.ask_commit(%L::jsonb)$$, (pg_temp.commit_((select (r ->> 'lookup_id')::uuid from live4)) || '{"result": null}')::text),
  'allow: a signed commit that marks the lookup failed');
select is(
  (select served_from from app.queries where intent ->> 'intent_key' = 'live-4'), 'db',
  'leaves the row at db (nothing was found)');

-- a later search for the same intent is served from the finished lookup and is not rewritten by anything
create temp table live1c as select pg_temp.begin_('live-1', 'v-live-3') as r;
select results_eq(
  $$select r ->> 'verdict' from live1c$$, $$values ('cached')$$, 'a search after the commit is cached');
select results_eq(
  $$select served_from, count(*)::int from app.queries where intent ->> 'intent_key' = 'live-1' group by 1 order by served_from collate "C"$$,
  $$values ('cache', 1), ('live', 2)$$,
  'the later search is its own row, served from cache; the start and the joiner stay live');

-- a second signed commit (a retry) does not rewrite the history
create temp table st_retry as select jsonb_agg(to_jsonb(q) order by q.id) as s from app.queries q;
select lives_ok(
  format($$select api.ask_commit(%L::jsonb)$$, pg_temp.commit_((select (r ->> 'lookup_id')::uuid from live1))::text),
  'allow: a retried commit for the settled lookup is accepted and ignored');
select is((select jsonb_agg(to_jsonb(q) order by q.id) from app.queries q), (select s from st_retry), 'and leaves the history as it was');

-- ---------------------------------------------------------------------------
-- roles
-- ---------------------------------------------------------------------------
do $$ begin perform set_config('t.begin', jsonb_build_object('intent', pg_temp.pi('as-anon'), 'intent_key', 'as-anon', 'visitor_hmac', 'v-anon', 'want_live', true)::text, true); end $$;
create temp table before_anon as select pg_temp.nq() as n;
set local role anon;
select is(api.ask_begin(current_setting('t.begin')::jsonb) ->> 'verdict', 'allow', 'allow: a call made as anon succeeds');
reset role;
select is(pg_temp.nq(), (select n + 1 from before_anon), 'and writes its history row (the function runs as its owner)');
set local role authenticated;
select throws_ok($$select api.ask_begin(current_setting('t.begin')::jsonb)$$, '42501', null, 'deny: authenticated gets insufficient privilege');
reset role;
select is(pg_temp.nq(), (select n + 1 from before_anon), 'and writes nothing');
select ok(
  (select bool_and(not has_table_privilege(r, 'app.queries', 'select, insert, update, delete'))
     from unnest(array['anon', 'authenticated', 'service_role']) as r),
  'no API role can read or write the history table directly');

select * from finish();
rollback;
