import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, setReglage, uid } from '../db/db'
import type { Equipement, Frequence, TypeEquipement } from '../db/types'
import { exporteSauvegarde } from '../lib/export'
import EtatSynchro from '../components/EtatSynchro'
import { IconeCorbeille, IconeExport, IconePlus, IconeValide } from '../components/Icones'

const TABLES = ['produits', 'equipements', 'releves', 'receptions', 'lots', 'taches', 'nettoyages', 'operateurs', 'reglages'] as const

const TYPES: Array<[TypeEquipement, string]> = [
  ['frigo', 'Frigo'], ['congelateur', 'Congelateur'], ['vitrine', 'Vitrine'], ['reserve', 'Reserve'],
]

const FREQUENCES: Array<[Frequence, string]> = [
  ['quotidien', 'Quotidien'], ['hebdomadaire', 'Hebdomadaire'], ['mensuel', 'Mensuel'],
]

export default function Reglages() {
  const fichierRef = useRef<HTMLInputElement>(null)
  const [nouvelOperateur, setNouvelOperateur] = useState('')
  const [message, setMessage] = useState('')

  const magasin = useLiveQuery(async () => (await db.reglages.get('magasin'))?.valeur ?? '', [], '') ?? ''
  const operateurs = useLiveQuery(() => db.operateurs.toArray(), [], []) ?? []
  const equipements = useLiveQuery(
    async () => (await db.equipements.toArray()).sort((a, b) => a.ordre - b.ordre), [], [],
  ) ?? []
  const taches = useLiveQuery(
    async () => (await db.taches.toArray()).sort((a, b) => a.ordre - b.ordre), [], [],
  ) ?? []

  const majEquipement = (id: string, champs: Partial<Equipement>) => void db.equipements.update(id, champs)

  const ajouteEquipement = () => void db.equipements.add({
    id: uid(), nom: 'Nouvel équipement', type: 'frigo',
    tempMin: 0, tempMax: 4, actif: 1, ordre: equipements.length + 1,
  })

  const ajouteTache = () => void db.taches.add({
    id: uid(), nom: 'Nouvelle tâche', zone: '', frequence: 'quotidien',
    produitUtilise: '', actif: 1, ordre: taches.length + 1,
  })

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
        <div className="ligne-espace">
          <h2>Équipements à surveiller</h2>
          <button type="button" className="discret" onClick={ajouteEquipement}><IconePlus /> Ajouter</button>
        </div>
        {equipements.map((e) => (
          <div key={e.id} className="pile" style={{ paddingTop: 12, borderTop: '1px solid var(--bord)' }}>
            <div className="ligne">
              <input className="champ" value={e.nom} onChange={(ev) => majEquipement(e.id, { nom: ev.target.value })} />
              <button type="button" className="discret" aria-label="Supprimer"
                onClick={() => { if (confirm(`Supprimer "${e.nom}" ? Les relevés passes sont conservés.`)) void db.equipements.delete(e.id) }}>
                <IconeCorbeille />
              </button>
            </div>
            <div className="deux-champs">
              <div>
                <label htmlFor={`ty-${e.id}`}>Type</label>
                <select id={`ty-${e.id}`} value={e.type}
                  onChange={(ev) => majEquipement(e.id, { type: ev.target.value as TypeEquipement })}>
                  {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="deux-champs">
                <div>
                  <label htmlFor={`mi-${e.id}`}>Min °C</label>
                  <input id={`mi-${e.id}`} className="mono" type="number" step="0.5" value={e.tempMin}
                    onChange={(ev) => majEquipement(e.id, { tempMin: Number(ev.target.value) })} />
                </div>
                <div>
                  <label htmlFor={`ma-${e.id}`}>Max °C</label>
                  <input id={`ma-${e.id}`} className="mono" type="number" step="0.5" value={e.tempMax}
                    onChange={(ev) => majEquipement(e.id, { tempMax: Number(ev.target.value) })} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="carte pile">
        <div className="ligne-espace">
          <h2>Plan de nettoyage</h2>
          <button type="button" className="discret" onClick={ajouteTache}><IconePlus /> Ajouter</button>
        </div>
        {taches.map((t) => (
          <div key={t.id} className="pile" style={{ paddingTop: 12, borderTop: '1px solid var(--bord)' }}>
            <div className="ligne">
              <input className="champ" value={t.nom} onChange={(e) => void db.taches.update(t.id, { nom: e.target.value })} />
              <button type="button" className="discret" aria-label="Supprimer"
                onClick={() => { if (confirm(`Supprimer la tâche "${t.nom}" ?`)) void db.taches.delete(t.id) }}>
                <IconeCorbeille />
              </button>
            </div>
            <div className="deux-champs">
              <div>
                <label htmlFor={`fr-${t.id}`}>Fréquence</label>
                <select id={`fr-${t.id}`} value={t.frequence}
                  onChange={(e) => void db.taches.update(t.id, { frequence: e.target.value as Frequence })}>
                  {FREQUENCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor={`zo-${t.id}`}>Zone</label>
                <input id={`zo-${t.id}`} value={t.zone} onChange={(e) => void db.taches.update(t.id, { zone: e.target.value })} />
              </div>
            </div>
          </div>
        ))}
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
