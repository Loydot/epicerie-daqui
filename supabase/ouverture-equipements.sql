-- Jours d'ouverture des équipements et jours d'extinction.
-- À coller dans l'éditeur SQL de Supabase AVANT d'utiliser la nouvelle version
-- de l'application. Rejouable sans risque.

alter table equipements add column if not exists jours_ouverture text not null default '';
alter table equipements add column if not exists exceptions text not null default '';
