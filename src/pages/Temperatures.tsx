import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, uid } from '../db/db'
import type { Equipement, Moment } from '../db/types'
import { aujourdhui, dateHeureCourte, dateHeureFr, jourDe, nombre } from '../lib/format'
import { ChoixOperateur, useOperateur } from '../lib/operateur'
import { exporteTemperaturesCsv } from '../lib/export'
import { IconeAlerte, IconeCorbeille, IconeExport, IconeTemperature, IconeValide } from '../components/Icones'
import GraphiqueTemperatures from '../components/GraphiqueTemperatures'

/** Avant 15 h on considere que c'est le relevé du matin. */
const momentParDefaut = (): Moment => (new Date().getHours() < 15 ? 'matin' : 'soir')

export default function Temperatures() {
  const jour = aujourdhui()
  const [operateur, setOperateur, operateurs] = useOperateur()
  const [saisies, setSaisies] = useState<Record<string, string>>({})
  const [moments, setMoments] = useState<Record<string, Moment>>({})
  const [actions, setActions] = useState<Record<string, string>>({})
  const [jours, setJours] = useState(30)

  const equipements = useLiveQuery(
    async () => (await db.equipements.toArray()).filter((e) => e.actif === 1).sort((a, b) => a.ordre - b.ordre),
    [], [],
  ) ?? []

  const relevesJour = useLiveQuery(() => db.releves.where('jour').equals(jour).toArray(), [jour], []) ?? []

  const debutPeriode = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - jours)
    return d.toISOString()
  }, [jours])

  const relevesPeriode = useLiveQuery(
    () => db.releves.where('date').aboveOrEqual(debutPeriode).toArray(),
    [debutPeriode], [],
  ) ?? []
  const historique = useLiveQuery(
    async () => (await db.releves.orderBy('date').reverse().limit(60).toArray()),
    [], [],
  ) ?? []

  const nomEquipement = (id: string) =>
    equipements.find((e) => e.id === id)?.nom ?? 'Équipement supprimé'

  /**
   * Un registre HACCP se corrige, il ne se réécrit pas en douce : d'où la
   * confirmation qui rappelle ce qu'on efface exactement.
   */
  const supprime = async (id: string, quoi: string) => {
    if (!confirm(`Supprimer définitivement ce relevé ?

${quoi}`)) return
    await db.releves.delete(id)
  }

  const enregistre = async (eq: Equipement) => {
    const brut = (saisies[eq.id] ?? '').replace(',', '.')
    const temp = Number(brut)
    if (brut === '' || Number.isNaN(temp)) return
    const conforme = temp >= eq.tempMin && temp <= eq.tempMax
    const action = (actions[eq.id] ?? '').trim()
    if (!conforme && !action) {
      alert("Température hors zone : décris l'action corrective avant d'enregistrer (c'est ce que le contrôleur regarde).")
      return
    }
    const maintenant = new Date()
    await db.releves.add({
      id: uid(),
      equipementId: eq.id,
      temp,
      date: maintenant.toISOString(),
      jour: jourDe(maintenant),
      moment: moments[eq.id] ?? momentParDefaut(),
      operateur,
      conforme: conforme ? 1 : 0,
      actionCorrective: conforme ? '' : action,
    })
    setSaisies((s) => ({ ...s, [eq.id]: '' }))
    setActions((a) => ({ ...a, [eq.id]: '' }))
  }

  return (
    <div className="pile">
      {operateurs.length > 0 && (
        <div className="carte">
          <ChoixOperateur valeur={operateur} surChangement={setOperateur} options={operateurs} />
        </div>
      )}

      {equipements.length > 0 && (
        <div className="onglets" role="group" aria-label="Période affichée sur les courbes">
          {[7, 30, 90].map((n) => (
            <button key={n} type="button" className={jours === n ? 'actif' : ''}
              onClick={() => setJours(n)} aria-pressed={jours === n}>
              {n} jours
            </button>
          ))}
        </div>
      )}

      {equipements.length === 0 && (
        <div className="carte vide">
          <IconeTemperature />
          <p>Aucun équipement. Ajoute tes frigos dans les réglages.</p>
        </div>
      )}

      {equipements.map((eq) => {
        const dejaFaits = relevesJour.filter((r) => r.equipementId === eq.id)
        const brut = (saisies[eq.id] ?? '').replace(',', '.')
        const valeur = brut === '' ? null : Number(brut)
        const horsZone = valeur != null && !Number.isNaN(valeur) && (valeur < eq.tempMin || valeur > eq.tempMax)

        return (
          <div key={eq.id} className="carte pile">
            <div className="ligne-espace">
              <div>
                <h2>{eq.nom}</h2>
                <span className="petit doux">Zone admise : {eq.tempMin} °C à {eq.tempMax} °C</span>
              </div>
              {dejaFaits.length > 0 && (
                <span className="etiquette ok"><IconeValide /> {dejaFaits.length} relevé{dejaFaits.length > 1 ? 's' : ''}</span>
              )}
            </div>

            <GraphiqueTemperatures
              equipement={eq}
              releves={relevesPeriode.filter((r) => r.equipementId === eq.id)}
            />

            {dejaFaits.length > 0 && (
              <div className="ligne petit doux" style={{ flexWrap: 'wrap' }}>
                {dejaFaits.map((r) => (
                  <span key={r.id} className={`etiquette ${r.conforme ? 'ok' : 'danger'}`}>
                    {r.moment} : {r.temp} °C
                  </span>
                ))}
              </div>
            )}

            <div className="ligne">
              <div className="champ">
                <label htmlFor={`t-${eq.id}`}>Température relevée (°C)</label>
                <input id={`t-${eq.id}`} className="mono" type="number" step="0.1" inputMode="decimal"
                  placeholder={`${eq.tempMin} à ${eq.tempMax}`}
                  value={saisies[eq.id] ?? ''}
                  onChange={(e) => setSaisies((s) => ({ ...s, [eq.id]: e.target.value }))} />
              </div>
              <div style={{ width: 120 }}>
                <label htmlFor={`m-${eq.id}`}>Moment</label>
                <select id={`m-${eq.id}`} value={moments[eq.id] ?? momentParDefaut()}
                  onChange={(e) => setMoments((m) => ({ ...m, [eq.id]: e.target.value as Moment }))}>
                  <option value="matin">Matin</option>
                  <option value="soir">Soir</option>
                </select>
              </div>
            </div>

            {horsZone && (
              <>
                <div className="bandeau danger">
                  <IconeAlerte />
                  <span>Hors zone. Note ce que tu fais : produits transférés, réglage du thermostat, appel au frigoriste…</span>
                </div>
                <textarea placeholder="Action corrective mise en œuvre"
                  value={actions[eq.id] ?? ''}
                  onChange={(e) => setActions((a) => ({ ...a, [eq.id]: e.target.value }))} />
              </>
            )}

            <button type="button" className="principal large" onClick={() => enregistre(eq)}
              disabled={(saisies[eq.id] ?? '') === ''}>
              Enregistrer le relevé
            </button>
          </div>
        )
      })}

      {historique.length > 0 && (
        <div className="carte">
          <div className="ligne-espace">
            <h2>Historique</h2>
            <button type="button" className="discret"
              onClick={() => exporteTemperaturesCsv(historique, nomEquipement)}>
              <IconeExport /> CSV
            </button>
          </div>
          <div className="liste" style={{ marginTop: 8 }}>
            {historique.map((r) => (
              <div key={r.id} className="item">
                <div className="item-corps">
                  <div className="item-nom mono">{nombre(r.temp, 1)} °C</div>
                  <div className="petit doux" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {dateHeureCourte(r.date)} · {nomEquipement(r.equipementId)}
                    {r.operateur && ` · ${r.operateur}`}
                  </div>
                </div>
                <span className={`etiquette ${r.conforme ? 'ok' : 'danger'}`}>
                  {r.conforme ? 'Conforme' : 'Hors zone'}
                </span>
                <button
                  type="button" className="discret"
                  aria-label={`Supprimer le relevé de ${dateHeureFr(r.date)}`}
                  onClick={() => supprime(
                    r.id,
                    `${nomEquipement(r.equipementId)} — ${nombre(r.temp, 1)} °C le ${dateHeureFr(r.date)}`,
                  )}
                >
                  <IconeCorbeille />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
