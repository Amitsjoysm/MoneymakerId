-- 0005_leads_and_revenue_tables: leads, lead_assignments, lead_prices, provider_credits,
-- featured_listings, advertisers, campaigns, ad_slots, sales_quotes.
-- CONTRACTS section 5 and 6a (LeadRecord). Owner: T02a.
--
-- Money columns are numeric(12,2) rupees. The status vocabularies the contract leaves open
-- (featured_listings.status, campaigns.status, sales_quotes.outcome) are marked below.

-- ---------------------------------------------------------------------------
-- leads: LeadRecord (section 6a), the LeadInsert objects flattened into columns.
-- ---------------------------------------------------------------------------
create table app.leads (
  id uuid primary key default gen_random_uuid(),
  -- public reference such as MM-AB12CD, allocated by api.submit_lead
  ref text not null unique check (btrim(ref) <> ''),
  lead_type text not null
    check (lead_type in ('quote', 'featured_enquiry', 'advertise', 'claim', 'contact', 'for_contractors', 'reminder')),
  status text not null default 'new'
    check (status in ('new', 'contacted', 'qualified', 'assigned', 'won', 'lost', 'spam', 'nurture')),
  grade text not null check (grade in ('A', 'B', 'C')),
  qualified boolean not null,
  -- null after lead_anonymise
  name text check (name is null or char_length(name) between 1 and 80),
  phone_e164 text check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  whatsapp_confirmed boolean not null default false,
  -- the client generates it once per form; api.submit_lead is idempotent on it
  idempotency_key uuid not null unique,
  consent_version text not null check (btrim(consent_version) <> ''),
  consent_accepted_at timestamptz not null default now(),
  -- quote context (LeadSubmission.quote); null for non-quote leads
  service_id text references app.services (id),
  locality_id text references app.localities (id),
  property_type text check (property_type in ('flat', 'independent_house', 'society_common', 'commercial')),
  ownership text check (ownership in ('owner', 'tenant', 'society')),
  timeline text check (timeline in ('within_2_weeks', 'within_1_month', '1_to_3_months', 'researching')),
  area_preset text check (area_preset in ('1bhk', '2bhk', '3bhk', '4bhk', 'independent_house', 'terrace', 'custom')),
  area_quantity numeric check (area_quantity is null or area_quantity > 0),
  tier text check (tier in ('budget', 'standard', 'premium')),
  estimate_low_inr numeric(12, 2) check (estimate_low_inr is null or estimate_low_inr >= 0),
  estimate_expected_inr numeric(12, 2) check (estimate_expected_inr is null or estimate_expected_inr >= 0),
  estimate_high_inr numeric(12, 2) check (estimate_high_inr is null or estimate_high_inr >= 0),
  requested_provider_id uuid references app.providers (business_id) on delete set null,
  quote_notes text check (quote_notes is null or char_length(quote_notes) <= 500),
  -- business / advertise / claim submissions (LeadSubmission.business)
  business jsonb check (business is null or jsonb_typeof(business) = 'object'),
  message text check (message is null or char_length(message) <= 1000),
  -- attribution
  landing_path text,
  page_type text
    check (page_type in ('home', 'city_hub', 'locality_hub', 'dish_city', 'dish_locality', 'food_intent',
                         'locality_food_intent', 'place', 'service_cost', 'service_city', 'locality_service',
                         'provider', 'calculator', 'get_quotes', 'for_contractors', 'ask', 'locality_guide',
                         'legal', 'business', 'contact', 'about', 'not_found', 'thank_you')),
  referrer_class text check (referrer_class in ('search', 'ai', 'social', 'direct', 'other')),
  utm_source text,
  utm_medium text,
  utm_campaign text,
  -- a string from the client, not a foreign key: a lead must never be lost over its attribution
  ranking_run_id text,
  ref_code text,
  variant text,
  visitor_hmac text,
  -- Synthetic test submissions create no row (CONTRACTS section 7); the column documents that.
  synthetic boolean not null default false check (synthetic = false),
  next_follow_up_at timestamptz,
  contact_attempts integer not null default 0 check (contact_attempts >= 0),
  remind_at timestamptz,
  duplicate_of uuid references app.leads (id) on delete set null,
  anonymised_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Until a lead is anonymised it carries a name and a valid phone.
  constraint leads_contact_present
    check (anonymised_at is not null or (name is not null and phone_e164 is not null)),
  constraint leads_not_own_duplicate check (duplicate_of is distinct from id)
);
select app.init_table('app.leads');

-- api.submit_lead dedupes phone + service within 30 days
create index leads_dedupe_idx on app.leads (phone_e164, service_id, created_at desc) where phone_e164 is not null;
create index leads_status_idx on app.leads (status, created_at desc);
create index leads_follow_up_idx on app.leads (next_follow_up_at) where next_follow_up_at is not null;
create index leads_remind_idx on app.leads (remind_at) where remind_at is not null;
create index leads_service_locality_idx on app.leads (service_id, locality_id, created_at);
create index leads_requested_provider_idx on app.leads (requested_provider_id) where requested_provider_id is not null;
create index leads_duplicate_of_idx on app.leads (duplicate_of) where duplicate_of is not null;

-- ---------------------------------------------------------------------------
-- lead_assignments: at most 3 shared per lead; an exclusive assignment excludes all others.
-- ---------------------------------------------------------------------------
create table app.lead_assignments (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references app.leads (id) on delete cascade,
  provider_id uuid not null references app.providers (business_id),
  mode text not null check (mode in ('shared', 'exclusive')),
  price_inr numeric(12, 2) not null check (price_inr >= 0),
  sent_at timestamptz,
  accepted_at timestamptz,
  outcome text not null default 'none' check (outcome in ('none', 'contacted', 'site_visit', 'won', 'lost')),
  quoted_amount_inr numeric(12, 2) check (quoted_amount_inr is null or quoted_amount_inr >= 0),
  final_amount_inr numeric(12, 2) check (final_amount_inr is null or final_amount_inr >= 0),
  area_quantity numeric check (area_quantity is null or area_quantity > 0),
  tier text check (tier in ('budget', 'standard', 'premium')),
  refund_reason text check (refund_reason in ('wrong_number', 'out_of_area', 'duplicate', 'not_owner')),
  credited boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lead_assignments_provider_once unique (lead_id, provider_id)
);
select app.init_table('app.lead_assignments');

-- at most one exclusive assignment per lead (the trigger below also keeps every other assignment out)
create unique index lead_assignments_one_exclusive on app.lead_assignments (lead_id) where mode = 'exclusive';
create index lead_assignments_provider_idx on app.lead_assignments (provider_id, created_at desc);

create function app.enforce_assignment_limits()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_shared integer;
  v_exclusive integer;
begin
  -- Serialise concurrent assignments of one lead, so two sessions cannot both take the last slot.
  perform 1 from app.leads l where l.id = new.lead_id for update;

  select count(*) filter (where a.mode = 'shared'),
         count(*) filter (where a.mode = 'exclusive')
    into v_shared, v_exclusive
    from app.lead_assignments a
   where a.lead_id = new.lead_id and a.id <> new.id;

  if v_exclusive > 0 then
    raise exception 'lead % is already assigned exclusively', new.lead_id
      using errcode = '23514', constraint = 'lead_assignments_exclusive_excludes_all';
  end if;
  if new.mode = 'exclusive' and v_shared > 0 then
    raise exception 'lead % already has shared assignments, so it cannot be assigned exclusively', new.lead_id
      using errcode = '23514', constraint = 'lead_assignments_exclusive_excludes_all';
  end if;
  if new.mode = 'shared' and v_shared >= 3 then
    raise exception 'lead % already has 3 shared assignments', new.lead_id
      using errcode = '23514', constraint = 'lead_assignments_max_3_shared';
  end if;
  return new;
end;
$$;

create trigger lead_assignments_limits
  before insert or update of lead_id, mode on app.lead_assignments
  for each row execute function app.enforce_assignment_limits();

-- ---------------------------------------------------------------------------
-- lead_prices (seeded from data/lead-pricing.json, editable in the admin)
-- ---------------------------------------------------------------------------
create table app.lead_prices (
  service_id text not null references app.services (id),
  grade text not null check (grade in ('A', 'B', 'C')),
  price_inr numeric(12, 2) not null check (price_inr >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (service_id, grade)
);
select app.init_table('app.lead_prices');

-- ---------------------------------------------------------------------------
-- provider_credits: manual ledger, + purchase / - spend
-- ---------------------------------------------------------------------------
create table app.provider_credits (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references app.providers (business_id),
  amount_inr numeric(12, 2) not null check (amount_inr <> 0),
  note text not null default '',
  created_by text not null default 'admin' check (btrim(created_by) <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select app.init_table('app.provider_credits');
create index provider_credits_provider_idx on app.provider_credits (provider_id, created_at);

-- ---------------------------------------------------------------------------
-- featured_listings, advertisers, campaigns, ad_slots (spec section 31), sales_quotes
-- ---------------------------------------------------------------------------
create table app.featured_listings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references app.businesses (id) on delete cascade,
  tier text not null check (tier in ('free', 'featured', 'premium')),
  locality_ids text[] not null default '{}',
  category_ids text[] not null default '{}',
  starts_on date not null,
  ends_on date not null,
  -- the contract leaves the vocabulary open; chosen here
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'ended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint featured_listings_dates check (ends_on >= starts_on)
);
select app.init_table('app.featured_listings');
create index featured_listings_business_idx on app.featured_listings (business_id);
create index featured_listings_active_idx on app.featured_listings (starts_on, ends_on) where status = 'active';

create table app.advertisers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  website text check (website is null or website ~* '^https?://'),
  business_id uuid references app.businesses (id) on delete set null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select app.init_table('app.advertisers');
create index advertisers_business_idx on app.advertisers (business_id) where business_id is not null;

create table app.campaigns (
  id uuid primary key default gen_random_uuid(),
  advertiser_id uuid not null references app.advertisers (id),
  kind text not null check (kind in ('sponsorship', 'banner')),
  budget_inr numeric(12, 2) check (budget_inr is null or budget_inr >= 0),
  -- spec section 31 names the column without a vocabulary
  pricing_model text not null default 'flat' check (btrim(pricing_model) <> ''),
  -- { text, url, image | null }
  creative jsonb not null default '{}' check (jsonb_typeof(creative) = 'object'),
  target_locality text references app.localities (id),
  target_category text,
  starts_on date not null,
  ends_on date not null,
  -- the contract leaves the vocabulary open; chosen here
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'ended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaigns_dates check (ends_on >= starts_on)
);
select app.init_table('app.campaigns');
create index campaigns_advertiser_idx on app.campaigns (advertiser_id);
create index campaigns_active_idx on app.campaigns (starts_on, ends_on) where status = 'active';

create table app.ad_slots (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  page_type text not null
    check (page_type in ('home', 'city_hub', 'locality_hub', 'dish_city', 'dish_locality', 'food_intent',
                         'locality_food_intent', 'place', 'service_cost', 'service_city', 'locality_service',
                         'provider', 'calculator', 'get_quotes', 'for_contractors', 'ask', 'locality_guide',
                         'legal', 'business', 'contact', 'about', 'not_found', 'thank_you')),
  position text not null check (btrim(position) <> ''),
  -- null: every device class
  device text check (device in ('mobile', 'tablet', 'desktop')),
  provider text not null check (provider in ('adsense', 'sponsorship')),
  active boolean not null default false,
  priority integer not null default 0,
  start_date date,
  end_date date,
  campaign_id uuid references app.campaigns (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ad_slots_dates check (start_date is null or end_date is null or end_date >= start_date)
);
select app.init_table('app.ad_slots');
create index ad_slots_campaign_idx on app.ad_slots (campaign_id) where campaign_id is not null;
create index ad_slots_lookup_idx on app.ad_slots (page_type, position) where active;

create table app.sales_quotes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references app.businesses (id) on delete cascade,
  product text not null check (product in ('featured', 'premium', 'sponsorship', 'lead_pack')),
  locality_id text references app.localities (id),
  service_id text references app.services (id),
  price_quoted_inr numeric(12, 2) not null check (price_quoted_inr >= 0),
  discount_reason text,
  -- the contract leaves the vocabulary open; chosen here (a win-rate report needs won / lost / still open)
  outcome text not null default 'open' check (outcome in ('open', 'won', 'lost')),
  objection text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_quotes_decided check (outcome = 'open' or decided_at is not null)
);
select app.init_table('app.sales_quotes');
create index sales_quotes_business_idx on app.sales_quotes (business_id, created_at desc);
