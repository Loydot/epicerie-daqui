-- Produits à la coupe : chaque pièce entamée (un brebis, un jambon…) et sa date d'ouverture.
create table if not exists ouvertures (
  id uuid primary key,
  nom text not null default '',
  categorie text not null default 'autre',
  ouvert_le text not null default '',
  fini_le text not null default '',
  operateur text not null default '',
  note text not null default '',
  cree_le timestamptz not null default now(),
  maj_le timestamptz not null default now(),
  supprime boolean not null default false
);
create index if not exists ouvertures_maj_le on ouvertures (maj_le);
alter table ouvertures enable row level security;
drop policy if exists "compte du magasin" on ouvertures;
create policy "compte du magasin" on ouvertures for all to authenticated
  using (public.est_autorise()) with check (public.est_autorise());
grant select, insert, update, delete on ouvertures to authenticated;
drop trigger if exists maj_le_ouvertures on ouvertures;
create trigger maj_le_ouvertures before insert or update on ouvertures
  for each row execute function touche_maj_le();

-- Photo de la pièce (JPEG réduit, en data URL).
alter table ouvertures add column if not exists photo text not null default '';
