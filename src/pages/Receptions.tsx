import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, uid } from '../db/db'
import { dateHeureFr, jourDe } from '../lib/format'
import { ChoixOperateur, useOperateur } from '../lib/operateur'
import { exporteReceptionsCsv } from '../lib/export'
import { IconeAlerte, IconeCamion, IconeExport, IconeValide } from '../components/Icones'

const vide = {
  fournisseur: '', bonLivraison: '', temp: '',
  emballageOk: true, dlcOk: true, motif: '',
}

export default function Receptions() {
  const [operateur, setOperateur, operateurs] = useOperateur()
  const [f, setF] = useState({ ...vide })
  const [ouvert, setOuvert] = useState(false)

  const receptions = useLiveQuery(
    () => db.receptions.orderBy('date').reverse().limit(60).toArray(), [], [],
  ) ?? []

  const fournisseursConnus = useLiveQuery(
    async () => [...new Set((await db.receptions.toArray()).map((r) => r.fournisseur).filter(Boolean))].sort(),
    [], [],
  ) ?? []

  const conforme = f.emballageOk && f.dlcOk
  const peutValider = f.fournisseur.trim() !== '' && (conforme || f.motif.trim() !== '')

  const enregistre = async () => {
    const maintenant = new Date()
    const temp = f.temp.replace(',', '.')
    await db.receptions.add({
      id: uid(),
      date: maintenant.toISOString(),
      jour: jourDe(maintenant),
      fournisseur: f.fournisseur.trim(),
      bonLivraison: f.bonLivraison.trim(),
      tempProduit: temp === '' ? null : Number(temp),
      emballageOk: f.emballageOk ? 1 : 0,
      dlcOk: f.dlcOk ? 1 : 0,
      conforme: conforme ? 1 : 0,
      motif: conforme ? '' : f.motif.trim(),
      operateur,
      photo: '',
    })
    setF({ ...vide })
    setOuvert(false)
  }

  return (
    <div className="pile">
      {!ouvert && (
        <button type="button" className="principal haut large" onClick={() => setOuvert(true)}>
          <IconeCamion /> Nouveau contrôle à réception
        </button>
      )}

      {ouvert && (
        <div className="carte pile">
          <h2>Contrôle à réception</h2>

          {operateurs.length > 0 && (
            <ChoixOperateur valeur={operateur} surChangement={setOperateur} options={operateurs} />
          )}

          <div>
            <label htmlFor="r-four">Fournisseur</label>
            <input id="r-four" list="fournisseurs" value={f.fournisseur}
              onChange={(e) => setF({ ...f, fournisseur: e.target.value })} placeholder="Nom du fournisseur" />
            <datalist id="fournisseurs">
              {fournisseursConnus.map((n) => <option key={n} value={n} />)}
            </datalist>
          </div>

          <div className="deux-champs">
            <div>
              <label htmlFor="r-bl">N° de bon de livraison</label>
              <input id="r-bl" className="mono" value={f.bonLivraison}
                onChange={(e) => setF({ ...f, bonLivraison: e.target.value })} />
            </div>
            <div>
              <label htmlFor="r-temp">Température produit (°C)</label>
              <input id="r-temp" className="mono" type="number" step="0.1" inputMode="decimal" value={f.temp}
                onChange={(e) => setF({ ...f, temp: e.target.value })} placeholder="Frais : 0 à 4" />
            </div>
          </div>

          <div className="pile">
            <label>Points de contrôle</label>
            <label className="ligne" style={{ fontWeight: 500, color: 'var(--texte)' }}>
              <input type="checkbox" style={{ width: 20, minHeight: 20, flex: '0 0 20px' }}
                checked={f.emballageOk} onChange={(e) => setF({ ...f, emballageOk: e.target.checked })} />
              Emballages propres et intacts
            </label>
            <label className="ligne" style={{ fontWeight: 500, color: 'var(--texte)' }}>
              <input type="checkbox" style={{ width: 20, minHeight: 20, flex: '0 0 20px' }}
                checked={f.dlcOk} onChange={(e) => setF({ ...f, dlcOk: e.target.checked })} />
              DLC / DDM conformes et lisibles
            </label>
          </div>

          {!conforme && (
            <>
              <div className="bandeau danger">
                <IconeAlerte />
                <span>Livraison non conforme : précise le motif et ce qui a été fait (refus total, refus partiel, réserve sur le BL).</span>
              </div>
              <textarea placeholder="Motif et décision" value={f.motif}
                onChange={(e) => setF({ ...f, motif: e.target.value })} />
            </>
          )}

          <div className="ligne">
            <button type="button" className="champ" onClick={() => { setF({ ...vide }); setOuvert(false) }}>
              Annuler
            </button>
            <button type="button" className="champ principal haut" onClick={enregistre} disabled={!peutValider}>
              <IconeValide /> Enregistrer
            </button>
          </div>
        </div>
      )}

      <div className="carte">
        <div className="ligne-espace">
          <h2>Historique des réceptions</h2>
          {receptions.length > 0 && (
            <button type="button" className="discret" onClick={() => exporteReceptionsCsv(receptions)}>
              <IconeExport /> CSV
            </button>
          )}
        </div>
        {receptions.length === 0 ? (
          <div className="vide"><IconeCamion /><p>Aucune réception enregistrée.</p></div>
        ) : (
          <div className="liste" style={{ marginTop: 8 }}>
            {receptions.map((r) => (
              <div key={r.id} className="item">
                <div className="item-corps">
                  <div className="item-nom">{r.fournisseur}</div>
                  <div className="petit doux">
                    {dateHeureFr(r.date)}
                    {r.bonLivraison && ` · BL ${r.bonLivraison}`}
                    {r.tempProduit != null && ` · ${r.tempProduit} °C`}
                  </div>
                  {!r.conforme && r.motif && <div className="petit" style={{ color: 'var(--danger)' }}>{r.motif}</div>}
                </div>
                <span className={`etiquette ${r.conforme ? 'ok' : 'danger'}`}>
                  {r.conforme ? 'Acceptée' : 'Refusée'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
