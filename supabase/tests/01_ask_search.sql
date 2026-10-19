-- T02b: api.ask_search (CONTRACTS section 5 and 6a: ParsedIntent in, AskItem[] out).
-- Published entities only; the latest finished ranking run; active, unexpired evidence; no phone numbers.
-- 22023 = invalid input (mm_invalid), 42501 = insufficient privilege.
begin;
select plan(58);

-- ---------------------------------------------------------------------------
-- Fixtures: invented "Example ..." businesses, in test data only
-- ---------------------------------------------------------------------------
insert into app.localities (id, name, kind, lat, lng, geo_source, jurisdiction) values
  ('baner', 'Baner', 'locality', 18.559, 73.786, '{}', 'PMC'),
  ('wakad', 'Wakad', 'locality', 18.598, 73.760, '{}', 'PCMC');
insert into app.dishes (id, name, parent_id, diet, cravings, price_sanity_min_inr, price_sanity_max_inr) values
  ('biryani', 'Biryani', null, 'both', '{}', 50, 1000),
  ('chicken-biryani', 'Chicken biryani', 'biryani', 'non_veg', '{spicy,filling}', 80, 800),
  ('veg-biryani', 'Veg biryani', 'biryani', 'veg', '{filling}', 60, 500);
insert into app.services (id, name, parent_id, unit) values
  ('waterproofing', 'Waterproofing', null, 'sqft'),
  ('terrace-waterproofing', 'Terrace waterproofing', 'waterproofing', 'sqft'),
  ('interior-painting', 'Interior painting', null, 'sqft');

insert into app.sources (id, kind, url, title, domain_etld1) values
  ('50000000-0000-4000-8000-0000000000a1', 'official_site', 'https://example.test/menu/a', 'Example Kitchen A menu', 'example.test'),
  ('50000000-0000-4000-8000-0000000000a2', 'official_site', 'https://example.test/menu/b', null, 'example.test'),
  ('50000000-0000-4000-8000-0000000000a3', 'official_site', 'https://example.test/old', 'Superseded page', 'example.test'),
  ('50000000-0000-4000-8000-0000000000a4', 'article', 'https://example.test/offer', 'Expired offer', 'example.test'),
  ('50000000-0000-4000-8000-0000000000a5', 'official_site', 'https://example.test/provider/1', 'Example Waterproofing Works', 'example.test'),
  ('50000000-0000-4000-8000-0000000000a6', 'official_site', 'https://example.test/anything', 'Anything', 'example.test');

-- businesses: A verified, B unverified, C candidate, D only stale evidence, E in Wakad, F veg, G stale price + fresh dish claim
insert into app.businesses (id, kind, name, normalised_name, slug, locality_id, status, published_at, phone,
                            verification_status, verification_method, verified_at) values
  ('10000000-0000-4000-8000-0000000000a1', 'restaurant', 'Example Kitchen A', 'example kitchen a', 'example-kitchen-a', 'baner', 'published', now(), '+919800000001', 'verified', 'website', now()),
  ('10000000-0000-4000-8000-0000000000a2', 'restaurant', 'Example Kitchen B', 'example kitchen b', 'example-kitchen-b', 'baner', 'published', now(), '+919800000002', 'unverified', null, null),
  ('10000000-0000-4000-8000-0000000000a3', 'restaurant', 'Example Candidate Kitchen', 'example candidate kitchen', 'example-candidate-kitchen', 'baner', 'candidate', null, null, 'unverified', null, null),
  ('10000000-0000-4000-8000-0000000000a4', 'restaurant', 'Example Stale Kitchen', 'example stale kitchen', 'example-stale-kitchen', 'baner', 'published', now(), null, 'unverified', null, null),
  ('10000000-0000-4000-8000-0000000000a5', 'restaurant', 'Example Wakad Kitchen', 'example wakad kitchen', 'example-wakad-kitchen', 'wakad', 'published', now(), null, 'unverified', null, null),
  ('10000000-0000-4000-8000-0000000000a6', 'restaurant', 'Example Veg Kitchen', 'example veg kitchen', 'example-veg-kitchen', 'baner', 'published', now(), null, 'unverified', null, null),
  ('10000000-0000-4000-8000-0000000000a7', 'restaurant', 'Example Old Price Kitchen', 'example old price kitchen', 'example-old-price-kitchen', 'baner', 'published', now(), null, 'unverified', null, null);
insert into app.restaurants (business_id, diet, opening_hours) values
  ('10000000-0000-4000-8000-0000000000a1', 'non_veg',
   '{"mon":[["00:00","24:00"]],"tue":[["00:00","24:00"]],"wed":[["00:00","24:00"]],"thu":[["00:00","24:00"]],"fri":[["00:00","24:00"]],"sat":[["00:00","24:00"]],"sun":[["00:00","24:00"]]}'),
  ('10000000-0000-4000-8000-0000000000a2', 'both', null),
  ('10000000-0000-4000-8000-0000000000a3', 'both', null),
  ('10000000-0000-4000-8000-0000000000a4', 'both', null),
  ('10000000-0000-4000-8000-0000000000a5', 'both', null),
  ('10000000-0000-4000-8000-0000000000a6', 'veg', null),
  ('10000000-0000-4000-8000-0000000000a7', 'both', null);

-- evidence first (restaurant_dishes needs it for a price); entity ids are text
insert into app.evidence (id, entity_type, entity_id, claim_type, claim, source_id, retrieved_at, valid_until, confidence, extractor_version, status) values
  ('30000000-0000-4000-8000-0000000000a1', 'restaurant_dish', '20000000-0000-4000-8000-0000000000a1', 'price', '{"price": {"price_inr": 180}}', '50000000-0000-4000-8000-0000000000a1', now() - interval '2 days', null, 0.9, 'test', 'active'),
  ('30000000-0000-4000-8000-0000000000a2', 'restaurant_dish', '20000000-0000-4000-8000-0000000000a2', 'price', '{"price": {"price_inr": 320}}', '50000000-0000-4000-8000-0000000000a2', now() - interval '3 days', null, 0.9, 'test', 'active'),
  ('30000000-0000-4000-8000-0000000000a3', 'restaurant_dish', '20000000-0000-4000-8000-0000000000a3', 'price', '{"price": {"price_inr": 100}}', '50000000-0000-4000-8000-0000000000a6', now() - interval '1 day', null, 0.9, 'test', 'active'),
  ('30000000-0000-4000-8000-0000000000a4', 'restaurant_dish', '20000000-0000-4000-8000-0000000000a4', 'price', '{"price": {"price_inr": 150}}', '50000000-0000-4000-8000-0000000000a6', now() - interval '100 days', null, 0.9, 'test', 'active'),
  ('30000000-0000-4000-8000-0000000000a5', 'restaurant_dish', '20000000-0000-4000-8000-0000000000a5', 'price', '{"price": {"price_inr": 200}}', '50000000-0000-4000-8000-0000000000a6', now() - interval '1 day', null, 0.9, 'test', 'active'),
  ('30000000-0000-4000-8000-0000000000a6', 'restaurant_dish', '20000000-0000-4000-8000-0000000000a6', 'price', '{"price": {"price_inr": 140}}', '50000000-0000-4000-8000-0000000000a6', now() - interval '4 days', null, 0.9, 'test', 'active'),
  ('30000000-0000-4000-8000-0000000000a7', 'restaurant_dish', '20000000-0000-4000-8000-0000000000a7', 'price', '{"price": {"price_inr": 150}}', '50000000-0000-4000-8000-0000000000a6', now() - interval '100 days', null, 0.9, 'test', 'active'),
  -- other claims: hours for A (live), a dish claim for G (WARM, live), a superseded claim for B, an expired offer for A
  ('31000000-0000-4000-8000-0000000000a1', 'business', '10000000-0000-4000-8000-0000000000a1', 'hours', '{"hours": {}}', '50000000-0000-4000-8000-0000000000a1', now() - interval '1 day', null, 0.9, 'test', 'active'),
  ('31000000-0000-4000-8000-0000000000a7', 'business', '10000000-0000-4000-8000-0000000000a7', 'dish', '{"dish": {"dish_id": "chicken-biryani"}}', '50000000-0000-4000-8000-0000000000a6', now() - interval '5 days', null, 0.9, 'test', 'active'),
  ('31000000-0000-4000-8000-0000000000b2', 'business', '10000000-0000-4000-8000-0000000000a2', 'dish', '{"dish": {"dish_id": "chicken-biryani"}}', '50000000-0000-4000-8000-0000000000a3', now() - interval '1 day', null, 0.9, 'test', 'superseded'),
  ('31000000-0000-4000-8000-0000000000b1', 'business', '10000000-0000-4000-8000-0000000000a1', 'offer', '{"offer": {"text": "x", "ends_on": null}}', '50000000-0000-4000-8000-0000000000a4', now() - interval '3 days', now() - interval '1 day', 0.9, 'test', 'active');
insert into app.restaurant_dishes (id, business_id, dish_id, price_inr, evidence_id) values
  ('20000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-0000000000a1', 'chicken-biryani', 180, '30000000-0000-4000-8000-0000000000a1'),
  ('20000000-0000-4000-8000-0000000000a2', '10000000-0000-4000-8000-0000000000a2', 'chicken-biryani', 320, '30000000-0000-4000-8000-0000000000a2'),
  ('20000000-0000-4000-8000-0000000000a3', '10000000-0000-4000-8000-0000000000a3', 'chicken-biryani', 100, '30000000-0000-4000-8000-0000000000a3'),
  ('20000000-0000-4000-8000-0000000000a4', '10000000-0000-4000-8000-0000000000a4', 'chicken-biryani', 150, '30000000-0000-4000-8000-0000000000a4'),
  ('20000000-0000-4000-8000-0000000000a5', '10000000-0000-4000-8000-0000000000a5', 'chicken-biryani', 200, '30000000-0000-4000-8000-0000000000a5'),
  ('20000000-0000-4000-8000-0000000000a6', '10000000-0000-4000-8000-0000000000a6', 'veg-biryani', 140, '30000000-0000-4000-8000-0000000000a6'),
  ('20000000-0000-4000-8000-0000000000a7', '10000000-0000-4000-8000-0000000000a7', 'chicken-biryani', 150, '30000000-0000-4000-8000-0000000000a7');

-- providers: P1 published in Baner (also serves Wakad), P2 candidate, P3 published in Wakad, P4 painting only
insert into app.businesses (id, kind, name, normalised_name, slug, locality_id, status, published_at, phone) values
  ('11000000-0000-4000-8000-0000000000a1', 'provider', 'Example Waterproofing Works', 'example waterproofing works', 'example-waterproofing-works', 'baner', 'published', now(), '+919800000099'),
  ('11000000-0000-4000-8000-0000000000a2', 'provider', 'Example Candidate Contractors', 'example candidate contractors', 'example-candidate-contractors', 'baner', 'candidate', null, null),
  ('11000000-0000-4000-8000-0000000000a3', 'provider', 'Example Wakad Waterproofers', 'example wakad waterproofers', 'example-wakad-waterproofers', 'wakad', 'published', now(), null),
  ('11000000-0000-4000-8000-0000000000a4', 'provider', 'Example Painters', 'example painters', 'example-painters', 'baner', 'published', now(), null);
insert into app.providers (business_id, service_localities, min_job_inr) values
  ('11000000-0000-4000-8000-0000000000a1', '{wakad}', 5000),
  ('11000000-0000-4000-8000-0000000000a2', '{}', null),
  ('11000000-0000-4000-8000-0000000000a3', '{}', null),
  ('11000000-0000-4000-8000-0000000000a4', '{}', null);
insert into app.provider_services (business_id, service_id) values
  ('11000000-0000-4000-8000-0000000000a1', 'terrace-waterproofing'),
  ('11000000-0000-4000-8000-0000000000a2', 'terrace-waterproofing'),
  ('11000000-0000-4000-8000-0000000000a3', 'terrace-waterproofing'),
  ('11000000-0000-4000-8000-0000000000a4', 'interior-painting');
insert into app.evidence (id, entity_type, entity_id, claim_type, claim, source_id, retrieved_at, confidence, extractor_version) values
  ('32000000-0000-4000-8000-0000000000a1', 'business', '11000000-0000-4000-8000-0000000000a1', 'service', '{"service": {"service_id": "terrace-waterproofing"}}', '50000000-0000-4000-8000-0000000000a5', now() - interval '10 days', 0.9, 'test'),
  ('32000000-0000-4000-8000-0000000000a2', 'business', '11000000-0000-4000-8000-0000000000a2', 'service', '{"service": {"service_id": "terrace-waterproofing"}}', '50000000-0000-4000-8000-0000000000a6', now() - interval '10 days', 0.9, 'test'),
  ('32000000-0000-4000-8000-0000000000a3', 'business', '11000000-0000-4000-8000-0000000000a3', 'service', '{"service": {"service_id": "terrace-waterproofing"}}', '50000000-0000-4000-8000-0000000000a6', now() - interval '20 days', 0.9, 'test'),
  ('32000000-0000-4000-8000-0000000000a4', 'business', '11000000-0000-4000-8000-0000000000a4', 'service', '{"service": {"service_id": "interior-painting"}}', '50000000-0000-4000-8000-0000000000a6', now() - interval '10 days', 0.9, 'test');

-- rankings: the newest finished run per page key wins; an unfinished run and an older run are ignored
insert into app.ranking_runs (id, kind, started_at, finished_at, config_hash) values
  ('40000000-0000-4000-8000-000000000001', 'food', now() - interval '11 days', now() - interval '10 days', 'cfg'),
  ('40000000-0000-4000-8000-000000000002', 'food', now() - interval '2 days', now() - interval '1 day', 'cfg'),
  ('40000000-0000-4000-8000-000000000003', 'food', now() - interval '1 hour', null, 'cfg'),
  ('40000000-0000-4000-8000-000000000004', 'provider', now() - interval '2 days', now() - interval '1 day', 'cfg');
insert into app.recommendations (run_id, page_key, entity_id, rank, organic_score, labels) values
  ('40000000-0000-4000-8000-000000000001', 'dish_locality:chicken-biryani:baner', '10000000-0000-4000-8000-0000000000a1', 1, 0.9, '["hot"]'),
  ('40000000-0000-4000-8000-000000000002', 'dish_locality:chicken-biryani:baner', '10000000-0000-4000-8000-0000000000a2', 1, 0.9, '["best_value", "not_a_label"]'),
  ('40000000-0000-4000-8000-000000000002', 'dish_locality:chicken-biryani:baner', '10000000-0000-4000-8000-0000000000a1', 2, 0.8, '["hidden_gem"]'),
  ('40000000-0000-4000-8000-000000000003', 'dish_locality:chicken-biryani:baner', '10000000-0000-4000-8000-0000000000a7', 1, 0.99, '[]'),
  ('40000000-0000-4000-8000-000000000004', 'locality_service:baner:terrace-waterproofing', '11000000-0000-4000-8000-0000000000a1', 1, 0.9, '[]');

create function pg_temp.q(intent jsonb, lim int default 10) returns jsonb language sql as $$
  select jsonb_build_object('intent', $j${
    "vertical": "food", "subject_id": "chicken-biryani", "craving": null, "locality_id": "baner", "budget_inr": null,
    "diet": null, "open_now": false, "intent_key": "food:chicken-biryani:baner", "confidence": 0.9
  }$j$::jsonb || intent, 'limit', lim);
$$;
create function pg_temp.names(r jsonb) returns text[] language sql as $$
  select coalesce(array_agg(i ->> 'name' order by o), '{}') from jsonb_array_elements(r) with ordinality as t(i, o);
$$;

create temp table queries_before as select count(*)::int as n from app.queries;
create temp table obs_before as select count(*)::int as n from app.observations;

-- ---------------------------------------------------------------------------
-- Food: published, live evidence, the latest finished run, in rank order
-- ---------------------------------------------------------------------------
create temp table s1 as select api.ask_search(pg_temp.q('{}')) as r;
select is(
  pg_temp.names((select r from s1)),
  array['Example Kitchen B', 'Example Kitchen A', 'Example Old Price Kitchen'],
  'allow: dish + locality returns the published places with live evidence, ranked by the newest finished run, unranked last'
);
select is(jsonb_typeof((select r from s1)), 'array', 'the result is a JSON array of AskItem');
select results_eq(
  $$select r -> 1 ->> 'entity_id', r -> 1 ->> 'name', r -> 1 ->> 'locality_id', r -> 1 ->> 'url', r -> 1 ->> 'summary',
           r -> 1 -> 'price_inr', r -> 1 -> 'labels', r -> 1 -> 'unverified' from s1$$,
  $$select '10000000-0000-4000-8000-0000000000a1', 'Example Kitchen A', 'baner', '/place/example-kitchen-a/', 'Chicken biryani at Example Kitchen A, Baner',
           '180'::jsonb, '["hidden_gem"]'::jsonb, 'false'::jsonb$$,
  'an item carries the entity, the price from live price evidence, and the labels of the newest run'
);
select is((select r -> 1 -> 'trust' from s1), '["verified", "recently_checked", "source_backed", "price_checked", "hours_checked"]'::jsonb,
  'trust labels come from the evidence and the verification status');
select is(
  (select r -> 1 -> 'sources' from s1),
  jsonb_build_array(jsonb_build_object(
    'url', 'https://example.test/menu/a', 'title', 'Example Kitchen A menu',
    'retrieved_at', to_char((now() - interval '1 day') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))),
  'sources list active, unexpired evidence once per URL, newest date, and skip superseded and expired claims'
);
select is((select r -> 0 -> 'labels' from s1), '["best_value"]'::jsonb, 'labels outside the vocabulary are dropped');
select is((select r -> 0 -> 'unverified' from s1), 'true'::jsonb, 'an unverified place is flagged');
select is((select r -> 0 -> 'sources' -> 0 ->> 'title' from s1), 'https://example.test/menu/b', 'a source without a title falls back to its URL');
select is((select r -> 0 -> 'trust' from s1), '["recently_checked", "source_backed", "price_checked"]'::jsonb, 'B has no verification and no hours');
select results_eq(
  $$select r -> 2 -> 'price_inr', r -> 2 -> 'trust' from s1$$,
  $$select 'null'::jsonb, '["recently_checked", "source_backed"]'::jsonb$$,
  'a place whose only price evidence is stale shows no price and no price_checked, but is kept for its fresh dish claim'
);
select is((select count(*)::int from s1, jsonb_array_elements(r) i where i::text like '%+9198%' or i::text like '%phone%'), 0, 'no phone numbers and no phone keys');
select is(
  (select count(*)::int
     from s1, jsonb_array_elements(r) i
    where not (i ?& array['entity_id', 'name', 'locality_id', 'url', 'summary', 'price_inr', 'labels', 'trust', 'sources', 'unverified'])
       or (select count(*) from jsonb_object_keys(i)) <> 10),
  0,
  'every item has exactly the ten AskItem keys (so no phone key)'
);

select is(pg_temp.names(api.ask_search(pg_temp.q('{}', 1))), array['Example Kitchen B'], 'limit 1 returns only the first');
select is(pg_temp.names(api.ask_search(pg_temp.q('{"budget_inr": 200}'))), array['Example Kitchen A'],
  'a budget keeps places whose live price is within it, and drops unpriced ones');
select is(pg_temp.names(api.ask_search(pg_temp.q('{"locality_id": "wakad"}'))), array['Example Wakad Kitchen'], 'another locality');
select is(pg_temp.names(api.ask_search(pg_temp.q('{"locality_id": null}'))),
  array['Example Kitchen B', 'Example Kitchen A', 'Example Wakad Kitchen', 'Example Old Price Kitchen'],
  'no locality searches the whole city');
select is(pg_temp.names(api.ask_search(pg_temp.q('{"subject_id": "biryani", "diet": "veg"}'))),
  array['Example Kitchen B', 'Example Veg Kitchen', 'Example Old Price Kitchen'],
  'a parent dish matches its variants, and diet veg keeps veg and both, not non_veg');
select is(pg_temp.names(api.ask_search(pg_temp.q('{"subject_id": null, "craving": "spicy"}'))),
  array['Example Kitchen B', 'Example Kitchen A', 'Example Old Price Kitchen'],
  'with no dish, a craving matches dishes tagged with it');
select is(pg_temp.names(api.ask_search(pg_temp.q('{"open_now": true}'))), array['Example Kitchen A'],
  'open_now keeps places with live hours evidence that are open now (here: open all day)');
select is(api.ask_search(pg_temp.q('{"subject_id": null, "craving": null}')), '[]'::jsonb, 'no dish and no craving returns an empty array');
select is(api.ask_search(pg_temp.q('{"subject_id": "veg-thali"}')), '[]'::jsonb, 'an unknown dish returns an empty array');

-- ---------------------------------------------------------------------------
-- open hours helper (IST, overnight ranges, bad data)
-- ---------------------------------------------------------------------------
select is(app.is_open_at('{"mon": [["11:00", "23:30"]]}', '2026-10-12 12:00+05:30'), true, 'open: Monday noon inside 11:00-23:30');
select is(app.is_open_at('{"mon": [["11:00", "23:30"]]}', '2026-10-12 23:45+05:30'), false, 'closed: after closing');
select is(app.is_open_at('{"mon": [["11:00", "23:30"]]}', '2026-10-12 10:59+05:30'), false, 'closed: before opening');
select is(app.is_open_at('{"mon": [["11:00", "23:30"]]}', '2026-10-13 12:00+05:30'), false, 'closed: Tuesday has no hours');
select is(app.is_open_at('{"mon": [["11:00", "23:30"]]}', '2026-10-12 06:30:00+00'), true, 'the day and time are read in IST, not UTC (06:30 UTC is 12:00 IST)');
select is(app.is_open_at('{"fri": [["18:00", "02:00"]]}', '2026-10-16 23:00+05:30'), true, 'overnight: Friday 23:00 is inside 18:00-02:00');
select is(app.is_open_at('{"fri": [["18:00", "02:00"]]}', '2026-10-17 01:00+05:30'), true, 'overnight: Saturday 01:00 is still Friday''s hours');
select is(app.is_open_at('{"fri": [["18:00", "02:00"]]}', '2026-10-17 02:00+05:30'), false, 'overnight: closed at 02:00');
select is(app.is_open_at('{"fri": [["18:00", "02:00"]]}', '2026-10-16 17:59+05:30'), false, 'overnight: closed before 18:00');
select is(app.is_open_at('{"mon": [["x", "y"]]}', '2026-10-12 12:00+05:30'), false, 'malformed hours are treated as closed, not as an error');
select is(app.is_open_at(null, '2026-10-12 12:00+05:30'), false, 'no hours means not known to be open');

-- ---------------------------------------------------------------------------
-- Construction: providers, never a phone number
-- ---------------------------------------------------------------------------
create temp table s2 as
  select api.ask_search(pg_temp.q('{"vertical": "construction", "subject_id": "terrace-waterproofing", "intent_key": "construction:terrace-waterproofing:baner"}')) as r;
select is(pg_temp.names((select r from s2)), array['Example Waterproofing Works'], 'allow: published providers of the service in the locality (candidates and other services excluded)');
select results_eq(
  $$select r -> 0 ->> 'url', r -> 0 ->> 'summary', r -> 0 -> 'price_inr', r -> 0 -> 'unverified', r -> 0 -> 'trust' from s2$$,
  $$select '/provider/example-waterproofing-works/', 'Terrace waterproofing provider in Baner', 'null'::jsonb, 'true'::jsonb, '["recently_checked", "source_backed"]'::jsonb$$,
  'a provider item has its profile path, no price, and trust from evidence'
);
select is((select r -> 0 -> 'labels' from s2), '[]'::jsonb, 'and the labels of the provider run');
select is((select count(*)::int from s2 where r::text like '%9800000099%' or r::text like '%phone%'), 0, 'no provider phone number or phone key');
select is(pg_temp.names(api.ask_search(pg_temp.q('{"vertical": "construction", "subject_id": "waterproofing"}'))), array['Example Waterproofing Works'],
  'a parent service matches the providers of its sub-services');
select is(pg_temp.names(api.ask_search(pg_temp.q('{"vertical": "construction", "subject_id": "terrace-waterproofing", "locality_id": "wakad"}'))),
  array['Example Waterproofing Works', 'Example Wakad Waterproofers'],
  'a locality matches providers based there or serving it (service_localities), newest evidence first');
select is(pg_temp.names(api.ask_search(pg_temp.q('{"vertical": "construction", "subject_id": "terrace-waterproofing", "locality_id": "wakad", "budget_inr": 3000}'))),
  array['Example Wakad Waterproofers'],
  'a job budget drops providers whose minimum job is higher');
select is(pg_temp.names(api.ask_search(pg_temp.q('{"vertical": "construction", "subject_id": null}'))),
  array['Example Waterproofing Works', 'Example Painters'], 'no service lists the published providers of the locality');

-- ---------------------------------------------------------------------------
-- Deny
-- ---------------------------------------------------------------------------
select throws_ok($$select api.ask_search('[]'::jsonb)$$, '22023', 'mm_invalid: ask_search: the argument must be a JSON object', 'deny: an array');
select throws_ok($$select api.ask_search('{"limit": 5}'::jsonb)$$, '22023', 'mm_invalid: ask_search: intent is required', 'deny: no intent');
select throws_ok(format($$select api.ask_search(%L::jsonb)$$, pg_temp.q('{"vertical": "travel"}')::text), '22023', null, 'deny: a vertical outside food and construction');
select throws_ok(format($$select api.ask_search(%L::jsonb)$$, pg_temp.q('{}', 11)::text), '22023', 'mm_invalid: ask_search: limit must be between 1 and 10', 'deny: limit above 10');
select throws_ok(format($$select api.ask_search(%L::jsonb)$$, pg_temp.q('{}', 0)::text), '22023', null, 'deny: limit 0');
select throws_ok(format($$select api.ask_search(%L::jsonb)$$, '{"intent": {"vertical": "food"}, "limit": 2.5}'), '22023', null, 'deny: a fractional limit');
select throws_ok(format($$select api.ask_search(%L::jsonb)$$, pg_temp.q('{"budget_inr": -1}')::text), '22023', null, 'deny: a negative budget');
select throws_ok(format($$select api.ask_search(%L::jsonb)$$, pg_temp.q('{"diet": "vegan"}')::text), '22023', null, 'deny: a diet outside the vocabulary');
select throws_ok(format($$select api.ask_search(%L::jsonb)$$, pg_temp.q('{"craving": "hungry"}')::text), '22023', null, 'deny: a craving outside the vocabulary');
select throws_ok(format($$select api.ask_search(%L::jsonb)$$, pg_temp.q('{"subject_id": "Not A Slug"}')::text), '22023', null, 'deny: a subject that is not a slug');
select throws_ok(format($$select api.ask_search(%L::jsonb)$$, pg_temp.q(jsonb_build_object('intent_key', repeat('k', 201)))::text), '22023', null, 'deny: an intent_key over 200 characters');
select throws_ok(format($$select api.ask_search(%L::jsonb)$$, pg_temp.q('{"confidence": 1.5}')::text), '22023', 'mm_invalid: ask_search: intent.confidence must be between 0 and 1', 'deny: a confidence above 1');
select is((select count(*)::int from app.queries), (select n from queries_before), 'ask_search is a read: it logs no query and changes nothing');
select is((select count(*)::int from app.observations), (select n from obs_before), 'and writes no observations');

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
select ok(has_function_privilege('anon', 'api.ask_search(jsonb)', 'execute'), 'allow: anon can execute api.ask_search');
select ok(not has_function_privilege('authenticated', 'api.ask_search(jsonb)', 'execute'), 'deny: authenticated cannot execute api.ask_search');
do $$ begin perform set_config('t.q', pg_temp.q('{}', 2)::text, true); end $$;
set local role anon;
select is(jsonb_array_length(api.ask_search(current_setting('t.q')::jsonb)), 2, 'allow: a call made as anon succeeds');
reset role;
set local role authenticated;
select throws_ok($$select api.ask_search('{}'::jsonb)$$, '42501', null, 'deny: authenticated gets insufficient privilege');
reset role;

select * from finish();
rollback;
