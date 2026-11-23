-- Visual-Builder: creative editor with per-tenant assets, Drive libraries and an archive.
-- Internal by default. Customers only reach it while the module is customer-visible,
-- and they never see archive entries that OMfire created internally.

create function private.visual_builder_is_internal(p_tenant uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.current_tenant_id() = p_tenant and exists (
    select 1 from public.memberships m join public.roles r on r.id = m.role_id
    where m.user_id = private.current_user_id() and m.is_active
      and r.scope in ('platform', 'assigned_tenants')
      and (m.tenant_id = p_tenant or r.scope = 'platform')
  );
$$;

create function private.visual_builder_access(p_tenant uuid, p_capability text)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_tenant = private.current_tenant_id()
    and private.has_capability(p_tenant, p_capability)
    and exists (
      select 1 from public.tenant_modules tm
      where tm.tenant_id = p_tenant and tm.module_slug = 'visual-builder' and tm.enabled
        and (tm.customer_visible or private.visual_builder_is_internal(p_tenant))
    );
$$;

revoke all on function private.visual_builder_is_internal(uuid), private.visual_builder_access(uuid, text) from public;
grant execute on function private.visual_builder_is_internal(uuid), private.visual_builder_access(uuid, text) to app_runtime;

create table public.visual_builder_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  default_font text check (default_font is null or char_length(default_font) between 1 and 80),
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.visual_builder_languages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null check (code ~ '^[A-Za-z]{2,3}([-_][A-Za-z0-9]{2,8}){0,2}$'),
  label text not null check (char_length(label) between 1 and 80),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create table public.visual_builder_assets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  kind text not null check (kind in ('logo', 'cta', 'font')),
  name text not null check (char_length(name) between 1 and 120),
  variant text not null,
  file_id uuid references public.file_objects(id) on delete restrict,
  cta_text text check (cta_text is null or char_length(cta_text) <= 200),
  style jsonb not null default '{}'::jsonb check (jsonb_typeof(style) = 'object'),
  font_family text check (font_family is null or char_length(font_family) between 1 and 80),
  font_weight integer check (font_weight is null or font_weight between 100 and 900),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (
    (kind = 'logo' and variant in ('square', 'wide') and file_id is not null)
    or (kind = 'cta' and variant = 'text')
    or (kind = 'cta' and variant = 'graphic' and file_id is not null)
    or (kind = 'font' and variant in ('normal', 'italic') and file_id is not null and font_family is not null and font_weight is not null)
  )
);
create index visual_builder_assets_tenant_kind_idx on public.visual_builder_assets (tenant_id, kind, created_at desc);

create table public.visual_builder_guidelines (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  content_text text not null check (char_length(content_text) <= 50000),
  filename text check (filename is null or char_length(filename) <= 200),
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.visual_builder_safe_zones (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  format text not null check (format in ('1x1', '191x1', '1x191')),
  rect jsonb not null check (jsonb_typeof(rect) = 'object'),
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, format)
);

create table public.visual_builder_libraries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 80),
  folder_id text not null check (folder_id ~ '^[A-Za-z0-9_-]{5,200}$'),
  position integer not null default 0,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tenant_id, folder_id)
);

create table public.visual_builder_image_formats (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  file_id text not null check (file_id ~ '^[A-Za-z0-9_-]{5,200}$'),
  format text not null check (format in ('1x1', '191x1', '1x191')),
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, file_id)
);

create table public.visual_builder_guideline_checks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  source_text text not null check (char_length(source_text) <= 5000),
  approved boolean not null,
  violations jsonb not null default '[]'::jsonb check (jsonb_typeof(violations) = 'array'),
  created_at timestamptz not null default now()
);
create index visual_builder_guideline_checks_user_idx on public.visual_builder_guideline_checks (tenant_id, user_id, created_at desc);

create table public.visual_builder_creatives (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  created_by uuid references public.users(id) on delete set null,
  audience text not null default 'internal' check (audience in ('internal', 'customer')),
  source_text text not null default '' check (char_length(source_text) <= 5000),
  language_code text check (language_code is null or char_length(language_code) <= 20),
  state jsonb check (state is null or jsonb_typeof(state) = 'object'),
  -- null marks entries taken over from the previous tool; their downloads stay open.
  guideline_status text check (guideline_status is null or guideline_status in ('draft', 'approved')),
  guideline_check_id uuid references public.visual_builder_guideline_checks(id) on delete set null,
  zip_file_id uuid references public.file_objects(id) on delete restrict,
  thumb_1x1_file_id uuid references public.file_objects(id) on delete restrict,
  thumb_191x1_file_id uuid references public.file_objects(id) on delete restrict,
  thumb_1x191_file_id uuid references public.file_objects(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index visual_builder_creatives_tenant_created_idx on public.visual_builder_creatives (tenant_id, created_at desc);

-- Approval is decided here, not by the request: only the saver's own passed check
-- for exactly this text approves an entry. Everything else is saved unapproved.
create function private.visual_builder_creative_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if private.current_user_id() is null then
    return new;
  end if;
  new.created_by := private.current_user_id();
  new.audience := case when private.visual_builder_is_internal(new.tenant_id) then 'internal' else 'customer' end;
  if new.guideline_check_id is not null and exists (
    select 1 from public.visual_builder_guideline_checks c
    where c.id = new.guideline_check_id and c.tenant_id = new.tenant_id
      and c.user_id = new.created_by and c.approved and c.source_text = new.source_text
  ) then
    new.guideline_status := 'approved';
  else
    new.guideline_status := 'draft';
    new.guideline_check_id := null;
  end if;
  return new;
end;
$$;
revoke all on function private.visual_builder_creative_guard() from public;
create trigger visual_builder_creative_guard before insert on public.visual_builder_creatives
for each row execute function private.visual_builder_creative_guard();

alter table public.visual_builder_settings enable row level security;
alter table public.visual_builder_settings force row level security;
alter table public.visual_builder_languages enable row level security;
alter table public.visual_builder_languages force row level security;
alter table public.visual_builder_assets enable row level security;
alter table public.visual_builder_assets force row level security;
alter table public.visual_builder_guidelines enable row level security;
alter table public.visual_builder_guidelines force row level security;
alter table public.visual_builder_safe_zones enable row level security;
alter table public.visual_builder_safe_zones force row level security;
alter table public.visual_builder_libraries enable row level security;
alter table public.visual_builder_libraries force row level security;
alter table public.visual_builder_image_formats enable row level security;
alter table public.visual_builder_image_formats force row level security;
alter table public.visual_builder_guideline_checks enable row level security;
alter table public.visual_builder_guideline_checks force row level security;
alter table public.visual_builder_creatives enable row level security;
alter table public.visual_builder_creatives force row level security;

-- Configuration: everyone with read access uses it, only configure changes it.
create policy visual_builder_settings_read on public.visual_builder_settings for select to app_runtime
  using (private.visual_builder_access(tenant_id, 'visual-builder.read'));
create policy visual_builder_settings_write on public.visual_builder_settings for all to app_runtime
  using (private.visual_builder_access(tenant_id, 'visual-builder.configure'))
  with check (private.visual_builder_access(tenant_id, 'visual-builder.configure'));

create policy visual_builder_languages_read on public.visual_builder_languages for select to app_runtime
  using (private.visual_builder_access(tenant_id, 'visual-builder.read'));
create policy visual_builder_languages_write on public.visual_builder_languages for all to app_runtime
  using (private.visual_builder_access(tenant_id, 'visual-builder.configure'))
  with check (private.visual_builder_access(tenant_id, 'visual-builder.configure'));

create policy visual_builder_assets_read on public.visual_builder_assets for select to app_runtime
  using (private.visual_builder_access(tenant_id, 'visual-builder.read'));
create policy visual_builder_assets_insert on public.visual_builder_assets for insert to app_runtime
  with check (
    private.visual_builder_access(tenant_id, 'visual-builder.configure')
    and created_by = private.current_user_id()
    and (file_id is null or exists (
      select 1 from public.file_objects f
      where f.id = visual_builder_assets.file_id and f.tenant_id = visual_builder_assets.tenant_id and f.deleted_at is null
    ))
  );
create policy visual_builder_assets_delete on public.visual_builder_assets for delete to app_runtime
  using (private.visual_builder_access(tenant_id, 'visual-builder.configure'));

create policy visual_builder_guidelines_read on public.visual_builder_guidelines for select to app_runtime
  using (private.visual_builder_access(tenant_id, 'visual-builder.read'));
create policy visual_builder_guidelines_write on public.visual_builder_guidelines for all to app_runtime
  using (private.visual_builder_access(tenant_id, 'visual-builder.configure'))
  with check (private.visual_builder_access(tenant_id, 'visual-builder.configure') and updated_by = private.current_user_id());

create policy visual_builder_safe_zones_read on public.visual_builder_safe_zones for select to app_runtime
  using (private.visual_builder_access(tenant_id, 'visual-builder.read'));
create policy visual_builder_safe_zones_write on public.visual_builder_safe_zones for all to app_runtime
  using (private.visual_builder_access(tenant_id, 'visual-builder.configure'))
  with check (private.visual_builder_access(tenant_id, 'visual-builder.configure'));

create policy visual_builder_libraries_read on public.visual_builder_libraries for select to app_runtime
  using (private.visual_builder_access(tenant_id, 'visual-builder.read'));
create policy visual_builder_libraries_write on public.visual_builder_libraries for all to app_runtime
  using (private.visual_builder_access(tenant_id, 'visual-builder.configure'))
  with check (private.visual_builder_access(tenant_id, 'visual-builder.configure'));

create policy visual_builder_image_formats_read on public.visual_builder_image_formats for select to app_runtime
  using (private.visual_builder_access(tenant_id, 'visual-builder.read'));
create policy visual_builder_image_formats_write on public.visual_builder_image_formats for all to app_runtime
  using (private.visual_builder_access(tenant_id, 'visual-builder.create'))
  with check (private.visual_builder_access(tenant_id, 'visual-builder.create') and updated_by = private.current_user_id());

create policy visual_builder_guideline_checks_read on public.visual_builder_guideline_checks for select to app_runtime
  using (private.visual_builder_access(tenant_id, 'visual-builder.read') and user_id = private.current_user_id());
create policy visual_builder_guideline_checks_insert on public.visual_builder_guideline_checks for insert to app_runtime
  with check (private.visual_builder_access(tenant_id, 'visual-builder.create') and user_id = private.current_user_id());

create policy visual_builder_creatives_read on public.visual_builder_creatives for select to app_runtime
  using (
    private.visual_builder_access(tenant_id, 'visual-builder.read')
    and (audience = 'customer' or private.visual_builder_is_internal(tenant_id))
  );
create policy visual_builder_creatives_insert on public.visual_builder_creatives for insert to app_runtime
  with check (
    private.visual_builder_access(tenant_id, 'visual-builder.create')
    and created_by = private.current_user_id()
  );
create policy visual_builder_creatives_delete on public.visual_builder_creatives for delete to app_runtime
  using (
    private.visual_builder_access(tenant_id, 'visual-builder.delete')
    and (audience = 'customer' or private.visual_builder_is_internal(tenant_id))
  );

revoke all on public.visual_builder_settings, public.visual_builder_languages, public.visual_builder_assets,
  public.visual_builder_guidelines, public.visual_builder_safe_zones, public.visual_builder_libraries,
  public.visual_builder_image_formats, public.visual_builder_guideline_checks, public.visual_builder_creatives
  from public, app_runtime;
grant select, insert, update, delete on public.visual_builder_settings, public.visual_builder_languages,
  public.visual_builder_guidelines, public.visual_builder_safe_zones, public.visual_builder_libraries,
  public.visual_builder_image_formats to app_runtime;
grant select, insert, delete on public.visual_builder_assets, public.visual_builder_creatives to app_runtime;
grant select, insert on public.visual_builder_guideline_checks to app_runtime;

insert into public.role_capabilities (role_id, capability, granted)
select r.id, capability, true
from public.roles r
cross join lateral (
  select unnest(case r.key
    when 'omfire_super_admin' then array['visual-builder.read','visual-builder.create','visual-builder.upload','visual-builder.configure','visual-builder.delete']
    when 'omfire_admin' then array['visual-builder.read','visual-builder.create','visual-builder.upload','visual-builder.configure','visual-builder.delete']
    when 'omfire_lead' then array['visual-builder.read','visual-builder.create','visual-builder.upload','visual-builder.configure','visual-builder.delete']
    when 'omfire_user' then array['visual-builder.read','visual-builder.create','visual-builder.upload']
    when 'client_admin' then array['visual-builder.read','visual-builder.create','visual-builder.upload']
    when 'client_user' then array['visual-builder.read','visual-builder.create','visual-builder.upload']
    else array[]::text[]
  end) as capability
) caps
where r.is_system
  and r.key in ('omfire_super_admin','omfire_admin','omfire_lead','omfire_user','client_admin','client_user')
on conflict (role_id, capability) do nothing;
