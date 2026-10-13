-- 0004_catalogue_tables: chains, businesses (+ restaurants / providers), experiences, sources, evidence,
-- restaurant_dishes, provider_services, experience_photos.
-- CONTRACTS section 5. Owner: T02a.
--
-- The observations triggers on businesses, restaurants, providers, restaurant_dishes and cost_models
-- are attached in 0007_observations.sql, once the observations table exists.

-- ---------------------------------------------------------------------------
-- chains
-- ---------------------------------------------------------------------------
create table app.chains (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  website_domain text unique check (website_domain is null or website_domain = lower(website_domain)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select app.init_table('app.chains');

-- ---------------------------------------------------------------------------
-- businesses
-- ---------------------------------------------------------------------------
create table app.businesses (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('restaurant', 'provider')),
  name text not null check (btrim(name) <> ''),
  normalised_name text not null check (btrim(normalised_name) <> ''),
  -- Allocated by the database (T02c upsert_business) at insert; never changes once the business has been published.
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  status text not null default 'candidate' check (status in ('candidate', 'published', 'hidden')),
  locality_id text not null references app.localities (id),
  address text,
  lat double precision check (lat is null or lat between -90 and 90),
  lng double precision check (lng is null or lng between -180 and 180),
  phone text,
  website text check (website is null or website ~* '^https?://'),
  chain_id uuid references app.chains (id) on delete set null,
  branch_key text,
  verification_status text not null default 'unverified' check (verification_status in ('unverified', 'verified')),
  verification_method text check (verification_method in ('website', 'phone', 'business_docs', 'visit')),
  verified_at timestamptz,
  confidence numeric not null default 0 check (confidence between 0 and 1),
  last_verified_at timestamptz,
  published_at timestamptz,
  auto_published boolean not null default false,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint businesses_geo_pair check ((lat is null) = (lng is null)),
  constraint businesses_verified_has_method
    check (verification_status <> 'verified' or (verification_method is not null and verified_at is not null)),
  constraint businesses_published_has_date check (status <> 'published' or published_at is not null)
);
select app.init_table('app.businesses');

-- One row per branch: the identity of a business (plan section 8, tiered dedup).
create unique index businesses_identity_key
  on app.businesses (kind, normalised_name, locality_id, coalesce(branch_key, ''));
create index businesses_name_trgm_idx
  on app.businesses using gin (normalised_name extensions.gin_trgm_ops);
create index businesses_locality_status_idx on app.businesses (locality_id, status);
create index businesses_chain_idx on app.businesses (chain_id) where chain_id is not null;

-- kind and a published slug are fixed: restaurants/providers rows depend on kind, URLs on the slug.
create function app.guard_business_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kind is distinct from old.kind then
    raise exception 'businesses.kind cannot change (business %)', old.id
      using errcode = '23514', constraint = 'businesses_kind_immutable';
  end if;
  if new.slug is distinct from old.slug and old.published_at is not null then
    raise exception 'businesses.slug cannot change after publish (business %)', old.id
      using errcode = '23514', constraint = 'businesses_slug_immutable';
  end if;
  return new;
end;
$$;

create trigger businesses_guard
  before update on app.businesses
  for each row execute function app.guard_business_update();

-- A restaurants row may only hang off a restaurant business, a providers row off a provider.
create function app.require_business_kind()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_kind text;
begin
  select b.kind into v_kind from app.businesses b where b.id = new.business_id;
  if v_kind is distinct from tg_argv[0] then
    raise exception '% row needs a business of kind %, business % is %', tg_table_name, tg_argv[0], new.business_id, coalesce(v_kind, 'missing')
      using errcode = '23514', constraint = tg_table_name || '_kind';
  end if;
  return new;
end;
$$;

create table app.business_redirects (
  host text not null check (host in ('main', 'food', 'construction')),
  from_slug text not null check (from_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  to_business_id uuid not null references app.businesses (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (host, from_slug)
);
select app.init_table('app.business_redirects');
create index business_redirects_target_idx on app.business_redirects (to_business_id);

-- ---------------------------------------------------------------------------
-- restaurants and providers (1:1 extensions of businesses)
-- ---------------------------------------------------------------------------
create table app.restaurants (
  business_id uuid primary key references app.businesses (id) on delete cascade,
  cuisines text[] not null default '{}',
  diet text not null check (diet in ('veg', 'non_veg', 'egg', 'both')),
  price_level smallint check (price_level between 1 and 3),
  -- {"mon": [["11:00", "23:30"]], ...} in IST
  opening_hours jsonb check (opening_hours is null or jsonb_typeof(opening_hours) = 'object'),
  service_modes text[] not null default '{}'
    check (service_modes <@ array['dine_in', 'takeaway', 'delivery']),
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select app.init_table('app.restaurants');

create trigger restaurants_kind
  before insert or update of business_id on app.restaurants
  for each row execute function app.require_business_kind('restaurant');

create table app.providers (
  business_id uuid primary key references app.businesses (id) on delete cascade,
  specializations text[] not null default '{}',
  experience_years smallint check (experience_years is null or experience_years between 0 and 80),
  accepts_leads boolean not null default false,
  service_localities text[] not null default '{}',
  min_job_inr numeric(12, 2) check (min_job_inr is null or min_job_inr >= 0),
  sales_stage text not null default 'prospect'
    check (sales_stage in ('prospect', 'contacted', 'trial', 'paying', 'churned')),
  trial_leads_remaining integer not null default 2 check (trial_leads_remaining >= 0),
  agreed_lead_price_inr numeric(12, 2) check (agreed_lead_price_inr is null or agreed_lead_price_inr >= 0),
  founding_partner boolean not null default false,
  price_locked_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select app.init_table('app.providers');

create trigger providers_kind
  before insert or update of business_id on app.providers
  for each row execute function app.require_business_kind('provider');

-- ---------------------------------------------------------------------------
-- experiences (first-hand visits), then sources and evidence
-- ---------------------------------------------------------------------------
create table app.experiences (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references app.businesses (id) on delete cascade,
  visited_at timestamptz not null,
  -- [{ dish_id, price_paid_inr, rating 1-5, notes }]
  dishes jsonb not null default '[]' check (jsonb_typeof(dishes) = 'array'),
  overall_rating numeric(2, 1) check (overall_rating is null or overall_rating between 1 and 5),
  would_recommend boolean,
  tags text[] not null default '{}',
  notes text not null default '',
  prose_status text not null default 'draft' check (prose_status in ('draft', 'reviewed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select app.init_table('app.experiences');
create index experiences_business_idx on app.experiences (business_id, visited_at desc);

create table app.sources (
  id uuid primary key default gen_random_uuid(),
  kind text not null
    check (kind in ('first_hand', 'owner_manual', 'csv', 'official_site', 'menu', 'directory', 'article', 'aggregator')),
  url text,
  domain_etld1 text,
  owner_group text,
  title text,
  content_hash text,
  http_status integer check (http_status is null or http_status between 100 and 599),
  fetched_at timestamptz,
  experience_id uuid references app.experiences (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A source has a URL, except a first-hand visit.
  constraint sources_url_required check (url is not null or kind = 'first_hand')
);
select app.init_table('app.sources');
create index sources_url_idx on app.sources (url) where url is not null;
create index sources_domain_idx on app.sources (domain_etld1) where domain_etld1 is not null;
create index sources_experience_idx on app.sources (experience_id) where experience_id is not null;

create table app.evidence (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null
    check (entity_type in ('business', 'restaurant_dish', 'provider_service', 'locality', 'cost_model')),
  -- uuid for businesses and joins, slug for localities and cost models, hence text
  entity_id text not null check (btrim(entity_id) <> ''),
  claim_type text not null
    check (claim_type in ('price', 'hours', 'offer', 'availability', 'dish', 'service', 'address', 'phone',
                          'rating', 'mention', 'locality_fact', 'cost_rate')),
  claim jsonb not null check (jsonb_typeof(claim) = 'object'),
  supporting_quote text,
  source_id uuid not null references app.sources (id),
  retrieved_at timestamptz not null,
  -- null: the CLAIM_TIER time-to-live applies (computed by readers)
  valid_until timestamptz,
  confidence numeric not null check (confidence between 0 and 1),
  extractor_version text not null check (btrim(extractor_version) <> ''),
  status text not null default 'active' check (status in ('active', 'superseded', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select app.init_table('app.evidence');
create index evidence_entity_idx on app.evidence (entity_type, entity_id) where status = 'active';
create index evidence_source_idx on app.evidence (source_id);
create index evidence_valid_until_idx on app.evidence (valid_until) where status = 'active';

-- ---------------------------------------------------------------------------
-- restaurant_dishes, provider_services
-- ---------------------------------------------------------------------------
create table app.restaurant_dishes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references app.restaurants (business_id) on delete cascade,
  dish_id text not null references app.dishes (id),
  variant_label text,
  price_inr numeric(10, 2) check (price_inr is null or price_inr > 0),
  evidence_id uuid references app.evidence (id),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- No fabricated data: a price is stored only together with the evidence that supports it.
  constraint restaurant_dishes_price_has_evidence check (price_inr is null or evidence_id is not null)
);
select app.init_table('app.restaurant_dishes');
create unique index restaurant_dishes_identity_key
  on app.restaurant_dishes (business_id, dish_id, coalesce(variant_label, ''));
create index restaurant_dishes_dish_idx on app.restaurant_dishes (dish_id);
create index restaurant_dishes_evidence_idx on app.restaurant_dishes (evidence_id) where evidence_id is not null;

create table app.provider_services (
  business_id uuid not null references app.providers (business_id) on delete cascade,
  service_id text not null references app.services (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (business_id, service_id)
);
select app.init_table('app.provider_services');
create index provider_services_service_idx on app.provider_services (service_id);

-- ---------------------------------------------------------------------------
-- experience_photos (files live in the private experience-photos bucket, see 0008)
-- ---------------------------------------------------------------------------
create table app.experience_photos (
  id uuid primary key default gen_random_uuid(),
  experience_id uuid not null references app.experiences (id) on delete cascade,
  storage_path text not null unique check (btrim(storage_path) <> ''),
  thumb_path text,
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  alt text not null default '',
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A photo goes public only with alt text.
  constraint experience_photos_published_has_alt check (not published or btrim(alt) <> '')
);
select app.init_table('app.experience_photos');
create index experience_photos_experience_idx on app.experience_photos (experience_id);
