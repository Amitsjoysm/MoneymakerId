-- 0105_ask_commit_secret: the shared secret that signs api.ask_commit (CONTRACTS section 5, amended 2026-10-19).
-- Owner: T02b.
--
-- api.ask_commit is callable with the publishable key, and a lookup id is handed to every caller who asks the same
-- intent (api.ask_begin joins a lookup in flight), so knowing an id proves nothing. The Worker that started the
-- lookup proves itself instead: commit_sig = hex(HMAC-SHA256(ASK_COMMIT_SECRET, lookup_id)), with the lookup id in
-- its canonical lowercase form. api.ask_commit (0104_ask.sql) calls app.require_ask_commit_sig first, before it
-- touches a key, the governor, a lookup or the catalogue, so a holder of the publishable key cannot cool or disable
-- API keys, spend the budget, settle a pending lookup with a forged result, or inject candidates.
--
-- The secret lives in one row of app.ask_secret (no API role has any privilege on it, like every table in app) and
-- is written by admin_api.ask_secret_set at deploy time with the secret key. Nothing ever returns it. It has to be
-- stored in the clear because the database computes the HMAC itself; the table is as private as the database.
-- 0104_ask.sql refers to the objects below by name inside a plpgsql body, so they only need to exist when
-- ask_commit is called, which is after every migration has run.

create extension if not exists pgcrypto with schema extensions;

create table app.ask_secret (
  -- one row: the key is the constant true
  id boolean primary key default true check (id),
  secret_value text not null check (char_length(secret_value) between 32 and 256 and secret_value !~ '^\s|\s$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select app.init_table('app.ask_secret');

comment on table app.ask_secret is
  'The single secret that signs api.ask_commit (HMAC-SHA256 of the lookup id). Written by admin_api.ask_secret_set; read only by app.require_ask_commit_sig; never returned by any function.';

-- ---------------------------------------------------------------------------
-- Verification (schema app: not callable by any API role)
-- ---------------------------------------------------------------------------

-- Raises mm_invalid unless p_sig is the hex HMAC-SHA256 of the lookup id under the stored secret. A missing secret
-- fails closed, with the same message as a wrong signature. Both digests are hashed before they are compared, so the
-- time taken does not depend on how many leading characters of a guess were right.
create function app.require_ask_commit_sig(p_fn text, p_lookup uuid, p_sig text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_secret text;
  v_expected text;
begin
  select s.secret_value into v_secret from app.ask_secret s where s.id;
  if v_secret is not null then
    v_expected := encode(extensions.hmac(p_lookup::text, v_secret, 'sha256'), 'hex');
  end if;
  if v_expected is null
     or extensions.digest(lower(p_sig), 'sha256') is distinct from extensions.digest(v_expected, 'sha256') then
    perform app.raise_invalid(p_fn, 'commit_sig is not valid');
  end if;
end;
$$;

comment on function app.require_ask_commit_sig(text, uuid, text) is
  'Raises mm_invalid (22023) unless p_sig = hex(HMAC-SHA256(stored secret, lookup id)), compared through a hash of both sides. Fails closed when no secret is stored.';

-- ---------------------------------------------------------------------------
-- admin_api.ask_secret_set
-- ---------------------------------------------------------------------------
create function admin_api.ask_secret_set(secret text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_fn constant text := 'ask_secret_set';
  v_rotated boolean;
begin
  perform set_config('mm.actor', 'admin', true);
  if secret is null or secret = '' then
    perform app.raise_invalid(c_fn, 'secret is required');
  end if;
  -- the usual deployment mistake is a secret pasted with a trailing newline, which would never match the Worker's
  if secret ~ '^\s|\s$' then
    perform app.raise_invalid(c_fn, 'secret must not start or end with whitespace');
  end if;
  if char_length(secret) < 32 or char_length(secret) > 256 then
    perform app.raise_invalid(c_fn, 'secret must be 32 to 256 characters');
  end if;

  v_rotated := exists (select 1 from app.ask_secret s where s.id);
  insert into app.ask_secret (id, secret_value) values (true, secret)
  on conflict (id) do update set secret_value = excluded.secret_value;

  -- the audit record says that it happened, never what the secret is
  insert into app.system_events (level, kind, message, data)
  values ('info', 'ask_secret_set',
          case when v_rotated then 'ask commit secret rotated' else 'ask commit secret set' end,
          jsonb_build_object('rotated', v_rotated));

  return jsonb_build_object('rotated', v_rotated);
end;
$$;

revoke all on function admin_api.ask_secret_set(text) from public, anon, authenticated;
grant execute on function admin_api.ask_secret_set(text) to service_role;

comment on function admin_api.ask_secret_set(text) is
  'Stores the secret that signs api.ask_commit (32 to 256 characters, no leading or trailing whitespace) and returns { rotated }. Replacing it takes effect at once: commits signed with the old one are refused. Never returns the secret; every call is audited as an ask_secret_set system event without it.';
