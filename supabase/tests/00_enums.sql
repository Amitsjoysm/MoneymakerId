-- T02a: every enumerated column carries exactly the vocabulary of CONTRACTS section 3.
-- The comparison reads the CHECK constraints from the catalog, so a value added to or dropped from a
-- constraint (or from the contract) shows up here, with the offending table.column listed on failure.
begin;
select plan(4);

create temp table enum_def (name text primary key, vals text[] not null) on commit drop;
insert into enum_def (name, vals) values
  ('LocalityKind', array['locality', 'sub_locality', 'landmark']),
  ('Jurisdiction', array['PMC', 'PCMC', 'PMRDA', 'cantonment', 'other']),
  ('BusinessKind', array['restaurant', 'provider']),
  ('BusinessStatus', array['candidate', 'published', 'hidden']),
  ('VerificationStatus', array['unverified', 'verified']),
  ('VerificationMethod', array['website', 'phone', 'business_docs', 'visit']),
  ('SourceKind', array['first_hand', 'owner_manual', 'csv', 'official_site', 'menu', 'directory', 'article', 'aggregator']),
  ('ClaimType', array['price', 'hours', 'offer', 'availability', 'dish', 'service', 'address', 'phone', 'rating',
                      'mention', 'locality_fact', 'cost_rate']),
  ('EvidenceStatus', array['active', 'superseded', 'rejected']),
  ('ProseStatus', array['draft', 'reviewed']),
  ('Diet', array['veg', 'non_veg', 'egg', 'both']),
  ('Craving', array['spicy', 'sweet', 'savoury', 'light', 'filling', 'street', 'breakfast', 'late_night', 'healthy']),
  ('ServiceMode', array['dine_in', 'takeaway', 'delivery']),
  ('Tier', array['budget', 'standard', 'premium']),
  ('CostUnit', array['sqft', 'rft', 'unit', 'project']),
  ('AreaPreset', array['1bhk', '2bhk', '3bhk', '4bhk', 'independent_house', 'terrace', 'custom']),
  ('PropertyType', array['flat', 'independent_house', 'society_common', 'commercial']),
  ('Ownership', array['owner', 'tenant', 'society']),
  ('Timeline', array['within_2_weeks', 'within_1_month', '1_to_3_months', 'researching']),
  ('LeadType', array['quote', 'featured_enquiry', 'advertise', 'claim', 'contact', 'for_contractors', 'reminder']),
  ('LeadStatus', array['new', 'contacted', 'qualified', 'assigned', 'won', 'lost', 'spam', 'nurture']),
  ('LeadGrade', array['A', 'B', 'C']),
  ('AssignmentMode', array['shared', 'exclusive']),
  ('AssignmentOutcome', array['none', 'contacted', 'site_visit', 'won', 'lost']),
  ('RefundReason', array['wrong_number', 'out_of_area', 'duplicate', 'not_owner']),
  ('SalesStage', array['prospect', 'contacted', 'trial', 'paying', 'churned']),
  ('ListingTier', array['free', 'featured', 'premium']),
  ('SalesProduct', array['featured', 'premium', 'sponsorship', 'lead_pack']),
  ('Host', array['main', 'food', 'construction', 'admin']),
  ('PublicHost', array['main', 'food', 'construction']),
  ('Locale', array['en', 'mr', 'hi']),
  ('ReferrerClass', array['search', 'ai', 'social', 'direct', 'other']),
  ('DeviceClass', array['mobile', 'tablet', 'desktop']),
  ('Provider', array['groq', 'exa', 'firecrawl']),
  ('EventName', array['session_start', 'web_vital', 'search', 'filter', 'recommendation_click', 'website_click',
                      'call_click', 'direction_click', 'whatsapp_click', 'quote_start', 'quote_step', 'quote_submit',
                      'calculator_start', 'calculator_complete', 'featured_click', 'provider_click',
                      'profile_view', 'list_impression', 'ad_impression', 'ad_click',
                      'ask_submit', 'feedback', 'outbound_order_click']),
  ('PageType', array['home', 'city_hub', 'locality_hub', 'dish_city', 'dish_locality', 'food_intent',
                     'locality_food_intent', 'place', 'service_cost', 'service_city', 'locality_service',
                     'provider', 'calculator', 'get_quotes', 'for_contractors', 'ask', 'locality_guide',
                     'legal', 'business', 'contact', 'about', 'not_found', 'thank_you']),
  ('Vertical', array['food', 'construction']),
  ('RankingKind', array['food', 'provider', 'hot']),
  ('ServedFrom', array['cache', 'db', 'live']),
  ('LookupStatus', array['pending', 'done', 'failed']),
  ('FeedbackKind', array['useful', 'not_useful', 'outdated']),
  ('CredentialStatus', array['active', 'cooling', 'disabled']),
  ('ClaimStatus', array['pending', 'approved', 'rejected']),
  ('CampaignKind', array['sponsorship', 'banner']),
  ('AdProvider', array['adsense', 'sponsorship']),
  ('ObservationActor', array['admin', 'csv', 'pipeline', 'ask']),
  ('EvidenceEntityType', array['business', 'restaurant_dish', 'provider_service', 'locality', 'cost_model']);

create temp table enum_use (tbl text not null, col text not null, enum_name text not null references enum_def (name)) on commit drop;
insert into enum_use (tbl, col, enum_name) values
  ('localities', 'kind', 'LocalityKind'),
  ('localities', 'jurisdiction', 'Jurisdiction'),
  ('dishes', 'diet', 'Diet'),
  ('dishes', 'cravings', 'Craving'),
  ('dishes', 'prose_status', 'ProseStatus'),
  ('services', 'unit', 'CostUnit'),
  ('services', 'prose_status', 'ProseStatus'),
  ('cost_models', 'tier', 'Tier'),
  ('cost_models', 'unit', 'CostUnit'),
  ('cost_models', 'status', 'ProseStatus'),
  ('businesses', 'kind', 'BusinessKind'),
  ('businesses', 'status', 'BusinessStatus'),
  ('businesses', 'verification_status', 'VerificationStatus'),
  ('businesses', 'verification_method', 'VerificationMethod'),
  ('business_redirects', 'host', 'PublicHost'),
  ('restaurants', 'diet', 'Diet'),
  ('restaurants', 'service_modes', 'ServiceMode'),
  ('providers', 'sales_stage', 'SalesStage'),
  ('experiences', 'prose_status', 'ProseStatus'),
  ('sources', 'kind', 'SourceKind'),
  ('evidence', 'entity_type', 'EvidenceEntityType'),
  ('evidence', 'claim_type', 'ClaimType'),
  ('evidence', 'status', 'EvidenceStatus'),
  ('observations', 'entity_type', 'EvidenceEntityType'),
  ('observations', 'actor', 'ObservationActor'),
  ('ranking_runs', 'kind', 'RankingKind'),
  ('leads', 'lead_type', 'LeadType'),
  ('leads', 'status', 'LeadStatus'),
  ('leads', 'grade', 'LeadGrade'),
  ('leads', 'property_type', 'PropertyType'),
  ('leads', 'ownership', 'Ownership'),
  ('leads', 'timeline', 'Timeline'),
  ('leads', 'area_preset', 'AreaPreset'),
  ('leads', 'tier', 'Tier'),
  ('leads', 'page_type', 'PageType'),
  ('leads', 'referrer_class', 'ReferrerClass'),
  ('lead_assignments', 'mode', 'AssignmentMode'),
  ('lead_assignments', 'outcome', 'AssignmentOutcome'),
  ('lead_assignments', 'tier', 'Tier'),
  ('lead_assignments', 'refund_reason', 'RefundReason'),
  ('lead_prices', 'grade', 'LeadGrade'),
  ('featured_listings', 'tier', 'ListingTier'),
  ('campaigns', 'kind', 'CampaignKind'),
  ('ad_slots', 'page_type', 'PageType'),
  ('ad_slots', 'device', 'DeviceClass'),
  ('ad_slots', 'provider', 'AdProvider'),
  ('sales_quotes', 'product', 'SalesProduct'),
  ('queries', 'vertical', 'Vertical'),
  ('queries', 'served_from', 'ServedFrom'),
  ('ask_lookups', 'status', 'LookupStatus'),
  ('events_daily', 'host', 'Host'),
  ('events_daily', 'page_type', 'PageType'),
  ('events_daily', 'event', 'EventName'),
  ('events_daily', 'referrer_class', 'ReferrerClass'),
  ('events_daily', 'device', 'DeviceClass'),
  ('demand_daily', 'vertical', 'Vertical'),
  ('feedback', 'kind', 'FeedbackKind'),
  ('api_credentials', 'provider', 'Provider'),
  ('api_credentials', 'status', 'CredentialStatus'),
  ('governor', 'provider', 'Provider'),
  ('business_claims', 'method', 'VerificationMethod'),
  ('business_claims', 'status', 'ClaimStatus'),
  ('page_builds', 'host', 'Host'),
  ('page_builds', 'locale', 'Locale'),
  ('page_builds', 'page_type', 'PageType'),
  ('prose_reviews', 'status', 'ProseStatus');

-- The quoted literals of every single-column CHECK on table.column, sorted.
create function pg_temp.check_values(tbl text, col text) returns text[] language sql as $$
  select coalesce(array_agg(distinct m[1] order by m[1]), '{}')
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attname = col and not a.attisdropped
   cross join lateral regexp_matches(pg_get_constraintdef(c.oid), '''([^'']*)''::text', 'g') as m
   where c.conrelid = ('app.' || tbl)::regclass
     and c.contype = 'c'
     and c.conkey = array[a.attnum];
$$;

select ok((select count(*) from enum_use) >= 60, 'the enum audit covers the enumerated columns of every table');

select is(
  (select coalesce(string_agg(u.tbl || '.' || u.col || ' (' || u.enum_name || ')', ', ' order by u.tbl, u.col), '')
     from enum_use u
     join enum_def d on d.name = u.enum_name
    where pg_temp.check_values(u.tbl, u.col) is distinct from (select array_agg(v order by v) from unnest(d.vals) v)),
  '',
  'every enumerated column allows exactly the values of its CONTRACTS section 3 enum'
);

-- Spot-check that the audit itself can fail: a column without a check has no values.
select is(pg_temp.check_values('leads', 'name'), '{}'::text[], 'the audit reads no vocabulary from a free-text column');

create table app.zz_enum_probe (k text check (k in ('b', 'a')), n int check (n > 0 and k <> 'z'));
select is(
  pg_temp.check_values('zz_enum_probe', 'k'),
  array['a', 'b'],
  'the audit reads and sorts the literals of a single-column check (and ignores a check spanning two columns)'
);

select * from finish();
rollback;
