-- 0101_submit_lead: api.submit_lead (CONTRACTS section 5 and 6a). Owner: T02b.
--
--   input   LeadInsert: the LeadSubmission the browser posted (turnstile_token and the phone as typed are
--           ignored and never stored) plus phone_e164, grade, qualified, visitor_hmac, synthetic = false
--   output  { lead_id, ref, duplicate_of }
--
-- Idempotent on idempotency_key: a replay returns the stored lead and writes nothing.
-- The same phone + service within 30 days is one lead: the new submission is kept (so nothing the visitor
-- sent is lost) with duplicate_of pointing at the first lead, and must never be sold again. Reminders
-- ('reminder', the "remind me before monsoon" opt-in) are nurture leads, compared only with other reminders.
-- Rules the contract leaves open are marked "chosen here".

-- A public reference such as MM-AB12CD: six characters from an alphabet without I, O, 0 and 1.
-- The first six bytes of a random uuid are fully random (the version and variant bits sit later).
create function app.new_lead_ref()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  c_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  v_ref text := 'MM-';
begin
  for i in 0 .. 5 loop
    v_ref := v_ref || substr(c_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
  end loop;
  return v_ref;
end;
$$;

-- When a "remind me before monsoon" lead comes due (chosen here): 09:00 IST on the next 1 April or 1 May
-- that is more than seven days away. April is the start of peak waterproofing booking (plan section 12),
-- and an opt-in made in April still gets a reminder on 1 May.
create function app.next_reminder_at(p_now timestamptz)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
declare
  v_local timestamp := p_now at time zone 'Asia/Kolkata';
  v_floor timestamp := v_local + interval '7 days';
  v_year integer := extract(year from v_local)::integer;
  v_candidate timestamp;
begin
  foreach v_candidate in array array[
    make_timestamp(v_year, 4, 1, 9, 0, 0),
    make_timestamp(v_year, 5, 1, 9, 0, 0),
    make_timestamp(v_year + 1, 4, 1, 9, 0, 0)
  ] loop
    if v_candidate > v_floor then
      return v_candidate at time zone 'Asia/Kolkata';
    end if;
  end loop;
  return null;
end;
$$;

create function api.submit_lead(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_fn constant text := 'submit_lead';
  c_dedupe_days constant integer := 30;
  c_max_bytes constant integer := 32768;   -- the Worker accepts 16 KB; the public key makes this callable without it
  v_lead_type text;
  v_key uuid;
  v_name text;
  v_phone text;
  v_grade text;
  v_qualified boolean;
  v_hmac text;
  v_message text;
  v_consent jsonb;
  v_quote jsonb;
  v_area jsonb;
  v_estimate jsonb;
  v_business jsonb;
  v_attr jsonb;
  v_consent_version text;
  v_service text;
  v_locality text;
  v_property text;
  v_ownership text;
  v_timeline text;
  v_preset text;
  v_quantity numeric;
  v_tier text;
  v_low numeric;
  v_expected numeric;
  v_high numeric;
  v_provider uuid;
  v_notes text;
  v_landing text;
  v_page_type text;
  v_referrer text;
  v_utm_source text;
  v_utm_medium text;
  v_utm_campaign text;
  v_run text;
  v_ref_code text;
  v_variant text;
  v_existing app.leads%rowtype;
  v_dup uuid;
  v_status text;
  v_remind timestamptz;
  v_ref text;
  v_id uuid;
  v_attempt integer := 0;
  v_constraint text;
begin
  perform app.require_object(p, c_fn);
  if octet_length(p::text) > c_max_bytes then
    perform app.raise_invalid(c_fn, 'the payload is larger than 32 KB');
  end if;

  v_lead_type := app.in_enum(p, 'lead_type', c_fn,
    array['quote', 'featured_enquiry', 'advertise', 'claim', 'contact', 'for_contractors', 'reminder']);
  v_key := app.in_uuid(p, 'idempotency_key', c_fn);

  v_consent := app.in_obj(p, 'consent', c_fn);
  if v_consent -> 'accepted' is distinct from 'true'::jsonb then
    perform app.raise_invalid(c_fn, 'consent.accepted must be true');
  end if;
  v_consent_version := app.in_text(v_consent, 'version', c_fn, 64, true, 'consent.version');

  v_name := app.in_text(p, 'name', c_fn, 80);
  v_phone := app.in_text(p, 'phone_e164', c_fn, 16);
  if v_phone !~ '^\+[1-9][0-9]{7,14}$' then
    perform app.raise_invalid(c_fn, 'phone_e164 must be an E.164 number');
  end if;
  v_grade := app.in_enum(p, 'grade', c_fn, array['A', 'B', 'C']);
  v_qualified := app.in_bool(p, 'qualified', c_fn);
  v_hmac := app.in_text(p, 'visitor_hmac', c_fn, 128);
  if coalesce(p -> 'synthetic', 'false'::jsonb) is distinct from 'false'::jsonb then
    perform app.raise_invalid(c_fn, 'synthetic leads are never stored');
  end if;
  v_message := app.in_text(p, 'message', c_fn, 1000, false);
  v_business := app.in_obj(p, 'business', c_fn, false);

  v_quote := app.in_obj(p, 'quote', c_fn, false);
  if v_lead_type = 'quote' and v_quote is null then
    perform app.raise_invalid(c_fn, 'a quote lead needs a quote');
  end if;
  if v_quote is not null then
    v_service := app.in_text(v_quote, 'service_id', c_fn, 100, true, 'quote.service_id');
    v_locality := app.in_text(v_quote, 'locality_id', c_fn, 100, true, 'quote.locality_id');
    if not exists (select 1 from app.services s where s.id = v_service) then
      perform app.raise_invalid(c_fn, 'quote.service_id is not a known service');
    end if;
    if not exists (select 1 from app.localities l where l.id = v_locality) then
      perform app.raise_invalid(c_fn, 'quote.locality_id is not a known locality');
    end if;
    v_property := app.in_text(v_quote, 'property_type', c_fn, 40, true, 'quote.property_type');
    v_ownership := app.in_text(v_quote, 'ownership', c_fn, 40, true, 'quote.ownership');
    v_timeline := app.in_text(v_quote, 'timeline', c_fn, 40, true, 'quote.timeline');
    v_area := app.in_obj(v_quote, 'area', c_fn, true, 'quote.area');
    v_preset := app.in_text(v_area, 'preset', c_fn, 40, true, 'quote.area.preset');
    v_quantity := app.in_num(v_area, 'quantity', c_fn, 0.01, 10000000, false, false, 'quote.area.quantity');
    v_tier := app.in_text(v_quote, 'tier', c_fn, 40, false, 'quote.tier');
    v_estimate := app.in_obj(v_quote, 'estimate', c_fn, false, 'quote.estimate');
    if v_estimate is not null then
      v_low := app.in_num(v_estimate, 'low', c_fn, 0, 1000000000, true, false, 'quote.estimate.low');
      v_expected := app.in_num(v_estimate, 'expected', c_fn, 0, 1000000000, true, false, 'quote.estimate.expected');
      v_high := app.in_num(v_estimate, 'high', c_fn, 0, 1000000000, true, false, 'quote.estimate.high');
    end if;
    v_provider := app.in_uuid(v_quote, 'requested_provider_id', c_fn, false, 'quote.requested_provider_id');
    -- A provider that is no longer in the catalogue is no reason to lose the lead.
    if v_provider is not null and not exists (select 1 from app.providers pr where pr.business_id = v_provider) then
      v_provider := null;
    end if;
    v_notes := app.in_text(v_quote, 'notes', c_fn, 500, false, 'quote.notes');
  end if;

  v_attr := app.in_obj(p, 'attribution', c_fn, false);
  if v_attr is not null then
    v_landing := app.in_text(v_attr, 'landing_path', c_fn, 512, false, 'attribution.landing_path');
    v_page_type := app.in_text(v_attr, 'page_type', c_fn, 40, false, 'attribution.page_type');
    v_referrer := app.in_text(v_attr, 'referrer_class', c_fn, 40, false, 'attribution.referrer_class');
    v_utm_source := app.in_text(v_attr, 'utm_source', c_fn, 100, false, 'attribution.utm_source');
    v_utm_medium := app.in_text(v_attr, 'utm_medium', c_fn, 100, false, 'attribution.utm_medium');
    v_utm_campaign := app.in_text(v_attr, 'utm_campaign', c_fn, 100, false, 'attribution.utm_campaign');
    v_run := app.in_text(v_attr, 'ranking_run_id', c_fn, 64, false, 'attribution.ranking_run_id');
    v_ref_code := app.in_text(v_attr, 'ref_code', c_fn, 64, false, 'attribution.ref_code');
    v_variant := app.in_text(v_attr, 'variant', c_fn, 64, false, 'attribution.variant');
  end if;

  -- Idempotency: the same key is the same lead.
  select * into v_existing from app.leads l where l.idempotency_key = v_key;
  if found then
    return jsonb_build_object('lead_id', v_existing.id, 'ref', v_existing.ref, 'duplicate_of', v_existing.duplicate_of);
  end if;

  -- Dedupe on phone + service within 30 days. Two submissions of one phone and service queue here, so
  -- both cannot decide they are the original. Leads without a service are never deduped. A reminder is
  -- compared only with reminders (chosen here), so a quote request and a reminder for the same job coexist.
  if v_service is not null then
    perform pg_advisory_xact_lock(hashtextextended(c_fn || ':' || v_phone || ':' || v_service, 0));
    select l.id into v_dup
      from app.leads l
     where l.phone_e164 = v_phone
       and l.service_id = v_service
       and l.created_at > now() - make_interval(days => c_dedupe_days)
       and l.duplicate_of is null
       and l.status <> 'spam'
       and (l.lead_type = 'reminder') = (v_lead_type = 'reminder')
     order by l.created_at desc
     limit 1;
  end if;

  v_status := case when v_lead_type = 'reminder' then 'nurture' else 'new' end;
  v_remind := case when v_lead_type = 'reminder' then app.next_reminder_at(now()) end;

  loop
    v_attempt := v_attempt + 1;
    v_ref := app.new_lead_ref();
    begin
      insert into app.leads (
        ref, lead_type, status, grade, qualified, name, phone_e164, idempotency_key, consent_version,
        service_id, locality_id, property_type, ownership, timeline, area_preset, area_quantity, tier,
        estimate_low_inr, estimate_expected_inr, estimate_high_inr, requested_provider_id, quote_notes,
        business, message,
        landing_path, page_type, referrer_class, utm_source, utm_medium, utm_campaign, ranking_run_id, ref_code, variant,
        visitor_hmac, remind_at, duplicate_of
      ) values (
        v_ref, v_lead_type, v_status, v_grade, v_qualified, v_name, v_phone, v_key, v_consent_version,
        v_service, v_locality, v_property, v_ownership, v_timeline, v_preset, v_quantity, v_tier,
        v_low, v_expected, v_high, v_provider, v_notes,
        v_business, v_message,
        v_landing, v_page_type, v_referrer, v_utm_source, v_utm_medium, v_utm_campaign, v_run, v_ref_code, v_variant,
        v_hmac, v_remind, v_dup
      )
      returning id into v_id;
      exit;
    exception
      when unique_violation then
        get stacked diagnostics v_constraint = constraint_name;
        if v_constraint = 'leads_idempotency_key_key' then
          -- a concurrent request with the same key won: this is a replay
          select * into v_existing from app.leads l where l.idempotency_key = v_key;
          return jsonb_build_object('lead_id', v_existing.id, 'ref', v_existing.ref, 'duplicate_of', v_existing.duplicate_of);
        elsif v_constraint = 'leads_ref_key' and v_attempt < 5 then
          null; -- a reference collision: draw another
        else
          raise;
        end if;
      when check_violation then
        get stacked diagnostics v_constraint = constraint_name;
        perform app.raise_invalid(c_fn, format('a value is outside what is accepted (%s)', coalesce(v_constraint, 'check')));
    end;
  end loop;

  return jsonb_build_object('lead_id', v_id, 'ref', v_ref, 'duplicate_of', v_dup);
end;
$$;

revoke all on function api.submit_lead(jsonb) from public;
grant execute on function api.submit_lead(jsonb) to anon, service_role;

comment on function api.submit_lead(jsonb) is
  'LeadInsert -> { lead_id, ref, duplicate_of }. Idempotent on idempotency_key; phone + service within 30 days links the new lead to the first (duplicate_of); lead_type reminder stores a nurture lead.';
