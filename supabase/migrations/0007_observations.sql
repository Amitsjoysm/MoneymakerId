-- 0007_observations: the observations table and the generic trigger that is its only writer.
-- CONTRACTS section 5. Owner: T02a.
--
-- An observation is one attribute of one entity changing: old_value / new_value as jsonb. Rows are written
-- by app.record_observations(), a trigger on the tracked columns of businesses, restaurants, providers,
-- restaurant_dishes and cost_models, and by nothing else (a guard trigger rejects direct writes).
--
-- The trigger is generic. Each table names its own tracked columns as trigger arguments:
--     execute function app.record_observations(<entity_type>, <entity id column>, <tracked column>, ...)
--
-- Session settings read by the trigger (set with set_config(name, value, true) inside the calling function):
--     mm.actor              'admin' (default) | 'csv' | 'pipeline' | 'ask'
--     mm.source_id          uuid of the source that produced the change, optional
--     mm.confidence         0..1, optional
--     mm.extractor_version  text, optional

create table app.observations (
  id uuid primary key default gen_random_uuid(),
  -- the evidence vocabulary: businesses, restaurants and providers all observe as 'business'
  entity_type text not null
    check (entity_type in ('business', 'restaurant_dish', 'provider_service', 'locality', 'cost_model')),
  entity_id text not null check (btrim(entity_id) <> ''),
  attribute text not null check (btrim(attribute) <> ''),
  old_value jsonb,
  new_value jsonb,
  observed_at timestamptz not null default now(),
  source_id uuid references app.sources (id) on delete set null,
  confidence numeric check (confidence is null or confidence between 0 and 1),
  extractor_version text,
  actor text not null check (actor in ('admin', 'csv', 'pipeline', 'ask')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select app.init_table('app.observations');

create index observations_entity_idx on app.observations (entity_type, entity_id, attribute, observed_at desc);
create index observations_observed_idx on app.observations (observed_at);
create index observations_source_idx on app.observations (source_id) where source_id is not null;

-- Append-only, and written only from inside another trigger (pg_trigger_depth() >= 2 here means the
-- insert came from app.record_observations, itself fired by a trigger on a tracked table).
create function app.observations_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'observations are append-only'
      using errcode = '42501', constraint = 'observations_append_only';
  end if;
  if pg_trigger_depth() < 2 then
    raise exception 'observations are written only by the observations trigger'
      using errcode = '42501', constraint = 'observations_trigger_only';
  end if;
  return new;
end;
$$;

create trigger observations_guard
  before insert or update on app.observations
  for each row execute function app.observations_guard();

create function app.record_observations()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) end;
  v_new jsonb := to_jsonb(new);
  v_entity_type text := tg_argv[0];
  v_entity_id text := to_jsonb(new) ->> tg_argv[1];
  v_actor text := coalesce(nullif(current_setting('mm.actor', true), ''), 'admin');
  v_source_id uuid := nullif(current_setting('mm.source_id', true), '')::uuid;
  v_confidence numeric := nullif(current_setting('mm.confidence', true), '')::numeric;
  v_extractor text := nullif(current_setting('mm.extractor_version', true), '');
  v_col text;
  v_old_value jsonb;
  v_new_value jsonb;
  i integer;
begin
  for i in 2 .. coalesce(array_length(tg_argv, 1), 0) - 1 loop
    v_col := tg_argv[i];
    if not (v_new ? v_col) then
      raise exception 'record_observations: % has no column %', tg_table_name, v_col
        using errcode = '42703';
    end if;

    -- SQL NULL and JSON null both mean "no value", so a new row does not log every empty column.
    v_old_value := case when jsonb_typeof(v_old -> v_col) = 'null' then null else v_old -> v_col end;
    v_new_value := case when jsonb_typeof(v_new -> v_col) = 'null' then null else v_new -> v_col end;

    if v_old_value is distinct from v_new_value then
      insert into app.observations
        (entity_type, entity_id, attribute, old_value, new_value, source_id, confidence, extractor_version, actor)
      values
        (v_entity_type, v_entity_id, v_col, v_old_value, v_new_value, v_source_id, v_confidence, v_extractor, v_actor);
    end if;
  end loop;
  return null;
end;
$$;

comment on function app.record_observations() is
  'AFTER INSERT OR UPDATE row trigger. Args: entity_type, entity id column, then the tracked columns. Writes one observations row per changed tracked column.';

create trigger record_observations
  after insert or update on app.businesses
  for each row execute function app.record_observations(
    'business', 'id',
    'name', 'status', 'locality_id', 'address', 'lat', 'lng', 'phone', 'website', 'chain_id', 'branch_key',
    'verification_status', 'verification_method');

create trigger record_observations
  after insert or update on app.restaurants
  for each row execute function app.record_observations(
    'business', 'business_id',
    'cuisines', 'diet', 'price_level', 'opening_hours', 'service_modes', 'tags');

create trigger record_observations
  after insert or update on app.providers
  for each row execute function app.record_observations(
    'business', 'business_id',
    'specializations', 'experience_years', 'accepts_leads', 'service_localities', 'min_job_inr',
    'agreed_lead_price_inr', 'sales_stage', 'founding_partner', 'price_locked_until');

create trigger record_observations
  after insert or update on app.restaurant_dishes
  for each row execute function app.record_observations(
    'restaurant_dish', 'id',
    'variant_label', 'price_inr');

create trigger record_observations
  after insert or update on app.cost_models
  for each row execute function app.record_observations(
    'cost_model', 'id',
    'tier', 'unit', 'rate_low_inr', 'rate_expected_inr', 'rate_high_inr', 'min_job_inr', 'components',
    'locality_factors', 'valid_until', 'status');
