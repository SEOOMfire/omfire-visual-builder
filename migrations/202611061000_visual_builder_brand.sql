-- Brand configuration per tenant (fonts per text role, colour palette) and badge templates
-- (price boxes, diamonds, starbursts). Both are configuration; nothing is tenant-specific in code.

alter table public.visual_builder_settings
  add column brand jsonb not null default '{}'::jsonb
  check (jsonb_typeof(brand) = 'object' and pg_column_size(brand) <= 16000);

alter table public.visual_builder_assets drop constraint visual_builder_assets_kind_check;
alter table public.visual_builder_assets
  add constraint visual_builder_assets_kind_check check (kind in ('logo', 'cta', 'font', 'example', 'badge'));

alter table public.visual_builder_assets drop constraint visual_builder_assets_check;
alter table public.visual_builder_assets
  add constraint visual_builder_assets_check check (
    (kind = 'logo' and variant in ('square', 'wide') and file_id is not null)
    or (kind = 'cta' and variant = 'text')
    or (kind = 'cta' and variant = 'graphic' and file_id is not null)
    or (kind = 'font' and variant in ('normal', 'italic') and file_id is not null and font_family is not null and font_weight is not null)
    or (kind = 'example' and variant = 'image' and file_id is not null)
    or (kind = 'badge' and variant in ('price-box', 'diamond', 'burst', 'circle', 'box') and file_id is null)
  );
