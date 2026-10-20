-- Accès réservé aux comptes autorisés.
-- Avant : tout compte connecté voyait tout. Si quelqu'un parvenait à s'inscrire
-- par l'API, il accédait aux données du magasin. Désormais seuls les comptes
-- listés dans "comptes_autorises" lisent et écrivent quoi que ce soit.
-- Pour autoriser un nouvel appareil/compte : insérer son id dans cette table.

create table if not exists comptes_autorises (
  user_id uuid primary key references auth.users (id) on delete cascade,
  note text not null default ''
);
alter table comptes_autorises enable row level security;
revoke all on comptes_autorises from anon, authenticated;

insert into comptes_autorises (user_id, note)
select id, email from auth.users
where email in ('lepiceriedaqui@orange.fr', 'loic.david6@hotmail.com')
on conflict do nothing;

create or replace function public.est_autorise()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from comptes_autorises where user_id = auth.uid())
$$;
revoke all on function public.est_autorise() from public, anon;
grant execute on function public.est_autorise() to authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'produits', 'equipements', 'releves', 'receptions', 'lots',
    'taches', 'nettoyages', 'operateurs', 'reglages',
    'clients', 'commandes', 'lignes_commande', 'factures'
  ] loop
    execute format('drop policy if exists "compte du magasin" on %I', t);
    execute format(
      'create policy "compte du magasin" on %I for all to authenticated '
      'using (public.est_autorise()) with check (public.est_autorise())', t);
  end loop;
end $$;

-- Vérification : doit renvoyer les deux comptes.
select u.email from comptes_autorises c join auth.users u on u.id = c.user_id;
