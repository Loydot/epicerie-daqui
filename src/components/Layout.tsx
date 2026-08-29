import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { aujourdhui, joursRestants } from '../lib/format'
import {
  IconeAccueil, IconeCatalogue, IconeRegistre, IconeReglages, IconeRetour,
  IconeScan, IconeTemperature,
} from './Icones'

const ONGLETS = [
  { to: '/', libelle: 'Accueil', Icone: IconeAccueil, exact: true },
  { to: '/scan', libelle: 'Scanner', Icone: IconeScan },
  { to: '/catalogue', libelle: 'Catalogue', Icone: IconeCatalogue },
  { to: '/controles', libelle: 'Controles', Icone: IconeTemperature, alertes: true },
  { to: '/registres', libelle: 'Registres', Icone: IconeRegistre },
]

/** Nombre de points rouges a afficher sur l'onglet Controles. */
function useNombreAlertes(): number {
  return useLiveQuery(async () => {
    const jour = aujourdhui()
    const [equipements, relevesDuJour, lots] = await Promise.all([
      db.equipements.filter((e) => e.actif === 1).count(),
      db.releves.where('jour').equals(jour).toArray(),
      db.lots.where('statut').equals('en_stock').toArray(),
    ])
    const faits = new Set(relevesDuJour.map((r) => r.equipementId)).size
    const relevesManquants = Math.max(0, equipements - faits)
    const dlcCritiques = lots.filter((l) => joursRestants(l.dlc) <= 3).length
    return relevesManquants + dlcCritiques
  }, [], 0) ?? 0
}

const TITRES: Array<[RegExp, string]> = [
  [/^\/$/, 'Tableau de bord'],
  [/^\/scan/, 'Scanner'],
  [/^\/catalogue$/, 'Catalogue'],
  [/^\/produit\//, 'Fiche produit'],
  [/^\/controles$/, 'Controles HACCP'],
  [/^\/temperatures/, 'Temperatures'],
  [/^\/receptions/, 'Receptions'],
  [/^\/dlc/, 'Dates limites'],
  [/^\/nettoyage/, 'Plan de nettoyage'],
  [/^\/registres/, 'Registres'],
  [/^\/reglages/, 'Reglages'],
]

export default function Layout() {
  const alertes = useNombreAlertes()
  const { pathname } = useLocation()
  const navigate = useNavigate()

  const titre = TITRES.find(([re]) => re.test(pathname))?.[1] ?? 'Epicerie'
  const racine = ONGLETS.some((o) => (o.exact ? o.to === pathname : pathname.startsWith(o.to)))

  return (
    <div className="app">
      <nav className="nav">
        {ONGLETS.map(({ to, libelle, Icone, exact, alertes: avecAlertes }) => (
          <NavLink key={to} to={to} end={exact} className={({ isActive }) => (isActive ? 'actif' : '')}>
            <Icone />
            <span>{libelle}</span>
            {avecAlertes && alertes > 0 && <span className="pastille">{alertes > 99 ? '99+' : alertes}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="colonne">
        <header className="entete">
          {!racine && (
            <button type="button" className="discret" onClick={() => navigate(-1)} aria-label="Retour">
              <IconeRetour />
            </button>
          )}
          <h1>{titre}</h1>
          <NavLink to="/reglages" className="discret bouton" aria-label="Reglages">
            <IconeReglages />
          </NavLink>
        </header>

        <main className="contenu">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
