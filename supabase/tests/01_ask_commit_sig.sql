-- T02b fix round 1: api.ask_commit is signed (CONTRACTS section 5, amended 2026-10-19; plan section 10).
-- commit_sig = hex(HMAC-SHA256(ASK_COMMIT_SECRET, lookup_id)). The secret is stored in app by
-- admin_api.ask_secret_set (secret key only) and never returned. A missing or wrong signature, or an unset
-- secret, is rejected with mm_invalid (22023) BEFORE any key, governor, lookup or catalogue row is touched, so
-- a holder of the publishable key cannot cool or disable API keys, spend the budget, poison a pending result
-- or inject candidates.
begin;
select plan(65);

-- ---------------------------------------------------------------------------
-- helpers (the body is built as postgres, then sent as the role under test)
-- ---------------------------------------------------------------------------
create function pg_temp.sig(id uuid, secret text default 'example-ask-commit-secret-not-real-0001') returns text
language sql as $$
  select encode(extensions.hmac(id::text, secret, 'sha256'), 'hex');
$$;

create function pg_temp.pi(intent_key text) returns jsonb language sql as $$
  select jsonb_build_object(
    'vertical', 'food', 'subject_id', 'chicken-biryani', 'craving', null, 'locality_id', 'baner',
    'budget_inr', null, 'diet', null, 'open_now', false, 'intent_key', intent_key, 'confidence', 0.9);
$$;

create function pg_temp.begin_(intent text, hmac text default 'v1') returns uuid language sql as $$
  select (api.ask_begin(jsonb_build_object('intent', pg_temp.pi(intent), 'intent_key', intent, 'visitor_hmac', hmac, 'want_live', true)) ->> 'lookup_id')::uuid;
$$;

-- A valid, correctly signed body; 'over' replaces keys (shallow). Take the signature out or replace it with ||/-.
create function pg_temp.commit_(id uuid, over jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object(
    'lookup_id', id,
    'commit_sig', pg_temp.sig(id),
    'result', $j${
      "items": [
        { "entity_id": null, "name": "Example Found Kitchen", "locality_id": "baner", "url": "https://example.test/found",
          "summary": "Found on the web just now", "price_inr": 150, "labels": [], "trust": [],
          "sources": [{ "url": "https://example.test/found", "title": "Example page", "retrieved_at": "2026-10-13T08:00:00Z" }],
          "unverified": true }
      ],
      "served_from": "live",
      "citations": [{ "url": "https://example.test/found", "title": "Example page", "retrieved_at": "2026-10-13T08:00:00Z" }]
    }$j$::jsonb,
    'key_outcomes', '[]'::jsonb,
    'candidates', '[]'::jsonb) || over;
$$;

-- What a forger would send: the most damaging body, a disabling outcome for a registered key plus a candidate.
create function pg_temp.forged(id uuid) returns jsonb language sql as $$
  select pg_temp.commit_(id, $j${
    "key_outcomes": [{"provider": "groq", "fingerprint": "aaaaaaaaaaaa", "account_label": "acct-groq", "status_code": 401, "outcome": "auth", "retry_after_s": null, "tokens": null}],
    "candidates": [{"kind": "restaurant", "name": "Example Forged Kitchen", "locality_id": "baner", "address": null, "geo": null, "phone": null,
                    "website": "https://example.test/forged", "chain_hint": null, "branch_key": null, "status": "candidate", "auto_published": false,
                    "restaurant": null, "provider": null, "actor": "ask", "evidence": [], "decision": "publish"}]
  }$j$::jsonb);
$$;

-- Everything a commit could change, so a rejected commit can be shown to have changed none of it.
create function pg_temp.state() returns jsonb language sql as $$
  select jsonb_build_object(
    'governor', (select coalesce(jsonb_agg(to_jsonb(g) order by g.provider), '[]') from app.governor g),
    'credentials', (select coalesce(jsonb_agg(to_jsonb(c) order by c.fingerprint), '[]') from app.api_credentials c),
    'lookups', (select coalesce(jsonb_agg(to_jsonb(l) order by l.id), '[]') from app.ask_lookups l),
    'queries', (select coalesce(jsonb_agg(to_jsonb(q) order by q.id), '[]') from app.queries q),
    'events', (select count(*) from app.system_events),
    'businesses', (select count(*) from app.businesses));
$$;

do $$ begin perform admin_api.governor_set_budget('{"provider": "groq", "budget": 150, "reserved_ask": 50}'::jsonb); end $$;
do $$ begin perform admin_api.governor_set_budget('{"provider": "exa", "budget": 50, "reserved_ask": 50}'::jsonb); end $$;
insert into app.api_credentials (fingerprint, provider, account_label) values
  ('aaaaaaaaaaaa', 'groq', 'acct-groq'), ('111111111111', 'exa', 'acct-exa');

-- ---------------------------------------------------------------------------
-- No secret yet: ask_commit fails closed
-- ---------------------------------------------------------------------------
select is((select count(*)::int from app.ask_secret), 0, 'no commit secret is stored before the deploy step sets it');
create temp table l0 as select pg_temp.begin_('sig-nosecret') as id;
create temp table st_nosecret as select pg_temp.state() as s;
select throws_ok(
  format($$select api.ask_commit(%L::jsonb)$$, pg_temp.commit_((select id from l0))::text),
  '22023', 'mm_invalid: ask_commit: commit_sig is not valid',
  'deny: with no secret configured even a well-formed signature is rejected (fails closed)');
select is(pg_temp.state(), (select s from st_nosecret), 'and nothing changed: the lookup is still pending and no key, budget or event moved');

-- ---------------------------------------------------------------------------
-- admin_api.ask_secret_set
-- ---------------------------------------------------------------------------
select is(
  admin_api.ask_secret_set('example-ask-commit-secret-not-real-0001'),
  '{"rotated": false}'::jsonb,
  'allow: the first call stores the secret and reports that nothing was replaced');
select is((select count(*)::int from app.ask_secret), 1, 'and exactly one secret is stored');
select ok(
  not (admin_api.ask_secret_set('example-ask-commit-secret-not-real-0001')::text like '%example-ask-commit-secret%'),
  'the answer never contains the secret');
select is(
  admin_api.ask_secret_set('example-ask-commit-secret-not-real-0001') ->> 'rotated', 'true',
  'allow: setting it again reports a rotation');
select is((select count(*)::int from app.ask_secret), 1, 'and still exactly one secret is stored');
select is(
  (select count(*)::int from app.system_events where kind = 'ask_secret_set'), 3,
  'every successful call is audited in a system event (the three calls so far)');
select is(
  (select count(*)::int from app.system_events where message like '%example-ask-commit-secret%' or data::text like '%example-ask-commit-secret%'),
  0,
  'and no event holds the secret');
select ok(
  (select not bool_or(has_table_privilege(r, 'app.ask_secret', 'select, insert, update, delete')
                      or has_any_column_privilege(r, 'app.ask_secret', 'select, insert, update'))
     from unnest(array['anon', 'authenticated', 'service_role']) as r),
  'no API role can read or write the stored secret directly');

select throws_ok($$select admin_api.ask_secret_set(null)$$, '22023', 'mm_invalid: ask_secret_set: secret is required', 'deny: a null secret');
select throws_ok($$select admin_api.ask_secret_set('')$$, '22023', 'mm_invalid: ask_secret_set: secret is required', 'deny: an empty secret');
select throws_ok(format($$select admin_api.ask_secret_set(%L)$$, repeat('s', 31)), '22023', 'mm_invalid: ask_secret_set: secret must be 32 to 256 characters', 'deny: a secret of 31 characters');
select throws_ok(format($$select admin_api.ask_secret_set(%L)$$, repeat('s', 257)), '22023', 'mm_invalid: ask_secret_set: secret must be 32 to 256 characters', 'deny: a secret of 257 characters');
select lives_ok(format($$select admin_api.ask_secret_set(%L)$$, repeat('s', 32)), 'allow: a secret of exactly 32 characters');
select lives_ok(format($$select admin_api.ask_secret_set(%L)$$, repeat('s', 256)), 'allow: a secret of exactly 256 characters');
select throws_ok(format($$select admin_api.ask_secret_set(%L)$$, ' ' || repeat('s', 40)), '22023', 'mm_invalid: ask_secret_set: secret must not start or end with whitespace', 'deny: a leading space');
select throws_ok(format($$select admin_api.ask_secret_set(%L)$$, repeat('s', 40) || E'\n'), '22023', 'mm_invalid: ask_secret_set: secret must not start or end with whitespace', 'deny: a trailing newline (the usual paste mistake)');
select lives_ok($$select admin_api.ask_secret_set('example-ask-commit-secret-not-real-0001')$$, 'allow: back to the test secret');

select ok(has_function_privilege('service_role', 'admin_api.ask_secret_set(text)', 'execute'), 'allow: service_role can execute admin_api.ask_secret_set');
select ok(not has_function_privilege('anon', 'admin_api.ask_secret_set(text)', 'execute'), 'deny: anon cannot execute admin_api.ask_secret_set');
select ok(not has_function_privilege('authenticated', 'admin_api.ask_secret_set(text)', 'execute'), 'deny: authenticated cannot execute admin_api.ask_secret_set');
set local role anon;
select throws_ok($$select admin_api.ask_secret_set('example-anon-must-not-set-this-secret-1')$$, '42501', null, 'deny: anon gets insufficient privilege');
reset role;
set local role authenticated;
select throws_ok($$select admin_api.ask_secret_set('example-user-must-not-set-this-secret-1')$$, '42501', null, 'deny: authenticated gets insufficient privilege');
reset role;
set local role service_role;
select is(admin_api.ask_secret_set('example-ask-commit-secret-not-real-0001') ->> 'rotated', 'true', 'allow: a call made as service_role succeeds');
reset role;
-- all the refused calls above left the stored secret alone: the test secret still signs
select lives_ok(
  format($$select api.ask_commit(%L::jsonb)$$, pg_temp.commit_((select id from l0))::text),
  'the secret is still the test secret after the refused calls: a commit signed with it is accepted');
select is((select status from app.ask_lookups where id = (select id from l0)), 'done', 'and it settled the lookup');

-- ---------------------------------------------------------------------------
-- ask_commit: a bad signature changes nothing
-- ---------------------------------------------------------------------------
create temp table l1 as select pg_temp.begin_('sig-1', 'v-sig') as id;
create temp table l2 as select pg_temp.begin_('sig-2', 'v-sig') as id;
create temp table st1 as select pg_temp.state() as s;

select throws_ok(
  format($$select api.ask_commit(%L::jsonb)$$, (pg_temp.forged((select id from l1)) - 'commit_sig')::text),
  '22023', 'mm_invalid: ask_commit: commit_sig is required', 'deny: no signature');
select throws_ok(
  format($$select api.ask_commit(%L::jsonb)$$, (pg_temp.forged((select id from l1)) || '{"commit_sig": null}')::text),
  '22023', 'mm_invalid: ask_commit: commit_sig is required', 'deny: a null signature');
select throws_ok(
  format($$select api.ask_commit(%L::jsonb)$$, (pg_temp.forged((select id from l1)) || '{"commit_sig": "   "}')::text),
  '22023', 'mm_invalid: ask_commit: commit_sig must not be empty', 'deny: a blank signature');
select throws_ok(
  format($$select api.ask_commit(%L::jsonb)$$, (pg_temp.forged((select id from l1)) || '{"commit_sig": 12345}')::text),
  '22023', 'mm_invalid: ask_commit: commit_sig must be a string', 'deny: a signature that is not a string');
select throws_ok(
  format($$select api.ask_commit(%L::jsonb)$$, (pg_temp.forged((select id from l1)) || jsonb_build_object('commit_sig', repeat('a', 65)))::text),
  '22023', 'mm_invalid: ask_commit: commit_sig is longer than 64 characters', 'deny: a signature of 65 characters');
select throws_ok(
  format($$select api.ask_commit(%L::jsonb)$$, (pg_temp.forged((select id from l1)) || jsonb_build_object('commit_sig', repeat('0', 64)))::text),
  '22023', 'mm_invalid: ask_commit: commit_sig is not valid', 'deny: a wrong signature');
select throws_ok(
  format($$select api.ask_commit(%L::jsonb)$$, (pg_temp.forged((select id from l1)) || jsonb_build_object('commit_sig', left(pg_temp.sig((select id from l1)), 63)))::text),
  '22023', 'mm_invalid: ask_commit: commit_sig is not valid', 'deny: a valid signature cut short by one character');
select throws_ok(
  format($$select api.ask_commit(%L::jsonb)$$, (pg_temp.forged((select id from l1)) || jsonb_build_object('commit_sig', repeat('z', 64)))::text),
  '22023', 'mm_invalid: ask_commit: commit_sig is not valid', 'deny: a signature of the right length that is not hex');
select throws_ok(
  format($$select api.ask_commit(%L::jsonb)$$, (pg_temp.forged((select id from l1)) || jsonb_build_object('commit_sig', pg_temp.sig((select id from l2))))::text),
  '22023', 'mm_invalid: ask_commit: commit_sig is not valid', 'deny: the signature of another lookup id');
select throws_ok(
  format($$select api.ask_commit(%L::jsonb)$$, (pg_temp.forged((select id from l1)) || jsonb_build_object('commit_sig', pg_temp.sig((select id from l1), 'example-another-secret-not-real-000002')))::text),
  '22023', 'mm_invalid: ask_commit: commit_sig is not valid', 'deny: a signature made with another secret');
select throws_ok(
  format($$select api.ask_commit(%L::jsonb)$$, (pg_temp.forged((select id from l1)) || jsonb_build_object('commit_sig', pg_temp.sig((select id from l1), 'example-ask-commit-secret-not-real-0001 ')))::text),
  '22023', 'mm_invalid: ask_commit: commit_sig is not valid', 'deny: a signature made with the secret plus a trailing space');
select throws_ok(
  format($$select api.ask_commit(%L::jsonb)$$, (pg_temp.forged((select id from l1)) || jsonb_build_object('lookup_id', (select id from l2)))::text),
  '22023', 'mm_invalid: ask_commit: commit_sig is not valid', 'deny: a valid signature moved onto another lookup id');
select throws_ok(
  format($$select api.ask_commit(%L::jsonb)$$, (pg_temp.forged('60000000-0000-4000-8000-0000000000ff') || jsonb_build_object('commit_sig', repeat('0', 64)))::text),
  '22023', 'mm_invalid: ask_commit: commit_sig is not valid', 'deny: an unknown lookup with a wrong signature is "not valid", never "not found" (no probing for ids)');
select throws_ok(
  format($$select api.ask_commit(%L::jsonb)$$, (pg_temp.forged((select id from l1)) || '{"commit_sig": "0000", "result": "nonsense"}')::text),
  '22023', 'mm_invalid: ask_commit: commit_sig is not valid', 'deny: the signature is checked before the rest of the body');
select throws_ok(
  format($$select api.ask_commit(%L::jsonb)$$, (pg_temp.forged((select id from l1)) - 'commit_sig' - 'lookup_id')::text),
  '22023', 'mm_invalid: ask_commit: lookup_id is required', 'deny: no lookup id');

select is(
  pg_temp.state(), (select s from st1),
  'none of the rejected commits changed anything: lookups, queries, api_credentials, governor, events and businesses are as before');
select results_eq(
  $$select status, disabled_reason, error_count, daily_used from app.api_credentials where fingerprint = 'aaaaaaaaaaaa'$$,
  $$values ('active', null, 0, 0)$$,
  'in particular the forged auth outcome did not disable the registered Groq key');
select results_eq(
  $$select used from app.governor where provider = 'groq'$$,
  $$values (0)$$,
  'nor spend any of the Groq budget');
select results_eq(
  $$select status, result is null from app.ask_lookups where id = (select id from l1)$$,
  $$values ('pending', true)$$,
  'nor settle or poison the pending lookup');

-- the real commit still works afterwards, and the first signed commit wins
select lives_ok(
  format($$select api.ask_commit(%L::jsonb)$$, pg_temp.commit_((select id from l1), '{"key_outcomes": [{"provider": "groq", "fingerprint": "aaaaaaaaaaaa", "account_label": "acct-groq", "status_code": 200, "outcome": "ok", "retry_after_s": null, "tokens": 900}]}')::text),
  'allow: after the forged attempts the lookup''s real commit is accepted');
select results_eq(
  $$select status, result -> 'items' -> 0 ->> 'name' from app.ask_lookups where id = (select id from l1)$$,
  $$values ('done', 'Example Found Kitchen')$$,
  'and the stored result is the real one');
select results_eq(
  $$select (select used from app.governor where provider = 'groq'), (select daily_used from app.api_credentials where fingerprint = 'aaaaaaaaaaaa')$$,
  $$values (1, 1)$$,
  'and its key outcome was applied');

-- a correctly signed commit for a lookup that is already settled changes nothing
create temp table st2 as select pg_temp.state() as s;
select lives_ok(
  format($$select api.ask_commit(%L::jsonb)$$, pg_temp.forged((select id from l1))::text),
  'allow: a second signed commit for a settled lookup is accepted and ignored (even with a disabling outcome)');
select is(pg_temp.state(), (select s from st2), 'and changes nothing');

-- the signature is case-insensitive hex
select lives_ok(
  format($$select api.ask_commit(%L::jsonb)$$, (pg_temp.commit_((select id from l2)) || jsonb_build_object('commit_sig', upper(pg_temp.sig((select id from l2)))))::text),
  'allow: the same signature in upper case hex is accepted');
select is((select status from app.ask_lookups where id = (select id from l2)), 'done', 'and settled the lookup');

-- a signed commit with an unknown lookup is not found (the signature was fine)
select throws_ok(
  format($$select api.ask_commit(%L::jsonb)$$, pg_temp.commit_('60000000-0000-4000-8000-0000000000ff')::text),
  'P0002', 'mm_not_found: ask_commit: lookup not found', 'deny: a correctly signed commit for an unknown lookup is not found');

-- a signed but invalid body is still rejected by the validation behind the signature
select throws_ok(
  format($$select api.ask_commit(%L::jsonb)$$, jsonb_set(pg_temp.commit_((select id from l0)), '{result,items,0,url}', '"javascript:alert(1)"')::text),
  '22023', 'mm_invalid: ask_commit: result URLs must be http(s) or a path on this site', 'deny: a correctly signed commit with a javascript: URL is still rejected');

-- ---------------------------------------------------------------------------
-- rotation: the old secret stops working at once, the new one works
-- ---------------------------------------------------------------------------
create temp table l3 as select pg_temp.begin_('sig-3', 'v-sig') as id;
select lives_ok($$select admin_api.ask_secret_set('example-rotated-secret-not-real-0000002')$$, 'allow: rotate the secret');
select throws_ok(
  format($$select api.ask_commit(%L::jsonb)$$, pg_temp.commit_((select id from l3))::text),
  '22023', 'mm_invalid: ask_commit: commit_sig is not valid', 'deny: a signature made with the old secret no longer works');
select lives_ok(
  format($$select api.ask_commit(%L::jsonb)$$, (pg_temp.commit_((select id from l3)) || jsonb_build_object('commit_sig', pg_temp.sig((select id from l3), 'example-rotated-secret-not-real-0000002')))::text),
  'allow: a signature made with the new secret works');
select is((select status from app.ask_lookups where id = (select id from l3)), 'done', 'and settled the lookup');

-- ---------------------------------------------------------------------------
-- the public roles
-- ---------------------------------------------------------------------------
do $$ begin perform admin_api.ask_secret_set('example-ask-commit-secret-not-real-0001'); end $$;
create temp table l4 as select pg_temp.begin_('sig-4', 'v-sig') as id;
do $$ begin perform set_config('t.good', pg_temp.commit_((select id from l4))::text, true); end $$;
do $$ begin perform set_config('t.bad', (pg_temp.forged((select id from l4)) || jsonb_build_object('commit_sig', repeat('0', 64)))::text, true); end $$;
create temp table st4 as select pg_temp.state() as s;
set local role anon;
select throws_ok($$select api.ask_commit(current_setting('t.bad')::jsonb)$$, '22023', 'mm_invalid: ask_commit: commit_sig is not valid', 'deny: anon with a wrong signature is rejected');
reset role;
select is(pg_temp.state(), (select s from st4), 'and nothing changed');
set local role anon;
select lives_ok($$select api.ask_commit(current_setting('t.good')::jsonb)$$, 'allow: anon with the right signature succeeds');
reset role;
select is((select status from app.ask_lookups where id = (select id from l4)), 'done', 'and settled the lookup');
set local role authenticated;
select throws_ok($$select api.ask_commit(current_setting('t.good')::jsonb)$$, '42501', null, 'deny: authenticated gets insufficient privilege, signature or not');
reset role;

select * from finish();
rollback;
