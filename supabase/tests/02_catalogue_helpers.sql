-- T02c: the small pure helpers behind upsert_business, evidence_insert and export_catalogue.
-- They live in schema app, so no API role can run them (asserted in 02_functions.sql).
begin;
select plan(38);

-- normalised_name: the identity of a business is its normalised name
select is(app.normalise_name('Example Misal-House & Cafe'), 'example misal house and cafe', 'normalise_name: case, hyphen and ampersand');
select is(app.normalise_name('  Joshi''s   Vada Pav!! '), 'joshis vada pav', 'normalise_name: apostrophes dropped, punctuation and runs of spaces collapsed');
select is(app.normalise_name('Joshi’s Vada Pav'), 'joshis vada pav', 'normalise_name: a typographic apostrophe is dropped too');
select is(app.normalise_name('Ｅｘａｍｐｌｅ Cafe'), 'example cafe', 'normalise_name: full-width letters are folded (NFKC)');
select is(app.normalise_name('शिवाजी मिसळ'), 'शिवाजी मिसळ', 'normalise_name: Devanagari letters and vowel signs survive');
select is(app.normalise_name('!!! ---'), '', 'normalise_name: nothing left of pure punctuation');

-- slugify
select is(app.slugify('example misal house'), 'example-misal-house', 'slugify: spaces become hyphens');
select is(app.slugify('  --Café 24x7--  '), 'caf-24x7', 'slugify: leading, trailing and doubled separators removed, non-ASCII dropped');
select is(app.slugify('शिवाजी'), '', 'slugify: a name with no ASCII letters has no slug of its own');

-- phone_key: the last ten digits identify a phone
select is(app.phone_key('+91 98765 43210'), '9876543210', 'phone_key: +91 prefix and spaces');
select is(app.phone_key('098765-43210'), '9876543210', 'phone_key: a leading zero');
select is(app.phone_key('020 2567 1234'), '2025671234', 'phone_key: a landline with its area code');
select is(app.phone_key('2567 1234'), null, 'phone_key: fewer than ten digits is not a key');
select is(app.phone_key(null), null, 'phone_key: null');

-- distance_m
select is(round(app.distance_m(18.5590, 73.7868, 18.5590, 73.7868)::numeric), 0::numeric, 'distance_m: same point');
select ok(app.distance_m(18.5590, 73.7868, 18.5610, 73.7868) between 215 and 230, 'distance_m: 0.002 degrees of latitude is about 222 m');
select ok(app.distance_m(18.5590, 73.7868, 18.5590, 73.8268) between 4150 and 4300, 'distance_m: 0.04 degrees of longitude at Pune is about 4.2 km');
select is(app.distance_m(null, 73.7868, 18.5610, 73.7868), null, 'distance_m: unknown when a coordinate is missing');

-- registrable_domain: the database's own conservative copy (the TypeScript side uses tldts)
select is(app.registrable_domain('https://www.punemirror.com/food/best-misal?x=1'), 'punemirror.com', 'registrable_domain: www and path removed');
select is(app.registrable_domain('http://Menu.Example-Cafe.co.in:8080/a'), 'example-cafe.co.in', 'registrable_domain: a two-label public suffix (co.in) keeps three labels');
select is(app.registrable_domain('https://example.org'), 'example.org', 'registrable_domain: a bare domain');
select is(app.registrable_domain('https://blog.example.com.au/x'), 'example.com.au', 'registrable_domain: com.au');
select is(app.registrable_domain('not a url'), null, 'registrable_domain: not a URL');
select is(app.registrable_domain(null), null, 'registrable_domain: null');

-- claim_tier follows CONTRACTS 8a
select is(app.claim_tier('price'), 'HOT', 'claim_tier: price is HOT');
select is(app.claim_tier('dish'), 'WARM', 'claim_tier: dish is WARM');
select is(app.claim_tier('address'), 'COLD', 'claim_tier: address is COLD');
select is(app.claim_tier('cost_rate'), 'COST', 'claim_tier: cost_rate is COST');

-- locality_root: the top of a locality subtree
insert into app.localities (id, name, kind, lat, lng, geo_source, jurisdiction) values
  ('baner', 'Baner', 'locality', 18.559, 73.7868, '{}', 'PMC'),
  ('hinjewadi', 'Hinjewadi', 'locality', 18.5912, 73.7389, '{}', 'PMRDA');
insert into app.localities (id, name, kind, parent_id, lat, lng, geo_source, jurisdiction) values
  ('hinjewadi-phase-1', 'Hinjewadi Phase 1', 'sub_locality', 'hinjewadi', 18.5913, 73.739, '{}', 'PMRDA'),
  ('near-example-park', 'Near Example Park', 'landmark', 'hinjewadi-phase-1', 18.5914, 73.7391, '{}', 'PMRDA');
select is(app.locality_root('baner'), 'baner', 'locality_root: a top-level locality is its own root');
select is(app.locality_root('hinjewadi-phase-1'), 'hinjewadi', 'locality_root: a sub-locality');
select is(app.locality_root('near-example-park'), 'hinjewadi', 'locality_root: a landmark two levels down');
select is(app.locality_root('nowhere'), null, 'locality_root: unknown id');

-- clean_claim: every claim is rebuilt from validated fields, so a stray key never reaches the snapshot
insert into app.dishes (id, name, diet, price_sanity_min_inr, price_sanity_max_inr) values ('biryani', 'Biryani', 'both', 50, 1500);
select is(
  app.clean_claim('price', '{"price": {"dish_id": "biryani", "service_id": null, "price_inr": 250, "unit": "serving", "extra": 1}}', 'test', 'claim'),
  '{"price": {"dish_id": "biryani", "service_id": null, "price_inr": 250, "unit": "serving"}}'::jsonb,
  'clean_claim: a price claim is rebuilt and the stray key dropped'
);
select throws_ok(
  $$select app.clean_claim('price', '{"price": {"dish_id": "biryani", "service_id": null, "price_inr": 250.5, "unit": "serving"}}', 'test', 'claim')$$,
  '22023', null, 'clean_claim: a price must be a whole number of rupees');
select throws_ok(
  $$select app.clean_claim('price', '{"price": {"dish_id": null, "service_id": null, "price_inr": 250, "unit": "serving"}}', 'test', 'claim')$$,
  '22023', null, 'clean_claim: a price names a dish or a service');
select throws_ok(
  $$select app.clean_claim('hours', '{"hours": {"funday": [["10:00", "22:00"]]}}', 'test', 'claim')$$,
  '22023', null, 'clean_claim: hours need real weekdays');
select throws_ok(
  $$select app.clean_claim('rating', '{"rating": {"value": 6, "scale": 5}}', 'test', 'claim')$$,
  '22023', null, 'clean_claim: a rating cannot exceed its scale');
select throws_ok(
  $$select app.clean_claim('price', '{"hours": {}}', 'test', 'claim')$$,
  '22023', null, 'clean_claim: the claim must be stored under its own type');

select * from finish();
rollback;
