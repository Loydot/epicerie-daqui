import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, setReglage, uid } from '../db/db'
import { exporteSauvegarde } from '../lib/export'
import EtatSynchro from '../components/EtatSynchro'
import { IconeCorbeille, IconeExport, IconePlus, IconeValide } from '../components/Icones'

const TABLES = ['produits', 'equipements', 'releves', 'receptions', 'lots', 'taches', 'nettoyages', 'operateurs', 'reglages'] as const

export default function Reglages() {
  const fichierRef = useRef<HTMLInputElement>(null)
  const [nouvelOperateur, setNouvelOperateur] = useState('')
  const [message, setMessage] = useState('')

  const magasin = useLiveQuery(async () => (await db.reglages.get('magasin'))?.valeur ?? '', [], '') ?? ''
  const operateurs = useLiveQuery(() => db.operateurs.toArray(), [], []) ?? []

  const sauvegarde = async () => {
    const donnees: Record<string, unknown[]> = {}
    for (const t of TABLES) donnees[t] = await db.table(t).toArray()
    exporteSauvegarde(donnees)
  }

  const restaure = async (fichier: File) => {
    try {
      const contenu = JSON.parse(await fichier.text())
      const donnees = contenu?.donnees
      if (!donnees || typeof donnees !== 'object') throw new Error('format')
      if (!confirm('La restauration remplace toutes les données actuelles. Continuer ?')) return
      await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
        for (const t of TABLES) {
          if (!Array.isArray(donnees[t])) continue
          await db.table(t).clear()
          await db.table(t).bulkAdd(donnees[t])
        }
      })
      setMessage('Sauvegarde restaurée.')
    } catch {
      setMessage("Fichier illisible : ce n'est pas une sauvegarde de l'application.")
    }
  }

  const videTout = async () => {
    if (!confirm('Effacer TOUTES les données de cet appareil ? Cette action est définitive.')) return
    if (!confirm('Dernière confirmation : catalogue, relevés et registres seront perdus.')) return
    await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
      for (const t of TABLES) await db.table(t).clear()
    })
    location.reload()
  }

  return (
    <div className="pile">
      {message && <div className="bandeau"><IconeValide /><span>{message}</span></div>}

      <div className="carte pile">
        <h2>Établissement</h2>
        <div>
          <label htmlFor="magasin">Nom du magasin</label>
          <input id="magasin" value={magasin} placeholder="Ex. Épicerie du Marché"
            onChange={(e) => void setReglage('magasin', e.target.value)} />
        </div>
        <p className="petit doux">Ce nom apparaît en tête de tous les registres et documents PDF.</p>
      </div>

      <div className="carte pile">
        <div className="ligne-espace">
          <h2>Personnes qui saisissent</h2>
        </div>
        <p className="petit doux">
          Un registre HACCP doit indiquer qui a fait le relevé. Ajoute les prénoms ici,
          ils apparaîtront dans un menu déroulant au moment de la saisie.
        </p>
        <div className="ligne">
          <input className="champ" placeholder="Prénom" value={nouvelOperateur}
            onChange={(e) => setNouvelOperateur(e.target.value)} />
          <button type="button" className="principal" disabled={!nouvelOperateur.trim()}
            onClick={() => {
              void db.operateurs.add({ id: uid(), nom: nouvelOperateur.trim(), actif: 1 })
              setNouvelOperateur('')
            }}>
            <IconePlus />
          </button>
        </div>
        {operateurs.length > 0 && (
          <div className="liste">
            {operateurs.map((o) => (
              <div key={o.id} className="item">
                <div className="item-corps"><div className="item-nom">{o.nom}</div></div>
                <button type="button" className="discret" aria-label={`Retirer ${o.nom}`}
                  onClick={() => void db.operateurs.delete(o.id)}>
                  <IconeCorbeille />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="carte pile">
        <h2>Sauvegarde</h2>
        <p className="petit doux">
          Tant que la synchro en ligne n'est pas branchée, les données vivent uniquement dans ce navigateur.
          Exporte une sauvegarde de temps en temps.
        </p>
        <button type="button" className="large" onClick={sauvegarde}>
          <IconeExport /> Exporter une sauvegarde
        </button>
        <button type="button" className="large" onClick={() => fichierRef.current?.click()}>
          Restaurer depuis un fichier
        </button>
        <input ref={fichierRef} type="file" accept="application/json" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void restaure(f); e.target.value = '' }} />
      </div>

      <EtatSynchro />

      <div className="carte pile">
        <h2 style={{ color: 'var(--danger)' }}>Zone dangereuse</h2>
        <button type="button" className="destructif large" onClick={videTout}>
          <IconeCorbeille /> Effacer toutes les données de cet appareil
        </button>
      </div>
    </div>
  )
}
