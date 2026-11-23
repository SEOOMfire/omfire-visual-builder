-- Standalone service: an insert without a user must not keep a caller-supplied approval.
-- The copied trigger returned the row unchanged when current_user_id() was null.

create or replace function private.visual_builder_creative_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  passed boolean;
begin
  if private.current_user_id() is null then
    raise exception 'Ein Werbemittel braucht eine angemeldete Person.' using errcode = '42501';
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
