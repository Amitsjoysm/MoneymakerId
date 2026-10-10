-- T02a: every table in CONTRACTS section 5 exists, with the contract's columns, and every table in
-- schema app is locked down the same way (RLS on, no policies, no privilege for anon,
-- authenticated or service_role, created_at/updated_at with the shared trigger).
begin;
select plan(61);

-- The columns named in CONTRACTS section 5, one entry per table ("table:col,col,...").
-- Names that the contract leaves open (geo, rate_inr, price_sanity_inr and the LeadRecord
-- objects) are flattened: lat/lng, rate_*_inr, price_sanity_*_inr, one column per lead field.
create temp table contract_columns (tbl text not null, col text not null) on commit drop;
insert into contract_columns (tbl, col)
select split_part(e, ':', 1), unnest(string_to_array(split_part(e, ':', 2), ','))
  from unnest(array[
    'cities:id,name',
    'localities:id,name,kind,city_id,parent_id,aliases,lat,lng,geo_source,jurisdiction,pincodes,neighbours,landmarks,commercial_centres,office_clusters,residential_clusters,construction_facts,food_notes,i18n,imported_at',
    'locality_profiles:locality_id,search_intent,popular_dishes,price_segments,business_density,data_quality,complete,last_updated',
    'dishes:id,name,parent_id,aliases,cravings,diet,price_bands_inr,price_sanity_min_inr,price_sanity_max_inr,description,prose_status,i18n,imported_at',
    'services:id,name,parent_id,unit,area_presets,scope_options,materials,duration_days,questions_to_ask,common_mistakes,quote_checklist,faq,prose_status,imported_at',
    'cost_models:id,service_id,scope_id,material_id,tier,unit,rate_low_inr,rate_expected_inr,rate_high_inr,min_job_inr,components,locality_factors,sources,reviewed_at,valid_until,status,notes,imported_at',
    'chains:id,name,website_domain',
    'businesses:id,kind,name,normalised_name,slug,status,locality_id,address,lat,lng,phone,website,chain_id,branch_key,verification_status,verification_method,verified_at,confidence,last_verified_at,published_at,auto_published,reviewed_at',
    'business_redirects:from_slug,to_business_id,host',
    'restaurants:business_id,cuisines,diet,price_level,opening_hours,service_modes,tags',
    'providers:business_id,specializations,experience_years,accepts_leads,service_localities,min_job_inr,sales_stage,trial_leads_remaining,agreed_lead_price_inr,founding_partner,price_locked_until',
    'restaurant_dishes:id,business_id,dish_id,variant_label,price_inr,evidence_id,last_seen_at',
    'provider_services:business_id,service_id',
    'sources:id,kind,url,domain_etld1,owner_group,title,content_hash,http_status,fetched_at,experience_id',
    'evidence:id,entity_type,entity_id,claim_type,claim,supporting_quote,source_id,retrieved_at,valid_until,confidence,extractor_version,status',
    'experiences:id,business_id,visited_at,dishes,overall_rating,would_recommend,tags,notes,prose_status',
    'experience_photos:id,experience_id,storage_path,thumb_path,width,height,alt,published',
    'observations:id,entity_type,entity_id,attribute,old_value,new_value,observed_at,source_id,confidence,extractor_version,actor',
    'ranking_runs:id,kind,started_at,finished_at,config_hash',
    'recommendations:run_id,page_key,entity_id,rank,organic_score,components,labels,commercial_score',
    'leads:id,ref,lead_type,status,grade,qualified,name,phone_e164,whatsapp_confirmed,idempotency_key,consent_version,consent_accepted_at,service_id,locality_id,property_type,ownership,timeline,area_preset,area_quantity,tier,estimate_low_inr,estimate_expected_inr,estimate_high_inr,requested_provider_id,quote_notes,business,message,landing_path,page_type,referrer_class,utm_source,utm_medium,utm_campaign,ranking_run_id,ref_code,variant,visitor_hmac,synthetic,next_follow_up_at,contact_attempts,remind_at,duplicate_of,anonymised_at',
    'lead_assignments:id,lead_id,provider_id,mode,price_inr,sent_at,accepted_at,outcome,quoted_amount_inr,final_amount_inr,area_quantity,tier,refund_reason,credited',
    'lead_prices:service_id,grade,price_inr',
    'provider_credits:id,provider_id,amount_inr,note,created_by',
    'featured_listings:id,business_id,tier,locality_ids,category_ids,starts_on,ends_on,status',
    'advertisers:id,name,website,business_id,notes',
    'campaigns:id,advertiser_id,kind,budget_inr,pricing_model,creative,target_locality,target_category,starts_on,ends_on,status',
    'ad_slots:id,name,page_type,position,device,provider,active,priority,start_date,end_date,campaign_id',
    'sales_quotes:id,business_id,product,locality_id,service_id,price_quoted_inr,discount_reason,outcome,objection,decided_at',
    'queries:id,vertical,intent,locality_id,candidate_ids,ranks,served_from,lookup_id',
    'ask_lookups:id,intent_key,status,result',
    'events_daily:day,host,page_type,event,locality_id,subject_id,entity_id,ranking_run_id,slot,campaign_id,variant,referrer_class,device,landing_path,count',
    'demand_daily:day,vertical,locality_id,subject_id,distinct_visitors',
    'feedback:id,page_key,entity_id,kind,note',
    'search_demand:day,page_url,query,impressions,clicks,position',
    'jobs:id,stage,run_id,status,started_at,finished_at,stats,error',
    'api_credentials:fingerprint,provider,account_label,status,cooldown_until,disabled_reason,daily_used,day,error_count,last_used_at',
    'governor:day,provider,budget,used,reserved_ask,breaker_open_until',
    'rate_buckets:key,window_start,count',
    'system_events:id,level,kind,message,data',
    'business_claims:id,business_id,claimant_name,phone,email,method,status',
    'page_builds:build_id,url,host,locale,page_type,indexable,content_hash,hash_changed_at,noindex_since,gate',
    'prose_reviews:key,status,reviewed_at,reviewer'
  ]) as e;

-- ---------------------------------------------------------------------------
-- 43 tables, as listed in CONTRACTS section 5
-- ---------------------------------------------------------------------------
select is((select count(distinct tbl)::int from contract_columns), 43, 'the contract lists 43 tables');

select has_table('app', t.tbl::name, format('table app.%s exists', t.tbl))
  from (select distinct tbl from contract_columns order by tbl) t;

select is(
  (select coalesce(string_agg(m.tbl || '.' || m.col, ', ' order by m.tbl, m.col), '')
     from contract_columns m
    where not exists (select 1
                        from information_schema.columns c
                       where c.table_schema = 'app' and c.table_name = m.tbl and c.column_name = m.col)),
  '',
  'every column named in CONTRACTS section 5 exists (missing columns are listed on failure)'
);

-- ---------------------------------------------------------------------------
-- Properties shared by every table in app (tables added later are held to them too)
-- ---------------------------------------------------------------------------
select is(
  (select coalesce(string_agg(c.relname, ', ' order by c.relname), '')
     from pg_class c
    where c.relnamespace = 'app'::regnamespace and c.relkind in ('r', 'p') and not c.relrowsecurity),
  '',
  'row level security is enabled on every table in app'
);

select is(
  (select count(*)::int from pg_policies where schemaname = 'app'),
  0,
  'no table in app has a policy, so anon and authenticated are denied by default'
);

select is(
  (select coalesce(string_agg(c.relname || ' ' || r.role_name, ', ' order by c.relname), '')
     from pg_class c
    cross join unnest(array['anon', 'authenticated', 'service_role']) as r(role_name)
    where c.relnamespace = 'app'::regnamespace and c.relkind in ('r', 'p')
      and (has_table_privilege(r.role_name, c.oid, 'select, insert, update, delete, truncate, references, trigger')
        or has_any_column_privilege(r.role_name, c.oid, 'select, insert, update, references'))),
  '',
  'anon, authenticated and service_role hold no privilege on any table in app'
);

select is(
  (select coalesce(string_agg(c.relname, ', ' order by c.relname), '')
     from pg_class c
    where c.relnamespace = 'app'::regnamespace and c.relkind in ('r', 'p')
      and exists (select 1 from aclexplode(c.relacl) a where a.grantee = 0)),
  '',
  'PUBLIC holds no privilege on any table in app'
);

select is(
  (select coalesce(string_agg(c.relname || '.' || k.col, ', ' order by c.relname, k.col), '')
     from pg_class c
    cross join unnest(array['created_at', 'updated_at']) as k(col)
    where c.relnamespace = 'app'::regnamespace and c.relkind in ('r', 'p')
      and not exists (select 1
                        from pg_attribute a
                        join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
                       where a.attrelid = c.oid and a.attname = k.col and not a.attisdropped
                         and a.atttypid = 'timestamptz'::regtype and a.attnotnull
                         and pg_get_expr(d.adbin, d.adrelid) = 'now()')),
  '',
  'every table has created_at and updated_at as timestamptz not null default now()'
);

select is(
  (select coalesce(string_agg(c.relname, ', ' order by c.relname), '')
     from pg_class c
    where c.relnamespace = 'app'::regnamespace and c.relkind in ('r', 'p')
      and not exists (select 1
                        from pg_trigger t
                       where t.tgrelid = c.oid and not t.tgisinternal
                         and t.tgfoid = 'app.touch_updated_at()'::regprocedure
                         and (t.tgtype & 2) = 2      -- BEFORE
                         and (t.tgtype & 16) = 16    -- UPDATE
                         and (t.tgtype & 1) = 1)),   -- FOR EACH ROW
  '',
  'every table has the shared BEFORE UPDATE touch_updated_at trigger'
);

select is(
  (select coalesce(string_agg(c.relname, ', ' order by c.relname), '')
     from pg_class c
    where c.relnamespace = 'app'::regnamespace and c.relkind in ('r', 'p')
      and not exists (select 1
                        from pg_index i
                       where i.indrelid = c.oid and i.indisprimary
                          or (i.indrelid = c.oid and i.indisunique))),
  '',
  'every table has a primary key or a unique index'
);

-- ---------------------------------------------------------------------------
-- Seed, indexes
-- ---------------------------------------------------------------------------
select results_eq(
  $$select id::text, name from app.cities order by id$$,
  $$values ('pune', 'Pune')$$,
  'app.cities is seeded with pune only'
);

select has_index('app', 'businesses', 'businesses_name_trgm_idx', 'businesses has a name index');
select ok(
  (select indexdef ~ 'USING gin \(normalised_name extensions\.gin_trgm_ops\)'
     from pg_indexes
    where schemaname = 'app' and tablename = 'businesses' and indexname = 'businesses_name_trgm_idx'),
  'the businesses name index is a pg_trgm GIN index on normalised_name'
);
select ok(
  (select indexdef ~ 'UNIQUE INDEX.*\(kind, normalised_name, locality_id, COALESCE\(branch_key, ''''::text\)\)'
     from pg_indexes
    where schemaname = 'app' and tablename = 'businesses' and indexname = 'businesses_identity_key'),
  'businesses is unique on (kind, normalised_name, locality_id, coalesce(branch_key, ''))'
);
select col_is_unique('app', 'businesses', 'slug', 'businesses.slug is unique');
select col_is_unique('app', 'leads', 'idempotency_key', 'leads.idempotency_key is unique');
select col_is_unique('app', 'leads', 'ref', 'leads.ref is unique');

-- ---------------------------------------------------------------------------
-- app.init_table: the one place a table is locked down. T02b and T02c call it for any table they add.
-- ---------------------------------------------------------------------------
select has_function('app', 'init_table', array['regclass'], 'app.init_table(regclass) exists');

create table app.zz_init_probe (id int primary key, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
grant select, insert on app.zz_init_probe to anon, authenticated;
select app.init_table('app.zz_init_probe');

select ok(
  (select relrowsecurity from pg_class where oid = 'app.zz_init_probe'::regclass),
  'init_table enables row level security'
);
select ok(
  not has_table_privilege('anon', 'app.zz_init_probe', 'select')
  and not has_table_privilege('authenticated', 'app.zz_init_probe', 'insert'),
  'init_table revokes the privileges anon and authenticated were given'
);
select ok(
  exists (select 1 from pg_trigger
           where tgrelid = 'app.zz_init_probe'::regclass and tgname = 'touch_updated_at' and not tgisinternal),
  'init_table adds the touch_updated_at trigger'
);
select lives_ok($$select app.init_table('app.zz_init_probe')$$, 'init_table is idempotent');

create table app.zz_init_no_ts (id int primary key);
select throws_ok(
  $$select app.init_table('app.zz_init_no_ts')$$,
  '23514', null,
  'init_table rejects a table without created_at and updated_at'
);

select * from finish();
rollback;
