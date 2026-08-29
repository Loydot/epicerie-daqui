import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, uid } from '../db/db'
import type { Equipement, Moment } from '../db/types'
import { aujourdhui, dateHeureFr, jourDe } from '../lib/format'
import { ChoixOperateur, useOperateur } from '../lib/operateur'
import { exporteTemperaturesCsv } from '../lib/export'
import { IconeAlerte, IconeExport, IconeTemperature, IconeValide } from '../components/Icones'

/** Avant 15 h on considere que c'est le releve du matin. */
const momentParDefaut = (): Moment => (new Date().getHours() < 15 ? 'matin' : 'soir')

export default function Temperatures() {
  const jour = aujourdhui()
  const [operateur, setOperateur, operateurs] = useOperateur()
  const [saisies, setSaisies] = useState<Record<string, string>>({})
  const [moments, setMoments] = useState<Record<string, Moment>>({})
  const [actions, setActions] = useState<Record<string, string>>({})

  const equipements = useLiveQuery(
    async () => (await db.equipements.toArray()).filter((e) => e.actif === 1).sort((a, b) => a.ordre - b.ordre),
    [], [],
  ) ?? []

  const relevesJour = useLiveQuery(() => db.releves.where('jour').equals(jour).toArray(), [jour], []) ?? []
  const historique = useLiveQuery(
    async () => (await db.releves.orderBy('date').reverse().limit(60).toArray()),
    [], [],
  ) ?? []

  const nomEquipement = (id: string) =>
    equipements.find((e) => e.id === id)?.nom ?? 'Equipement supprime'

  const enregistre = async (eq: Equipement) => {
    const brut = (saisies[eq.id] ?? '').replace(',', '.')
    const temp = Number(brut)
    if (brut === '' || Number.isNaN(temp)) return
    const conforme = temp >= eq.tempMin && temp <= eq.tempMax
    const action = (actions[eq.id] ?? '').trim()
    if (!conforme && !action) {
      alert("Temperature hors zone : decris l'action corrective avant d'enregistrer (c'est ce que le controleur regarde).")
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

      {equipements.length === 0 && (
        <div className="carte vide">
          <IconeTemperature />
          <p>Aucun equipement. Ajoute tes frigos dans les reglages.</p>
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
                <span className="petit doux">Zone admise : {eq.tempMin} °C a {eq.tempMax} °C</span>
              </div>
              {dejaFaits.length > 0 && (
                <span className="etiquette ok"><IconeValide /> {dejaFaits.length} releve{dejaFaits.length > 1 ? 's' : ''}</span>
              )}
            </div>

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
                <label htmlFor={`t-${eq.id}`}>Temperature relevee (°C)</label>
                <input id={`t-${eq.id}`} className="mono" type="number" step="0.1" inputMode="decimal"
                  placeholder={`${eq.tempMin} a ${eq.tempMax}`}
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
                  <span>Hors zone. Note ce que tu fais : produits transferes, reglage du thermostat, appel au frigoriste…</span>
                </div>
                <textarea placeholder="Action corrective mise en oeuvre"
                  value={actions[eq.id] ?? ''}
                  onChange={(e) => setActions((a) => ({ ...a, [eq.id]: e.target.value }))} />
              </>
            )}

            <button type="button" className="principal large" onClick={() => enregistre(eq)}
              disabled={(saisies[eq.id] ?? '') === ''}>
              Enregistrer le releve
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
          <div className="defilable">
            <table className="tableau">
              <thead>
                <tr><th>Date</th><th>Equipement</th><th className="num">Temp.</th><th>Etat</th><th>Par</th></tr>
              </thead>
              <tbody>
                {historique.map((r) => (
                  <tr key={r.id}>
                    <td>{dateHeureFr(r.date)}</td>
                    <td>{nomEquipement(r.equipementId)}</td>
                    <td className="num mono">{r.temp} °C</td>
                    <td>
                      <span className={`etiquette ${r.conforme ? 'ok' : 'danger'}`}>
                        {r.conforme ? 'Conforme' : 'Hors zone'}
                      </span>
                    </td>
                    <td className="petit doux">{r.operateur || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
