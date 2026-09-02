-- Product barcode metadata and per-user duplicate protection.
alter table public.ingredients
  add column if not exists barcode text;

alter table public.ingredients
  drop constraint if exists ingredients_barcode_format_check;

alter table public.ingredients
  add constraint ingredients_barcode_format_check
  check (barcode is null or barcode ~ '^[0-9]{8,14}$');

create index if not exists ingredients_barcode_idx
  on public.ingredients(barcode)
  where barcode is not null;

create unique index if not exists ingredients_user_barcode_unique_idx
  on public.ingredients(user_id, barcode)
  where barcode is not null;
