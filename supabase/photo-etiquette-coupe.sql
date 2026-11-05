-- À exécuter dans Supabase pour synchroniser les photos d'étiquette et les allergènes repérés.
alter table public.ouvertures
  add column if not exists photo_etiquette text not null default '';

alter table public.ouvertures
  add column if not exists allergenes text not null default '';
