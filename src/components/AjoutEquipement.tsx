import { useState } from 'react'
import { db, uid } from '../db/db'
import type { TypeEquipement } from '../db/types'
import { IconePlus, IconeValide } from './Icones'

/**
 * Ajout d'un équipement à surveiller.
 *
 * Les raccourcis ne créent rien tant qu'on ne les touche pas : ils pré-remplissent
 * le nom et la zone de température, qui restent modifiables. C'est le contraire
 * d'un contenu imposé qu'il faudrait supprimer.
 */

interface Raccourci {
  nom: string
  type: TypeEquipement
  min: number
  max: number
}

const RACCOURCIS: Raccourci[] = [
  { nom: 'Frigo', type: 'frigo', min: 0, max: 4 },
  { nom: 'Congélateur', type: 'congelateur', min: -25, max: -18 },
  { nom: 'Vitrine réfrigérée', type: 'vitrine', min: 0, max: 8 },
  { nom: 'Réserve sèche', type: 'reserve', min: 10, max: 25 },
]

interface Props {
  /** Sert à placer le nouvel équipement à la suite des autres. */
  nombreExistant: number
  /** Premier ajout : on explique, au lieu de laisser un bouton seul. */
  premier?: boolean
}

export default function AjoutEquipement({ nombreExistant, premier = false }: Props) {
  const [ouvert, setOuvert] = useState(false)
  const [nom, setNom] = useState('')
  const [type, setType] = useState<TypeEquipement>('frigo')
  const [min, setMin] = useState(0)
  const [max, setMax] = useState(4)

  const prendre = (r: Raccourci) => {
    setNom(r.nom)
    setType(r.type)
    setMin(r.min)
    setMax(r.max)
    setOuvert(true)
  }

  const ajoute = async () => {
    const propre = nom.trim()
    if (!propre) return
    await db.equipements.add({
      id: uid(), nom: propre, type,
      tempMin: Math.min(min, max), tempMax: Math.max(min, max),
      actif: 1, ordre: nombreExistant + 1,
    })
    setOuvert(false)
    setNom('')
  }

  if (!ouvert) {
    return (
      <div className="carte pile">
        {premier && (
          <>
            <h2>Quels équipements surveilles-tu ?</h2>
            <p className="petit doux">
              Ajoute ceux que tu as réellement. Un raccourci pré-remplit le nom et la
              zone de température ; tu peux tout changer.
            </p>
          </>
        )}
        <div className="ligne" style={{ flexWrap: 'wrap' }}>
          {RACCOURCIS.map((r) => (
            <button key={r.nom} type="button" onClick={() => prendre(r)}>
              <IconePlus /> {r.nom}
            </button>
          ))}
          <button type="button" className="discret" onClick={() => {
            setNom(''); setType('frigo'); setMin(0); setMax(4); setOuvert(true)
          }}>
            Autre…
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="carte pile">
      <h2>Nouvel équipement</h2>
      <div>
        <label htmlFor="ae-nom">Nom</label>
        <input id="ae-nom" value={nom} autoFocus placeholder="Frigo charcuterie"
          onChange={(e) => setNom(e.target.value)} />
      </div>
      <div className="deux-champs">
        <div>
          <label htmlFor="ae-min">Température mini (°C)</label>
          <input id="ae-min" className="mono" type="number" step="0.5" inputMode="decimal"
            value={min} onChange={(e) => setMin(Number(e.target.value))} />
        </div>
        <div>
          <label htmlFor="ae-max">Température maxi (°C)</label>
          <input id="ae-max" className="mono" type="number" step="0.5" inputMode="decimal"
            value={max} onChange={(e) => setMax(Number(e.target.value))} />
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
