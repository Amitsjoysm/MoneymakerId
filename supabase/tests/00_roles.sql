-- T02a: what anon, authenticated and service_role can actually do, by switching to each role.
-- The catalog checks in 00_schemas_privileges.sql and 00_tables.sql say what is granted; this file
-- proves the effect, including the failure modes (a grant given by mistake still leaves RLS in the way).
-- 42501 = insufficient privilege.
begin;
select plan(23);

insert into app.localities (id, name, kind, lat, lng, geo_source, jurisdiction)
values ('baner', 'Baner', 'locality', 18.559, 73.786, '{}', 'PMC');

create function admin_api.zz_probe() returns int language sql security definer set search_path = '' as 'select 1';
create function api.zz_probe() returns int language sql security definer set search_path = '' as 'select 1';

-- ---------------------------------------------------------------------------
-- anon: the publishable key
-- ---------------------------------------------------------------------------
set local role anon;
select throws_ok($$select * from app.cities$$, '42501', null, 'anon cannot read app.cities');
select throws_ok($$select * from app.leads$$, '42501', null, 'anon cannot read app.leads');
select throws_ok($$insert into app.feedback (page_key, kind) values ('/x', 'useful')$$, '42501', null, 'anon cannot insert into app.feedback');
select throws_ok($$select admin_api.zz_probe()$$, '42501', null, 'anon cannot call an admin_api function');
select throws_ok($$select api.zz_probe()$$, '42501', null, 'anon cannot call an api function until it is granted deliberately');
reset role;

-- ---------------------------------------------------------------------------
-- authenticated: not used by this site, so it gets nothing
-- ---------------------------------------------------------------------------
set local role authenticated;
select throws_ok($$select * from app.cities$$, '42501', null, 'authenticated cannot read app.cities');
select throws_ok($$select * from app.leads$$, '42501', null, 'authenticated cannot read app.leads');
select throws_ok($$select admin_api.zz_probe()$$, '42501', null, 'authenticated cannot call an admin_api function');
select throws_ok($$select api.zz_probe()$$, '42501', null, 'authenticated cannot call an api function');
reset role;

-- ---------------------------------------------------------------------------
-- service_role: the secret key reaches the tables only through admin_api functions
-- ---------------------------------------------------------------------------
set local role service_role;
select throws_ok($$select * from app.cities$$, '42501', null, 'service_role cannot read app.cities directly');
select throws_ok($$update app.localities set name = 'x'$$, '42501', null, 'service_role cannot write app.localities directly');
select is(admin_api.zz_probe(), 1, 'service_role can call an admin_api function');
select is(api.zz_probe(), 1, 'service_role can call an api function');
reset role;

-- ---------------------------------------------------------------------------
-- A grant for anon given by mistake is still not enough (defence in depth)
-- ---------------------------------------------------------------------------
grant execute on function api.zz_probe() to anon;
set local role anon;
select is(api.zz_probe(), 1, 'a deliberate EXECUTE grant lets anon call an api function');
reset role;

grant usage on schema app to anon;
set local role anon;
select throws_ok($$select * from app.cities$$, '42501', null, 'USAGE on app without a table grant still denies anon');
reset role;

grant select on app.cities, app.leads to anon;
set local role anon;
select is((select count(*)::int from app.cities), 0, 'a table grant without a policy shows anon no rows (RLS is deny by default)');
select is((select count(*)::int from app.leads), 0, 'the same holds for leads');
select throws_ok($$insert into app.cities (id, name) values ('mumbai', 'Mumbai')$$, '42501', null, 'and anon still cannot insert');
reset role;

-- ---------------------------------------------------------------------------
-- A table created later inherits nothing, behaviourally
-- ---------------------------------------------------------------------------
create table app.zz_later (id int primary key, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
insert into app.zz_later (id) values (1);
set local role anon;
select throws_ok($$select * from app.zz_later$$, '42501', null, 'anon cannot read a table created later without init_table');
reset role;
set local role authenticated;
select throws_ok($$select * from app.zz_later$$, '42501', null, 'authenticated cannot read a table created later');
reset role;
set local role service_role;
select throws_ok($$select * from app.zz_later$$, '42501', null, 'service_role cannot read a table created later');
reset role;

-- ---------------------------------------------------------------------------
-- The migration role is unaffected: fixtures and SECURITY DEFINER functions keep working
-- ---------------------------------------------------------------------------
select is((select count(*)::int from app.localities), 1, 'postgres still reads app tables (SECURITY DEFINER functions run as the owner)');
select is(
  (select count(*)::int from app.cities),
  1,
  'the cities seed row (pune) is there');

select * from finish();
rollback;
