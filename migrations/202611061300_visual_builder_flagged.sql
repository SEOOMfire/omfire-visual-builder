-- A checked creative with findings stays downloadable but is marked as not signed off ('flagged').
-- Only the saver's own check of exactly this text counts; without one the entry stays 'draft'.

alter table public.visual_builder_creatives drop constraint visual_builder_creatives_guideline_status_check;
alter table public.visual_builder_creatives
  add constraint visual_builder_creatives_guideline_status_check
  check (guideline_status is null or guideline_status in ('draft', 'flagged', 'approved'));

create or replace function private.visual_builder_creative_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  passed boolean;
begin
  if private.current_user_id() is null then
    return new;
  end if;
  new.created_by := private.current_user_id();
  new.audience := case when private.visual_builder_is_internal(new.tenant_id) then 'internal' else 'customer' end;
  select c.approved into passed
  from public.visual_builder_guideline_checks c
  where c.id = new.guideline_check_id and c.tenant_id = new.tenant_id
    and c.user_id = new.created_by and c.source_text = new.source_text;
  if passed is null then
    new.guideline_status := 'draft';
    new.guideline_check_id := null;
  elsif passed then
    new.guideline_status := 'approved';
  else
    new.guideline_status := 'flagged';
  end if;
  return new;
end;
$$;
revoke all on function private.visual_builder_creative_guard() from public;
