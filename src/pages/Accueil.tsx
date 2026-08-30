import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { aujourdhui, euro, joursRestants, nombre } from '../lib/format'
import {
  IconeAlerte, IconeBalai, IconeBoite, IconeCalendrier, IconeCamion,
  IconeScan, IconeTemperature, IconeValide,
} from '../components/Icones'

export default function Accueil() {
  const resume = useLiveQuery(async () => {
    const jour = aujourdhui()
    const [produits, equipements, relevesJour, lots, receptionsJour] = await Promise.all([
      db.produits.toArray(),
      db.equipements.filter((e) => e.actif === 1).toArray(),
      db.releves.where('jour').equals(jour).toArray(),
      db.lots.where('statut').equals('en_stock').toArray(),
      db.receptions.where('jour').equals(jour).count(),
    ])

    const releves = new Set(relevesJour.map((r) => r.equipementId))
    const perimes = lots.filter((l) => joursRestants(l.dlc) < 0)
    const proches = lots.filter((l) => {
      const j = joursRestants(l.dlc)
      return j >= 0 && j <= 3
    })

    return {
      references: produits.length,
      unites: produits.reduce((s, p) => s + p.stock, 0),
      valeur: produits.reduce((s, p) => s + p.stock * (p.prixAchat ?? 0), 0),
      sansPrix: produits.filter((p) => p.prixVente == null).length,
      aEnrichir: produits.filter((p) => p.aEnrichir === 1).length,
      equipements: equipements.length,
      relevesFaits: releves.size,
      relevesNonConformes: relevesJour.filter((r) => r.conforme === 0).length,
      receptionsJour,
      perimes,
      proches,
    }
  }, [], undefined)

  if (!resume) return <div className="carte vide">Chargement…</div>

  const relevesRestants = Math.max(0, resume.equipements - resume.relevesFaits)

  return (
    <div className="pile">
      <Link to="/scan" className="bouton principal haut large">
        <IconeScan /> Scanner un produit
      </Link>

      {resume.perimes.length > 0 && (
        <Link to="/dlc" className="bandeau danger" style={{ textDecoration: 'none' }}>
          <IconeAlerte />
          <span>
            <strong>{resume.perimes.length} lot{resume.perimes.length > 1 ? 's' : ''} dépassé{resume.perimes.length > 1 ? 's' : ''}</strong>
            {' '}— à retirer de la vente immédiatement.
          </span>
        </Link>
      )}
      {resume.relevesNonConformes > 0 && (
        <Link to="/temperatures" className="bandeau danger" style={{ textDecoration: 'none' }}>
          <IconeAlerte />
          <span><strong>{resume.relevesNonConformes} température hors zone</strong> aujourd'hui — action corrective à tracer.</span>
        </Link>
      )}
      {resume.aEnrichir > 0 && (
        <div className="bandeau">
          <IconeBoite />
          <span>
            {resume.aEnrichir} fiche{resume.aEnrichir > 1 ? 's' : ''} scannée{resume.aEnrichir > 1 ? 's' : ''} sans réseau.
            {' '}Le nom et la photo seront récupérés tout seuls dès que l'appareil retrouvera une connexion.
          </span>
        </div>
      )}
      {resume.proches.length > 0 && (
        <Link to="/dlc" className="bandeau alerte" style={{ textDecoration: 'none' }}>
          <IconeCalendrier />
          <span>{resume.proches.length} lot{resume.proches.length > 1 ? 's arrivent' : ' arrive'} à échéance sous 3 jours.</span>
        </Link>
      )}

      <div>
        <div className="section-titre">Aujourd'hui</div>
        <div className="grille">
          <Link to="/temperatures" className="carte" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="ligne-espace">
              <span className="petit doux">Relevés de température</span>
              <IconeTemperature className="doux" />
            </div>
            <div className="gros-chiffre">{resume.relevesFaits} / {resume.equipements}</div>
            {/* Sans équipement, « tout est relevé » serait un mensonge rassurant. */}
            <span className={`etiquette ${
              resume.equipements === 0 ? 'accent' : relevesRestants === 0 ? 'ok' : 'alerte'
            }`}>
              {resume.equipements === 0
                ? 'Ajouter un équipement'
                : relevesRestants === 0
                  ? <><IconeValide /> Tout est relevé</>
                  : `${relevesRestants} équipement${relevesRestants > 1 ? 's' : ''} en attente`}
            </span>
          </Link>

          <Link to="/receptions" className="carte" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="ligne-espace">
              <span className="petit doux">Réceptions contrôlées</span>
              <IconeCamion className="doux" />
            </div>
            <div className="gros-chiffre">{nombre(resume.receptionsJour)}</div>
            <span className="etiquette">Livraisons du jour</span>
          </Link>

          <Link to="/nettoyage" className="carte" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="ligne-espace">
              <span className="petit doux">Plan de nettoyage</span>
              <IconeBalai className="doux" />
            </div>
            <div className="petit" style={{ marginTop: 10 }}>Cocher les tâches faites</div>
            <span className="etiquette accent">Ouvrir</span>
          </Link>
        </div>
      </div>

      <div>
        <div className="section-titre">Inventaire</div>
        <div className="tuiles">
          <Link to="/catalogue" className="tuile">
            <span className="tuile-libelle">Références</span>
            <div>
              <div className="tuile-valeur mono">{nombre(resume.references)}</div>
              <span className="tuile-note">{nombre(resume.unites)} unités</span>
            </div>
          </Link>

          <div className="tuile">
            <span className="tuile-libelle">Valeur</span>
            <div>
              <div className="tuile-valeur mono long">{euro(resume.valeur)}</div>
              <span className="tuile-note">au prix d'achat</span>
            </div>
          </div>

          {resume.sansPrix > 0 && (
            <Link to="/catalogue" className="tuile">
              <span className="tuile-libelle">Prix manquants</span>
              <div>
                <div className="tuile-valeur mono" style={{ color: 'var(--alerte)' }}>{nombre(resume.sansPrix)}</div>
                <span className="tuile-note">à compléter</span>
              </div>
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
