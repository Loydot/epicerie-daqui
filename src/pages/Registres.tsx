import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { aujourdhui, jourDe, nombre } from '../lib/format'
import { exporteCatalogueCsv } from '../lib/export'
import { rangSection } from '../lib/sections'
import { IconeExport, IconeRegistre } from '../components/Icones'

/** Le moteur PDF pese plusieurs centaines de Ko : charge seulement au clic. */
const chargePdf = () => import('../lib/pdf')

/** Debut du mois en cours : la période qu'on edite le plus souvent. */
const debutDuMois = () => {
  const d = new Date()
  return jourDe(new Date(d.getFullYear(), d.getMonth(), 1))
}

export default function Registres() {
  const [du, setDu] = useState(debutDuMois())
  const [au, setAu] = useState(aujourdhui())
  const [enCours, setEnCours] = useState(false)

  const magasin = useLiveQuery(async () => (await db.reglages.get('magasin'))?.valeur ?? '', [], '') ?? ''

  const compte = useLiveQuery(async () => {
    const dans = (jour: string) => jour >= du && jour <= au
    const [releves, receptions, lots, nettoyages] = await Promise.all([
      db.releves.toArray(), db.receptions.toArray(), db.lots.toArray(), db.nettoyages.toArray(),
    ])
    return {
      releves: releves.filter((r) => dans(r.jour)).length,
      receptions: receptions.filter((r) => dans(r.jour)).length,
      lots: lots.filter((l) => dans(l.dlc) || (l.retireLe && dans(jourDe(new Date(l.retireLe))))).length,
      nettoyages: nettoyages.filter((n) => dans(jourDe(new Date(n.date)))).length,
    }
  }, [du, au], undefined)

  const genere = async () => {
    setEnCours(true)
    try {
      const dans = (jour: string) => jour >= du && jour <= au
      const [releves, receptions, lots, nettoyages, equipements, taches, produits] = await Promise.all([
        db.releves.toArray(), db.receptions.toArray(), db.lots.toArray(), db.nettoyages.toArray(),
        db.equipements.toArray(), db.taches.toArray(), db.produits.toArray(),
      ])
      const { registrePdf } = await chargePdf()
      registrePdf({
        magasin, du, au,
        releves: releves.filter((r) => dans(r.jour)).sort((a, b) => a.date.localeCompare(b.date)),
        nomEquipement: (id) => equipements.find((e) => e.id === id)?.nom ?? 'Équipement supprimé',
        receptions: receptions.filter((r) => dans(r.jour)).sort((a, b) => a.date.localeCompare(b.date)),
        lots: lots.filter((l) => dans(l.dlc) || (l.retireLe && dans(jourDe(new Date(l.retireLe)))))
          .sort((a, b) => a.dlc.localeCompare(b.dlc)),
        nomProduit: (id) => produits.find((p) => p.id === id)?.nom ?? 'Produit supprimé',
        nettoyages: nettoyages.filter((n) => dans(jourDe(new Date(n.date))))
          .sort((a, b) => a.date.localeCompare(b.date)),
        taches,
      })
    } finally {
      setEnCours(false)
    }
  }

  const exporteEtiquettes = async () => {
    const produits = (await db.produits.toArray())
      .filter((p) => p.prixVente != null)
      // Rangées comme le magasin : on colle les étiquettes rayon par rayon.
      .sort((a, b) => rangSection(a.section) - rangSection(b.section) || a.nom.localeCompare(b.nom, 'fr'))
    if (produits.length === 0) { alert('Aucun produit avec un prix de vente renseigné.'); return }
    const { etiquettesPdf } = await chargePdf()
    etiquettesPdf(produits, magasin)
  }

  const total = compte ? compte.releves + compte.receptions + compte.lots + compte.nettoyages : 0

  return (
    <div className="pile">
      <div className="carte pile">
        <h2>Registre HACCP</h2>
        <p className="petit doux">
          Un seul PDF regroupant les quatre registres d'autocontrôle sur la période choisie.
          C'est le document à présenter en cas de contrôle.
        </p>

        <div className="deux-champs">
          <div>
            <label htmlFor="du">Du</label>
            <input id="du" type="date" value={du} max={au} onChange={(e) => setDu(e.target.value)} />
          </div>
          <div>
            <label htmlFor="au">Au</label>
            <input id="au" type="date" value={au} min={du} onChange={(e) => setAu(e.target.value)} />
          </div>
        </div>

        {compte && (
          <div className="tuiles">
            <div className="tuile">
              <span className="tuile-libelle">Températures</span>
              <div className="tuile-valeur mono">{nombre(compte.releves)}</div>
            </div>
            <div className="tuile">
              <span className="tuile-libelle">Réceptions</span>
              <div className="tuile-valeur mono">{nombre(compte.receptions)}</div>
            </div>
            <div className="tuile">
              <span className="tuile-libelle">Lots suivis</span>
              <div className="tuile-valeur mono">{nombre(compte.lots)}</div>
            </div>
            <div className="tuile">
              <span className="tuile-libelle">Nettoyage</span>
              <div className="tuile-valeur mono">{nombre(compte.nettoyages)}</div>
            </div>
          </div>
        )}

        <button type="button" className="principal haut large" onClick={genere} disabled={enCours || total === 0}>
          <IconeRegistre /> {enCours ? 'Génération…' : 'Générer le registre PDF'}
        </button>
        {total === 0 && <p className="petit doux">Aucune saisie sur cette période.</p>}
      </div>

      <div className="carte pile">
        <h2>Documents d'inventaire</h2>
        <button type="button" className="large" onClick={exporteEtiquettes}>
          <IconeExport /> Planche d'étiquettes de rayon (PDF)
        </button>
        <button type="button" className="large" onClick={async () => exporteCatalogueCsv(await db.produits.toArray())}>
          <IconeExport /> Catalogue complet (CSV pour Excel)
        </button>
      </div>
    </div>
  )
}
