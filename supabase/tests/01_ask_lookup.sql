-- T02b: api.ask_begin, api.ask_commit and api.ask_result (CONTRACTS section 5, plan section 9).
-- ask_begin answers in one round trip: cached/coalesced, per-visitor burst limit, the daily Ask cap,
-- provider budgets, and which keys are usable. ask_commit settles a pending lookup once.
-- 22023 = invalid input (mm_invalid), P0002 = not found, 42501 = insufficient privilege.
begin;
select plan(98);

create function pg_temp.today() returns date language sql as $$ select (now() at time zone 'Asia/Kolkata')::date; $$;

create function pg_temp.begin_(intent text, hmac text default 'v1', live boolean default true)
returns jsonb language sql as $$
  select api.ask_begin(jsonb_build_object('intent_key', intent, 'visitor_hmac', hmac, 'want_live', live));
$$;

create function pg_temp.lookups_today() returns int language sql as $$
  select count(*)::int from app.ask_lookups where created_at >= (pg_temp.today()::timestamp at time zone 'Asia/Kolkata');
$$;

-- A valid commit body; 'over' replaces keys (shallow)
create function pg_temp.commit_(id uuid, over jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object(
    'lookup_id', id,
    'result', $j${
      "items": [
        { "entity_id": null, "name": "Example Found Kitchen", "locality_id": "baner", "url": "https://example.test/found",
          "summary": "Found on the web just now", "price_inr": 150, "labels": [], "trust": [],
          "sources": [{ "url": "https://example.test/found", "title": "Example page", "retrieved_at": "2026-10-13T08:00:00Z" }],
          "unverified": true },
        { "entity_id": "10000000-0000-4000-8000-0000000000a1", "name": "Example Kitchen A", "locality_id": "baner", "url": "/place/example-kitchen-a/",
          "summary": "Known place", "price_inr": null, "labels": [], "trust": ["source_backed"], "sources": [], "unverified": false }
      ],
      "served_from": "live",
      "citations": [{ "url": "https://example.test/found", "title": "Example page", "retrieved_at": "2026-10-13T08:00:00Z" }]
    }$j$::jsonb,
    'key_outcomes', '[]'::jsonb,
    'candidates', '[]'::jsonb) || over;
$$;

create function pg_temp.cand(over jsonb default '{}') returns jsonb language sql as $$
  select $j${
    "kind": "restaurant", "name": "Example Found Kitchen", "locality_id": "baner", "address": null, "geo": null, "phone": null,
    "website": "https://example.test/found", "chain_hint": null, "branch_key": null, "status": "candidate", "auto_published": false,
    "restaurant": null, "provider": null, "actor": "ask", "evidence": [], "decision": "queue"
  }$j$::jsonb || over;
$$;

insert into app.localities (id, name, kind, lat, lng, geo_source, jurisdiction) values ('baner', 'Baner', 'locality', 18.559, 73.786, '{}', 'PMC');
create temp table obs_before as select count(*)::int as n from app.observations;
create temp table biz_before as select count(*)::int as n from app.businesses;

-- ---------------------------------------------------------------------------
-- ask_begin before any budget exists: fails closed
-- ---------------------------------------------------------------------------
create temp table b0 as select pg_temp.begin_('k0') as r;
select results_eq(
  $$select r ->> 'verdict', r -> 'lookup_id', r -> 'usable' from b0$$,
  $$select 'budget_exhausted', 'null'::jsonb, '{"groq": [], "exa": [], "firecrawl": []}'::jsonb$$,
  'allow: with no governor budget configured the verdict is budget_exhausted, with no lookup and no keys'
);
select is((select count(*)::int from app.ask_lookups), 0, 'and no lookup row was created');
select results_eq(
  $$select r ->> 'verdict', r -> 'lookup_id' from (select pg_temp.begin_('k0', 'v1', false) as r) x$$,
  $$select 'cached', 'null'::jsonb$$,
  'want_live = false never starts a lookup: cached with no lookup id when nothing is cached'
);

-- configure: Groq and Exa with an Ask share of 10, one key each
do $$ begin perform admin_api.governor_set_budget('{"provider": "groq", "budget": 150, "reserved_ask": 10}'::jsonb); end $$;
do $$ begin perform admin_api.governor_set_budget('{"provider": "exa", "budget": 20, "reserved_ask": 10}'::jsonb); end $$;
insert into app.api_credentials (fingerprint, provider, account_label) values
  ('aaaaaaaaaaaa', 'groq', 'acct-groq'), ('111111111111', 'exa', 'acct-exa');

-- ---------------------------------------------------------------------------
-- ask_begin: allow, then coalesce
-- ---------------------------------------------------------------------------
create temp table b1 as select pg_temp.begin_('k1', 'v1') as r;
select results_eq(
  $$select r ->> 'verdict', r ->> 'lookup_id' is not null, r -> 'usable' from b1$$,
  $$select 'allow', true, '{"groq": ["aaaaaaaaaaaa"], "exa": ["111111111111"], "firecrawl": []}'::jsonb$$,
  'allow: a miss gets a lookup id and the usable key fingerprints'
);
select results_eq(
  $$select intent_key, status, result is null from app.ask_lookups where id = (select (r ->> 'lookup_id')::uuid from b1)$$,
  $$values ('k1', 'pending', true)$$,
  'and a pending lookup row exists for the intent'
);
create temp table b1b as select pg_temp.begin_('k1', 'v2') as r;
select results_eq(
  $$select r ->> 'verdict', r ->> 'lookup_id', r -> 'usable' from b1b$$,
  $$select 'cached', (select r ->> 'lookup_id' from b1), '{"groq": [], "exa": [], "firecrawl": []}'::jsonb$$,
  'identical concurrent misses are coalesced: the same intent returns the existing lookup, with no keys handed out'
);
select is((select count(*)::int from app.ask_lookups), 1, 'and creates no second lookup');
select is((pg_temp.begin_('k1', 'v3', false)) ->> 'lookup_id', (select r ->> 'lookup_id' from b1), 'want_live = false still reports an existing lookup');

update app.ask_lookups set status = 'done', result = '{"items": [], "served_from": "live", "citations": []}';
select is((pg_temp.begin_('k1', 'v1') ->> 'verdict'), 'cached', 'a lookup that finished within 24 hours is served from cache');
update app.ask_lookups set created_at = now() - interval '25 hours';
create temp table b1c as select pg_temp.begin_('k1', 'v1') as r;
select is((select r ->> 'verdict' from b1c), 'allow', 'allow: a lookup older than 24 hours is stale, so a new one starts');
select isnt((select r ->> 'lookup_id' from b1c), (select r ->> 'lookup_id' from b1), 'with a new id');

create temp table b2 as select pg_temp.begin_('k2', 'v1') as r;
update app.ask_lookups set created_at = now() - interval '6 minutes' where intent_key = 'k2';
select is((pg_temp.begin_('k2', 'v1') ->> 'verdict'), 'allow', 'allow: a pending lookup older than five minutes no longer blocks a retry');
create temp table b3 as select pg_temp.begin_('k3', 'v1') as r;
update app.ask_lookups set status = 'failed' where intent_key = 'k3';
select is((pg_temp.begin_('k3', 'v1') ->> 'verdict'), 'allow', 'allow: a failed lookup does not block a retry');

-- ---------------------------------------------------------------------------
-- ask_begin: the per-visitor burst limit (10 live lookups in 10 minutes)
-- ---------------------------------------------------------------------------
do $$ begin perform admin_api.governor_set_budget('{"provider": "groq", "budget": 150, "reserved_ask": 40}'::jsonb); end $$;
do $$ begin perform admin_api.governor_set_budget('{"provider": "exa", "budget": 50, "reserved_ask": 40}'::jsonb); end $$;
select is(
  (select count(*)::int from generate_series(1, 10) g where pg_temp.begin_('b' || g, 'burst') ->> 'verdict' = 'allow'),
  10,
  'allow: ten different live lookups from one visitor are allowed'
);
create temp table b11 as select pg_temp.begin_('b11', 'burst') as r;
select results_eq(
  $$select r ->> 'verdict', r -> 'lookup_id', r -> 'usable' from b11$$,
  $$select 'rate_limited', 'null'::jsonb, '{"groq": [], "exa": [], "firecrawl": []}'::jsonb$$,
  'deny: the eleventh within the window is rate_limited, with no lookup and no keys'
);
select is((select count(*)::int from app.ask_lookups where intent_key = 'b11'), 0, 'and nothing was created');
select is((pg_temp.begin_('b11', 'someone-else') ->> 'verdict'), 'allow', 'allow: another visitor is not limited');
select is((pg_temp.begin_('b1', 'burst') ->> 'verdict'), 'cached', 'a limited visitor can still read a cached or coalesced lookup');

-- ---------------------------------------------------------------------------
-- ask_begin: the daily cap is the smaller Ask share of Groq and Exa
-- ---------------------------------------------------------------------------
do $$ begin perform admin_api.governor_set_budget(jsonb_build_object('provider', 'exa', 'budget', 50, 'reserved_ask', pg_temp.lookups_today())); end $$;
select is((pg_temp.begin_('cap-1', 'v-cap') ->> 'verdict'), 'budget_exhausted', 'deny: at the daily cap the verdict is budget_exhausted');
select is((pg_temp.begin_('b1', 'v-cap') ->> 'verdict'), 'cached', 'but an existing lookup is still served');
select is((select count(*)::int from app.ask_lookups where intent_key = 'cap-1'), 0, 'and no lookup was created at the cap');
do $$ begin perform admin_api.governor_set_budget(jsonb_build_object('provider', 'exa', 'budget', 50, 'reserved_ask', pg_temp.lookups_today() + 1)); end $$;
select is((pg_temp.begin_('cap-1', 'v-cap') ->> 'verdict'), 'allow', 'allow: raising the Ask share by one lets one more through');
select is((pg_temp.begin_('cap-2', 'v-cap') ->> 'verdict'), 'budget_exhausted', 'and only one');
do $$ begin perform admin_api.governor_set_budget('{"provider": "exa", "budget": 50, "reserved_ask": 40}'::jsonb); end $$;

-- provider budget, breaker and keys
update app.governor set used = budget where provider = 'groq';
select is((pg_temp.begin_('p-1', 'v-p') ->> 'verdict'), 'budget_exhausted', 'deny: a Groq budget that is used up');
update app.governor set used = 0 where provider = 'groq';
do $$ begin perform admin_api.governor_set_budget('{"provider": "exa", "budget": 50, "breaker_open_until": "2099-01-01T00:00:00Z"}'::jsonb); end $$;
select is((pg_temp.begin_('p-1', 'v-p') ->> 'verdict'), 'budget_exhausted', 'deny: an open Exa breaker');
do $$ begin perform admin_api.governor_set_budget('{"provider": "exa", "budget": 50, "breaker_open_until": null}'::jsonb); end $$;
update app.api_credentials set status = 'disabled', disabled_reason = 'auth' where fingerprint = 'aaaaaaaaaaaa';
select is((pg_temp.begin_('p-1', 'v-p') ->> 'verdict'), 'budget_exhausted', 'deny: no usable Groq key');
update app.api_credentials set status = 'active', disabled_reason = null where fingerprint = 'aaaaaaaaaaaa';
select is((pg_temp.begin_('p-1', 'v-p') ->> 'verdict'), 'allow', 'allow: and everything is back to normal');

-- ---------------------------------------------------------------------------
-- ask_begin: deny (input) and privileges
-- ---------------------------------------------------------------------------
create temp table lookups_before as select count(*)::int as n from app.ask_lookups;
select throws_ok($$select api.ask_begin('[]'::jsonb)$$, '22023', 'mm_invalid: ask_begin: the argument must be a JSON object', 'deny: an array');
select throws_ok($$select api.ask_begin('{"visitor_hmac": "v", "want_live": true}'::jsonb)$$, '22023', 'mm_invalid: ask_begin: intent_key is required', 'deny: no intent_key');
select throws_ok($$select api.ask_begin('{"intent_key": "   ", "visitor_hmac": "v", "want_live": true}'::jsonb)$$, '22023', null, 'deny: a blank intent_key');
select throws_ok(format($$select api.ask_begin(%L::jsonb)$$, jsonb_build_object('intent_key', repeat('k', 201), 'visitor_hmac', 'v', 'want_live', true)::text), '22023', null, 'deny: an intent_key over 200 characters');
select throws_ok($$select api.ask_begin('{"intent_key": "k", "want_live": true}'::jsonb)$$, '22023', 'mm_invalid: ask_begin: visitor_hmac is required', 'deny: no visitor_hmac');
select throws_ok($$select api.ask_begin('{"intent_key": "k", "visitor_hmac": "v", "want_live": "yes"}'::jsonb)$$, '22023', null, 'deny: want_live that is not a boolean');
select throws_ok($$select api.ask_begin('{"intent_key": "k", "visitor_hmac": "v"}'::jsonb)$$, '22023', 'mm_invalid: ask_begin: want_live is required', 'deny: no want_live');
select is((select count(*)::int from app.ask_lookups), (select n from lookups_before), 'rejected calls created no lookup');
select ok(has_function_privilege('anon', 'api.ask_begin(jsonb)', 'execute'), 'allow: anon can execute api.ask_begin');
select ok(not has_function_privilege('authenticated', 'api.ask_begin(jsonb)', 'execute'), 'deny: authenticated cannot execute api.ask_begin');
set local role anon;
select is(api.ask_begin('{"intent_key": "as-anon", "visitor_hmac": "v-anon", "want_live": true}'::jsonb) ->> 'verdict', 'allow', 'allow: a call made as anon succeeds');
reset role;
set local role authenticated;
select throws_ok($$select api.ask_begin('{}'::jsonb)$$, '42501', null, 'deny: authenticated gets insufficient privilege');
reset role;

-- ---------------------------------------------------------------------------
-- ask_result
-- ---------------------------------------------------------------------------
insert into app.ask_lookups (id, intent_key, status, result, created_at) values
  ('60000000-0000-4000-8000-000000000001', 'r-pending', 'pending', null, now()),
  ('60000000-0000-4000-8000-000000000002', 'r-done', 'done', '{"items": [], "served_from": "live", "citations": []}', now() - interval '3 hours'),
  ('60000000-0000-4000-8000-000000000003', 'r-failed', 'failed', null, now()),
  ('60000000-0000-4000-8000-000000000004', 'r-stuck', 'pending', null, now() - interval '11 minutes');
select is(api.ask_result('60000000-0000-4000-8000-000000000001'), '{"status": "pending", "result": null}'::jsonb, 'allow: a pending lookup');
select is(api.ask_result('60000000-0000-4000-8000-000000000002'),
  '{"status": "done", "result": {"items": [], "served_from": "live", "citations": []}}'::jsonb, 'allow: a finished lookup returns its result');
select is(api.ask_result('60000000-0000-4000-8000-000000000003'), '{"status": "failed", "result": null}'::jsonb, 'a failed lookup');
select is(api.ask_result('60000000-0000-4000-8000-000000000004'), '{"status": "failed", "result": null}'::jsonb, 'a lookup still pending after ten minutes is reported as failed, so the page stops polling');
select is(api.ask_result('60000000-0000-4000-8000-0000000000ff'), null::jsonb, 'deny: an unknown id returns null and nothing else');
select is((select count(*)::int from jsonb_object_keys(api.ask_result('60000000-0000-4000-8000-000000000002'))), 2, 'only status and result are exposed (not the intent or the dates)');
select ok(has_function_privilege('anon', 'api.ask_result(uuid)', 'execute'), 'allow: anon can execute api.ask_result');
select ok(not has_function_privilege('authenticated', 'api.ask_result(uuid)', 'execute'), 'deny: authenticated cannot execute api.ask_result');
set local role anon;
select is(api.ask_result('60000000-0000-4000-8000-000000000003') ->> 'status', 'failed', 'allow: a call made as anon succeeds');
reset role;
set local role authenticated;
select throws_ok($$select api.ask_result('60000000-0000-4000-8000-000000000003')$$, '42501', null, 'deny: authenticated gets insufficient privilege');
reset role;

-- ---------------------------------------------------------------------------
-- ask_commit: allow
-- ---------------------------------------------------------------------------
create temp table c_begin as select pg_temp.begin_('commit-1', 'v-commit') as r;
create temp table gov_before as select used from app.governor where provider = 'groq';
create temp table cred_before as select daily_used from app.api_credentials where fingerprint = 'aaaaaaaaaaaa';

select lives_ok(
  format($$select api.ask_commit(pg_temp.commit_(%L::uuid, %L::jsonb))$$,
    (select r ->> 'lookup_id' from c_begin),
    '{"key_outcomes": [{"provider": "groq", "fingerprint": "aaaaaaaaaaaa", "account_label": "acct-groq", "status_code": 200, "outcome": "ok", "retry_after_s": null, "tokens": 900}]}'),
  'allow: a commit with a result and a key outcome');
select results_eq(
  $$select status, result -> 'served_from', jsonb_array_length(result -> 'items') from app.ask_lookups where id = (select (r ->> 'lookup_id')::uuid from c_begin)$$,
  $$select 'done', '"live"'::jsonb, 2$$,
  'the lookup is done and holds the result'
);
select is(
  api.ask_result((select (r ->> 'lookup_id')::uuid from c_begin)) -> 'result' -> 'items' -> 0 ->> 'name',
  'Example Found Kitchen',
  'and ask_result returns it'
);
select is((select daily_used from app.api_credentials where fingerprint = 'aaaaaaaaaaaa'), (select daily_used + 1 from cred_before), 'the key outcome was applied to the key');
select is((select used from app.governor where provider = 'groq'), (select used + 1 from gov_before), 'and counted against the provider budget');

-- settled once
select lives_ok(
  format($$select api.ask_commit(pg_temp.commit_(%L::uuid, %L::jsonb))$$,
    (select r ->> 'lookup_id' from c_begin),
    '{"result": {"items": [], "served_from": "db", "citations": []}, "key_outcomes": [{"provider": "groq", "fingerprint": "aaaaaaaaaaaa", "account_label": "acct-groq", "status_code": 200, "outcome": "ok", "retry_after_s": null, "tokens": 1}]}'),
  'allow: a second commit for the same lookup is accepted and ignored');
select is(
  api.ask_result((select (r ->> 'lookup_id')::uuid from c_begin)) -> 'result' ->> 'served_from',
  'live',
  'the first result stands (a lookup cannot be overwritten)'
);
select is((select daily_used from app.api_credentials where fingerprint = 'aaaaaaaaaaaa'), (select daily_used + 1 from cred_before), 'and the second commit''s key outcomes were not applied');

-- a failed lookup: no result, key outcomes still reported
create temp table c_fail as select pg_temp.begin_('commit-2', 'v-commit') as r;
select lives_ok(
  format($$select api.ask_commit(pg_temp.commit_(%L::uuid, %L::jsonb))$$,
    (select r ->> 'lookup_id' from c_fail),
    '{"result": null, "key_outcomes": [{"provider": "exa", "fingerprint": "111111111111", "account_label": "acct-exa", "status_code": 503, "outcome": "server", "retry_after_s": null, "tokens": null}]}'),
  'allow: a commit with no result marks the lookup failed');
select is((select status from app.ask_lookups where id = (select (r ->> 'lookup_id')::uuid from c_fail)), 'failed', 'the lookup is failed');
select is((select error_count from app.api_credentials where fingerprint = '111111111111'), 1, 'and the provider failure was still reported');

-- the public function never registers a key: an outcome naming a fingerprint nobody registered is ignored
create temp table c_unreg as select pg_temp.begin_('commit-unreg', 'v-commit') as r;
create temp table gov_unreg as select used from app.governor where provider = 'groq';
select lives_ok(
  format($$select api.ask_commit(pg_temp.commit_(%L::uuid, %L::jsonb))$$,
    (select r ->> 'lookup_id' from c_unreg),
    '{"key_outcomes": [{"provider": "groq", "fingerprint": "ffffffffffff", "account_label": "acct-forged", "status_code": 401, "outcome": "auth", "retry_after_s": null, "tokens": null}]}'),
  'allow: a commit whose key outcome names an unregistered fingerprint still settles the lookup');
select is((select status from app.ask_lookups where id = (select (r ->> 'lookup_id')::uuid from c_unreg)), 'done', 'the lookup is done');
select is((select count(*)::int from app.api_credentials where fingerprint = 'ffffffffffff'), 0, 'and a public call did not register the fingerprint');
select is((select used from app.governor where provider = 'groq'), (select used from gov_unreg), 'and the ignored outcome was not counted against the budget');

-- candidates are validated and held, never published from here
create temp table c_cand as select pg_temp.begin_('commit-3', 'v-commit') as r;
select lives_ok(
  format($$select api.ask_commit(pg_temp.commit_(%L::uuid, jsonb_build_object('candidates', jsonb_build_array(pg_temp.cand(), pg_temp.cand('{"name": "Example Second Kitchen", "decision": "publish"}')))))$$,
    (select r ->> 'lookup_id' from c_cand)),
  'allow: a commit with two candidates');
select results_eq(
  $$select level, data ->> 'lookup_id', jsonb_array_length(data -> 'candidates') from app.system_events where kind = 'ask_candidates_received'$$,
  $$select 'info', (select r ->> 'lookup_id' from c_cand), 2$$,
  'the candidates are kept whole in a system event with the lookup id (the audit record)'
);
select is((select count(*)::int from app.businesses), (select n from biz_before), 'and no business was created by the public function');

-- the catalogue writer (T02c) replaces app.ask_apply_candidates; the audit record must not depend on it
select has_function('app', 'ask_apply_candidates', array['uuid', 'jsonb'], 'app.ask_apply_candidates is the seam for the catalogue writer');
create or replace function app.ask_apply_candidates(p_lookup uuid, p_candidates jsonb) returns void language plpgsql as $$ begin null; end; $$;
create temp table c_seam as select pg_temp.begin_('commit-seam', 'v-commit') as r;
select lives_ok(
  format($$select api.ask_commit(pg_temp.commit_(%L::uuid, jsonb_build_object('candidates', jsonb_build_array(pg_temp.cand()))))$$,
    (select r ->> 'lookup_id' from c_seam)),
  'allow: a commit with a candidate while the catalogue writer is replaced');
select is(
  (select count(*)::int from app.system_events where kind = 'ask_candidates_received' and data ->> 'lookup_id' = (select r ->> 'lookup_id' from c_seam)),
  1,
  'the audit record is written by ask_commit itself, so replacing the catalogue writer does not lose it');

-- ---------------------------------------------------------------------------
-- ask_commit: deny
-- ---------------------------------------------------------------------------
create temp table c_deny as select pg_temp.begin_('commit-4', 'v-deny') as r;
create temp table deny_state as
  select (select used from app.governor where provider = 'groq') as used,
         (select daily_used from app.api_credentials where fingerprint = 'aaaaaaaaaaaa') as daily_used,
         (select count(*)::int from app.system_events) as events;

select throws_ok($$select api.ask_commit('[]'::jsonb)$$, '22023', 'mm_invalid: ask_commit: the argument must be a JSON object', 'deny: an array');
select throws_ok($$select api.ask_commit('{"result": null}'::jsonb)$$, '22023', 'mm_invalid: ask_commit: lookup_id is required', 'deny: no lookup_id');
select throws_ok($$select api.ask_commit(pg_temp.commit_('60000000-0000-4000-8000-0000000000ff'))$$, 'P0002', 'mm_not_found: ask_commit: lookup not found', 'deny: an unknown lookup');
select throws_ok(format($$select api.ask_commit(%L::jsonb)$$, (pg_temp.commit_((select (r ->> 'lookup_id')::uuid from c_deny)) || '{"lookup_id": "nope"}')::text), '22023', null, 'deny: a lookup_id that is not a uuid');
select throws_ok(format($$select api.ask_commit(pg_temp.commit_(%L::uuid, '{"result": []}'))$$, (select r ->> 'lookup_id' from c_deny)), '22023', null, 'deny: a result that is not an object');
select throws_ok(
  format($$select api.ask_commit(pg_temp.commit_(%L::uuid, jsonb_build_object('result', jsonb_build_object('items', (select jsonb_agg(pg_temp.commit_(%L::uuid) #> '{result,items,0}') from generate_series(1, 11)), 'served_from', 'live', 'citations', '[]'::jsonb))))$$,
    (select r ->> 'lookup_id' from c_deny), (select r ->> 'lookup_id' from c_deny)),
  '22023', null, 'deny: more than 10 items');
select throws_ok(
  format($$select api.ask_commit(%L::jsonb)$$, jsonb_set(pg_temp.commit_((select (r ->> 'lookup_id')::uuid from c_deny)), '{result,items,0,url}', '"javascript:alert(1)"')::text),
  '22023', 'mm_invalid: ask_commit: result URLs must be http(s) or a path on this site', 'deny: an item URL that is javascript:');
select throws_ok(
  format($$select api.ask_commit(%L::jsonb)$$, jsonb_set(pg_temp.commit_((select (r ->> 'lookup_id')::uuid from c_deny)), '{result,items,0,url}', '"//evil.example/x"')::text),
  '22023', null, 'deny: a protocol-relative item URL');
select throws_ok(
  format($$select api.ask_commit(%L::jsonb)$$, jsonb_set(pg_temp.commit_((select (r ->> 'lookup_id')::uuid from c_deny)), '{result,items,0,sources,0,url}', '"ftp://example.test/x"')::text),
  '22023', null, 'deny: a source URL that is not http(s)');
select throws_ok(
  format($$select api.ask_commit(%L::jsonb)$$, jsonb_set(pg_temp.commit_((select (r ->> 'lookup_id')::uuid from c_deny)), '{result,citations,0,url}', '"data:text/html,x"')::text),
  '22023', null, 'deny: a citation URL that is not http(s)');
select throws_ok(
  format($$select api.ask_commit(%L::jsonb)$$, jsonb_set(pg_temp.commit_((select (r ->> 'lookup_id')::uuid from c_deny)), '{result,items,0,name}', '""')::text),
  '22023', null, 'deny: an item without a name');
select throws_ok(
  format($$select api.ask_commit(%L::jsonb)$$, jsonb_set(pg_temp.commit_((select (r ->> 'lookup_id')::uuid from c_deny)), '{result,served_from}', '"cache"')::text),
  '22023', null, 'deny: served_from outside db and live');
select throws_ok(
  format($$select api.ask_commit(%L::jsonb)$$, jsonb_set(pg_temp.commit_((select (r ->> 'lookup_id')::uuid from c_deny)), '{result,items,0,summary}', to_jsonb(repeat('s', 70000)))::text),
  '22023', 'mm_invalid: ask_commit: the payload is larger than 64 KB', 'deny: a payload over 64 KB');
select throws_ok(
  format($$select api.ask_commit(pg_temp.commit_(%L::uuid, %L::jsonb))$$, (select r ->> 'lookup_id' from c_deny),
    '{"key_outcomes": [{"provider": "groq", "fingerprint": "aaaaaaaaaaaa", "account_label": "acct-groq", "status_code": 200, "outcome": "ok", "retry_after_s": null, "tokens": 1},
                      {"provider": "groq", "fingerprint": "aaaaaaaaaaaa", "account_label": "acct-groq", "status_code": 200, "outcome": "bogus", "retry_after_s": null, "tokens": 1}]}'),
  '22023', null, 'deny: one invalid key outcome rejects the whole commit');
select throws_ok(format($$select api.ask_commit(pg_temp.commit_(%L::uuid, jsonb_build_object('candidates', jsonb_build_array(pg_temp.cand('{"decision": "maybe"}')))))$$, (select r ->> 'lookup_id' from c_deny)), '22023', null, 'deny: a candidate decision outside publish and queue');
select throws_ok(format($$select api.ask_commit(pg_temp.commit_(%L::uuid, jsonb_build_object('candidates', jsonb_build_array(pg_temp.cand('{"kind": "cafe"}')))))$$, (select r ->> 'lookup_id' from c_deny)), '22023', null, 'deny: a candidate kind outside restaurant and provider');
select throws_ok(format($$select api.ask_commit(pg_temp.commit_(%L::uuid, jsonb_build_object('candidates', jsonb_build_array(pg_temp.cand('{"actor": "admin"}')))))$$, (select r ->> 'lookup_id' from c_deny)), '22023', 'mm_invalid: ask_commit: candidates[0].actor must be ask', 'deny: a candidate that claims another actor');
select throws_ok(format($$select api.ask_commit(pg_temp.commit_(%L::uuid, jsonb_build_object('candidates', jsonb_build_array(pg_temp.cand('{"evidence": {}}')))))$$, (select r ->> 'lookup_id' from c_deny)), '22023', null, 'deny: candidate evidence that is not an array');
select throws_ok(format($$select api.ask_commit(pg_temp.commit_(%L::uuid, jsonb_build_object('candidates', jsonb_build_array(pg_temp.cand('{"name": ""}')))))$$, (select r ->> 'lookup_id' from c_deny)), '22023', null, 'deny: a candidate without a name');
select throws_ok(
  format($$select api.ask_commit(pg_temp.commit_(%L::uuid, jsonb_build_object('candidates', (select jsonb_agg(pg_temp.cand()) from generate_series(1, 11)))))$$, (select r ->> 'lookup_id' from c_deny)),
  '22023', null, 'deny: more than 10 candidates');

select results_eq(
  $$select status, result is null from app.ask_lookups where id = (select (r ->> 'lookup_id')::uuid from c_deny)$$,
  $$values ('pending', true)$$,
  'after all the rejected commits the lookup is still pending and empty'
);
select results_eq(
  $$select (select used from app.governor where provider = 'groq'),
           (select daily_used from app.api_credentials where fingerprint = 'aaaaaaaaaaaa'),
           (select count(*)::int from app.system_events)$$,
  $$select used, daily_used, events from deny_state$$,
  'and they applied no key outcome and wrote no event'
);
select ok(has_function_privilege('anon', 'api.ask_commit(jsonb)', 'execute'), 'allow: anon can execute api.ask_commit');
select ok(not has_function_privilege('authenticated', 'api.ask_commit(jsonb)', 'execute'), 'deny: authenticated cannot execute api.ask_commit');
do $$ begin perform set_config('t.commit', pg_temp.commit_((select id from app.ask_lookups where intent_key = 'commit-4'))::text, true); end $$;
set local role anon;
select lives_ok($$select api.ask_commit(current_setting('t.commit')::jsonb)$$, 'allow: a commit made as anon succeeds');
reset role;
select is((select status from app.ask_lookups where intent_key = 'commit-4'), 'done', 'and settled the lookup');
set local role authenticated;
select throws_ok($$select api.ask_commit('{}'::jsonb)$$, '42501', null, 'deny: authenticated gets insufficient privilege');
reset role;

select is((select count(*)::int from app.observations), (select n from obs_before), 'none of the three functions writes observations');

select * from finish();
rollback;
