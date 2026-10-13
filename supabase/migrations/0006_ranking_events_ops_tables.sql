-- 0006_ranking_events_ops_tables: ranking_runs, recommendations, ask_lookups, queries, events_daily,
-- demand_daily, feedback, search_demand, jobs, api_credentials, governor, rate_buckets, system_events,
-- business_claims, page_builds, prose_reviews.
-- CONTRACTS section 5. Owner: T02a.
--
-- Analytics tables (events_daily, demand_daily, queries, feedback) hold no IP address, no user agent and no
-- free text beyond the limits below. events_daily and demand_daily are keyed on every dimension, and a
-- primary key cannot hold NULL, so an absent dimension is stored as '' (empty string), never NULL.

-- ---------------------------------------------------------------------------
-- ranking_runs, recommendations
-- ---------------------------------------------------------------------------
create table app.ranking_runs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('food', 'provider', 'hot')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  config_hash text not null check (btrim(config_hash) <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ranking_runs_finish_order check (finished_at is null or finished_at >= started_at)
);
select app.init_table('app.ranking_runs');
create index ranking_runs_kind_idx on app.ranking_runs (kind, finished_at desc);

create table app.recommendations (
  run_id uuid not null references app.ranking_runs (id) on delete cascade,
  page_key text not null check (btrim(page_key) <> ''),
  entity_id uuid not null references app.businesses (id) on delete cascade,
  rank integer not null check (rank >= 1),
  organic_score numeric not null,
  components jsonb not null default '{}' check (jsonb_typeof(components) = 'object'),
  labels jsonb not null default '[]' check (jsonb_typeof(labels) = 'array'),
  -- paid placement never changes organic ranking: this score is kept apart from organic_score
  commercial_score numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (run_id, page_key, entity_id)
);
select app.init_table('app.recommendations');
create index recommendations_page_rank_idx on app.recommendations (run_id, page_key, rank);
create index recommendations_entity_idx on app.recommendations (entity_id);

-- ---------------------------------------------------------------------------
-- ask_lookups, queries
-- ---------------------------------------------------------------------------
create table app.ask_lookups (
  id uuid primary key default gen_random_uuid(),
  intent_key text not null check (btrim(intent_key) <> ''),
  status text not null default 'pending' check (status in ('pending', 'done', 'failed')),
  result jsonb check (result is null or jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select app.init_table('app.ask_lookups');
create index ask_lookups_intent_idx on app.ask_lookups (intent_key, created_at desc);

create table app.queries (
  id uuid primary key default gen_random_uuid(),
  vertical text not null check (vertical in ('food', 'construction')),
  -- ParsedIntent. No free text: every string inside is at most 200 characters.
  intent jsonb not null check (
    jsonb_typeof(intent) = 'object'
    and not jsonb_path_exists(intent, '$.** ? (@ like_regex "^.{201,}$" flag "s")')
  ),
  locality_id text,
  candidate_ids uuid[] not null default '{}',
  ranks integer[] not null default '{}',
  served_from text not null check (served_from in ('cache', 'db', 'live')),
  lookup_id uuid references app.ask_lookups (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint queries_ranks_match check (cardinality(candidate_ids) = cardinality(ranks))
);
select app.init_table('app.queries');
create index queries_created_idx on app.queries (created_at);
create index queries_lookup_idx on app.queries (lookup_id) where lookup_id is not null;

-- ---------------------------------------------------------------------------
-- events_daily, demand_daily, feedback, search_demand
-- ---------------------------------------------------------------------------
create table app.events_daily (
  day date not null,
  host text not null check (host in ('main', 'food', 'construction', 'admin')),
  page_type text not null
    check (page_type in ('home', 'city_hub', 'locality_hub', 'dish_city', 'dish_locality', 'food_intent',
                         'locality_food_intent', 'place', 'service_cost', 'service_city', 'locality_service',
                         'provider', 'calculator', 'get_quotes', 'for_contractors', 'ask', 'locality_guide',
                         'legal', 'business', 'contact', 'about', 'not_found', 'thank_you')),
  event text not null
    check (event in ('session_start', 'web_vital', 'search', 'filter', 'recommendation_click', 'website_click',
                     'call_click', 'direction_click', 'whatsapp_click', 'quote_start', 'quote_step', 'quote_submit',
                     'calculator_start', 'calculator_complete', 'featured_click', 'provider_click',
                     'profile_view', 'list_impression', 'ad_impression', 'ad_click',
                     'ask_submit', 'feedback', 'outbound_order_click')),
  locality_id text not null default '',
  subject_id text not null default '',
  entity_id text not null default '',
  ranking_run_id text not null default '',
  slot text not null default '',
  campaign_id text not null default '',
  variant text not null default '',
  referrer_class text not null check (referrer_class in ('search', 'ai', 'social', 'direct', 'other')),
  device text not null check (device in ('mobile', 'tablet', 'desktop')),
  landing_path text not null default '',
  count bigint not null default 0 check (count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (day, host, page_type, event, locality_id, subject_id, entity_id, ranking_run_id, slot,
               campaign_id, variant, referrer_class, device, landing_path)
);
select app.init_table('app.events_daily');

create table app.demand_daily (
  day date not null,
  vertical text not null check (vertical in ('food', 'construction')),
  locality_id text not null default '',
  subject_id text not null default '',
  distinct_visitors integer not null default 0 check (distinct_visitors >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (day, vertical, locality_id, subject_id)
);
select app.init_table('app.demand_daily');

create table app.feedback (
  id uuid primary key default gen_random_uuid(),
  page_key text not null check (btrim(page_key) <> '' and char_length(page_key) <= 300),
  entity_id uuid,
  kind text not null check (kind in ('useful', 'not_useful', 'outdated')),
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select app.init_table('app.feedback');
create index feedback_page_idx on app.feedback (page_key, created_at desc);

create table app.search_demand (
  day date not null,
  page_url text not null,
  query text not null default '',
  impressions integer not null default 0 check (impressions >= 0),
  clicks integer not null default 0 check (clicks >= 0),
  position numeric(8, 2) check (position is null or position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (day, page_url, query)
);
select app.init_table('app.search_demand');

-- ---------------------------------------------------------------------------
-- jobs, api_credentials, governor, rate_buckets, system_events
-- ---------------------------------------------------------------------------
create table app.jobs (
  id uuid primary key default gen_random_uuid(),
  stage text not null check (btrim(stage) <> ''),
  run_id text,
  -- the contract leaves the vocabulary open; chosen here
  status text not null default 'running' check (status in ('running', 'success', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  stats jsonb not null default '{}' check (jsonb_typeof(stats) = 'object'),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jobs_finish_order check (finished_at is null or finished_at >= started_at)
);
select app.init_table('app.jobs');
create index jobs_stage_idx on app.jobs (stage, finished_at desc) where status = 'success';
create index jobs_started_idx on app.jobs (started_at desc);

create table app.api_credentials (
  -- first 12 hex characters of the sha256 of the key. Never the key itself.
  fingerprint text primary key check (fingerprint ~ '^[0-9a-f]{12}$'),
  provider text not null check (provider in ('groq', 'exa', 'firecrawl')),
  account_label text not null check (btrim(account_label) <> ''),
  status text not null default 'active' check (status in ('active', 'cooling', 'disabled')),
  cooldown_until timestamptz,
  disabled_reason text,
  daily_used integer not null default 0 check (daily_used >= 0),
  day date,
  error_count integer not null default 0 check (error_count >= 0),
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select app.init_table('app.api_credentials');
create index api_credentials_provider_idx on app.api_credentials (provider, status);

create table app.governor (
  day date not null,
  provider text not null check (provider in ('groq', 'exa', 'firecrawl')),
  budget integer not null check (budget >= 0),
  used integer not null default 0 check (used >= 0),
  reserved_ask integer not null default 0 check (reserved_ask >= 0),
  breaker_open_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (day, provider)
);
select app.init_table('app.governor');

create table app.rate_buckets (
  key text not null check (btrim(key) <> ''),
  window_start timestamptz not null,
  count integer not null default 0 check (count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (key, window_start)
);
select app.init_table('app.rate_buckets');
create index rate_buckets_window_idx on app.rate_buckets (window_start);

create table app.system_events (
  id uuid primary key default gen_random_uuid(),
  -- the contract leaves the vocabulary open; chosen here
  level text not null check (level in ('info', 'warn', 'error', 'critical')),
  kind text not null check (btrim(kind) <> ''),
  message text not null default '',
  data jsonb not null default '{}' check (jsonb_typeof(data) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select app.init_table('app.system_events');
create index system_events_created_idx on app.system_events (created_at desc);
create index system_events_kind_idx on app.system_events (kind, created_at desc);

-- ---------------------------------------------------------------------------
-- business_claims, page_builds, prose_reviews
-- ---------------------------------------------------------------------------
create table app.business_claims (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references app.businesses (id) on delete cascade,
  claimant_name text not null check (btrim(claimant_name) <> ''),
  phone text,
  email text,
  method text check (method in ('website', 'phone', 'business_docs', 'visit')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select app.init_table('app.business_claims');
create index business_claims_business_idx on app.business_claims (business_id, status);

create table app.page_builds (
  build_id text not null check (btrim(build_id) <> ''),
  url text not null check (btrim(url) <> ''),
  host text not null check (host in ('main', 'food', 'construction', 'admin')),
  locale text not null check (locale in ('en', 'mr', 'hi')),
  page_type text not null
    check (page_type in ('home', 'city_hub', 'locality_hub', 'dish_city', 'dish_locality', 'food_intent',
                         'locality_food_intent', 'place', 'service_cost', 'service_city', 'locality_service',
                         'provider', 'calculator', 'get_quotes', 'for_contractors', 'ask', 'locality_guide',
                         'legal', 'business', 'contact', 'about', 'not_found', 'thank_you')),
  indexable boolean not null,
  content_hash text not null check (btrim(content_hash) <> ''),
  hash_changed_at timestamptz not null,
  noindex_since timestamptz,
  gate jsonb not null check (jsonb_typeof(gate) = 'object'),
  -- ManifestEntry.redirect_to: set when the URL is a redirect
  redirect_to text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (build_id, url)
);
select app.init_table('app.page_builds');
create index page_builds_url_idx on app.page_builds (url, created_at desc);
create index page_builds_created_idx on app.page_builds (created_at);

create table app.prose_reviews (
  key text primary key check (btrim(key) <> ''),
  status text not null default 'draft' check (status in ('draft', 'reviewed')),
  reviewed_at timestamptz,
  reviewer text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prose_reviews_reviewed_has_who
    check (status <> 'reviewed' or (reviewed_at is not null and reviewer is not null))
);
select app.init_table('app.prose_reviews');
