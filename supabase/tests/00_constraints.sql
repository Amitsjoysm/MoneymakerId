-- T02a: constraints, uniqueness and idempotency, assignment limits, guards, and the updated_at rules.
-- Every case runs as postgres inside a rolled-back transaction. SQLSTATE 23514 = check violation,
-- 23505 = unique violation, 23503 = foreign key violation.
begin;
select plan(116);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into app.localities (id, name, kind, lat, lng, geo_source, jurisdiction) values
  ('baner', 'Baner', 'locality', 18.559, 73.786, '{"url": "https://example.org/baner"}', 'PMC'),
  ('hinjewadi', 'Hinjewadi', 'locality', 18.591, 73.738, '{"url": "https://example.org/hinjewadi"}', 'PMRDA');
insert into app.services (id, name, unit) values ('terrace-waterproofing', 'Terrace waterproofing', 'sqft');
insert into app.dishes (id, name, diet, price_sanity_min_inr, price_sanity_max_inr) values ('biryani', 'Biryani', 'both', 50, 1000);
insert into app.businesses (id, kind, name, normalised_name, slug, locality_id) values
  ('00000000-0000-4000-8000-000000000001', 'restaurant', 'Test Biryani House', 'test biryani house', 'test-biryani-house', 'baner');
insert into app.restaurants (business_id, diet) values ('00000000-0000-4000-8000-000000000001', 'both');

create function pg_temp.mk_provider(n int) returns uuid language plpgsql as $$
declare v_id uuid := ('00000000-0000-4000-8000-0000000000e' || n)::uuid;
begin
  insert into app.businesses (id, kind, name, normalised_name, slug, locality_id)
  values (v_id, 'provider', 'Provider ' || n, 'provider ' || n, 'provider-' || n, 'baner');
  insert into app.providers (business_id) values (v_id);
  return v_id;
end $$;

create function pg_temp.mk_lead(n int) returns uuid language plpgsql as $$
declare v_id uuid := ('00000000-0000-4000-8000-0000000000a' || n)::uuid;
begin
  insert into app.leads (id, ref, lead_type, grade, qualified, name, phone_e164, idempotency_key, consent_version)
  values (v_id, 'MM-T' || n, 'quote', 'A', true, 'Lead ' || n, '+9198000000' || lpad(n::text, 2, '0'),
          ('00000000-0000-4000-8000-0000000000b' || n)::uuid, 'lead-consent-v1');
  return v_id;
end $$;

create function pg_temp.assign(lead_n int, prov_n int, mode text) returns void language sql as $$
  insert into app.lead_assignments (lead_id, provider_id, mode, price_inr)
  values (('00000000-0000-4000-8000-0000000000a' || lead_n)::uuid,
          ('00000000-0000-4000-8000-0000000000e' || prov_n)::uuid, mode, 100);
$$;

select pg_temp.mk_provider(n) from generate_series(1, 5) n;
select pg_temp.mk_lead(n) from generate_series(1, 6) n;

-- ---------------------------------------------------------------------------
-- Reserved slugs and id shapes (CONTRACTS section 4a)
-- ---------------------------------------------------------------------------
select throws_ok(
  $$insert into app.localities (id, name, kind, lat, lng, geo_source, jurisdiction) values ('budget-food', 'x', 'locality', 18, 73, '{}', 'PMC')$$,
  '23514', null, 'a reserved slug cannot be a locality id');
select throws_ok(
  $$insert into app.dishes (id, name, diet, price_sanity_min_inr, price_sanity_max_inr) values ('under-300', 'x', 'veg', 0, 10)$$,
  '23514', null, 'under-* cannot be a dish id');
select throws_ok(
  $$insert into app.services (id, name, unit) values ('painting-cost', 'x', 'sqft')$$,
  '23514', null, 'a slug ending in -cost cannot be a service id');
select throws_ok(
  $$insert into app.dishes (id, name, diet, price_sanity_min_inr, price_sanity_max_inr) values ('veg', 'x', 'veg', 0, 10)$$,
  '23514', null, 'veg is reserved');
select lives_ok(
  $$insert into app.dishes (id, name, parent_id, diet, price_sanity_min_inr, price_sanity_max_inr) values ('veg-biryani', 'Veg biryani', 'biryani', 'veg', 40, 600)$$,
  'a variant such as veg-biryani is a valid dish id');
select throws_ok(
  $$insert into app.localities (id, name, kind, lat, lng, geo_source, jurisdiction) values ('Bad Id', 'x', 'locality', 18, 73, '{}', 'PMC')$$,
  '23514', null, 'an id must be a lowercase slug');
select is(app.is_reserved_slug('terrace-waterproofing'), false, 'terrace-waterproofing is not reserved');
select is(app.is_reserved_slug('mr'), true, 'mr is reserved');

-- ---------------------------------------------------------------------------
-- Localities: landmarks, neighbours, deferred parent keys
-- ---------------------------------------------------------------------------
select throws_ok(
  $$insert into app.localities (id, name, kind, parent_id, lat, lng, geo_source, jurisdiction) values ('baner-metro', 'x', 'landmark', 'baner', 18, 73, '{}', 'PMC')$$,
  '23514', null, 'a landmark id must start with near-');
select throws_ok(
  $$insert into app.localities (id, name, kind, lat, lng, geo_source, jurisdiction) values ('near-baner-metro', 'x', 'landmark', 18, 73, '{}', 'PMC')$$,
  '23514', null, 'a landmark needs a parent locality');
select lives_ok(
  $$insert into app.localities (id, name, kind, parent_id, lat, lng, geo_source, jurisdiction) values ('near-baner-metro', 'Near Baner metro', 'landmark', 'baner', 18, 73, '{}', 'PMC')$$,
  'a landmark with a near- id and a parent is accepted');
select throws_ok(
  $$insert into app.localities (id, name, kind, lat, lng, geo_source, jurisdiction, neighbours) values ('zz-seven', 'x', 'locality', 18, 73, '{}', 'PMC', array['a','b','c','d','e','f','g'])$$,
  '23514', null, 'a locality has at most 6 neighbours');
select throws_ok(
  $$insert into app.localities (id, name, kind, lat, lng, geo_source, jurisdiction) values ('zz-lat', 'x', 'locality', 118, 73, '{}', 'PMC')$$,
  '23514', null, 'latitude is range-checked');

insert into app.localities (id, name, kind, parent_id, lat, lng, geo_source, jurisdiction)
values ('wakad-phase-1', 'Wakad phase 1', 'sub_locality', 'wakad', 18.6, 73.76, '{}', 'PCMC');
insert into app.localities (id, name, kind, lat, lng, geo_source, jurisdiction)
values ('wakad', 'Wakad', 'locality', 18.598, 73.76, '{}', 'PCMC');
select lives_ok($$set constraints all immediate$$, 'parent_id is deferred: a child may be inserted before its parent in one transaction');
set constraints all deferred;
insert into app.localities (id, name, kind, parent_id, lat, lng, geo_source, jurisdiction)
values ('zz-orphan', 'x', 'sub_locality', 'nowhere', 18, 73, '{}', 'PMC');
select throws_ok($$set constraints all immediate$$, '23503', null, 'a dangling parent_id is still rejected when the constraint is checked');
delete from app.localities where id = 'zz-orphan';

-- ---------------------------------------------------------------------------
-- Cost models, dishes
-- ---------------------------------------------------------------------------
select lives_ok(
  $$insert into app.cost_models (id, service_id, tier, unit, rate_low_inr, rate_expected_inr, rate_high_inr, components, sources, reviewed_at, valid_until)
    values ('terrace-waterproofing-standard', 'terrace-waterproofing', 'standard', 'sqft', 60, 80, 110,
            '{"materials": 0.5, "labour": 0.3, "preparation": 0.1, "repair": 0.05, "transport": 0.03, "waste": 0.02}', '[]', '2026-10-01', '2027-04-01')$$,
  'a cost model with ordered rates is accepted');
select throws_ok(
  $$insert into app.cost_models (id, service_id, tier, unit, rate_low_inr, rate_expected_inr, rate_high_inr, components, sources, reviewed_at, valid_until)
    values ('zz-bad-rates', 'terrace-waterproofing', 'standard', 'sqft', 90, 80, 110, '{}', '[]', '2026-10-01', '2027-04-01')$$,
  '23514', null, 'cost model rates must satisfy low <= expected <= high');
select throws_ok(
  $$insert into app.dishes (id, name, diet, price_sanity_min_inr, price_sanity_max_inr) values ('zz-dish', 'x', 'veg', 500, 100)$$,
  '23514', null, 'a dish price sanity range must have min <= max');

-- ---------------------------------------------------------------------------
-- Businesses: identity, slug, guards
-- ---------------------------------------------------------------------------
select throws_ok(
  $$insert into app.businesses (kind, name, normalised_name, slug, locality_id) values ('restaurant', 'Test Biryani House', 'test biryani house', 'other-slug', 'baner')$$,
  '23505', null, 'a business is unique on (kind, normalised_name, locality_id) when branch_key is empty');
select lives_ok(
  $$insert into app.businesses (kind, name, normalised_name, slug, locality_id, branch_key) values ('restaurant', 'Test Biryani House', 'test biryani house', 'test-biryani-house-2', 'baner', 'wakad')$$,
  'the same name with a different branch_key is a different business');
select throws_ok(
  $$insert into app.businesses (kind, name, normalised_name, slug, locality_id, branch_key) values ('restaurant', 'Test Biryani House', 'test biryani house', 'test-biryani-house-3', 'baner', 'wakad')$$,
  '23505', null, 'the same branch_key is a duplicate');
select lives_ok(
  $$insert into app.businesses (kind, name, normalised_name, slug, locality_id) values ('provider', 'Test Biryani House', 'test biryani house', 'test-biryani-house-p', 'baner')$$,
  'kind is part of the identity');
select throws_ok(
  $$insert into app.businesses (kind, name, normalised_name, slug, locality_id) values ('restaurant', 'Another', 'another', 'test-biryani-house', 'baner')$$,
  '23505', null, 'businesses.slug is unique');
select throws_ok(
  $$insert into app.businesses (kind, name, normalised_name, slug, locality_id, status) values ('restaurant', 'Pub', 'pub', 'pub', 'baner', 'published')$$,
  '23514', null, 'a published business needs published_at');
select throws_ok(
  $$update app.businesses set verification_status = 'verified' where id = '00000000-0000-4000-8000-000000000001'$$,
  '23514', null, 'a verified business needs a method and a date');
select lives_ok(
  $$update app.businesses set verification_status = 'verified', verification_method = 'visit', verified_at = now() where id = '00000000-0000-4000-8000-000000000001'$$,
  'verification with method and date is accepted');
select throws_ok(
  $$update app.businesses set lat = 18.5 where id = '00000000-0000-4000-8000-000000000001'$$,
  '23514', null, 'lat and lng come as a pair');
select throws_ok(
  $$update app.businesses set website = 'ftp://x.example' where id = '00000000-0000-4000-8000-000000000001'$$,
  '23514', null, 'website must be http(s)');

select lives_ok(
  $$update app.businesses set slug = 'test-biryani-house-renamed' where id = '00000000-0000-4000-8000-000000000001'$$,
  'the slug of an unpublished business can still change');
select lives_ok(
  $$update app.businesses set status = 'published', published_at = now() where id = '00000000-0000-4000-8000-000000000001'$$,
  'a business can be published');
select throws_ok(
  $$update app.businesses set slug = 'something-else' where id = '00000000-0000-4000-8000-000000000001'$$,
  '23514', 'businesses.slug cannot change after publish (business 00000000-0000-4000-8000-000000000001)',
  'the slug never changes after publish');
select lives_ok(
  $$update app.businesses set status = 'hidden' where id = '00000000-0000-4000-8000-000000000001'$$,
  'a published business can be hidden');
select throws_ok(
  $$update app.businesses set slug = 'something-else' where id = '00000000-0000-4000-8000-000000000001'$$,
  '23514', null, 'the slug stays fixed after a business is hidden');
select throws_ok(
  $$update app.businesses set kind = 'provider' where id = '00000000-0000-4000-8000-000000000001'$$,
  '23514', null, 'the kind of a business never changes');

-- restaurants and providers hang off the right kind of business
select throws_ok(
  $$insert into app.providers (business_id) values ('00000000-0000-4000-8000-000000000001')$$,
  '23514', null, 'a providers row cannot hang off a restaurant business');
select throws_ok(
  $$insert into app.restaurants (business_id, diet) values ('00000000-0000-4000-8000-0000000000e1', 'veg')$$,
  '23514', null, 'a restaurants row cannot hang off a provider business');
select throws_ok(
  $$update app.restaurants set business_id = '00000000-0000-4000-8000-0000000000e1' where business_id = '00000000-0000-4000-8000-000000000001'$$,
  '23514', null, 'a restaurants row cannot be re-pointed at a provider');
select throws_ok(
  $$update app.restaurants set service_modes = array['drive_in'] where business_id = '00000000-0000-4000-8000-000000000001'$$,
  '23514', null, 'service_modes only takes dine_in, takeaway or delivery');
select throws_ok(
  $$update app.restaurants set price_level = 4 where business_id = '00000000-0000-4000-8000-000000000001'$$,
  '23514', null, 'price_level is 1 to 3');
select results_eq(
  $$select accepts_leads, trial_leads_remaining, sales_stage, founding_partner from app.providers where business_id = '00000000-0000-4000-8000-0000000000e1'$$,
  $$values (false, 2, 'prospect', false)$$,
  'a new provider starts with no leads accepted, 2 trial leads, stage prospect and not a founding partner');

-- ---------------------------------------------------------------------------
-- Sources, evidence, restaurant_dishes, photos
-- ---------------------------------------------------------------------------
select throws_ok(
  $$insert into app.sources (kind) values ('csv')$$,
  '23514', null, 'a source has a url unless it is first-hand');
select lives_ok($$insert into app.sources (kind) values ('first_hand')$$, 'a first-hand source needs no url');
insert into app.sources (id, kind, url, title) values ('00000000-0000-4000-8000-0000000000c1', 'official_site', 'https://example.org/menu', 'Menu');
select throws_ok(
  $$insert into app.evidence (entity_type, entity_id, claim_type, claim, source_id, retrieved_at, confidence, extractor_version)
    values ('business', 'x', 'price', '{}', '00000000-0000-4000-8000-0000000000c1', now(), 1.5, 'v1')$$,
  '23514', null, 'evidence confidence is 0 to 1');
insert into app.evidence (id, entity_type, entity_id, claim_type, claim, source_id, retrieved_at, confidence, extractor_version)
values ('00000000-0000-4000-8000-0000000000d1', 'restaurant_dish', 'x', 'price', '{"price": 250}', '00000000-0000-4000-8000-0000000000c1', now(), 0.9, 'v1');

select throws_ok(
  $$insert into app.restaurant_dishes (business_id, dish_id, price_inr) values ('00000000-0000-4000-8000-000000000001', 'biryani', 250)$$,
  '23514', null, 'a dish price is stored only with the evidence that supports it');
select lives_ok(
  $$insert into app.restaurant_dishes (business_id, dish_id, price_inr, evidence_id) values ('00000000-0000-4000-8000-000000000001', 'biryani', 250, '00000000-0000-4000-8000-0000000000d1')$$,
  'a priced dish with evidence is accepted');
select lives_ok(
  $$insert into app.restaurant_dishes (business_id, dish_id) values ('00000000-0000-4000-8000-000000000001', 'veg-biryani')$$,
  'a listed dish without a price is accepted');
select throws_ok(
  $$insert into app.restaurant_dishes (business_id, dish_id, price_inr, evidence_id) values ('00000000-0000-4000-8000-000000000001', 'biryani', 260, '00000000-0000-4000-8000-0000000000d1')$$,
  '23505', null, 'a restaurant lists a dish variant once');
select lives_ok(
  $$insert into app.restaurant_dishes (business_id, dish_id, variant_label, price_inr, evidence_id) values ('00000000-0000-4000-8000-000000000001', 'biryani', 'half', 150, '00000000-0000-4000-8000-0000000000d1')$$,
  'another variant of the same dish is a separate row');
select throws_ok(
  $$insert into app.restaurant_dishes (business_id, dish_id) values ('00000000-0000-4000-8000-0000000000e1', 'biryani')$$,
  '23503', null, 'restaurant_dishes needs a restaurant');

insert into app.experiences (id, business_id, visited_at) values ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-000000000001', now());
select throws_ok(
  $$insert into app.experience_photos (experience_id, storage_path, published) values ('00000000-0000-4000-8000-0000000000f1', 'a/1.webp', true)$$,
  '23514', null, 'a photo is published only with alt text');
select lives_ok(
  $$insert into app.experience_photos (experience_id, storage_path, alt, published) values ('00000000-0000-4000-8000-0000000000f1', 'a/1.webp', 'A plate of biryani', true)$$,
  'a published photo with alt text is accepted');
select throws_ok(
  $$insert into app.experience_photos (experience_id, storage_path) values ('00000000-0000-4000-8000-0000000000f1', 'a/1.webp')$$,
  '23505', null, 'storage_path is unique');

-- ---------------------------------------------------------------------------
-- Leads: idempotency, shape, privacy
-- ---------------------------------------------------------------------------
select throws_ok(
  $$insert into app.leads (ref, lead_type, grade, qualified, name, phone_e164, idempotency_key, consent_version)
    values ('MM-OTHER', 'quote', 'A', true, 'Dup', '+919800000099', '00000000-0000-4000-8000-0000000000b1', 'v1')$$,
  '23505', null, 'leads are idempotent on idempotency_key');
select throws_ok(
  $$insert into app.leads (ref, lead_type, grade, qualified, name, phone_e164, idempotency_key, consent_version)
    values ('MM-T1', 'quote', 'A', true, 'Dup', '+919800000099', gen_random_uuid(), 'v1')$$,
  '23505', null, 'lead refs are unique');
select throws_ok(
  $$insert into app.leads (ref, lead_type, grade, qualified, name, phone_e164, idempotency_key, consent_version)
    values ('MM-BAD', 'quote', 'A', true, 'Bad', '9800000099', gen_random_uuid(), 'v1')$$,
  '23514', null, 'a lead phone is E.164');
select throws_ok(
  $$insert into app.leads (ref, lead_type, grade, qualified, name, idempotency_key, consent_version)
    values ('MM-NOPHONE', 'quote', 'A', true, 'No phone', gen_random_uuid(), 'v1')$$,
  '23514', null, 'a live lead needs a phone');
select lives_ok(
  $$insert into app.leads (ref, lead_type, grade, qualified, idempotency_key, consent_version, anonymised_at)
    values ('MM-ANON', 'quote', 'C', false, gen_random_uuid(), 'v1', now())$$,
  'an anonymised lead carries no name or phone');
select throws_ok(
  $$insert into app.leads (ref, lead_type, grade, qualified, name, phone_e164, idempotency_key, consent_version, synthetic)
    values ('MM-SYN', 'quote', 'A', true, 'Syn', '+919800000098', gen_random_uuid(), 'v1', true)$$,
  '23514', null, 'a synthetic lead is never stored');
select throws_ok(
  format($$insert into app.leads (ref, lead_type, grade, qualified, name, phone_e164, idempotency_key, consent_version, message)
           values ('MM-LONG', 'contact', 'C', false, 'Long', '+919800000097', gen_random_uuid(), 'v1', %L)$$, repeat('x', 1001)),
  '23514', null, 'a lead message is at most 1000 characters');
select throws_ok(
  $$update app.leads set duplicate_of = id where ref = 'MM-T1'$$,
  '23514', null, 'a lead cannot duplicate itself');
select throws_ok(
  $$update app.leads set requested_provider_id = '00000000-0000-4000-8000-000000000001' where ref = 'MM-T1'$$,
  '23503', null, 'a lead can request only a provider');
select throws_ok(
  $$update app.leads set status = 'closed' where ref = 'MM-T1'$$,
  '23514', null, 'lead status is one of the contract values');

-- ---------------------------------------------------------------------------
-- Lead assignments: at most 3 shared; an exclusive assignment excludes all others
-- ---------------------------------------------------------------------------
select lives_ok($$select pg_temp.assign(2, 1, 'shared')$$, 'first shared assignment');
select lives_ok($$select pg_temp.assign(2, 2, 'shared')$$, 'second shared assignment');
select lives_ok($$select pg_temp.assign(2, 3, 'shared')$$, 'third shared assignment');
select throws_ok(
  $$select pg_temp.assign(2, 4, 'shared')$$,
  '23514', 'lead 00000000-0000-4000-8000-0000000000a2 already has 3 shared assignments',
  'a fourth shared assignment is rejected');
select throws_ok(
  $$select pg_temp.assign(2, 4, 'exclusive')$$,
  '23514', null, 'an exclusive assignment is rejected when shared ones exist');
select lives_ok($$delete from app.lead_assignments where lead_id = '00000000-0000-4000-8000-0000000000a2' and provider_id = '00000000-0000-4000-8000-0000000000e3'$$,
  'removing an assignment frees its slot');
select lives_ok($$select pg_temp.assign(2, 4, 'shared')$$, 'the freed slot can be taken again');

select lives_ok($$select pg_temp.assign(3, 1, 'exclusive')$$, 'an exclusive assignment on an unassigned lead');
select throws_ok(
  $$select pg_temp.assign(3, 2, 'shared')$$,
  '23514', 'lead 00000000-0000-4000-8000-0000000000a3 is already assigned exclusively',
  'a shared assignment is rejected next to an exclusive one');
select throws_ok(
  $$select pg_temp.assign(3, 2, 'exclusive')$$,
  '23514', null, 'a second exclusive assignment is rejected');
select throws_ok(
  $$insert into app.lead_assignments (lead_id, provider_id, mode, price_inr) values ('00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-0000000000e2', 'shared', 100)$$,
  '23514', null, 'the limit holds for a plain insert as well');

select lives_ok($$select pg_temp.assign(4, 1, 'shared')$$, 'shared assignment on lead 4');
select throws_ok($$select pg_temp.assign(4, 1, 'shared')$$, '23505', null, 'a provider is assigned to a lead once');
select lives_ok($$select pg_temp.assign(4, 2, 'shared')$$, 'second shared assignment on lead 4');
select throws_ok(
  $$update app.lead_assignments set mode = 'exclusive' where lead_id = '00000000-0000-4000-8000-0000000000a4' and provider_id = '00000000-0000-4000-8000-0000000000e1'$$,
  '23514', null, 'a shared assignment cannot turn exclusive while another assignment exists');
select lives_ok($$select pg_temp.assign(5, 1, 'shared')$$, 'a lone shared assignment on lead 5');
select lives_ok(
  $$update app.lead_assignments set mode = 'exclusive' where lead_id = '00000000-0000-4000-8000-0000000000a5'$$,
  'a lone shared assignment can turn exclusive');
select throws_ok(
  $$insert into app.lead_assignments (lead_id, provider_id, mode, price_inr) values ('00000000-0000-4000-8000-0000000000a6', '00000000-0000-4000-8000-000000000001', 'shared', 100)$$,
  '23503', null, 'only a provider can be assigned a lead');
select throws_ok(
  $$insert into app.lead_assignments (lead_id, provider_id, mode, price_inr) values ('00000000-0000-4000-8000-0000000000a6', '00000000-0000-4000-8000-0000000000e1', 'shared', -1)$$,
  '23514', null, 'an assignment price is not negative');

-- ---------------------------------------------------------------------------
-- Analytics, ranking, credentials and other operational tables
-- ---------------------------------------------------------------------------
select is(
  (select array_agg(a.attname::text order by a.attnum)
     from pg_index i
     join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
    where i.indrelid = 'app.events_daily'::regclass and i.indisprimary),
  (select array_agg(c.column_name::text order by c.ordinal_position)
     from information_schema.columns c
    where c.table_schema = 'app' and c.table_name = 'events_daily'
      and c.column_name not in ('count', 'created_at', 'updated_at')),
  'events_daily is keyed on every column except count (and the row timestamps)');
select is(
  (select array_agg(a.attname::text order by a.attnum)
     from pg_index i
     join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
    where i.indrelid = 'app.demand_daily'::regclass and i.indisprimary),
  array['day', 'vertical', 'locality_id', 'subject_id'],
  'demand_daily is keyed on (day, vertical, locality_id, subject_id)');

insert into app.events_daily (day, host, page_type, event, referrer_class, device, count)
values ('2026-10-10', 'construction', 'calculator', 'calculator_start', 'search', 'mobile', 1);
insert into app.events_daily (day, host, page_type, event, referrer_class, device, count)
values ('2026-10-10', 'construction', 'calculator', 'calculator_start', 'search', 'mobile', 2)
on conflict (day, host, page_type, event, locality_id, subject_id, entity_id, ranking_run_id, slot, campaign_id,
             variant, referrer_class, device, landing_path)
do update set count = app.events_daily.count + excluded.count;
select is((select count from app.events_daily), 3::bigint, 'an event aggregate upserts into one row and adds its count');
select throws_ok(
  $$insert into app.events_daily (day, host, page_type, event, referrer_class, device) values ('2026-10-10', 'food', 'home', 'page_view', 'search', 'mobile')$$,
  '23514', null, 'events_daily only takes the contract event names');
select throws_ok(
  $$insert into app.events_daily (day, host, page_type, event, referrer_class, device, locality_id) values ('2026-10-10', 'food', 'home', 'search', 'search', 'mobile', null)$$,
  '23502', null, 'events_daily dimensions are never NULL (an absent one is an empty string)');

select is(
  (select count(*)::int
     from information_schema.columns
    where table_schema = 'app'
      and (column_name ~* '(^|_)(ip|ips|ip_address|user_agent|ua|useragent|remote_addr)($|_)')),
  0,
  'no table in app has an IP address or user agent column');

select lives_ok(
  $$insert into app.queries (vertical, intent, served_from, candidate_ids, ranks) values ('food', '{"subject_id": "biryani", "locality_id": "baner"}', 'db', array[gen_random_uuid()], array[1])$$,
  'a query row with a ParsedIntent is accepted');
select lives_ok(
  format($$insert into app.queries (vertical, intent, served_from) values ('food', jsonb_build_object('q', %L), 'db')$$, repeat('x', 200)),
  'a query intent string of 200 characters is accepted');
select throws_ok(
  format($$insert into app.queries (vertical, intent, served_from) values ('food', jsonb_build_object('q', %L), 'db')$$, repeat('x', 201)),
  '23514', null, 'a query intent string over 200 characters is rejected');
select throws_ok(
  format($$insert into app.queries (vertical, intent, served_from) values ('food', jsonb_build_object('a', jsonb_build_array(jsonb_build_object('b', %L))), 'db')$$, repeat('x', 201)),
  '23514', null, 'the 200 character limit applies to nested strings too');
select throws_ok(
  $$insert into app.queries (vertical, intent, served_from, candidate_ids, ranks) values ('food', '{}', 'db', array[gen_random_uuid()], '{}')$$,
  '23514', null, 'queries.ranks matches candidate_ids');

select throws_ok(
  format($$insert into app.feedback (page_key, kind, note) values ('p', 'useful', %L)$$, repeat('x', 501)),
  '23514', null, 'a feedback note is at most 500 characters');

select throws_ok(
  $$insert into app.api_credentials (fingerprint, provider, account_label) values ('gsk_abcdefghijklmnopqrstuvwxyz0123456789', 'groq', 'a')$$,
  '23514', null, 'api_credentials takes a 12 character fingerprint, so the key itself can never be stored');
select lives_ok(
  $$insert into app.api_credentials (fingerprint, provider, account_label) values ('a1b2c3d4e5f6', 'groq', 'acct-1')$$,
  'a fingerprint is accepted');

insert into app.governor (day, provider, budget) values ('2026-10-10', 'exa', 100);
select throws_ok($$insert into app.governor (day, provider, budget) values ('2026-10-10', 'exa', 50)$$, '23505', null, 'governor has one row per day and provider');
select throws_ok($$insert into app.governor (day, provider, budget, used) values ('2026-10-10', 'groq', 50, -1)$$, '23514', null, 'governor counters are not negative');
insert into app.rate_buckets (key, window_start, count) values ('ask:1', '2026-10-10 10:00+00', 1);
select throws_ok($$insert into app.rate_buckets (key, window_start) values ('ask:1', '2026-10-10 10:00+00')$$, '23505', null, 'rate_buckets has one row per key and window');

insert into app.ranking_runs (id, kind, config_hash) values ('00000000-0000-4000-8000-0000000000aa', 'food', 'abc');
select lives_ok(
  $$insert into app.recommendations (run_id, page_key, entity_id, rank, organic_score) values ('00000000-0000-4000-8000-0000000000aa', 'biryani/baner', '00000000-0000-4000-8000-000000000001', 1, 0.8)$$,
  'a recommendation row is accepted');
select throws_ok(
  $$insert into app.recommendations (run_id, page_key, entity_id, rank, organic_score) values ('00000000-0000-4000-8000-0000000000aa', 'biryani/baner', '00000000-0000-4000-8000-000000000001', 2, 0.7)$$,
  '23505', null, 'a business appears once per run and page');
select throws_ok(
  $$insert into app.recommendations (run_id, page_key, entity_id, rank, organic_score) values ('00000000-0000-4000-8000-0000000000aa', 'biryani/baner', '00000000-0000-4000-8000-0000000000e1', 0, 0.7)$$,
  '23514', null, 'rank starts at 1');
delete from app.ranking_runs where id = '00000000-0000-4000-8000-0000000000aa';
select is((select count(*)::int from app.recommendations), 0, 'deleting a ranking run removes its recommendations');

select throws_ok($$insert into app.prose_reviews (key, status) values ('guide:baner', 'reviewed')$$, '23514', null, 'a reviewed prose key records who and when');
select throws_ok($$insert into app.provider_credits (provider_id, amount_inr) values ('00000000-0000-4000-8000-0000000000e1', 0)$$, '23514', null, 'a credit ledger entry is never zero');
select throws_ok(
  $$insert into app.featured_listings (business_id, tier, starts_on, ends_on) values ('00000000-0000-4000-8000-000000000001', 'featured', '2026-11-01', '2026-10-01')$$,
  '23514', null, 'a featured listing cannot end before it starts');
select throws_ok(
  $$insert into app.sales_quotes (business_id, product, price_quoted_inr, outcome) values ('00000000-0000-4000-8000-000000000001', 'featured', 3000, 'won')$$,
  '23514', null, 'a decided sales quote records when it was decided');
select throws_ok(
  $$insert into app.jobs (stage, started_at, finished_at) values ('rank', now(), now() - interval '1 hour')$$,
  '23514', null, 'a job cannot finish before it starts');
select throws_ok(
  $$insert into app.lead_prices (service_id, grade, price_inr) values ('terrace-waterproofing', 'A', -5)$$,
  '23514', null, 'a lead price is not negative');
select lives_ok(
  $$insert into app.page_builds (build_id, url, host, locale, page_type, indexable, content_hash, hash_changed_at, gate)
    values ('b1', '/a', 'construction', 'en', 'service_cost', true, 'h', now(), '{}')$$,
  'a page_builds row is accepted');
select throws_ok(
  $$insert into app.page_builds (build_id, url, host, locale, page_type, indexable, content_hash, hash_changed_at, gate)
    values ('b1', '/a', 'construction', 'en', 'service_cost', true, 'h', now(), '{}')$$,
  '23505', null, 'page_builds has one row per build and url');
select throws_ok(
  $$insert into app.chains (name, website_domain) values ('Chain', 'Example.COM')$$,
  '23514', null, 'a chain domain is stored lowercase');

-- ---------------------------------------------------------------------------
-- updated_at, and the "unedited" test used by mm import:reference (updated_at = imported_at)
-- ---------------------------------------------------------------------------
insert into app.chains (id, name, created_at, updated_at) values ('00000000-0000-4000-8000-0000000000c9', 'Old', '2020-01-01', '2020-01-01');
update app.chains set name = 'New' where id = '00000000-0000-4000-8000-0000000000c9';
select is(
  (select updated_at from app.chains where id = '00000000-0000-4000-8000-0000000000c9'),
  now(),
  'an update stamps updated_at with the transaction time');
select is(
  (select created_at from app.chains where id = '00000000-0000-4000-8000-0000000000c9'),
  '2020-01-01'::timestamptz,
  'an update leaves created_at alone');

insert into app.dishes (id, name, diet, price_sanity_min_inr, price_sanity_max_inr, imported_at, created_at, updated_at)
values ('poha', 'Poha', 'veg', 10, 200, '2020-01-01', '2020-01-01', '2020-01-01');
select ok(
  (select updated_at = imported_at from app.dishes where id = 'poha'),
  'a freshly imported row is unedited: updated_at = imported_at');
update app.dishes set description = 'edited by hand' where id = 'poha';
select ok(
  (select updated_at <> imported_at from app.dishes where id = 'poha'),
  'an admin edit makes the row edited: updated_at <> imported_at');
update app.dishes set description = 'imported again', imported_at = now() where id = 'poha';
select ok(
  (select updated_at = imported_at from app.dishes where id = 'poha'),
  'a forced re-import that sets imported_at = now() leaves the row unedited again');

select * from finish();
rollback;
