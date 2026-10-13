-- 0002_table_helpers: the shared updated_at trigger and the one place a table is locked down.
-- CONTRACTS section 5. Owner: T02a.
--
-- Every table in schema app is created and then passed through app.init_table(). T02b and T02c
-- call it for any table they add, so a new table cannot be exposed or left without the trigger
-- by accident (pgTAP 00_tables.sql audits every table in app, whoever added it).

create function app.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- now() is the transaction start time. An import that sets imported_at = now() in the same
  -- statement leaves updated_at = imported_at, which is how "unedited" is detected (CONTRACTS section 5).
  new.updated_at := now();
  return new;
end;
$$;

comment on function app.touch_updated_at() is
  'BEFORE UPDATE trigger: stamps updated_at with the transaction time.';

create function app.init_table(tbl regclass)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_schema text;
  v_ok boolean;
begin
  select n.nspname
    into v_schema
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where c.oid = tbl;

  if v_schema is distinct from 'app' then
    raise exception 'app.init_table: % is not a table in schema app', tbl
      using errcode = '22023';
  end if;

  select count(*) = 2
    into v_ok
    from pg_catalog.pg_attribute a
   where a.attrelid = tbl
     and a.attname in ('created_at', 'updated_at')
     and a.atttypid = 'timestamptz'::regtype
     and a.attnotnull
     and not a.attisdropped;

  if not v_ok then
    raise exception 'app.init_table: % needs created_at and updated_at as timestamptz not null', tbl
      using errcode = '23514';
  end if;

  -- Deny by default: row level security on and no policy for anyone. Tables are reached only
  -- through SECURITY DEFINER functions owned by postgres (api.* and admin_api.*).
  execute format('alter table %s enable row level security', tbl);
  execute format('revoke all on table %s from public, anon, authenticated, service_role', tbl);

  if not exists (
    select 1
      from pg_catalog.pg_trigger t
     where t.tgrelid = tbl and t.tgname = 'touch_updated_at' and not t.tgisinternal
  ) then
    execute format(
      'create trigger touch_updated_at before update on %s for each row execute function app.touch_updated_at()',
      tbl
    );
  end if;
end;
$$;

comment on function app.init_table(regclass) is
  'Locks a table in schema app down: RLS on, no policy, no privilege for anon/authenticated/service_role, touch_updated_at trigger. Idempotent.';
