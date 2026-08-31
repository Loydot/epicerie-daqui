-- Schéma de synchronisation de l'application Épicerie — Scan & HACCP.
--
-- Principes :
--   * chaque table reprend les champs de la base locale (IndexedDB) ;
--   * "maj_le" horodate la dernière modification et sert de curseur de synchro ;
--   * "supprime" remplace la suppression réelle, sinon un effacement fait sur un
--     appareil ne pourrait jamais se propager aux autres ;
--   * l'accès est refusé par défaut : rien n'est lisible sans être connecté.
--
-- À exécuter dans l'éditeur SQL du projet Supabase. Rejouable sans risque.

-- ---------------------------------------------------------------- tables

create table if not exists produits (
  id uuid primary key,
  ean text not null,
  nom text not null default '',
  marque text not null default '',
  contenance text not null default '',
  rayon text not null default '',
  section text not null default 'nonclasse',
  photo_url text not null default '',
  prix_achat numeric,
  prix_vente numeric,
  tva numeric not null default 5.5,
  stock numeric not null default 0,
  seuil_alerte numeric,
  fournisseur text not null default '',
  allergenes text not null default '',
  nutriscore text not null default '',
  source text not null default 'manuel',
  a_enrichir int not null default 0,
  note text not null default '',
  cree_le timestamptz not null default now(),
  maj_le timestamptz not null default now(),
  supprime boolean not null default false
);

create table if not exists equipements (
  id uuid primary key,
  nom text not null default '',
  type text not null default 'frigo',
  temp_min numeric not null default 0,
  temp_max numeric not null default 4,
  actif int not null default 1,
  ordre int not null default 0,
  maj_le timestamptz not null default now(),
  supprime boolean not null default false
);

create table if not exists releves (
  id uuid primary key,
  equipement_id uuid not null,
  temp numeric not null,
  date timestamptz not null,
  jour text not null,
  moment text not null,
  operateur text not null default '',
  conforme int not null default 1,
  action_corrective text not null default '',
  maj_le timestamptz not null default now(),
  supprime boolean not null default false
);

create table if not exists receptions (
  id uuid primary key,
  date timestamptz not null,
  jour text not null,
  fournisseur text not null default '',
  bon_livraison text not null default '',
  temp_produit numeric,
  emballage_ok int not null default 1,
  dlc_ok int not null default 1,
  conforme int not null default 1,
  motif text not null default '',
  operateur text not null default '',
  photo text not null default '',
  maj_le timestamptz not null default now(),
  supprime boolean not null default false
);

create table if not exists lots (
  id uuid primary key,
  produit_id uuid not null,
  ean text not null default '',
  numero_lot text not null default '',
  dlc text not null default '',
  quantite numeric not null default 1,
  statut text not null default 'en_stock',
  operateur text not null default '',
  cree_le timestamptz not null default now(),
  retire_le text not null default '',
  maj_le timestamptz not null default now(),
  supprime boolean not null default false
);

create table if not exists taches (
  id uuid primary key,
  nom text not null default '',
  zone text not null default '',
  frequence text not null default 'quotidien',
  produit_utilise text not null default '',
  actif int not null default 1,
  ordre int not null default 0,
  maj_le timestamptz not null default now(),
  supprime boolean not null default false
);

create table if not exists nettoyages (
  id uuid primary key,
  tache_id uuid not null,
  date timestamptz not null,
  periode text not null,
  operateur text not null default '',
  commentaire text not null default '',
  maj_le timestamptz not null default now(),
  supprime boolean not null default false
);

create table if not exists operateurs (
  id uuid primary key,
  nom text not null default '',
  actif int not null default 1,
  maj_le timestamptz not null default now(),
  supprime boolean not null default false
);

create table if not exists reglages (
  cle text primary key,
  valeur text not null default '',
  maj_le timestamptz not null default now(),
  supprime boolean not null default false
);

-- Ajouts après coup pour les bases déjà créées.
alter table clients add column if not exists adresse text not null default '';
alter table commandes add column if not exists mode text not null default 'retrait';
alter table commandes add column if not exists adresse_livraison text not null default '';

alter table produits add column if not exists section text not null default 'nonclasse';

create table if not exists clients (
  id uuid primary key,
  nom text not null default '',
  telephone text not null default '',
  adresse text not null default '',
  note text not null default '',
  cree_le timestamptz not null default now(),
  maj_le timestamptz not null default now(),
  supprime boolean not null default false
);

create table if not exists commandes (
  id uuid primary key,
  client_id uuid not null,
  date timestamptz not null,
  mode text not null default 'retrait',
  date_retrait text not null default '',
  adresse_livraison text not null default '',
  statut text not null default 'a_commander',
  note text not null default '',
  operateur text not null default '',
  retire_le text not null default '',
  maj_le timestamptz not null default now(),
  supprime boolean not null default false
);

create table if not exists lignes_commande (
  id uuid primary key,
  commande_id uuid not null,
  produit_id text not null default '',
  libelle text not null default '',
  quantite numeric not null default 1,
  prix_unitaire numeric,
  maj_le timestamptz not null default now(),
  supprime boolean not null default false
);

create index if not exists commandes_client on commandes (client_id);
create index if not exists lignes_commande_commande on lignes_commande (commande_id);
create index if not exists clients_maj_le on clients (maj_le);
create index if not exists commandes_maj_le on commandes (maj_le);
create index if not exists lignes_commande_maj_le on lignes_commande (maj_le);

-- Un même code-barres ne doit exister qu'une fois, sauf parmi les fiches effacées.
create unique index if not exists produits_ean_unique
  on produits (ean) where not supprime;

-- Curseurs de synchronisation : chaque appareil ne redemande que le nouveau.
create index if not exists produits_maj_le on produits (maj_le);
create index if not exists equipements_maj_le on equipements (maj_le);
create index if not exists releves_maj_le on releves (maj_le);
create index if not exists receptions_maj_le on receptions (maj_le);
create index if not exists lots_maj_le on lots (maj_le);
create index if not exists taches_maj_le on taches (maj_le);
create index if not exists nettoyages_maj_le on nettoyages (maj_le);
create index if not exists operateurs_maj_le on operateurs (maj_le);
create index if not exists reglages_maj_le on reglages (maj_le);

-- ------------------------------------------------------- règles d'accès

-- Sans ces lignes, la clé publique donnerait un accès complet à n'importe qui.
do $$
declare t text;
begin
  foreach t in array array[
    'produits', 'equipements', 'releves', 'receptions', 'lots',
    'taches', 'nettoyages', 'operateurs', 'reglages',
    'clients', 'commandes', 'lignes_commande'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "compte du magasin" on %I', t);
    -- Un seul compte partagé : être authentifié suffit, et c'est tout.
    execute format(
      'create policy "compte du magasin" on %I for all to authenticated '
      'using (auth.uid() is not null) with check (auth.uid() is not null)', t);
  end loop;
end $$;

-- --------------------------------------------------------- privilèges

-- Les règles RLS filtrent les lignes, mais encore faut-il avoir le droit
-- d'approcher la table. Sur ce projet, ni anon ni authenticated ne l'avaient :
-- sans ces lignes, l'application échouerait avec « permission denied » même
-- après connexion. On donne à "authenticated" seulement, jamais à "anon".
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- Même chose pour les tables qui seraient créées plus tard.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

-- --------------------------------------------- horodatage automatique

-- Le serveur fait foi sur "maj_le" : une horloge de téléphone mal réglée ne doit
-- pas pouvoir faire gagner une modification plus ancienne.
create or replace function touche_maj_le()
returns trigger language plpgsql as $$
begin
  new.maj_le := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'produits', 'equipements', 'releves', 'receptions', 'lots',
    'taches', 'nettoyages', 'operateurs', 'reglages',
    'clients', 'commandes', 'lignes_commande'
  ] loop
    execute format('drop trigger if exists %I on %I', 'maj_le_' || t, t);
    execute format(
      'create trigger %I before insert or update on %I '
      'for each row execute function touche_maj_le()', 'maj_le_' || t, t);
  end loop;
end $$;

-- ------------------------------------------------------ temps réel

-- Pour que le PC voie apparaître un scan du téléphone sans rien rafraîchir.
do $$
declare t text;
begin
  foreach t in array array[
    'produits', 'equipements', 'releves', 'receptions', 'lots',
    'taches', 'nettoyages', 'operateurs', 'reglages',
    'clients', 'commandes', 'lignes_commande'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;
