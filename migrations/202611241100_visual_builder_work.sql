-- Drafts, batch jobs, API tokens and Drive clients.
-- A client is a customer folder inside the person's current tenant, not a second login.

create table public.visual_builder_clients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  folder_id text,
  system_modified_at timestamptz,
  brand jsonb,
  templates jsonb not null default '[]'::jsonb check (jsonb_typeof(templates) = 'array'),
  guideline_text text,
  sync_report jsonb,
  last_ok_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, slug)
);

create table public.visual_builder_drafts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  client_slug text not null,
  campaign text,
  motif text,
  languages text[] not null default '{}',
  formats text[] not null default '{}',
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  hints jsonb not null default '[]'::jsonb check (jsonb_typeof(hints) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days')
);
create index visual_builder_drafts_user_idx on public.visual_builder_drafts (tenant_id, user_id, updated_at desc);

create table public.visual_builder_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  client_slug text not null,
  source_name text not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  summary text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.visual_builder_job_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.visual_builder_jobs(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  line_number integer not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'saved', 'skipped', 'failed')),
  detail text not null default '',
  file_names text[] not null default '{}',
  unique (job_id, line_number)
);

create table public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  prefix text not null,
  token_hash text not null unique,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create function private.resolve_api_token(requested_hash text)
returns table (user_id uuid, tenant_id uuid, token_id uuid)
language plpgsql security definer set search_path = '' as $$
begin
  return query
  update public.api_tokens as token
     set last_used_at = pg_catalog.now()
   where token.token_hash = requested_hash and token.revoked_at is null
  returning token.user_id, token.tenant_id, token.id;
end;
$$;

revoke all on function private.resolve_api_token(text) from public;
grant execute on function private.resolve_api_token(text) to app_runtime;

create function private.membership_principal(requested_user uuid, requested_tenant uuid)
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
  select u.id, u.email, u.display_name, m.tenant_id, t.slug, r.id, r.key, r.name, r.scope,
         coalesce(array(
           select rc.capability from public.role_capabilities rc
            where rc.role_id = r.id and rc.granted
            order by rc.capability
         ), '{}'::text[])
    from public.users u
    join public.memberships m on m.user_id = u.id and m.tenant_id = requested_tenant and m.is_active
    join public.tenants t on t.id = m.tenant_id and t.status = 'active'
    join public.roles r on r.id = m.role_id and r.scope in ('platform', 'assigned_tenants')
   where u.id = requested_user and u.status = 'active'
   limit 1;
$$;

revoke all on function private.membership_principal(uuid, uuid) from public;
grant execute on function private.membership_principal(uuid, uuid) to app_runtime;

alter table public.visual_builder_clients enable row level security;
alter table public.visual_builder_clients force row level security;
alter table public.visual_builder_drafts enable row level security;
alter table public.visual_builder_drafts force row level security;
alter table public.visual_builder_jobs enable row level security;
alter table public.visual_builder_jobs force row level security;
alter table public.visual_builder_job_items enable row level security;
alter table public.visual_builder_job_items force row level security;
alter table public.api_tokens enable row level security;
alter table public.api_tokens force row level security;

grant select, insert, update, delete on public.visual_builder_clients, public.visual_builder_drafts,
  public.visual_builder_jobs, public.visual_builder_job_items, public.api_tokens to app_runtime;

create policy visual_builder_clients_read on public.visual_builder_clients for select to app_runtime
  using (private.visual_builder_access(tenant_id, 'visual-builder.read'));
create policy visual_builder_clients_write on public.visual_builder_clients for all to app_runtime
  using (private.visual_builder_access(tenant_id, 'visual-builder.configure'))
  with check (private.visual_builder_access(tenant_id, 'visual-builder.configure'));

create policy visual_builder_drafts_all on public.visual_builder_drafts for all to app_runtime
  using (private.visual_builder_access(tenant_id, 'visual-builder.read') and user_id = private.current_user_id())
  with check (private.visual_builder_access(tenant_id, 'visual-builder.create') and user_id = private.current_user_id());

create policy visual_builder_jobs_all on public.visual_builder_jobs for all to app_runtime
  using (private.visual_builder_access(tenant_id, 'visual-builder.read') and user_id = private.current_user_id())
  with check (private.visual_builder_access(tenant_id, 'visual-builder.create') and user_id = private.current_user_id());

create policy visual_builder_job_items_all on public.visual_builder_job_items for all to app_runtime
  using (private.visual_builder_access(tenant_id, 'visual-builder.read'))
  with check (private.visual_builder_access(tenant_id, 'visual-builder.create'));

create policy api_tokens_owner on public.api_tokens for all to app_runtime
  using (private.visual_builder_access(tenant_id, 'visual-builder.read') and user_id = private.current_user_id())
  with check (private.visual_builder_access(tenant_id, 'visual-builder.read') and user_id = private.current_user_id());
