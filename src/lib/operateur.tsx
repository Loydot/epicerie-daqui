import { useLiveQuery } from 'dexie-react-hooks'
import { db, setReglage } from '../db/db'

/**
 * Qui saisit. Un registre HACCP doit etre nominatif : plutot que d'imposer des
 * comptes, on mémorisé le prenom choisi et on l'estampille sur chaque saisie.
 */
export function useOperateur(): [string, (nom: string) => void, string[]] {
  const courant = useLiveQuery(async () => (await db.reglages.get('operateur'))?.valeur ?? '', [], '') ?? ''
  const liste = useLiveQuery(
    async () => (await db.operateurs.toArray()).filter((o) => o.actif === 1).map((o) => o.nom).sort(),
    [], [],
  ) ?? []
  return [courant, (nom: string) => void setReglage('operateur', nom), liste]
}

interface Props {
  valeur: string
  surChangement: (nom: string) => void
  options: string[]
}

export function ChoixOperateur({ valeur, surChangement, options }: Props) {
  if (options.length === 0) return null
  return (
    <div>
      <label htmlFor="operateur">Relevé effectué par</label>
      <select id="operateur" value={valeur} onChange={(e) => surChangement(e.target.value)}>
        <option value="">— choisir —</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}
