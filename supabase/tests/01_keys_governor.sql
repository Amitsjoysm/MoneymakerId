-- T02b: admin_api.governor_set_budget, key_report and credentials_usable (CONTRACTS section 5, plan section 10).
-- The secret key reaches these through service_role only. Keys are known by a 12-character fingerprint,
-- never by the key itself. 22023 = invalid input (mm_invalid), 42501 = insufficient privilege.
begin;
select plan(115);

create function pg_temp.today() returns date language sql as $$ select (now() at time zone 'Asia/Kolkata')::date; $$;

-- One KeyOutcome; 'over' replaces keys (shallow)
create function pg_temp.ko(provider text, fp text, outcome text, over jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object('provider', provider, 'fingerprint', fp, 'account_label', 'acct-' || provider,
                            'status_code', null, 'outcome', outcome, 'retry_after_s', null, 'tokens', null) || over;
$$;

create function pg_temp.report(variadic outcomes jsonb[]) returns jsonb language sql as $$
  select admin_api.key_report(to_jsonb(outcomes));
$$;

-- the usable fingerprints in a fixed order, for cases where the order is not the point
create function pg_temp.usable(p_provider text) returns text[] language sql as $$
  select coalesce(array_agg(f order by f), '{}') from unnest(admin_api.credentials_usable(p_provider)) as f;
$$;

create temp table obs_before as select count(*)::int as n from app.observations;

-- ---------------------------------------------------------------------------
-- governor_set_budget: allow
-- ---------------------------------------------------------------------------
create temp table gb1 as select admin_api.governor_set_budget('{"provider": "groq", "budget": 150, "reserved_ask": 50}'::jsonb) as r;
select results_eq(
  $$select r ->> 'day', r ->> 'provider', (r ->> 'budget')::int, (r ->> 'used')::int, (r ->> 'reserved_ask')::int, r -> 'breaker_open_until' from gb1$$,
  $$select pg_temp.today()::text, 'groq', 150, 0, 50, 'null'::jsonb$$,
  'allow: setting a budget returns today''s governor row'
);
select results_eq(
  $$select day, provider, budget, used, reserved_ask, breaker_open_until from app.governor$$,
  $$values (pg_temp.today(), 'groq', 150, 0, 50, null::timestamptz)$$,
  'and the row is stored for today (IST)'
);
select lives_ok($$select admin_api.governor_set_budget('{"provider": "groq", "budget": 200}'::jsonb)$$, 'allow: raising only the budget');
select results_eq(
  $$select budget, reserved_ask from app.governor where provider = 'groq'$$,
  $$values (200, 50)$$,
  'the reserved Ask share is kept when it is not sent'
);
select lives_ok($$select admin_api.governor_set_budget('{"provider": "groq", "budget": 150, "reserved_ask": 50}'::jsonb)$$, 'allow: back to 150');
select lives_ok($$select admin_api.governor_set_budget('{"provider": "exa", "budget": 20, "reserved_ask": 5}'::jsonb)$$, 'allow: an Exa budget');
select is(
  (select count(*)::int from app.system_events where kind = 'governor_budget_set'),
  4,
  'every change is audited as a governor_budget_set system event'
);
select lives_ok(
  $$select admin_api.governor_set_budget('{"provider": "exa", "budget": 20, "breaker_open_until": "2099-01-01T00:00:00Z"}'::jsonb)$$,
  'allow: opening the breaker by hand');
select is((select breaker_open_until from app.governor where provider = 'exa'), '2099-01-01T00:00:00Z'::timestamptz, 'the breaker time is stored');
select lives_ok(
  $$select admin_api.governor_set_budget('{"provider": "exa", "budget": 20, "breaker_open_until": null}'::jsonb)$$,
  'allow: closing the breaker with null');
select is((select breaker_open_until from app.governor where provider = 'exa'), null::timestamptz, 'the breaker is closed');
select is((select reserved_ask from app.governor where provider = 'exa'), 5, 'and the Exa Ask share survived');
select lives_ok($$select admin_api.governor_set_budget('{"provider": "firecrawl", "budget": 30}'::jsonb)$$, 'allow: a first budget sent without an Ask share');
select is((select reserved_ask from app.governor where provider = 'firecrawl'), 0, 'a provider''s first budget starts with no Ask share');
delete from app.governor where provider = 'firecrawl';

-- a new day starts from the latest budget (carry forward)
insert into app.governor (day, provider, budget, used, reserved_ask)
values (pg_temp.today() - 1, 'firecrawl', 30, 17, 3);
select results_eq(
  $$select (g).budget, (g).used, (g).reserved_ask, (g).day from (select app.governor_today('firecrawl') as g) x$$,
  $$select 30, 0, 3, pg_temp.today()$$,
  'a day without a row starts from the latest earlier day: same budget and share, used back to 0'
);
delete from app.governor where provider = 'firecrawl';
select is((app.governor_today('firecrawl')).day, null::date, 'with no earlier row there is no budget, and so no row');

-- ---------------------------------------------------------------------------
-- governor_set_budget: deny
-- ---------------------------------------------------------------------------
select throws_ok($$select admin_api.governor_set_budget('[]'::jsonb)$$, '22023', 'mm_invalid: governor_set_budget: the argument must be a JSON object', 'deny: an array');
select throws_ok($$select admin_api.governor_set_budget('{"provider": "openai", "budget": 10}'::jsonb)$$, '22023', null, 'deny: an unknown provider');
select throws_ok($$select admin_api.governor_set_budget('{"provider": "groq"}'::jsonb)$$, '22023', 'mm_invalid: governor_set_budget: budget is required', 'deny: no budget');
select throws_ok($$select admin_api.governor_set_budget('{"provider": "groq", "budget": -1}'::jsonb)$$, '22023', null, 'deny: a negative budget');
select throws_ok($$select admin_api.governor_set_budget('{"provider": "groq", "budget": 10.5}'::jsonb)$$, '22023', null, 'deny: a fractional budget');
select throws_ok($$select admin_api.governor_set_budget('{"provider": "groq", "budget": "150"}'::jsonb)$$, '22023', null, 'deny: a budget sent as a string');
select throws_ok(
  $$select admin_api.governor_set_budget('{"provider": "groq", "budget": 40, "reserved_ask": 50}'::jsonb)$$,
  '22023', 'mm_invalid: governor_set_budget: reserved_ask cannot exceed budget', 'deny: an Ask share larger than the budget');
select throws_ok(
  $$select admin_api.governor_set_budget('{"provider": "groq", "budget": 40}'::jsonb)$$,
  '22023', 'mm_invalid: governor_set_budget: reserved_ask cannot exceed budget', 'deny: lowering the budget below the existing Ask share');
select throws_ok($$select admin_api.governor_set_budget('{"provider": "groq", "budget": 150, "breaker_open_until": "tomorrow-ish"}'::jsonb)$$, '22023', null, 'deny: a breaker time that is not a timestamp');
select is((select budget from app.governor where provider = 'groq'), 150, 'rejected calls changed nothing');

-- ---------------------------------------------------------------------------
-- key_report: an ok outcome registers a key and counts the call
-- ---------------------------------------------------------------------------
create temp table kr1 as select pg_temp.report(pg_temp.ko('groq', 'aaaaaaaaaaaa', 'ok')) as r;
select results_eq(
  $$select r -> 'applied', r -> 'disabled', r -> 'breakers_opened' from kr1$$,
  $$select '1'::jsonb, '[]'::jsonb, '[]'::jsonb$$,
  'allow: key_report returns a summary (applied count, keys disabled, breakers opened)'
);
select results_eq(
  $$select provider, account_label, status, daily_used, error_count, day, cooldown_until, disabled_reason, last_used_at is not null
      from app.api_credentials where fingerprint = 'aaaaaaaaaaaa'$$,
  $$values ('groq', 'acct-groq', 'active', 1, 0, pg_temp.today(), null::timestamptz, null::text, true)$$,
  'an unknown fingerprint is registered as active with one call used today'
);
select is((select used from app.governor where provider = 'groq'), 1, 'and the provider''s used count for the day goes up');
select lives_ok($$select pg_temp.report(pg_temp.ko('groq', 'aaaaaaaaaaaa', 'ok'), pg_temp.ko('groq', 'bbbbbbbbbbbb', 'ok'))$$, 'allow: several outcomes in one call');
select results_eq(
  $$select fingerprint, daily_used from app.api_credentials where provider = 'groq' order by fingerprint$$,
  $$values ('aaaaaaaaaaaa', 2), ('bbbbbbbbbbbb', 1)$$,
  'each outcome counts one call for its key'
);
select is((select used from app.governor where provider = 'groq'), 3, 'and one for the provider');
select is(admin_api.credentials_usable('groq'), array['bbbbbbbbbbbb', 'aaaaaaaaaaaa'], 'credentials_usable lists active keys, least used first');
select is(admin_api.credentials_usable('exa'), array[]::text[], 'allow: a provider with a budget but no keys gets an empty list');

-- rate limited: cooling for Retry-After
select lives_ok($$select pg_temp.report(pg_temp.ko('groq', 'aaaaaaaaaaaa', 'rate_limited', '{"status_code": 429, "retry_after_s": 120}'))$$, 'allow: a 429 with Retry-After');
select results_eq(
  $$select status, cooldown_until, daily_used from app.api_credentials where fingerprint = 'aaaaaaaaaaaa'$$,
  $$select 'cooling', now() + interval '120 seconds', 3$$,
  'the key cools down for Retry-After seconds'
);
select is(admin_api.credentials_usable('groq'), array['bbbbbbbbbbbb'], 'and is not usable meanwhile');
update app.api_credentials set cooldown_until = now() - interval '1 second' where fingerprint = 'aaaaaaaaaaaa';
select is(admin_api.credentials_usable('groq'), array['bbbbbbbbbbbb', 'aaaaaaaaaaaa'], 'a key whose cooldown has passed is usable again');
select lives_ok($$select pg_temp.report(pg_temp.ko('groq', 'aaaaaaaaaaaa', 'ok'))$$, 'allow: an ok after the cooldown');
select results_eq(
  $$select status, cooldown_until from app.api_credentials where fingerprint = 'aaaaaaaaaaaa'$$,
  $$values ('active', null::timestamptz)$$,
  'puts the key back to active'
);
select lives_ok($$select pg_temp.report(pg_temp.ko('groq', 'bbbbbbbbbbbb', 'rate_limited'))$$, 'allow: a 429 without Retry-After');
select is((select cooldown_until from app.api_credentials where fingerprint = 'bbbbbbbbbbbb'), now() + interval '60 seconds', 'defaults to a 60 second cooldown');
select lives_ok($$select pg_temp.report(pg_temp.ko('groq', 'cccccccccccc', 'rate_limited', '{"retry_after_s": 1000000}'))$$, 'allow: an absurd Retry-After');
select is((select cooldown_until from app.api_credentials where fingerprint = 'cccccccccccc'), now() + interval '86400 seconds', 'is capped at one day');

-- auth failure: disabled for good, one alert event
create temp table kr_auth as select pg_temp.report(pg_temp.ko('groq', 'cccccccccccc', 'auth', '{"status_code": 401}')) as r;
select results_eq(
  $$select status, disabled_reason, cooldown_until from app.api_credentials where fingerprint = 'cccccccccccc'$$,
  $$values ('disabled', 'auth', null::timestamptz)$$,
  'allow: a 401 disables the key with reason auth'
);
select is((select r -> 'disabled' -> 0 ->> 'fingerprint' from kr_auth), 'cccccccccccc', 'and the summary names the disabled key so the caller can alert');
select results_eq(
  $$select level, message like '%acct-groq%', data ->> 'fingerprint', data ->> 'reason', data ->> 'provider'
      from app.system_events where kind = 'key_disabled'$$,
  $$values ('error', true, 'cccccccccccc', 'auth', 'groq')$$,
  'a key_disabled system event records the account label and fingerprint'
);
select lives_ok($$select pg_temp.report(pg_temp.ko('groq', 'cccccccccccc', 'auth', '{"status_code": 403}'))$$, 'allow: a second auth failure');
select is((select count(*)::int from app.system_events where kind = 'key_disabled'), 1, 'does not raise the alert again');
select lives_ok($$select pg_temp.report(pg_temp.ko('groq', 'cccccccccccc', 'ok'))$$, 'allow: an ok from a key disabled for auth');
select is((select status from app.api_credentials where fingerprint = 'cccccccccccc'), 'disabled', 'does not bring it back (only a person re-enables an auth failure)');
select ok(not ('cccccccccccc' = any (admin_api.credentials_usable('groq'))), 'and it is never listed as usable');

-- credits: disabled until the provider's credits reset
create temp table kr_credits as
  select pg_temp.report(pg_temp.ko('exa', '333333333333', 'credits', '{"status_code": 402}'),
                        pg_temp.ko('groq', 'bbbbbbbbbbbb', 'credits')) as r;
select results_eq(
  $$select fingerprint, status, disabled_reason, cooldown_until from app.api_credentials where fingerprint in ('333333333333', 'bbbbbbbbbbbb') order by fingerprint$$,
  $$values ('333333333333', 'disabled', 'credits', (date_trunc('month', now() at time zone 'UTC') + interval '1 month') at time zone 'UTC'),
           ('bbbbbbbbbbbb', 'disabled', 'credits', (date_trunc('day', now() at time zone 'UTC') + interval '1 day') at time zone 'UTC')$$,
  'allow: a 402 disables the key until the first of next month (Exa) or the next UTC midnight (Groq)'
);
select is(jsonb_array_length((select r -> 'disabled' from kr_credits)), 2, 'and both are in the summary');
select is(admin_api.credentials_usable('groq'), array['aaaaaaaaaaaa'], 'a credits-disabled key is not usable before the reset');
update app.api_credentials set cooldown_until = now() - interval '1 second' where fingerprint = 'bbbbbbbbbbbb';
select is(pg_temp.usable('groq'), array['aaaaaaaaaaaa', 'bbbbbbbbbbbb'], 'it is usable again once the reset time has passed');
select lives_ok($$select pg_temp.report(pg_temp.ko('groq', 'bbbbbbbbbbbb', 'ok'))$$, 'allow: an ok after the reset');
select results_eq(
  $$select status, disabled_reason, cooldown_until from app.api_credentials where fingerprint = 'bbbbbbbbbbbb'$$,
  $$values ('active', null::text, null::timestamptz)$$,
  'reactivates the key and clears the reason'
);

-- outcomes that do not say anything about the key
select lives_ok($$select pg_temp.report(pg_temp.ko('groq', 'aaaaaaaaaaaa', 'bad_request', '{"status_code": 400}'), pg_temp.ko('groq', 'aaaaaaaaaaaa', 'schema'))$$,
  'allow: bad_request and schema outcomes');
select results_eq(
  $$select status, error_count from app.api_credentials where fingerprint = 'aaaaaaaaaaaa'$$,
  $$values ('active', 0)$$,
  'leave the key status and error count alone'
);

-- day rollover
update app.api_credentials set day = pg_temp.today() - 1, daily_used = 9 where fingerprint = 'aaaaaaaaaaaa';
select lives_ok($$select pg_temp.report(pg_temp.ko('groq', 'aaaaaaaaaaaa', 'ok'))$$, 'allow: the first call of a new day');
select results_eq(
  $$select daily_used, day from app.api_credentials where fingerprint = 'aaaaaaaaaaaa'$$,
  $$select 1, pg_temp.today()$$,
  'a key''s daily count starts again on a new day'
);

-- ---------------------------------------------------------------------------
-- The circuit breaker: five consecutive provider failures open it for five minutes
-- ---------------------------------------------------------------------------
insert into app.api_credentials (fingerprint, provider, account_label) values
  ('111111111111', 'exa', 'acct-one'), ('222222222222', 'exa', 'acct-two');
select lives_ok(
  $$select pg_temp.report(pg_temp.ko('exa', '111111111111', 'server'), pg_temp.ko('exa', '111111111111', 'timeout'),
                         pg_temp.ko('exa', '111111111111', 'server'), pg_temp.ko('exa', '111111111111', 'server'),
                         pg_temp.ko('exa', '111111111111', 'ok'), pg_temp.ko('exa', '111111111111', 'server'))$$,
  'allow: four failures, a success, then one more failure');
select results_eq(
  $$select error_count, status from app.api_credentials where fingerprint = '111111111111'$$,
  $$values (1, 'active')$$,
  'a key''s error count is its consecutive timeout/server failures, reset by an ok'
);
select is((select breaker_open_until from app.governor where provider = 'exa'), null::timestamptz, 'a success in between keeps the breaker closed');
create temp table kr_breaker as
  select pg_temp.report(pg_temp.ko('exa', '111111111111', 'server'), pg_temp.ko('exa', '222222222222', 'timeout'),
                        pg_temp.ko('exa', '222222222222', 'server'), pg_temp.ko('exa', '111111111111', 'server')) as r;
select is(
  (select breaker_open_until from app.governor where provider = 'exa'),
  now() + interval '5 minutes',
  'allow: five consecutive failures across the provider''s keys open the breaker for five minutes'
);
select is((select r -> 'breakers_opened' from kr_breaker), '["exa"]'::jsonb, 'and the summary says which provider');
select is((select count(*)::int from app.system_events where kind = 'provider_breaker_open'), 1, 'and a system event records it');
select is(admin_api.credentials_usable('exa'), array[]::text[], 'while the breaker is open no Exa key is usable');
select lives_ok($$select admin_api.governor_set_budget('{"provider": "exa", "budget": 20, "breaker_open_until": null}'::jsonb)$$, 'allow: closing the breaker');
select is(pg_temp.usable('exa'), array['111111111111', '222222222222'], 'the keys are usable again');
select lives_ok($$select pg_temp.report(pg_temp.ko('exa', '111111111111', 'server'))$$, 'allow: one more failure');
select is((select breaker_open_until from app.governor where provider = 'exa'), null::timestamptz, 'the failure streak starts again after the breaker opened');

-- ---------------------------------------------------------------------------
-- credentials_usable: budgets
-- ---------------------------------------------------------------------------
select is(admin_api.credentials_usable('firecrawl'), array[]::text[], 'allow: a provider with no budget set has no usable keys (fails closed)');
create temp table kr_fc as select pg_temp.report(pg_temp.ko('firecrawl', 'f1f1f1f1f1f1', 'ok')) as r;
select is(admin_api.credentials_usable('firecrawl'), array[]::text[], 'even once a key is registered');
select is((select count(*)::int from app.governor where provider = 'firecrawl'), 0, 'and without a budget the provider''s use is not counted');
select lives_ok($$select admin_api.governor_set_budget('{"provider": "firecrawl", "budget": 30, "reserved_ask": 5}'::jsonb)$$, 'allow: setting the Firecrawl budget');
select is(admin_api.credentials_usable('firecrawl'), array['f1f1f1f1f1f1'], 'the key is usable once there is a budget');
update app.governor set used = 25 where provider = 'firecrawl';
select is(admin_api.credentials_usable('firecrawl'), array[]::text[], 'the pipeline stops at budget minus the Ask share (25 of 30 used, 5 held back)');
update app.governor set used = 24 where provider = 'firecrawl';
select is(admin_api.credentials_usable('firecrawl'), array['f1f1f1f1f1f1'], 'and has the budget up to that point (24 used)');
select lives_ok($$select admin_api.governor_set_budget('{"provider": "firecrawl", "budget": 0, "reserved_ask": 0}'::jsonb)$$, 'allow: a zero budget');
select is(admin_api.credentials_usable('firecrawl'), array[]::text[], 'a zero budget leaves nothing usable');

-- ---------------------------------------------------------------------------
-- key_report and credentials_usable: deny
-- ---------------------------------------------------------------------------
create temp table cred_before as select count(*)::int as n from app.api_credentials;
create temp table used_before as select used from app.governor where provider = 'groq';

select throws_ok($$select admin_api.key_report('{}'::jsonb)$$, '22023', 'mm_invalid: key_report: key outcomes must be a JSON array', 'deny: an object instead of an array');
select throws_ok(
  format($$select admin_api.key_report(%L::jsonb)$$, (select jsonb_agg(pg_temp.ko('groq', 'aaaaaaaaaaaa', 'ok')) from generate_series(1, 51))::text),
  '22023', null, 'deny: more than 50 outcomes');
select throws_ok($$select pg_temp.report(pg_temp.ko('groq', 'AAAAAAAAAAAA', 'ok'))$$, '22023', null, 'deny: an upper-case fingerprint');
select throws_ok($$select pg_temp.report(pg_temp.ko('groq', 'example-not-a-real-key', 'ok'))$$, '22023', null, 'deny: something that looks like a key instead of a fingerprint');
select throws_ok($$select pg_temp.report(pg_temp.ko('groq', repeat('a', 64), 'ok'))$$, '22023', null, 'deny: a full sha256 instead of the 12-character prefix');
select throws_ok($$select pg_temp.report(pg_temp.ko('groq', 'aaaaaaaaaaaa', 'exploded'))$$, '22023', null, 'deny: an outcome outside the vocabulary');
select throws_ok($$select pg_temp.report(pg_temp.ko('openai', 'aaaaaaaaaaaa', 'ok'))$$, '22023', null, 'deny: a provider outside the vocabulary');
select throws_ok($$select pg_temp.report(pg_temp.ko('exa', 'aaaaaaaaaaaa', 'ok'))$$, '22023', 'mm_invalid: key_report: fingerprint belongs to another provider', 'deny: a fingerprint registered for another provider');
select throws_ok($$select pg_temp.report(pg_temp.ko('groq', 'dddddddddddd', 'ok', '{"account_label": ""}'))$$, '22023', null, 'deny: an empty account label');
select throws_ok($$select pg_temp.report(pg_temp.ko('groq', 'dddddddddddd', 'ok', '{"status_code": 99}'))$$, '22023', null, 'deny: an HTTP status below 100');
select throws_ok($$select pg_temp.report(pg_temp.ko('groq', 'dddddddddddd', 'rate_limited', '{"retry_after_s": -5}'))$$, '22023', null, 'deny: a negative Retry-After');
select throws_ok($$select pg_temp.report(pg_temp.ko('groq', 'dddddddddddd', 'ok', '{"tokens": 1.5}'))$$, '22023', null, 'deny: a fractional token count');
select throws_ok(
  $$select pg_temp.report(pg_temp.ko('groq', 'eeeeeeeeeeee', 'ok'), pg_temp.ko('groq', 'dddddddddddd', 'ok', '{"outcome": "bogus"}'))$$,
  '22023', null, 'deny: one bad outcome rejects the whole call');
select is((select count(*)::int from app.api_credentials), (select n from cred_before), 'a rejected call registers no key');
select is((select used from app.governor where provider = 'groq'), (select used from used_before), 'and counts no call');

select throws_ok($$select admin_api.credentials_usable('openai')$$, '22023', null, 'deny: credentials_usable for an unknown provider');
select throws_ok($$select admin_api.credentials_usable(null)$$, '22023', null, 'deny: credentials_usable for a null provider');

-- ---------------------------------------------------------------------------
-- Privileges: the secret key (service_role) only
-- ---------------------------------------------------------------------------
select ok(has_function_privilege('service_role', 'admin_api.key_report(jsonb)', 'execute'), 'allow: service_role can execute key_report');
select ok(has_function_privilege('service_role', 'admin_api.credentials_usable(text)', 'execute'), 'allow: service_role can execute credentials_usable');
select ok(has_function_privilege('service_role', 'admin_api.governor_set_budget(jsonb)', 'execute'), 'allow: service_role can execute governor_set_budget');
select ok(
  not has_function_privilege('anon', 'admin_api.key_report(jsonb)', 'execute')
  and not has_function_privilege('anon', 'admin_api.credentials_usable(text)', 'execute')
  and not has_function_privilege('anon', 'admin_api.governor_set_budget(jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'admin_api.key_report(jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'admin_api.credentials_usable(text)', 'execute')
  and not has_function_privilege('authenticated', 'admin_api.governor_set_budget(jsonb)', 'execute'),
  'deny: neither anon nor authenticated can execute any of them'
);
set local role service_role;
select is(cardinality(admin_api.credentials_usable('groq')), 2, 'allow: a call made as service_role succeeds');
select lives_ok($$select admin_api.key_report('[]'::jsonb)$$, 'allow: key_report as service_role');
select lives_ok($$select admin_api.governor_set_budget('{"provider": "groq", "budget": 150, "reserved_ask": 50}'::jsonb)$$, 'allow: governor_set_budget as service_role');
reset role;
set local role anon;
select throws_ok($$select admin_api.credentials_usable('groq')$$, '42501', null, 'deny: anon cannot call credentials_usable');
select throws_ok($$select admin_api.key_report('[]'::jsonb)$$, '42501', null, 'deny: anon cannot call key_report');
select throws_ok($$select admin_api.governor_set_budget('{"provider": "groq", "budget": 1}'::jsonb)$$, '42501', null, 'deny: anon cannot call governor_set_budget');
reset role;
set local role authenticated;
select throws_ok($$select admin_api.credentials_usable('groq')$$, '42501', null, 'deny: authenticated cannot call credentials_usable');
select throws_ok($$select admin_api.key_report('[]'::jsonb)$$, '42501', null, 'deny: authenticated cannot call key_report');
select throws_ok($$select admin_api.governor_set_budget('{"provider": "groq", "budget": 1}'::jsonb)$$, '42501', null, 'deny: authenticated cannot call governor_set_budget');
reset role;

select is((select budget from app.governor where provider = 'groq'), 150, 'fixture: the anon and authenticated attempts changed no budget');
select is((select count(*)::int from app.observations), (select n from obs_before), 'none of the three functions writes observations');
select is(
  (select count(*)::int from app.api_credentials where length(fingerprint) <> 12),
  0,
  'only 12-character fingerprints are ever stored, never a key'
);

select * from finish();
rollback;
