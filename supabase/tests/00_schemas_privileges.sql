-- T02a: schemas, roles, default privileges and the function-privilege guard.
-- CONTRACTS section 5:
--   app        every table, never exposed
--   api        public SECURITY DEFINER functions (publishable key = anon)
--   admin_api  service_role-only SECURITY DEFINER functions (secret key)
begin;
select plan(39);

-- ---------------------------------------------------------------------------
-- Schemas and extensions
-- ---------------------------------------------------------------------------
select has_schema('app', 'schema app exists');
select has_schema('api', 'schema api exists');
select has_schema('admin_api', 'schema admin_api exists');
select has_extension('extensions', 'pg_trgm', 'pg_trgm is installed in the extensions schema');

-- ---------------------------------------------------------------------------
-- Schema privileges: USAGE and CREATE per role
-- ---------------------------------------------------------------------------
select ok(has_schema_privilege('anon', 'api', 'usage'), 'anon can use schema api');
select ok(not has_schema_privilege('anon', 'admin_api', 'usage'), 'anon cannot use schema admin_api');
select ok(not has_schema_privilege('anon', 'app', 'usage'), 'anon cannot use schema app');

select ok(not has_schema_privilege('authenticated', 'api', 'usage'), 'authenticated cannot use schema api');
select ok(not has_schema_privilege('authenticated', 'admin_api', 'usage'), 'authenticated cannot use schema admin_api');
select ok(not has_schema_privilege('authenticated', 'app', 'usage'), 'authenticated cannot use schema app');

select ok(has_schema_privilege('service_role', 'api', 'usage'), 'service_role can use schema api');
select ok(has_schema_privilege('service_role', 'admin_api', 'usage'), 'service_role can use schema admin_api');
select ok(not has_schema_privilege('service_role', 'app', 'usage'), 'service_role cannot use schema app (it only calls admin_api functions)');

select is(
  (select count(*)::int
     from unnest(array['anon', 'authenticated', 'service_role']) as r(role_name)
    cross join unnest(array['app', 'api', 'admin_api']) as s(schema_name)
    where has_schema_privilege(r.role_name, s.schema_name, 'create')),
  0,
  'no API role can create objects in app, api or admin_api'
);

-- ---------------------------------------------------------------------------
-- A table added later inherits nothing (ALTER DEFAULT PRIVILEGES IN SCHEMA app)
-- ---------------------------------------------------------------------------
create table app.zz_inherit_probe (id int primary key);

select is(
  (select count(*)::int
     from unnest(array['anon', 'authenticated']) as r(role_name)
    cross join unnest(array['select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger']) as p(priv)
    where has_table_privilege(r.role_name, 'app.zz_inherit_probe', p.priv)),
  0,
  'a new table in app gives anon and authenticated no table privilege'
);
select is(
  (select count(*)::int
     from unnest(array['anon', 'authenticated']) as r(role_name)
    where has_any_column_privilege(r.role_name, 'app.zz_inherit_probe', 'select, insert, update, references')),
  0,
  'a new table in app gives anon and authenticated no column privilege'
);
select ok(
  not has_table_privilege('service_role', 'app.zz_inherit_probe', 'select')
  and not has_table_privilege('service_role', 'app.zz_inherit_probe', 'insert'),
  'a new table in app gives service_role no table privilege either'
);

create sequence app.zz_inherit_seq;
select is(
  (select count(*)::int
     from unnest(array['anon', 'authenticated', 'service_role']) as r(role_name)
    cross join unnest(array['usage', 'select', 'update']) as p(priv)
    where has_sequence_privilege(r.role_name, 'app.zz_inherit_seq', p.priv)),
  0,
  'a new sequence in app gives no API role any privilege'
);

-- ---------------------------------------------------------------------------
-- A function added later inherits no PUBLIC execute
-- ---------------------------------------------------------------------------
create function app.zz_probe() returns int language sql as 'select 1';
create function admin_api.zz_probe() returns int language sql as 'select 1';
create function api.zz_probe() returns int language sql as 'select 1';

select ok(
  not has_function_privilege('anon', 'app.zz_probe()', 'execute')
  and not has_function_privilege('authenticated', 'app.zz_probe()', 'execute')
  and not has_function_privilege('service_role', 'app.zz_probe()', 'execute'),
  'a new function in app is executable by no API role'
);
select ok(
  not has_function_privilege('anon', 'admin_api.zz_probe()', 'execute'),
  'a new admin_api function is not executable by anon'
);
select ok(
  not has_function_privilege('authenticated', 'admin_api.zz_probe()', 'execute'),
  'a new admin_api function is not executable by authenticated'
);
select ok(
  has_function_privilege('service_role', 'admin_api.zz_probe()', 'execute'),
  'a new admin_api function is executable by service_role'
);
select ok(
  not has_function_privilege('anon', 'api.zz_probe()', 'execute'),
  'a new api function is not executable by anon until it is granted deliberately'
);
select ok(
  not has_function_privilege('authenticated', 'api.zz_probe()', 'execute'),
  'a new api function is not executable by authenticated'
);
select ok(
  has_function_privilege('service_role', 'api.zz_probe()', 'execute'),
  'a new api function is executable by service_role'
);
select is(
  (select count(*)::int
     from pg_proc p
     cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where p.proname = 'zz_probe'
      and p.pronamespace in ('app'::regnamespace, 'api'::regnamespace, 'admin_api'::regnamespace)
      and a.grantee = 0),
  0,
  'new functions are not executable by PUBLIC'
);

-- ---------------------------------------------------------------------------
-- Guard over every function that exists in api and admin_api (T02b and T02c add them).
-- The three checks are temp functions so the probes below can prove they catch mistakes.
-- ---------------------------------------------------------------------------
create function pg_temp.admin_api_acl_violations() returns int language sql as $$
  select count(*)::int
    from pg_proc p
   where p.pronamespace = 'admin_api'::regnamespace
     and (has_function_privilege('anon', p.oid, 'execute')
       or has_function_privilege('authenticated', p.oid, 'execute')
       or not has_function_privilege('service_role', p.oid, 'execute')
       or exists (select 1
                    from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                   where a.grantee = 0));
$$;
create function pg_temp.api_acl_violations() returns int language sql as $$
  select count(*)::int
    from pg_proc p
   where p.pronamespace = 'api'::regnamespace
     and (not has_function_privilege('anon', p.oid, 'execute')
       or has_function_privilege('authenticated', p.oid, 'execute')
       or not has_function_privilege('service_role', p.oid, 'execute')
       or exists (select 1
                    from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                   where a.grantee = 0));
$$;
create function pg_temp.definer_violations() returns int language sql as $$
  select count(*)::int
    from pg_proc p
   where p.pronamespace in ('api'::regnamespace, 'admin_api'::regnamespace)
     and (not p.prosecdef
       or not coalesce(p.proconfig, '{}') @> array['search_path=""']);
$$;

select is(pg_temp.admin_api_acl_violations(), 0, 'guard: the default ACL of a new admin_api function is already compliant');
select is(pg_temp.api_acl_violations(), 1, 'guard: the api probe is flagged until anon is granted deliberately');

drop function app.zz_probe();
drop function admin_api.zz_probe();
drop function api.zz_probe();

select is(pg_temp.admin_api_acl_violations(), 0, 'every admin_api function is executable by service_role only');
select is(pg_temp.api_acl_violations(), 0, 'every api function is executable by anon and service_role only');
select is(pg_temp.definer_violations(), 0, 'every api and admin_api function is SECURITY DEFINER with search_path = empty');

-- The guards must catch mistakes: one compliant and several broken probes.
create function api.zz_ok() returns int language sql security definer set search_path = '' as 'select 1';
revoke all on function api.zz_ok() from public;
grant execute on function api.zz_ok() to anon, service_role;
create function admin_api.zz_ok() returns int language sql security definer set search_path = '' as 'select 1';
revoke all on function admin_api.zz_ok() from public;
grant execute on function admin_api.zz_ok() to service_role;
select is(
  pg_temp.admin_api_acl_violations() + pg_temp.api_acl_violations() + pg_temp.definer_violations(),
  0,
  'guard: a compliant function in each schema produces no violation'
);

create function admin_api.zz_bad() returns int language sql as 'select 1';
grant execute on function admin_api.zz_bad() to anon;
select is(pg_temp.admin_api_acl_violations(), 1, 'guard: an admin_api function granted to anon is flagged');
select is(pg_temp.definer_violations(), 1, 'guard: a function without SECURITY DEFINER and search_path is flagged');
drop function admin_api.zz_bad();

create function api.zz_bad() returns int language sql security definer set search_path = '' as 'select 1';
grant execute on function api.zz_bad() to anon, authenticated, service_role;
select is(pg_temp.api_acl_violations(), 1, 'guard: an api function granted to authenticated is flagged');
drop function api.zz_bad();
create function api.zz_bad() returns int language sql security definer set search_path = '' as 'select 1';
select is(pg_temp.api_acl_violations(), 1, 'guard: an api function left executable by PUBLIC only is flagged');
drop function api.zz_bad();

-- ---------------------------------------------------------------------------
-- No function in app is reachable through the API roles
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int
     from pg_proc p
    where p.pronamespace = 'app'::regnamespace
      and (has_function_privilege('anon', p.oid, 'execute')
        or has_function_privilege('authenticated', p.oid, 'execute')
        or has_function_privilege('service_role', p.oid, 'execute'))),
  0,
  'no function in app is executable by an API role'
);
-- ---------------------------------------------------------------------------
-- The data API cannot be pointed at the wrong schemas by a role setting
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int
     from pg_class c
    where c.relnamespace in ('public'::regnamespace, 'api'::regnamespace, 'admin_api'::regnamespace)
      and c.relkind in ('r', 'p', 'v', 'm', 'f')),
  0,
  'there are no tables or views in public, api or admin_api'
);

select ok(
  (select bool_and(not has_schema_privilege('authenticated', s, 'usage'))
     from unnest(array['app', 'api', 'admin_api']) as s),
  'authenticated has no schema usage anywhere in the MarketMind schemas'
);

select * from finish();
rollback;
