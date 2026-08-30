import { useLiveQuery } from 'dexie-react-hooks'
import { db, uid } from '../db/db'
import type { Frequence, Tache } from '../db/types'
import { aujourdhui, dateHeureFr, moisDe, semaineDe } from '../lib/format'
import { ChoixOperateur, useOperateur } from '../lib/operateur'
import { IconeValide } from '../components/Icones'
import AjoutTache from '../components/AjoutTache'

const LIBELLES: Record<Frequence, string> = {
  quotidien: 'Chaque jour',
  hebdomadaire: 'Chaque semaine',
  mensuel: 'Chaque mois',
}

/** La période courante depend de la frequence : le jour, la semaine ISO ou le mois. */
const periodeCourante = (f: Frequence): string =>
  f === 'quotidien' ? aujourdhui() : f === 'hebdomadaire' ? semaineDe() : moisDe()

export default function Nettoyage() {
  const [operateur, setOperateur, operateurs] = useOperateur()

  const taches = useLiveQuery(
    async () => (await db.taches.toArray()).filter((t) => t.actif === 1).sort((a, b) => a.ordre - b.ordre),
    [], [],
  ) ?? []

  const faits = useLiveQuery(
    async () => db.nettoyages.orderBy('date').reverse().limit(200).toArray(), [], [],
  ) ?? []

  const estFait = (t: Tache) =>
    faits.find((n) => n.tacheId === t.id && n.periode === periodeCourante(t.frequence))

  const bascule = async (t: Tache) => {
    const dejaFait = estFait(t)
    if (dejaFait) {
      await db.nettoyages.delete(dejaFait.id)
      return
    }
    await db.nettoyages.add({
      id: uid(),
      tacheId: t.id,
      date: new Date().toISOString(),
      periode: periodeCourante(t.frequence),
      operateur,
      commentaire: '',
    })
  }

  const groupes: Frequence[] = ['quotidien', 'hebdomadaire', 'mensuel']

  return (
    <div className="pile">
      {operateurs.length > 0 && (
        <div className="carte">
          <ChoixOperateur valeur={operateur} surChangement={setOperateur} options={operateurs} />
        </div>
      )}

      {taches.length === 0 && <AjoutTache nombreExistant={0} premier />}

      {groupes.map((freq) => {
        const duGroupe = taches.filter((t) => t.frequence === freq)
        if (duGroupe.length === 0) return null
        const restants = duGroupe.filter((t) => !estFait(t)).length

        return (
          <div key={freq} className="carte">
            <div className="ligne-espace">
              <h2>{LIBELLES[freq]}</h2>
              <span className={`etiquette ${restants === 0 ? 'ok' : 'alerte'}`}>
                {restants === 0 ? <><IconeValide /> Terminé</> : `${restants} restante${restants > 1 ? 's' : ''}`}
              </span>
            </div>

            <div className="liste" style={{ marginTop: 8 }}>
              {duGroupe.map((t) => {
                const fait = estFait(t)
                return (
                  <button key={t.id} type="button" className="item" onClick={() => bascule(t)}>
                    <span
                      aria-hidden
                      style={{
                        width: 24, height: 24, flex: '0 0 24px', borderRadius: 7,
                        display: 'grid', placeItems: 'center',
                        border: `1.8px solid ${fait ? 'var(--ok)' : 'var(--bord)'}`,
                        background: fait ? 'var(--ok)' : 'transparent',
                        color: '#fff',
                      }}
                    >
                      {fait && <IconeValide />}
                    </span>
                    <div className="item-corps">
                      <div className="item-nom" style={{ textDecoration: fait ? 'line-through' : undefined, opacity: fait ? .6 : 1 }}>
                        {t.nom}
                      </div>
                      <div className="petit doux">
                        {fait
                          ? `Fait le ${dateHeureFr(fait.date)}${fait.operateur ? ` par ${fait.operateur}` : ''}`
                          : [t.zone, t.produitUtilise].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      {taches.length > 0 && <AjoutTache nombreExistant={taches.length} />}
    </div>
  )
}
