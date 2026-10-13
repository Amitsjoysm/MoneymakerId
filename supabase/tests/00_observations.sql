-- T02a: the observations table and its trigger (CONTRACTS section 5).
-- "Written only by a trigger on the tracked columns of businesses, restaurants, providers,
-- restaurant_dishes and cost_models." Every case runs as postgres in a rolled-back transaction.
begin;
select plan(38);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into app.localities (id, name, kind, lat, lng, geo_source, jurisdiction) values
  ('baner', 'Baner', 'locality', 18.559, 73.786, '{}', 'PMC'),
  ('wakad', 'Wakad', 'locality', 18.598, 73.760, '{}', 'PCMC');
insert into app.dishes (id, name, diet, price_sanity_min_inr, price_sanity_max_inr) values ('biryani', 'Biryani', 'both', 50, 1000);
insert into app.services (id, name, unit) values ('terrace-waterproofing', 'Terrace waterproofing', 'sqft');

-- The observations written so far, newest last, for one entity
create function pg_temp.obs(p_entity text, p_attribute text default null)
returns table (attribute text, old_value jsonb, new_value jsonb, actor text)
language sql as $$
  select o.attribute, o.old_value, o.new_value, o.actor
    from app.observations o
   where o.entity_id = p_entity and (p_attribute is null or o.attribute = p_attribute)
   order by o.created_at, o.attribute;
$$;

-- ---------------------------------------------------------------------------
-- businesses: insert logs the columns that carry a value, and nothing else
-- ---------------------------------------------------------------------------
insert into app.businesses (id, kind, name, normalised_name, slug, locality_id, address, phone)
values ('00000000-0000-4000-8000-000000000001', 'restaurant', 'Test Biryani House', 'test biryani house',
        'test-biryani-house', 'baner', 'Baner Road', '+919800000001');

select results_eq(
  $$select attribute from pg_temp.obs('00000000-0000-4000-8000-000000000001') order by attribute$$,
  $$values ('address'), ('locality_id'), ('name'), ('phone'), ('status'), ('verification_status')$$,
  'a new business logs the tracked columns that have a value (SQL null is not logged)'
);
select results_eq(
  $$select old_value, new_value from pg_temp.obs('00000000-0000-4000-8000-000000000001', 'name')$$,
  $$values (null::jsonb, '"Test Biryani House"'::jsonb)$$,
  'an insert logs old_value null and new_value as jsonb'
);
select is(
  (select distinct entity_type from app.observations where entity_id = '00000000-0000-4000-8000-000000000001'),
  'business',
  'a business observes as entity_type business'
);
select is(
  (select distinct actor from app.observations where entity_id = '00000000-0000-4000-8000-000000000001'),
  'admin',
  'the actor defaults to admin when mm.actor is not set'
);

-- ---------------------------------------------------------------------------
-- businesses: update logs only tracked columns whose value changed
-- ---------------------------------------------------------------------------
update app.businesses set name = 'Test Biryani Palace' where id = '00000000-0000-4000-8000-000000000001';
select results_eq(
  $$select old_value, new_value from pg_temp.obs('00000000-0000-4000-8000-000000000001', 'name') offset 1$$,
  $$values ('"Test Biryani House"'::jsonb, '"Test Biryani Palace"'::jsonb)$$,
  'an update logs the old and new value of the tracked column'
);

select is((select count(*)::int from app.observations), 7, 'so far: 6 rows for the insert and 1 for the name change');

update app.businesses set name = 'Test Biryani Palace' where id = '00000000-0000-4000-8000-000000000001';
select is((select count(*)::int from app.observations), 7, 'an update that sets the same value logs nothing');

update app.businesses set confidence = 0.9, last_verified_at = now(), reviewed_at = now(), auto_published = true
 where id = '00000000-0000-4000-8000-000000000001';
select is((select count(*)::int from app.observations), 7, 'changing columns that are not tracked logs nothing');

update app.businesses set phone = null, address = 'Baner Road, Pune'
 where id = '00000000-0000-4000-8000-000000000001';
select results_eq(
  $$select attribute, old_value, new_value from pg_temp.obs('00000000-0000-4000-8000-000000000001')
     where attribute in ('phone', 'address') and old_value is not null order by attribute$$,
  $$values ('address', '"Baner Road"'::jsonb, '"Baner Road, Pune"'::jsonb),
           ('phone', '"+919800000001"'::jsonb, null::jsonb)$$,
  'one statement logs one row per changed column, and a value removed logs new_value null'
);

-- ---------------------------------------------------------------------------
-- Session settings: mm.actor, mm.source_id, mm.confidence, mm.extractor_version
-- ---------------------------------------------------------------------------
insert into app.sources (id, kind, url) values ('00000000-0000-4000-8000-0000000000d1', 'official_site', 'https://example.org/menu');
select set_config('mm.actor', 'pipeline', true);
select set_config('mm.source_id', '00000000-0000-4000-8000-0000000000d1', true);
select set_config('mm.confidence', '0.75', true);
select set_config('mm.extractor_version', 'groq-2026-10', true);
update app.businesses set website = 'https://example.org' where id = '00000000-0000-4000-8000-000000000001';

select results_eq(
  $$select actor, source_id::text, confidence, extractor_version from app.observations
     where entity_id = '00000000-0000-4000-8000-000000000001' and attribute = 'website'$$,
  $$values ('pipeline', '00000000-0000-4000-8000-0000000000d1', 0.75, 'groq-2026-10')$$,
  'actor, source, confidence and extractor version come from the mm.* settings'
);

select set_config('mm.actor', 'csv', true);
update app.businesses set status = 'hidden' where id = '00000000-0000-4000-8000-000000000001';
select is(
  (select actor from app.observations where entity_id = '00000000-0000-4000-8000-000000000001' and attribute = 'status' and new_value = '"hidden"'),
  'csv',
  'a later change in the same transaction takes the new actor'
);

select set_config('mm.actor', '', true);
update app.businesses set status = 'candidate' where id = '00000000-0000-4000-8000-000000000001';
select is(
  (select actor from app.observations where entity_id = '00000000-0000-4000-8000-000000000001' and attribute = 'status' and old_value = '"hidden"' and new_value = '"candidate"'),
  'admin',
  'an empty mm.actor falls back to admin'
);

select set_config('mm.actor', 'robot', true);
select throws_ok(
  $$update app.businesses set name = 'Robot Palace' where id = '00000000-0000-4000-8000-000000000001'$$,
  '23514', null, 'an actor outside admin, csv, pipeline and ask is rejected');
select set_config('mm.actor', 'ask', true);
update app.businesses set name = 'Ask Palace' where id = '00000000-0000-4000-8000-000000000001';
select is(
  (select actor from app.observations where entity_id = '00000000-0000-4000-8000-000000000001' and new_value = '"Ask Palace"'),
  'ask',
  'ask is a valid actor'
);
select set_config('mm.actor', '', true);
select set_config('mm.source_id', '', true);
select set_config('mm.confidence', '', true);
select set_config('mm.extractor_version', '', true);

-- ---------------------------------------------------------------------------
-- restaurants, providers, restaurant_dishes, cost_models
-- ---------------------------------------------------------------------------
insert into app.restaurants (business_id, diet, price_level, opening_hours, cuisines, tags)
values ('00000000-0000-4000-8000-000000000001', 'veg', 2, '{"mon": [["11:00", "23:30"]]}', array['mughlai'], '{}');

select results_eq(
  $$select attribute from app.observations
     where entity_id = '00000000-0000-4000-8000-000000000001'
       and attribute in ('cuisines', 'diet', 'price_level', 'opening_hours', 'service_modes', 'tags')
     order by attribute$$,
  $$values ('cuisines'), ('diet'), ('opening_hours'), ('price_level'), ('service_modes'), ('tags')$$,
  'a restaurants row observes under its business id'
);
select is(
  (select new_value from app.observations where entity_id = '00000000-0000-4000-8000-000000000001' and attribute = 'opening_hours'),
  '{"mon": [["11:00", "23:30"]]}'::jsonb,
  'a jsonb column is logged as jsonb'
);
select is(
  (select new_value from app.observations where entity_id = '00000000-0000-4000-8000-000000000001' and attribute = 'cuisines'),
  '["mughlai"]'::jsonb,
  'a text[] column is logged as a jsonb array'
);

update app.restaurants set opening_hours = '{"mon": [["11:00", "23:30"]], "tue": [["11:00", "23:30"]]}'
 where business_id = '00000000-0000-4000-8000-000000000001';
select is(
  (select old_value from app.observations where entity_id = '00000000-0000-4000-8000-000000000001' and attribute = 'opening_hours' and old_value is not null),
  '{"mon": [["11:00", "23:30"]]}'::jsonb,
  'a changed jsonb value logs the previous jsonb value'
);

insert into app.businesses (id, kind, name, normalised_name, slug, locality_id)
values ('00000000-0000-4000-8000-000000000002', 'provider', 'Dry Roof Co', 'dry roof co', 'dry-roof-co', 'wakad');
insert into app.providers (business_id, accepts_leads, founding_partner) values ('00000000-0000-4000-8000-000000000002', false, false);
update app.providers set accepts_leads = true, sales_stage = 'trial', price_locked_until = '2027-03-31'
 where business_id = '00000000-0000-4000-8000-000000000002';

select results_eq(
  $$select attribute, old_value, new_value from app.observations
     where entity_id = '00000000-0000-4000-8000-000000000002'
       and attribute in ('accepts_leads', 'sales_stage', 'price_locked_until')
       and old_value is distinct from new_value and (old_value is not null or attribute = 'price_locked_until')
     order by attribute$$,
  $$values ('accepts_leads', 'false'::jsonb, 'true'::jsonb),
           ('price_locked_until', null::jsonb, '"2027-03-31"'::jsonb),
           ('sales_stage', '"prospect"'::jsonb, '"trial"'::jsonb)$$,
  'a providers row observes under its business id (booleans and dates included)'
);
select is(
  (select count(*)::int from app.observations where entity_id = '00000000-0000-4000-8000-000000000002' and attribute = 'trial_leads_remaining'),
  0,
  'trial_leads_remaining is a counter, not a tracked column'
);

-- A price is stored only with the evidence behind it (restaurant_dishes_price_has_evidence)
insert into app.sources (id, kind, url) values ('00000000-0000-4000-8000-0000000000d2', 'menu', 'https://example.org/menu.pdf');
insert into app.evidence (id, entity_type, entity_id, claim_type, claim, source_id, retrieved_at, confidence, extractor_version)
values ('00000000-0000-4000-8000-0000000000e1', 'restaurant_dish', '00000000-0000-4000-8000-0000000000aa', 'price',
        '{"price": {"price_inr": 249}}', '00000000-0000-4000-8000-0000000000d2', now(), 0.8, 'test');
insert into app.restaurant_dishes (id, business_id, dish_id, price_inr, evidence_id)
values ('00000000-0000-4000-8000-0000000000aa', '00000000-0000-4000-8000-000000000001', 'biryani', 249, '00000000-0000-4000-8000-0000000000e1');
update app.restaurant_dishes set price_inr = 279 where id = '00000000-0000-4000-8000-0000000000aa';

select results_eq(
  $$select entity_type, old_value, new_value from app.observations
     where entity_id = '00000000-0000-4000-8000-0000000000aa' and attribute = 'price_inr' order by new_value$$,
  $$values ('restaurant_dish', null::jsonb, '249.00'::jsonb), ('restaurant_dish', '249.00'::jsonb, '279.00'::jsonb)$$,
  'a restaurant_dishes price observes as entity_type restaurant_dish, keyed by the row id'
);
update app.restaurant_dishes set last_seen_at = now() + interval '1 day' where id = '00000000-0000-4000-8000-0000000000aa';
select is(
  (select count(*)::int from app.observations where entity_id = '00000000-0000-4000-8000-0000000000aa'),
  2,
  'last_seen_at is not a tracked column (a re-seen price logs nothing)'
);

insert into app.cost_models (id, service_id, tier, unit, rate_low_inr, rate_expected_inr, rate_high_inr, components, sources, reviewed_at, valid_until)
values ('terrace-waterproofing-standard', 'terrace-waterproofing', 'standard', 'sqft', 60, 80, 110,
        '{"materials": 0.5, "labour": 0.3, "preparation": 0.1, "repair": 0.05, "transport": 0.03, "waste": 0.02}', '[]', '2026-10-01', '2027-04-01');
update app.cost_models set rate_expected_inr = 85, rate_high_inr = 120 where id = 'terrace-waterproofing-standard';

select results_eq(
  $$select attribute, old_value, new_value from app.observations
     where entity_type = 'cost_model' and entity_id = 'terrace-waterproofing-standard'
       and old_value is not null and attribute like 'rate%' order by attribute$$,
  $$values ('rate_expected_inr', '80'::jsonb, '85'::jsonb), ('rate_high_inr', '110'::jsonb, '120'::jsonb)$$,
  'cost_models observes by its text id as entity_type cost_model'
);
update app.cost_models set notes = 'reworded', reviewed_at = '2026-10-05' where id = 'terrace-waterproofing-standard';
select is(
  (select count(*)::int from app.observations where entity_type = 'cost_model' and attribute in ('notes', 'reviewed_at', 'sources')),
  0,
  'notes, reviewed_at and sources are not tracked on cost_models'
);

-- ---------------------------------------------------------------------------
-- The trigger is generic: a table names its tracked columns in the trigger arguments
-- ---------------------------------------------------------------------------
create table app.zz_obs_probe (
  id text primary key, a text, b jsonb, c int,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
select app.init_table('app.zz_obs_probe');
create trigger record_observations after insert or update on app.zz_obs_probe
  for each row execute function app.record_observations('locality', 'id', 'a', 'b');

insert into app.zz_obs_probe (id, a, b, c) values ('p1', 'x', '{"k": 1}', 1);
update app.zz_obs_probe set a = 'y', c = 2 where id = 'p1';
select results_eq(
  $$select attribute, old_value, new_value from app.observations where entity_type = 'locality' and entity_id = 'p1' order by attribute, old_value is not null$$,
  $$values ('a', null::jsonb, '"x"'::jsonb), ('a', '"x"'::jsonb, '"y"'::jsonb), ('b', null::jsonb, '{"k": 1}'::jsonb)$$,
  'the tracked columns come from the trigger arguments and the entity from its first two'
);
update app.zz_obs_probe set b = null where id = 'p1';
select is(
  (select new_value from app.observations where entity_id = 'p1' and attribute = 'b' and old_value is not null),
  null::jsonb,
  'setting a jsonb column to SQL null logs new_value null'
);
update app.zz_obs_probe set b = 'null'::jsonb where id = 'p1';
select is(
  (select count(*)::int from app.observations where entity_id = 'p1' and attribute = 'b'),
  2,
  'JSON null and SQL null both mean no value, so swapping one for the other logs nothing'
);

create table app.zz_obs_bad (
  id text primary key, a text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
select app.init_table('app.zz_obs_bad');
create trigger record_observations after insert or update on app.zz_obs_bad
  for each row execute function app.record_observations('locality', 'id', 'a', 'no_such_column');
select throws_ok(
  $$insert into app.zz_obs_bad (id, a) values ('b1', 'x')$$,
  '42703', null, 'a tracked column that does not exist is an error, not a silent gap');

-- ---------------------------------------------------------------------------
-- Written only by the trigger; append-only
-- ---------------------------------------------------------------------------
select throws_ok(
  $$insert into app.observations (entity_type, entity_id, attribute, new_value, actor) values ('business', 'x', 'name', '"x"', 'admin')$$,
  '42501', null, 'a direct insert into observations is rejected');
select throws_ok(
  $$update app.observations set confidence = 1$$,
  '42501', null, 'observations cannot be updated');
select lives_ok(
  $$delete from app.observations where entity_id = 'p1'$$,
  'observations can be deleted (retention is done by admin_api.prune)');
select throws_ok(
  $$insert into app.observations (entity_type, entity_id, attribute, new_value, actor) select 'business', 'x', 'name', '"x"', 'admin'$$,
  '42501', null, 'insert ... select into observations is rejected as well');

-- A trigger on a tracked table that fails must fail the whole statement (no change without its record).
select throws_ok(
  $$insert into app.businesses (id, kind, name, normalised_name, slug, locality_id, status)
    values ('00000000-0000-4000-8000-000000000003', 'restaurant', 'Pub', 'pub', 'pub', 'baner', 'closed')$$,
  '23514', null, 'an invalid business is rejected before anything is observed');
select is(
  (select count(*)::int from app.observations where entity_id = '00000000-0000-4000-8000-000000000003'),
  0,
  'a rejected change leaves no observation behind');

-- ---------------------------------------------------------------------------
-- Which tables carry the trigger
-- ---------------------------------------------------------------------------
select is(
  (select string_agg(c.relname, ', ' order by c.relname)
     from pg_trigger t
     join pg_class c on c.oid = t.tgrelid
    where t.tgname = 'record_observations' and not t.tgisinternal and c.relnamespace = 'app'::regnamespace
      and c.relname not like 'zz\_%'),
  'businesses, cost_models, providers, restaurant_dishes, restaurants',
  'the observations trigger is on businesses, restaurants, providers, restaurant_dishes and cost_models'
);
select is(
  (select count(*)::int
     from pg_trigger t
    where t.tgname = 'record_observations' and not t.tgisinternal
      and t.tgfoid = 'app.record_observations()'::regprocedure
      and (t.tgtype & 1) = 1 and (t.tgtype & 2) = 0 and (t.tgtype & 4) = 4 and (t.tgtype & 16) = 16
      and t.tgrelid::regclass::text not like 'app.zz\_%'),
  5,
  'each is an AFTER INSERT OR UPDATE row trigger'
);

-- Observations are reachable by no API role
select ok(
  not has_table_privilege('anon', 'app.observations', 'select')
  and not has_table_privilege('authenticated', 'app.observations', 'select')
  and not has_table_privilege('service_role', 'app.observations', 'select'),
  'no API role can read observations directly');
select ok(
  (select relrowsecurity from pg_class where oid = 'app.observations'::regclass),
  'observations has row level security on');

select * from finish();
rollback;
