-- 0001_schemas: schemas, extensions, schema grants and default privileges.
-- CONTRACTS section 5. Owner: T02a.
--
--   app        every table. Never exposed through the data API.
--   api        public SECURITY DEFINER functions, callable with the publishable key (anon).
--   admin_api  SECURITY DEFINER functions callable with the secret key (service_role) only.
--
-- The roles anon, authenticated and service_role already exist in Supabase's image.
-- This site does not use Supabase Auth, so `authenticated` is locked out of everything.

create extension if not exists pg_trgm with schema extensions;

create schema if not exists app;
create schema if not exists api;
create schema if not exists admin_api;

comment on schema app is
  'Every MarketMind AI table. Not exposed through PostgREST; reached only by SECURITY DEFINER functions in api and admin_api.';
comment on schema api is
  'Public functions callable with the publishable key (anon). SECURITY DEFINER, search_path = empty.';
comment on schema admin_api is
  'Functions callable with the secret key (service_role) only. SECURITY DEFINER, search_path = empty.';

-- ---------------------------------------------------------------------------
-- Schema privileges
-- ---------------------------------------------------------------------------
revoke all on schema app from public, anon, authenticated, service_role;

revoke all on schema api from public, anon, authenticated, service_role;
grant usage on schema api to anon, service_role;

revoke all on schema admin_api from public, anon, authenticated, service_role;
grant usage on schema admin_api to service_role;

-- ---------------------------------------------------------------------------
-- Default privileges: what a table or function created LATER inherits.
-- Migrations run as postgres, so these apply to objects postgres creates.
-- ---------------------------------------------------------------------------

-- A table added to app later is not exposed by accident.
alter default privileges in schema app revoke all on tables from anon, authenticated;
alter default privileges in schema app revoke all on sequences from anon, authenticated;
alter default privileges in schema app revoke all on functions from anon, authenticated;

-- Postgres grants EXECUTE on every new function to PUBLIC. A schema-scoped REVOKE cannot
-- remove that built-in default, so it is removed globally for functions postgres creates.
-- Every function therefore starts with no EXECUTE for anyone but its owner.
alter default privileges for role postgres revoke execute on functions from public;

-- service_role may call whatever is added to api and admin_api. anon is never granted by
-- default: T02b grants it to each public function on purpose, so a helper that lands in
-- api by mistake is not callable with the publishable key.
alter default privileges for role postgres in schema api grant execute on functions to service_role;
alter default privileges for role postgres in schema admin_api grant execute on functions to service_role;
