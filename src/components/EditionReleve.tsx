import { useState } from 'react'
import { db } from '../db/db'
import type { Equipement, Moment, Releve } from '../db/types'
import { aujourdhui, jourDe } from '../lib/format'

interface Props {
  releve: Releve
  /** Absent quand l'équipement a été supprimé : la conformité ne peut alors plus être recalculée. */
  equipement?: Equipement
  surFermer: () => void
  /** Appelé avec le jour final du relevé, pour que la page suive un relevé déplacé. */
  surEnregistre: (jour: string) => void
}

const p = (n: number) => String(n).padStart(2, '0')

/** Corrige un relevé : la date (saisi au mauvais jour), la valeur, le moment. */
export default function EditionReleve({ releve, equipement, surFermer, surEnregistre }: Props) {
  const debut = new Date(releve.date)
  const [jour, setJour] = useState(jourDe(debut))
  const [heure, setHeure] = useState(`${p(debut.getHours())}:${p(debut.getMinutes())}`)
  const [temp, setTemp] = useState(String(releve.temp))
  const [moment, setMoment] = useState<Moment>(releve.moment)
  const [action, setAction] = useState(releve.actionCorrective)

  const valeur = Number(temp.replace(',', '.'))
  const valide = temp.trim() !== '' && !Number.isNaN(valeur) && jour !== '' && heure !== ''
  const conforme = equipement
    ? valeur >= equipement.tempMin && valeur <= equipement.tempMax
    : releve.conforme === 1

  const enregistre = async () => {
    if (!valide) return
    if (!conforme && !action.trim()) {
      alert("Température hors zone : décris l'action corrective avant d'enregistrer.")
      return
    }
    const date = new Date(`${jour}T${heure}:00`)
    await db.releves.update(releve.id, {
      temp: valeur,
      date: date.toISOString(),
      jour: jourDe(date),
      moment,
      conforme: conforme ? 1 : 0,
      actionCorrective: conforme ? '' : action.trim(),
    })
    surEnregistre(jourDe(date))
  }

  return (
    <div className="pile" style={{ padding: '8px 0' }}>
      <div className="deux-champs">
        <div>
          <label htmlFor={`rj-${releve.id}`}>Date</label>
          <input id={`rj-${releve.id}`} type="date" value={jour} max={aujourdhui()}
            onChange={(e) => setJour(e.target.value)} />
        </div>
        <div>
          <label htmlFor={`rh-${releve.id}`}>Heure</label>
          <input id={`rh-${releve.id}`} type="time" value={heure}
            onChange={(e) => setHeure(e.target.value)} />
        </div>
      </div>
      <div className="deux-champs">
        <div>
          <label htmlFor={`rt-${releve.id}`}>Température (°C)</label>
          <input id={`rt-${releve.id}`} className="mono" type="number" step="0.1" inputMode="decimal"
            value={temp} onChange={(e) => setTemp(e.target.value)} />
        </div>
        <div>
          <label htmlFor={`rm-${releve.id}`}>Moment</label>
          <select id={`rm-${releve.id}`} value={moment} onChange={(e) => setMoment(e.target.value as Moment)}>
            <option value="matin">Matin</option>
            <option value="soir">Soir</option>
          </select>
        </div>
      </div>
      {!conforme && valide && (
        <textarea placeholder="Action corrective mise en œuvre" value={action}
          onChange={(e) => setAction(e.target.value)} />
      )}
      <div className="ligne">
        <button type="button" className="principal" onClick={enregistre} disabled={!valide}>Enregistrer</button>
        <button type="button" onClick={surFermer}>Annuler</button>
      </div>
    </div>
  )
}
