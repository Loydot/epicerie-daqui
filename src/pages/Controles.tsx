import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { aujourdhui, joursRestants } from '../lib/format'
import { IconeBalai, IconeCalendrier, IconeCamion, IconeRegistre, IconeTemperature } from '../components/Icones'

export default function Controles() {
  const etat = useLiveQuery(async () => {
    const jour = aujourdhui()
    const [equipements, relevesJour, lots, receptionsJour] = await Promise.all([
      db.equipements.filter((e) => e.actif === 1).count(),
      db.releves.where('jour').equals(jour).toArray(),
      db.lots.where('statut').equals('en_stock').toArray(),
      db.receptions.where('jour').equals(jour).count(),
    ])
    return {
      relevesManquants: Math.max(0, equipements - new Set(relevesJour.map((r) => r.equipementId)).size),
      horsZone: relevesJour.filter((r) => r.conforme === 0).length,
      urgents: lots.filter((l) => joursRestants(l.dlc) <= 3).length,
      receptionsJour,
    }
  }, [], undefined)

  const cartes = [
    {
      to: '/temperatures', titre: 'Températures', Icone: IconeTemperature,
      texte: 'Relever les frigos, congélateurs et vitrines matin et soir.',
      alerte: etat && (etat.horsZone > 0
        ? { niveau: 'danger', texte: `${etat.horsZone} relevé hors zone` }
        : etat.relevesManquants > 0
          ? { niveau: 'alerte', texte: `${etat.relevesManquants} équipement(s) a relever` }
          : { niveau: 'ok', texte: 'A jour pour aujourd\'hui' }),
    },
    {
      to: '/receptions', titre: 'Réceptions', Icone: IconeCamion,
      texte: 'Controler chaque livraison : température, emballages, DLC.',
      alerte: etat && { niveau: '', texte: `${etat.receptionsJour} contrôle(s) aujourd'hui` },
    },
    {
      to: '/dlc', titre: 'Dates limites', Icone: IconeCalendrier,
      texte: 'Suivre les lots et tracer les retraits de la vente.',
      alerte: etat && (etat.urgents > 0
        ? { niveau: 'danger', texte: `${etat.urgents} lot(s) à traiter` }
        : { niveau: 'ok', texte: 'Rien d\'urgent' }),
    },
    {
      to: '/nettoyage', titre: 'Plan de nettoyage', Icone: IconeBalai,
      texte: 'Cocher les tâches quotidiennes, hebdomadaires et mensuelles.',
      alerte: null,
    },
    {
      to: '/registres', titre: 'Registres', Icone: IconeRegistre,
      texte: "Le PDF des quatre registres, à présenter en cas de contrôle.",
      alerte: null,
    },
  ]

  return (
    <div className="grille">
      {cartes.map(({ to, titre, texte, Icone, alerte }) => (
        <Link key={to} to={to} className="carte" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="ligne-espace">
            <h2>{titre}</h2>
            <Icone className="doux" />
          </div>
          <p className="petit doux" style={{ margin: '6px 0 10px' }}>{texte}</p>
          {alerte && <span className={`etiquette ${alerte.niveau}`}>{alerte.texte}</span>}
        </Link>
      ))}
    </div>
  )
}
