import { useState } from 'react'
import { db, uid } from '../db/db'
import type { Frequence } from '../db/types'
import { IconePlus, IconeValide } from './Icones'

/** Ajout d'une tâche au plan de nettoyage, sur le même principe que les équipements. */

interface Raccourci {
  nom: string
  zone: string
  frequence: Frequence
}

const RACCOURCIS: Raccourci[] = [
  { nom: 'Nettoyage du sol', zone: 'Magasin', frequence: 'quotidien' },
  { nom: 'Plan de travail et caisse', zone: 'Caisse', frequence: 'quotidien' },
  { nom: 'Sortie des déchets', zone: 'Réserve', frequence: 'quotidien' },
  { nom: 'Vitrines réfrigérées', zone: 'Rayon frais', frequence: 'hebdomadaire' },
  { nom: 'Dégivrage du congélateur', zone: 'Réserve', frequence: 'mensuel' },
]

const FREQUENCES: Array<[Frequence, string]> = [
  ['quotidien', 'Chaque jour'],
  ['hebdomadaire', 'Chaque semaine'],
  ['mensuel', 'Chaque mois'],
]

interface Props {
  nombreExistant: number
  premier?: boolean
}

export default function AjoutTache({ nombreExistant, premier = false }: Props) {
  const [ouvert, setOuvert] = useState(false)
  const [nom, setNom] = useState('')
  const [zone, setZone] = useState('')
  const [frequence, setFrequence] = useState<Frequence>('quotidien')

  const prendre = (r: Raccourci) => {
    setNom(r.nom)
    setZone(r.zone)
    setFrequence(r.frequence)
    setOuvert(true)
  }

  const ajoute = async () => {
    const propre = nom.trim()
    if (!propre) return
    await db.taches.add({
      id: uid(), nom: propre, zone: zone.trim(), frequence,
      produitUtilise: '', actif: 1, ordre: nombreExistant + 1,
    })
    setOuvert(false)
    setNom('')
    setZone('')
  }

  if (!ouvert) {
    return (
      <div className="carte pile">
        {premier && (
          <>
            <h2>Que faut-il nettoyer, et à quel rythme ?</h2>
            <p className="petit doux">
              Ne mets que ce que vous faites vraiment : un plan de nettoyage
              inventé se voit tout de suite lors d'un contrôle.
            </p>
          </>
        )}
        <div className="ligne" style={{ flexWrap: 'wrap' }}>
          {RACCOURCIS.map((r) => (
            <button key={r.nom} type="button" onClick={() => prendre(r)}>
              <IconePlus /> {r.nom}
            </button>
          ))}
          <button type="button" className="discret"
            onClick={() => { setNom(''); setZone(''); setFrequence('quotidien'); setOuvert(true) }}>
            Autre…
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="carte pile">
      <h2>Nouvelle tâche</h2>
      <div>
        <label htmlFor="at-nom">Tâche</label>
        <input id="at-nom" value={nom} autoFocus placeholder="Nettoyage des rayonnages"
          onChange={(e) => setNom(e.target.value)} />
      </div>
      <div className="deux-champs">
        <div>
          <label htmlFor="at-freq">Fréquence</label>
          <select id="at-freq" value={frequence}
            onChange={(e) => setFrequence(e.target.value as Frequence)}>
            {FREQUENCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="at-zone">Zone</label>
          <input id="at-zone" value={zone} placeholder="Magasin"
            onChange={(e) => setZone(e.target.value)} />
        </div>
      </div>
      <div className="ligne">
        <button type="button" className="champ" onClick={() => setOuvert(false)}>Annuler</button>
        <button type="button" className="champ principal" onClick={ajoute} disabled={!nom.trim()}>
          <IconeValide /> Ajouter
        </button>
      </div>
    </div>
  )
}
