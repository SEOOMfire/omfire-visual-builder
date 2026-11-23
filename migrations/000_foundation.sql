-- Minimal platform the Visual Builder policies and the copied RLS tests rely on.
-- Roles keep the Search OS keys so the copied capability grants and tests stay valid.
-- Login itself only accepts platform and assigned_tenants memberships.

do $$
declare
  runtime_role pg_catalog.pg_roles%rowtype;
begin
  select * into runtime_role from pg_catalog.pg_roles where rolname = 'app_runtime';
  if not found then
    raise exception 'Required external role app_runtime is missing';
  end if;
  if runtime_role.rolsuper or runtime_role.rolbypassrls or runtime_role.rolcreatedb or runtime_role.rolcreaterole then
    raise exception 'External role app_runtime does not satisfy the runtime security contract';
  end if;
end;
$$;

create schema if not exists private;

create table public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  display_name text not null,
  password_hash text,
  status text not null default 'active' check (status in ('invited', 'active', 'disabled')),
  created_at timestamptz not null default now()
);

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  key text not null check (key ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'),
  name text not null,
  scope text not null check (scope in ('platform', 'assigned_tenants', 'tenant')),
  is_system boolean not null default false,
  description text not null default '',
  created_at timestamptz not null default now(),
  unique nulls not distinct (tenant_id, key),
  check ((is_system and tenant_id is null) or (not is_system and tenant_id is not null))
);

create table public.role_capabilities (
  role_id uuid not null references public.roles(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete cascade,
  capability text not null check (capability ~ '^[a-z0-9-]+\.[a-z0-9._-]+$'),
  granted boolean not null default true,
  primary key (role_id, capability)
);

create table public.memberships (
  user_id uuid not null references public.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete restrict,
  display_name text not null,
  email text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (user_id, tenant_id)
);

create table public.tenant_modules (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  module_slug text not null check (module_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  enabled boolean not null default false,
  customer_visible boolean not null default false,
  primary key (tenant_id, module_slug)
);

create table public.auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.auth_email_links (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz
);

create table public.file_objects (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  storage_key text not null check (storage_key <> '' and storage_key !~ '(^|/)\.\.(/|$)'),
  original_filename text not null,
  content_type text not null,
  byte_size bigint not null check (byte_size >= 0),
  checksum text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, storage_key)
);

create table private.rate_limit_counters (
  scope text not null,
  identity text not null,
  window_start timestamptz not null,
  hits integer not null,
  primary key (scope, identity, window_start)
);

create function private.current_user_id()
returns uuid language sql stable set search_path = '' as $$
  select nullif(current_setting('app.current_user_id', true), '')::uuid;
$$;

create function private.current_tenant_id()
returns uuid language sql stable set search_path = '' as $$
  select nullif(current_setting('app.current_tenant_id', true), '')::uuid;
$$;

create function private.is_active_tenant_member(target_tenant uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.current_user_id() is not null
    and private.current_tenant_id() is not null
    and exists (select 1 from public.tenants t where t.id = target_tenant and t.status = 'active')
    and exists (
      select 1
      from public.memberships m
      join public.roles r on r.id = m.role_id
      where m.user_id = private.current_user_id()
        and m.is_active
        and (m.tenant_id = target_tenant or (r.is_system and r.scope = 'platform'))
        and (target_tenant = private.current_tenant_id() or (r.is_system and r.scope = 'platform'))
    );
$$;

create function private.has_capability(target_tenant uuid, required_capability text)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_active_tenant_member(target_tenant)
    and exists (
      select 1
      from public.memberships m
      join public.roles r on r.id = m.role_id
      join public.role_capabilities rc on rc.role_id = r.id and rc.granted
      where m.user_id = private.current_user_id()
        and m.is_active
        and rc.capability = required_capability
        and (m.tenant_id = target_tenant or (r.is_system and r.scope = 'platform'))
    );
$$;

create function private.consume_rate_limit(p_scope text, p_identity text, p_max integer, p_window_seconds integer)
returns table (allowed boolean, remaining integer, retry_after_seconds integer)
language plpgsql security definer set search_path = '' as $$
declare
  bucket timestamptz := to_timestamp(floor(extract(epoch from pg_catalog.now()) / p_window_seconds) * p_window_seconds);
  current_hits integer;
begin
  insert into private.rate_limit_counters as c (scope, identity, window_start, hits)
  values (p_scope, p_identity, bucket, 1)
  on conflict (scope, identity, window_start) do update set hits = c.hits + 1
  returning hits into current_hits;
  allowed := current_hits <= p_max;
  remaining := greatest(p_max - current_hits, 0);
  retry_after_seconds := greatest(1, ceil(extract(epoch from (bucket + make_interval(secs => p_window_seconds) - pg_catalog.now())))::integer);
  return next;
end;
$$;

insert into public.roles (tenant_id, key, name, scope, is_system, description)
values
  (null, 'omfire_super_admin', 'Admin OMfire', 'platform', true, 'Plattformweit.'),
  (null, 'omfire_admin', 'Admin OMfire', 'platform', true, 'Mandantenübergreifend.'),
  (null, 'omfire_lead', 'Admin OMfire', 'assigned_tenants', true, 'Zugewiesene Mandanten.'),
  (null, 'omfire_user', 'User OMfire', 'assigned_tenants', true, 'Zugewiesene Mandanten ohne Konfiguration.'),
  (null, 'client_admin', 'Kunden-Admin', 'tenant', true, 'Bleibt im Schema, damit übernommene Regeln testbar sind. Die Anmeldung legt solche Konten nicht an.'),
  (null, 'client_user', 'Kunden-User', 'tenant', true, 'Bleibt im Schema, damit übernommene Regeln testbar sind. Die Anmeldung legt solche Konten nicht an.');

create function private.staff_account(requested_email text)
returns table (user_id uuid, tenant_id uuid, email text)
language sql stable security definer set search_path = '' as $$
  select u.id, m.tenant_id, u.email
    from public.users u
    join public.memberships m on m.user_id = u.id and m.is_active
    join public.roles r on r.id = m.role_id
    join public.tenants t on t.id = m.tenant_id and t.status = 'active'
   where u.email = lower(btrim(requested_email))
     and u.status = 'active'
     and r.scope in ('platform', 'assigned_tenants')
   order by m.created_at
   limit 1;
$$;

create function private.open_session(
  requested_user uuid,
  requested_tenant uuid,
  requested_token_hash text,
  requested_expiry timestamptz
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1
      from public.memberships m
      join public.roles r on r.id = m.role_id
     where m.user_id = requested_user and m.tenant_id = requested_tenant and m.is_active
       and r.scope in ('platform', 'assigned_tenants')
  ) then
    raise exception 'Anmeldung abgelehnt' using errcode = '42501';
  end if;
  delete from public.auth_sessions where user_id = requested_user and token_hash = requested_token_hash;
  insert into public.auth_sessions (user_id, tenant_id, token_hash, expires_at)
  values (requested_user, requested_tenant, requested_token_hash, requested_expiry);
end;
$$;

create function private.session_principal(requested_token_hash text)
returns table (
  user_id uuid,
  email text,
  display_name text,
  tenant_id uuid,
  tenant_slug text,
  role_id uuid,
  role_key text,
  role_name text,
  role_scope text,
  capabilities text[]
)
language sql stable security definer set search_path = '' as $$
  select u.id, u.email, u.display_name, s.tenant_id, t.slug, r.id, r.key, r.name, r.scope,
         coalesce(array(
           select rc.capability from public.role_capabilities rc
            where rc.role_id = r.id and rc.granted
            order by rc.capability
         ), '{}'::text[])
    from public.auth_sessions s
    join public.users u on u.id = s.user_id and u.status = 'active'
    join public.tenants t on t.id = s.tenant_id and t.status = 'active'
    join public.memberships m on m.user_id = u.id and m.tenant_id = s.tenant_id and m.is_active
    join public.roles r on r.id = m.role_id and r.scope in ('platform', 'assigned_tenants')
   where s.token_hash = requested_token_hash and s.expires_at > pg_catalog.now()
   limit 1;
$$;

create function private.password_hash_for(requested_email text)
returns text
language sql stable security definer set search_path = '' as $$
  select u.password_hash from public.users u where u.email = lower(btrim(requested_email)) and u.status = 'active';
$$;

create function private.store_email_link(requested_email text, requested_token_hash text, requested_expiry timestamptz)
returns void
language sql security definer set search_path = '' as $$
  insert into public.auth_email_links (email, token_hash, expires_at)
  values (lower(btrim(requested_email)), requested_token_hash, requested_expiry);
$$;

create function private.consume_email_link(requested_token_hash text)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  found text;
begin
  update public.auth_email_links
     set consumed_at = pg_catalog.now()
   where token_hash = requested_token_hash and consumed_at is null and expires_at > pg_catalog.now()
  returning email into found;
  return found;
end;
$$;

revoke all on schema private from public;
grant usage on schema public to app_runtime;
grant usage on schema private to app_runtime;
grant execute on function private.current_user_id() to app_runtime;
grant execute on function private.current_tenant_id() to app_runtime;
grant execute on function private.is_active_tenant_member(uuid) to app_runtime;
grant execute on function private.has_capability(uuid, text) to app_runtime;
grant execute on function private.consume_rate_limit(text, text, integer, integer) to app_runtime;
grant execute on function private.staff_account(text) to app_runtime;
grant execute on function private.open_session(uuid, uuid, text, timestamptz) to app_runtime;
grant execute on function private.session_principal(text) to app_runtime;
grant execute on function private.password_hash_for(text) to app_runtime;
grant execute on function private.store_email_link(text, text, timestamptz) to app_runtime;
grant execute on function private.consume_email_link(text) to app_runtime;

revoke all on public.users, public.tenants, public.roles, public.role_capabilities, public.memberships,
  public.tenant_modules, public.auth_sessions, public.auth_email_links, public.file_objects
  from public, app_runtime;
grant select, insert, update, delete on public.tenant_modules to app_runtime;
grant select, insert, update on public.file_objects to app_runtime;

alter table public.file_objects enable row level security;
alter table public.file_objects force row level security;
create policy file_objects_select on public.file_objects for select to app_runtime
  using (private.is_active_tenant_member(tenant_id));
create policy file_objects_insert on public.file_objects for insert to app_runtime
  with check (private.is_active_tenant_member(tenant_id) and created_by = private.current_user_id());
create policy file_objects_update on public.file_objects for update to app_runtime
  using (private.is_active_tenant_member(tenant_id))
  with check (private.is_active_tenant_member(tenant_id));
