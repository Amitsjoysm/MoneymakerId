-- 0003_reference_tables: cities, localities, locality_profiles, dishes, services, cost_models.
-- CONTRACTS sections 4 and 5. Owner: T02a.
--
-- Conventions for the reference tables (they mirror the data/*.json shapes of section 4):
--   * flat string lists are text[] (as the contract does for popular_dishes, cuisines, tags);
--     lists of objects and nested objects are jsonb with a jsonb_typeof guard;
--   * geo {lat, lng} is flattened to lat and lng; price_sanity and rate_inr likewise;
--   * parent_id foreign keys are deferred so an import may load a whole file in any order;
--   * database rows are authoritative after the first import: imported_at records when a row was
--     last written by `mm import:reference`, and updated_at = imported_at means "unedited".

-- IDs are URL slugs, and some slugs are reserved for routes (CONTRACTS section 4a).
create function app.is_reserved_slug(slug text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select slug in (
           'late-night-food', 'budget-food', 'veg-food', 'veg', 'late-night', 'family', 'office-lunch',
           'ask', 'about', 'api', 'mr', 'hi', 'ui-fixtures'
         )
      or slug like 'under-%'
      or slug like '%-cost';
$$;

comment on function app.is_reserved_slug(text) is
  'True for slugs that routes reserve and that must never be a locality, dish or service id (CONTRACTS section 4a).';

-- ---------------------------------------------------------------------------
-- cities
-- ---------------------------------------------------------------------------
create table app.cities (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (btrim(name) <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select app.init_table('app.cities');

insert into app.cities (id, name) values ('pune', 'Pune');

-- ---------------------------------------------------------------------------
-- localities
-- ---------------------------------------------------------------------------
create table app.localities (
  id text primary key
    check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and not app.is_reserved_slug(id)),
  name text not null check (btrim(name) <> ''),
  kind text not null
    check (kind in ('locality', 'sub_locality', 'landmark')),
  city_id text not null default 'pune' references app.cities (id),
  parent_id text references app.localities (id) deferrable initially deferred,
  aliases text[] not null default '{}',
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  geo_source jsonb not null check (jsonb_typeof(geo_source) = 'object'),
  jurisdiction text not null
    check (jurisdiction in ('PMC', 'PCMC', 'PMRDA', 'cantonment', 'other')),
  pincodes text[] not null default '{}',
  neighbours text[] not null default '{}' check (cardinality(neighbours) <= 6),
  landmarks text[] not null default '{}',
  commercial_centres text[] not null default '{}',
  office_clusters text[] not null default '{}',
  residential_clusters text[] not null default '{}',
  construction_facts jsonb not null default '[]' check (jsonb_typeof(construction_facts) = 'array'),
  food_notes jsonb not null default '[]' check (jsonb_typeof(food_notes) = 'array'),
  i18n jsonb not null default '{"mr": null, "hi": null}' check (jsonb_typeof(i18n) = 'object'),
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Sub-localities and landmarks hang off a locality; landmark ids are prefixed near- (section 4a).
  constraint localities_parent_required check (kind = 'locality' or parent_id is not null),
  constraint localities_landmark_id check (kind <> 'landmark' or id like 'near-%'),
  constraint localities_not_own_parent check (parent_id is distinct from id)
);
select app.init_table('app.localities');

create index localities_city_idx on app.localities (city_id);
create index localities_parent_idx on app.localities (parent_id) where parent_id is not null;
create index localities_kind_idx on app.localities (kind);

-- ---------------------------------------------------------------------------
-- locality_profiles (written by the ranking pipeline, R00)
-- ---------------------------------------------------------------------------
create table app.locality_profiles (
  locality_id text primary key references app.localities (id) on delete cascade,
  search_intent jsonb not null default '{}' check (jsonb_typeof(search_intent) = 'object'),
  popular_dishes text[] not null default '{}',
  price_segments jsonb not null default '{}' check (jsonb_typeof(price_segments) = 'object'),
  business_density numeric not null default 0 check (business_density >= 0),
  data_quality numeric not null default 0 check (data_quality between 0 and 1),
  complete boolean not null default false,
  last_updated timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select app.init_table('app.locality_profiles');

-- ---------------------------------------------------------------------------
-- dishes
-- ---------------------------------------------------------------------------
create table app.dishes (
  id text primary key
    check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and not app.is_reserved_slug(id)),
  name text not null check (btrim(name) <> ''),
  parent_id text references app.dishes (id) deferrable initially deferred,
  aliases text[] not null default '{}',
  cravings text[] not null default '{}'
    check (cravings <@ array['spicy', 'sweet', 'savoury', 'light', 'filling', 'street', 'breakfast', 'late_night', 'healthy']),
  diet text not null check (diet in ('veg', 'non_veg', 'egg', 'both')),
  price_bands_inr numeric[] not null default '{}',
  price_sanity_min_inr numeric not null check (price_sanity_min_inr >= 0),
  price_sanity_max_inr numeric not null,
  description text not null default '',
  prose_status text not null default 'draft' check (prose_status in ('draft', 'reviewed')),
  i18n jsonb not null default '{"mr": null, "hi": null}' check (jsonb_typeof(i18n) = 'object'),
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dishes_price_sanity_order check (price_sanity_max_inr >= price_sanity_min_inr),
  constraint dishes_not_own_parent check (parent_id is distinct from id)
);
select app.init_table('app.dishes');

create index dishes_parent_idx on app.dishes (parent_id) where parent_id is not null;

-- ---------------------------------------------------------------------------
-- services (top-level and sub-services; sub_services nesting is the parent_id relation)
-- ---------------------------------------------------------------------------
create table app.services (
  id text primary key
    check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and not app.is_reserved_slug(id)),
  name text not null check (btrim(name) <> ''),
  parent_id text references app.services (id) deferrable initially deferred,
  unit text not null check (unit in ('sqft', 'rft', 'unit', 'project')),
  area_presets jsonb not null default '[]' check (jsonb_typeof(area_presets) = 'array'),
  scope_options jsonb not null default '[]' check (jsonb_typeof(scope_options) = 'array'),
  materials jsonb not null default '[]' check (jsonb_typeof(materials) = 'array'),
  -- null when unsourced; pages hide it. Otherwise { min, max, basis }.
  duration_days jsonb check (duration_days is null or jsonb_typeof(duration_days) = 'object'),
  questions_to_ask text[] not null default '{}',
  common_mistakes text[] not null default '{}',
  quote_checklist text[] not null default '{}',
  faq jsonb not null default '[]' check (jsonb_typeof(faq) = 'array'),
  prose_status text not null default 'draft' check (prose_status in ('draft', 'reviewed')),
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint services_not_own_parent check (parent_id is distinct from id)
);
select app.init_table('app.services');

create index services_parent_idx on app.services (parent_id) where parent_id is not null;

-- ---------------------------------------------------------------------------
-- cost_models
-- ---------------------------------------------------------------------------
create table app.cost_models (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  service_id text not null references app.services (id),
  scope_id text,
  material_id text,
  tier text not null check (tier in ('budget', 'standard', 'premium')),
  unit text not null check (unit in ('sqft', 'rft', 'unit', 'project')),
  rate_low_inr numeric not null check (rate_low_inr >= 0),
  rate_expected_inr numeric not null,
  rate_high_inr numeric not null,
  min_job_inr numeric check (min_job_inr is null or min_job_inr >= 0),
  -- { materials, labour, preparation, repair, transport, waste }, summing to 1 +/- 0.01 (checked by Zod at import).
  components jsonb not null check (jsonb_typeof(components) = 'object'),
  locality_factors jsonb not null default '[]' check (jsonb_typeof(locality_factors) = 'array'),
  -- SourceRef[]: at least two, from different publishers (checked by Zod at import).
  sources jsonb not null check (jsonb_typeof(sources) = 'array'),
  reviewed_at date not null,
  valid_until date not null,
  status text not null default 'draft' check (status in ('draft', 'reviewed')),
  notes text not null default '',
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cost_models_rate_order check (rate_low_inr <= rate_expected_inr and rate_expected_inr <= rate_high_inr),
  constraint cost_models_validity_order check (valid_until >= reviewed_at)
);
select app.init_table('app.cost_models');

create index cost_models_service_idx on app.cost_models (service_id, tier);
create index cost_models_valid_until_idx on app.cost_models (valid_until);
