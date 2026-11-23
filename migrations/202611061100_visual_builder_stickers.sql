-- Decorative images per tenant (leaves, arrows) that creatives place as their own layer.

alter table public.visual_builder_assets drop constraint visual_builder_assets_kind_check;
alter table public.visual_builder_assets
  add constraint visual_builder_assets_kind_check check (kind in ('logo', 'cta', 'font', 'example', 'badge', 'sticker'));

alter table public.visual_builder_assets drop constraint visual_builder_assets_check;
alter table public.visual_builder_assets
  add constraint visual_builder_assets_check check (
    (kind = 'logo' and variant in ('square', 'wide') and file_id is not null)
    or (kind = 'cta' and variant = 'text')
    or (kind = 'cta' and variant = 'graphic' and file_id is not null)
    or (kind = 'font' and variant in ('normal', 'italic') and file_id is not null and font_family is not null and font_weight is not null)
    or (kind = 'example' and variant = 'image' and file_id is not null)
    or (kind = 'badge' and variant in ('price-box', 'diamond', 'burst', 'circle', 'box') and file_id is null)
    or (kind = 'sticker' and variant = 'image' and file_id is not null)
  );
