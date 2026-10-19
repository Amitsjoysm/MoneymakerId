-- T02b: api.submit_lead (CONTRACTS section 5 and 6a).
-- Idempotent on idempotency_key; the same phone + service within 30 days is one lead (never sold twice);
-- lead_type = 'reminder' stores a nurture lead. Every case runs in a rolled-back transaction.
-- 22023 = invalid input (stable message prefix mm_invalid), 42501 = insufficient privilege.
begin;
select plan(60);

-- ---------------------------------------------------------------------------
-- Fixtures: reference rows, one published provider, and a valid LeadInsert builder
-- ---------------------------------------------------------------------------
insert into app.localities (id, name, kind, lat, lng, geo_source, jurisdiction) values
  ('baner', 'Baner', 'locality', 18.559, 73.786, '{}', 'PMC'),
  ('wakad', 'Wakad', 'locality', 18.598, 73.760, '{}', 'PCMC');
insert into app.services (id, name, unit) values
  ('terrace-waterproofing', 'Terrace waterproofing', 'sqft'),
  ('interior-painting', 'Interior painting', 'sqft');
insert into app.businesses (id, kind, name, normalised_name, slug, locality_id, status, published_at)
values ('00000000-0000-4000-8000-0000000000a1', 'provider', 'Example Waterproofing Works', 'example waterproofing works',
        'example-waterproofing-works', 'baner', 'published', now());
insert into app.providers (business_id) values ('00000000-0000-4000-8000-0000000000a1');

create function pg_temp.lead(over jsonb default '{}')
returns jsonb language sql as $$
  select $j${
    "lead_type": "quote",
    "idempotency_key": "11111111-1111-4111-8111-111111111111",
    "turnstile_token": "tok-secret-value",
    "consent": { "version": "lead-consent-v1", "accepted": true },
    "name": "Example Visitor",
    "phone": "98765 43210",
    "phone_e164": "+919876543210",
    "grade": "A",
    "qualified": true,
    "visitor_hmac": "hmac-visitor-1",
    "synthetic": false,
    "quote": {
      "service_id": "terrace-waterproofing", "locality_id": "baner", "property_type": "flat", "ownership": "owner",
      "timeline": "within_2_weeks", "area": { "preset": "2bhk", "quantity": null }, "tier": "standard",
      "estimate": { "low": 40000, "expected": 55000, "high": 70000 },
      "requested_provider_id": null, "notes": "Seepage near the parapet"
    },
    "business": null,
    "message": null,
    "attribution": {
      "landing_path": "/pune/baner/terrace-waterproofing/", "page_type": "locality_service", "referrer_class": "search",
      "utm_source": null, "utm_medium": null, "utm_campaign": null, "ranking_run_id": null,
      "ref_code": "C-BANER-WP", "variant": null
    }
  }$j$::jsonb || over;
$$;

-- A different idempotency key per call
create function pg_temp.key(n int) returns text language sql as $$
  select format('22222222-2222-4222-8222-%s', lpad(n::text, 12, '0'));
$$;

create temp table obs_before as select count(*)::int as n from app.observations;

-- ---------------------------------------------------------------------------
-- Allow: a valid quote lead is stored with every field mapped
-- ---------------------------------------------------------------------------
create temp table result_1 as select api.submit_lead(pg_temp.lead()) as r;

select ok((select r ->> 'lead_id' is not null from result_1), 'a valid lead returns a lead_id');
select matches((select r ->> 'ref' from result_1), '^MM-[A-HJ-NP-Z2-9]{6}$', 'the ref is MM- plus six unambiguous characters');
select is((select r -> 'duplicate_of' from result_1), 'null'::jsonb, 'a first lead is not a duplicate');
select is((select count(*)::int from app.leads), 1, 'one lead row exists');

select results_eq(
  $$select lead_type, status, grade, qualified, name, phone_e164, consent_version, visitor_hmac, synthetic, duplicate_of is null, remind_at is null
      from app.leads$$,
  $$values ('quote', 'new', 'A', true, 'Example Visitor', '+919876543210', 'lead-consent-v1', 'hmac-visitor-1', false, true, true)$$,
  'type, status, grade, contact, consent and visitor are stored'
);
select results_eq(
  $$select service_id, locality_id, property_type, ownership, timeline, area_preset, area_quantity, tier,
           estimate_low_inr, estimate_expected_inr, estimate_high_inr, requested_provider_id, quote_notes
      from app.leads$$,
  $$values ('terrace-waterproofing', 'baner', 'flat', 'owner', 'within_2_weeks', '2bhk', null::numeric, 'standard',
            40000::numeric, 55000::numeric, 70000::numeric, null::uuid, 'Seepage near the parapet')$$,
  'the quote context is flattened into columns'
);
select results_eq(
  $$select landing_path, page_type, referrer_class, ref_code, utm_source, ranking_run_id, variant from app.leads$$,
  $$values ('/pune/baner/terrace-waterproofing/', 'locality_service', 'search', 'C-BANER-WP', null::text, null::text, null::text)$$,
  'attribution is stored'
);
select is(
  (select count(*)::int from app.leads l where to_jsonb(l)::text like '%tok-secret-value%' or to_jsonb(l)::text like '%98765 43210%'),
  0,
  'the Turnstile token and the raw phone as typed are never stored'
);
select is((select count(*)::int from app.observations), (select n from obs_before), 'submit_lead writes no observations (it touches no tracked table)');

-- ---------------------------------------------------------------------------
-- Idempotency: the same key returns the same lead and creates nothing
-- ---------------------------------------------------------------------------
select is(api.submit_lead(pg_temp.lead()), (select r from result_1), 'replaying the idempotency key returns the same result');
select is((select count(*)::int from app.leads), 1, 'and creates no second row');
select is(
  (api.submit_lead(pg_temp.lead(jsonb_build_object('name', 'Someone Else', 'message', 'changed'))) ->> 'lead_id')::uuid,
  (select (r ->> 'lead_id')::uuid from result_1),
  'a replay with a different body still returns the original lead (the key decides)'
);
select is((select name from app.leads), 'Example Visitor', 'and the stored lead is not overwritten');

-- ---------------------------------------------------------------------------
-- 30-day dedupe on phone + service: stored, linked to the original, never chained
-- ---------------------------------------------------------------------------
create temp table result_2 as
  select api.submit_lead(pg_temp.lead(jsonb_build_object('idempotency_key', pg_temp.key(2)))) as r;
select is(
  (select (r ->> 'duplicate_of')::uuid from result_2),
  (select (r ->> 'lead_id')::uuid from result_1),
  'the same phone and service within 30 days points at the first lead'
);
select isnt((select r ->> 'lead_id' from result_2), (select r ->> 'lead_id' from result_1), 'the duplicate is its own row');
select isnt((select r ->> 'ref' from result_2), (select r ->> 'ref' from result_1), 'with its own ref');
select is((select count(*)::int from app.leads), 2, 'both rows are kept, so no submission is lost');

create temp table result_3 as
  select api.submit_lead(pg_temp.lead(jsonb_build_object('idempotency_key', pg_temp.key(3)))) as r;
select is(
  (select (r ->> 'duplicate_of')::uuid from result_3),
  (select (r ->> 'lead_id')::uuid from result_1),
  'a third submission points at the original, not at the duplicate (no chains)'
);

select is(
  (api.submit_lead(pg_temp.lead(jsonb_build_object(
     'idempotency_key', pg_temp.key(4),
     'quote', (pg_temp.lead() -> 'quote') || '{"service_id": "interior-painting"}'::jsonb))) -> 'duplicate_of'),
  'null'::jsonb,
  'another service from the same phone is not a duplicate'
);
select is(
  (api.submit_lead(pg_temp.lead(jsonb_build_object('idempotency_key', pg_temp.key(5), 'phone_e164', '+919876543299'))) -> 'duplicate_of'),
  'null'::jsonb,
  'the same service from another phone is not a duplicate'
);

-- the window: a lead 29 days old still counts, one older than 30 days no longer does, and neither does one marked spam
update app.leads set created_at = now() - interval '29 days';
select is(
  (api.submit_lead(pg_temp.lead(jsonb_build_object('idempotency_key', pg_temp.key(18)))) ->> 'duplicate_of')::uuid,
  (select (r ->> 'lead_id')::uuid from result_1),
  'a lead 29 days old is still inside the dedupe window'
);
update app.leads set created_at = now() - interval '31 days';
create temp table result_6 as
  select api.submit_lead(pg_temp.lead(jsonb_build_object('idempotency_key', pg_temp.key(6)))) as r;
select is((select r -> 'duplicate_of' from result_6), 'null'::jsonb, 'a lead 31 days old is outside the dedupe window');

create temp table result_7 as
  select api.submit_lead(pg_temp.lead(jsonb_build_object('idempotency_key', pg_temp.key(7), 'phone_e164', '+919876543277'))) as r;
update app.leads set status = 'spam' where idempotency_key = pg_temp.key(7)::uuid;
select is(
  (api.submit_lead(pg_temp.lead(jsonb_build_object('idempotency_key', pg_temp.key(8), 'phone_e164', '+919876543277'))) -> 'duplicate_of'),
  'null'::jsonb,
  'a lead marked spam is not a dedupe target'
);

-- ---------------------------------------------------------------------------
-- Reminder: a nurture lead with a remind_at, deduped only against other reminders
-- ---------------------------------------------------------------------------
create temp table result_9 as
  select api.submit_lead(pg_temp.lead(jsonb_build_object(
    'lead_type', 'reminder', 'idempotency_key', pg_temp.key(9),
    'consent', '{"version": "reminder-consent-v1", "accepted": true}'::jsonb))) as r;
select is((select r -> 'duplicate_of' from result_9), 'null'::jsonb,
  'a reminder is not a duplicate of a quote lead with the same phone and service');
select results_eq(
  $$select status, lead_type, consent_version, remind_at > now() + interval '6 days' from app.leads
     where idempotency_key = '22222222-2222-4222-8222-000000000009'$$,
  $$values ('nurture', 'reminder', 'reminder-consent-v1', true)$$,
  'a reminder is stored as nurture, with its own consent version and a future remind_at'
);
select is(
  (api.submit_lead(pg_temp.lead(jsonb_build_object('lead_type', 'reminder', 'idempotency_key', pg_temp.key(10)))) ->> 'duplicate_of')::uuid,
  (select (r ->> 'lead_id')::uuid from result_9),
  'a second reminder for the same phone and service is a duplicate of the first reminder'
);
select is(
  (api.submit_lead(pg_temp.lead(jsonb_build_object('idempotency_key', pg_temp.key(11)))) ->> 'duplicate_of')::uuid,
  (select (r ->> 'lead_id')::uuid from result_6),
  'a quote lead after a reminder is a duplicate of the earlier quote lead, never of the reminder'
);

-- reminder date: the next 1 April or 1 May at 09:00 IST that is more than 7 days away
select is(app.next_reminder_at('2026-10-13 10:00+05:30'), '2027-04-01 09:00+05:30'::timestamptz, 'reminder date from October is next 1 April');
select is(app.next_reminder_at('2027-02-10 10:00+05:30'), '2027-04-01 09:00+05:30'::timestamptz, 'reminder date from February is 1 April');
select is(app.next_reminder_at('2027-04-10 10:00+05:30'), '2027-05-01 09:00+05:30'::timestamptz, 'reminder date from 10 April is 1 May');
select is(app.next_reminder_at('2027-04-28 10:00+05:30'), '2028-04-01 09:00+05:30'::timestamptz, 'reminder date inside the last 7 days before 1 May is next year');

-- ---------------------------------------------------------------------------
-- Other lead types: no quote needed, never deduped
-- ---------------------------------------------------------------------------
create temp table result_13 as
  select api.submit_lead(pg_temp.lead(jsonb_build_object(
    'lead_type', 'advertise', 'idempotency_key', pg_temp.key(13), 'quote', null,
    'business', '{"business_name": "Example Contractors", "category": "waterproofing", "locality_id": "baner", "website": null,
                  "whatsapp": null, "email": "owner@example.test", "description": null, "services": ["terrace-waterproofing"],
                  "preferred_placement": "featured"}'::jsonb,
    'message', 'Interested in a featured listing'))) as r;
select results_eq(
  $$select lead_type, service_id is null, business ->> 'business_name', message from app.leads
     where idempotency_key = '22222222-2222-4222-8222-000000000013'$$,
  $$values ('advertise', true, 'Example Contractors', 'Interested in a featured listing')$$,
  'an advertise lead stores its business object and message without a quote'
);
select is(
  (api.submit_lead(pg_temp.lead(jsonb_build_object(
    'lead_type', 'advertise', 'idempotency_key', pg_temp.key(14), 'quote', null,
    'business', '{"business_name": "Example Contractors", "category": "waterproofing", "locality_id": "baner", "website": null,
                  "whatsapp": null, "email": "owner@example.test", "description": null, "services": [], "preferred_placement": null}'::jsonb))) -> 'duplicate_of'),
  'null'::jsonb,
  'a lead without a service is never deduped'
);

-- a custom area, no tier, no estimate and no attribution are all accepted and stored as nulls
create temp table result_17 as
  select api.submit_lead(pg_temp.lead(jsonb_build_object(
    'idempotency_key', pg_temp.key(17), 'phone_e164', '+919876543213', 'attribution', null,
    'quote', (pg_temp.lead() -> 'quote') || '{"area": {"preset": "custom", "quantity": 850.5}, "tier": null, "estimate": null}'::jsonb))) as r;
select results_eq(
  $$select area_preset, area_quantity, tier, estimate_expected_inr, landing_path, page_type, ref_code
      from app.leads where idempotency_key = pg_temp.key(17)::uuid$$,
  $$values ('custom', 850.5::numeric, null::text, null::numeric, null::text, null::text, null::text)$$,
  'allow: a custom area quantity is stored, and a missing tier, estimate and attribution are stored as null'
);

-- a requested provider that does not exist is dropped, not a reason to lose the lead
create temp table result_15 as
  select api.submit_lead(pg_temp.lead(jsonb_build_object(
    'idempotency_key', pg_temp.key(15), 'phone_e164', '+919876543211',
    'quote', (pg_temp.lead() -> 'quote') || '{"requested_provider_id": "99999999-9999-4999-8999-999999999999"}'::jsonb))) as r;
select is(
  (select requested_provider_id from app.leads where id = (select (r ->> 'lead_id')::uuid from result_15)),
  null::uuid,
  'an unknown requested_provider_id is stored as null'
);
create temp table result_16 as
  select api.submit_lead(pg_temp.lead(jsonb_build_object(
    'idempotency_key', pg_temp.key(16), 'phone_e164', '+919876543212',
    'quote', (pg_temp.lead() -> 'quote') || '{"requested_provider_id": "00000000-0000-4000-8000-0000000000a1"}'::jsonb))) as r;
select is(
  (select requested_provider_id from app.leads where id = (select (r ->> 'lead_id')::uuid from result_16)),
  '00000000-0000-4000-8000-0000000000a1'::uuid,
  'a known requested_provider_id is kept'
);

-- ---------------------------------------------------------------------------
-- Deny: input is validated inside the function, and a rejected call stores nothing
-- ---------------------------------------------------------------------------
create temp table lead_count_before as select count(*)::int as n from app.leads;

select throws_ok($$select api.submit_lead('[]'::jsonb)$$, '22023', 'mm_invalid: submit_lead: the argument must be a JSON object', 'deny: a JSON array');
select throws_ok(
  format($$select api.submit_lead(pg_temp.lead(%L::jsonb))$$, jsonb_build_object('idempotency_key', pg_temp.key(32), 'business', jsonb_build_object('blob', repeat('x', 33000)))::text),
  '22023', 'mm_invalid: submit_lead: the payload is larger than 32 KB', 'deny: a payload over 32 KB');
select throws_ok(
  format($$select api.submit_lead(pg_temp.lead(%L::jsonb))$$, '{"consent": {"version": "lead-consent-v1", "accepted": false}}'),
  '22023', 'mm_invalid: submit_lead: consent.accepted must be true', 'deny: consent not accepted');
select throws_ok(
  format($$select api.submit_lead(pg_temp.lead(%L::jsonb))$$, '{"consent": {"version": "", "accepted": true}}'),
  '22023', null, 'deny: empty consent version');
select throws_ok(
  format($$select api.submit_lead(pg_temp.lead(%L::jsonb))$$, '{"name": "   "}'),
  '22023', 'mm_invalid: submit_lead: name must not be empty', 'deny: blank name');
select throws_ok(
  format($$select api.submit_lead(pg_temp.lead(%L::jsonb))$$, jsonb_build_object('name', repeat('x', 81))::text),
  '22023', null, 'deny: name over 80 characters');
select throws_ok(
  format($$select api.submit_lead(pg_temp.lead(%L::jsonb))$$, '{"phone_e164": "9876543210"}'),
  '22023', 'mm_invalid: submit_lead: phone_e164 must be an E.164 number', 'deny: phone without the plus sign');
select throws_ok(
  format($$select api.submit_lead(pg_temp.lead(%L::jsonb))$$, '{"grade": "D"}'),
  '22023', null, 'deny: unknown grade');
select throws_ok(
  format($$select api.submit_lead(pg_temp.lead(%L::jsonb))$$, '{"lead_type": "newsletter"}'),
  '22023', null, 'deny: unknown lead type');
select throws_ok(
  format($$select api.submit_lead(pg_temp.lead(%L::jsonb))$$, '{"idempotency_key": "not-a-uuid"}'),
  '22023', null, 'deny: idempotency key is not a uuid');
select throws_ok(
  format($$select api.submit_lead(pg_temp.lead(%L::jsonb))$$, '{"synthetic": true}'),
  '22023', 'mm_invalid: submit_lead: synthetic leads are never stored', 'deny: a synthetic lead');
select throws_ok(
  format($$select api.submit_lead(pg_temp.lead(%L::jsonb))$$, '{"quote": null}'),
  '22023', 'mm_invalid: submit_lead: a quote lead needs a quote', 'deny: a quote lead without a quote');
select throws_ok(
  format($$select api.submit_lead(pg_temp.lead(%L::jsonb))$$,
    jsonb_build_object('quote', (pg_temp.lead() -> 'quote') || '{"service_id": "no-such-service"}')::text),
  '22023', 'mm_invalid: submit_lead: quote.service_id is not a known service', 'deny: unknown service');
select throws_ok(
  format($$select api.submit_lead(pg_temp.lead(%L::jsonb))$$,
    jsonb_build_object('quote', (pg_temp.lead() -> 'quote') || '{"locality_id": "no-such-place"}')::text),
  '22023', 'mm_invalid: submit_lead: quote.locality_id is not a known locality', 'deny: unknown locality');
select throws_ok(
  format($$select api.submit_lead(pg_temp.lead(%L::jsonb))$$,
    jsonb_build_object('idempotency_key', pg_temp.key(30), 'quote', (pg_temp.lead() -> 'quote') || '{"timeline": "someday"}')::text),
  '22023', null, 'deny: timeline outside the vocabulary (the table check, reported as invalid input)');
select throws_ok(
  format($$select api.submit_lead(pg_temp.lead(%L::jsonb))$$, jsonb_build_object('message', repeat('m', 1001))::text),
  '22023', null, 'deny: message over 1000 characters');
select throws_ok(
  format($$select api.submit_lead(pg_temp.lead(%L::jsonb))$$,
    jsonb_build_object('idempotency_key', pg_temp.key(31), 'attribution', (pg_temp.lead() -> 'attribution') || '{"page_type": "nowhere"}')::text),
  '22023', null, 'deny: page type outside the vocabulary');

select is((select count(*)::int from app.leads), (select n from lead_count_before), 'every rejected call stored nothing');

-- ---------------------------------------------------------------------------
-- Privileges: callable with the publishable key, not by authenticated
-- ---------------------------------------------------------------------------
select ok(has_function_privilege('anon', 'api.submit_lead(jsonb)', 'execute'), 'allow: anon can execute api.submit_lead');
select ok(has_function_privilege('service_role', 'api.submit_lead(jsonb)', 'execute'), 'allow: service_role can execute api.submit_lead');
select ok(not has_function_privilege('authenticated', 'api.submit_lead(jsonb)', 'execute'), 'deny: authenticated cannot execute api.submit_lead');

do $$ begin perform set_config('t.lead', pg_temp.lead(jsonb_build_object('idempotency_key', pg_temp.key(20), 'phone_e164', '+919876543266'))::text, true); end $$;
set local role anon;
select is(
  (api.submit_lead(current_setting('t.lead')::jsonb) -> 'duplicate_of'),
  'null'::jsonb,
  'allow: a call made as anon succeeds (the function runs as its owner)'
);
reset role;
select is((select count(*)::int from app.leads where idempotency_key = pg_temp.key(20)::uuid), 1, 'and the lead was written');

set local role authenticated;
select throws_ok($$select api.submit_lead('{}'::jsonb)$$, '42501', null, 'deny: authenticated gets insufficient privilege');
reset role;

select * from finish();
rollback;
