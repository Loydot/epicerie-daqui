-- Factures. Les lignes sont rangées dans la facture elle-même (JSON) : une
-- facture émise forme un tout, on ne la recompose jamais à partir d'autres tables.
create table if not exists factures (
  id uuid primary key,
  numero text not null default '',
  date text not null default '',
  date_vente text not null default '',
  echeance text not null default '',
  client_nom text not null default '',
  client_adresse text not null default '',
  client_code_postal text not null default '',
  client_ville text not null default '',
  client_telephone text not null default '',
  client_email text not null default '',
  client_siret text not null default '',
  client_tva text not null default '',
  lignes text not null default '[]',
  mode_paiement text not null default '',
  acquittee integer not null default 0,
  note text not null default '',
  cree_le timestamptz not null default now(),
  maj_le timestamptz not null default now(),
  supprime boolean not null default false
);

create index if not exists factures_maj_le on factures (maj_le);

alter table factures enable row level security;
drop policy if exists "compte du magasin" on factures;
create policy "compte du magasin" on factures for all to authenticated
  using (auth.uid() is not null) with check (auth.uid() is not null);
grant select, insert, update, delete on factures to authenticated;

drop trigger if exists maj_le_factures on factures;
create trigger maj_le_factures before insert or update on factures
  for each row execute function touche_maj_le();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'factures'
  ) then
    alter publication supabase_realtime add table factures;
  end if;
end $$;
