-- T02b: the inventory of public functions and their ACLs (CONTRACTS section 5).
-- Seven api functions are callable with the publishable key (anon) and the secret key (service_role);
-- four admin_api functions are callable with the secret key only. Behaviour is tested in the other 01_ files.
-- This file lists what T02b must provide; T02c adds more functions to the same schemas.
begin;
select plan(68);

create temp table expected (schema_name name, fn name, args text[], returns text);
insert into expected values
  ('api', 'submit_lead', array['jsonb'], 'jsonb'),
  ('api', 'record_events', array['jsonb'], 'void'),
  ('api', 'submit_feedback', array['jsonb'], 'void'),
  ('api', 'ask_search', array['jsonb'], 'jsonb'),
  ('api', 'ask_begin', array['jsonb'], 'jsonb'),
  ('api', 'ask_commit', array['jsonb'], 'void'),
  ('api', 'ask_result', array['uuid'], 'jsonb'),
  ('admin_api', 'key_report', array['jsonb'], 'jsonb'),
  ('admin_api', 'credentials_usable', array['text'], 'text[]'),
  ('admin_api', 'governor_set_budget', array['jsonb'], 'jsonb'),
  ('admin_api', 'ask_secret_set', array['text'], 'jsonb');

select has_function(e.schema_name, e.fn, e.args, format('%s.%s(%s) exists', e.schema_name, e.fn, array_to_string(e.args, ', ')))
  from expected e order by e.schema_name, e.fn;
select function_returns(e.schema_name, e.fn, e.args, e.returns, format('%s.%s returns %s', e.schema_name, e.fn, e.returns))
  from expected e order by e.schema_name, e.fn;
select is_definer(e.schema_name, e.fn, e.args, format('%s.%s is SECURITY DEFINER', e.schema_name, e.fn))
  from expected e order by e.schema_name, e.fn;

-- api: anon and service_role execute; authenticated does not
select function_privs_are(e.schema_name, e.fn, e.args, 'anon', array['EXECUTE'], format('anon can execute %s.%s', e.schema_name, e.fn))
  from expected e where e.schema_name = 'api' order by e.fn;
select function_privs_are(e.schema_name, e.fn, e.args, 'authenticated', array[]::text[], format('authenticated cannot execute %s.%s', e.schema_name, e.fn))
  from expected e order by e.schema_name, e.fn;
-- admin_api: service_role only
select function_privs_are(e.schema_name, e.fn, e.args, 'anon', array[]::text[], format('anon cannot execute %s.%s', e.schema_name, e.fn))
  from expected e where e.schema_name = 'admin_api' order by e.fn;
select function_privs_are(e.schema_name, e.fn, e.args, 'service_role', array['EXECUTE'], format('service_role can execute %s.%s', e.schema_name, e.fn))
  from expected e order by e.schema_name, e.fn;

-- the helpers stay out of reach: nothing in app is executable by an API role (also asserted in 00_schemas_privileges)
select is(
  (select count(*)::int from pg_proc p
    where p.pronamespace = 'app'::regnamespace
      and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute')
        or has_function_privilege('service_role', p.oid, 'execute'))),
  0,
  'no helper in app is executable by an API role'
);
select is(
  (select count(*)::int from pg_proc p
    where p.pronamespace in ('api'::regnamespace, 'admin_api'::regnamespace)
      and p.proowner <> 'postgres'::regrole),
  0,
  'every function in api and admin_api is owned by postgres'
);

select * from finish();
rollback;
