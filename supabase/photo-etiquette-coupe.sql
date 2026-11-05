-- À exécuter dans Supabase pour synchroniser la seconde photo des pièces à la coupe.
alter table public.ouvertures
  add column if not exists photo_etiquette text not null default '';
