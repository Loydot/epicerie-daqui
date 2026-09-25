import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, uid } from '../db/db'
import type { Equipement, Moment, TypeEquipement } from '../db/types'
import { aujourdhui, dateFr, dateHeureFr, jourDe, nombre } from '../lib/format'
import {
  estEteint, exceptionsApresBascule, joursOuverts, JOURS_SEMAINE, versJoursOuverture,
} from '../lib/ouverture'
import { ChoixOperateur, useOperateur } from '../lib/operateur'
import { exporteTemperaturesCsv } from '../lib/export'
import { IconeAlerte, IconeCorbeille, IconeExport, IconeReglages, IconeValide } from '../components/Icones'
import GraphiqueTemperatures from '../components/GraphiqueTemperatures'
import AjoutEquipement from '../components/AjoutEquipement'
import EditionReleve from '../components/EditionReleve'

/** Avant 15 h on considere que c'est le relevé du matin. */
const momentParDefaut = (): Moment => (new Date().getHours() < 15 ? 'matin' : 'soir')

/** Un jour passé n'a pas d'heure « courante » : le matin à 8 h, le soir à 17 h. */
const dateDuReleve = (jour: string, moment: Moment): Date =>
  jour === aujourdhui() ? new Date() : new Date(`${jour}T${moment === 'matin' ? '08:00' : '17:00'}:00`)

/** Décale un jour AAAA-MM-JJ de n jours. */
const decale = (jour: string, n: number): string => {
  const d = new Date(`${jour}T12:00:00`)
  d.setDate(d.getDate() + n)
  return jourDe(d)
}

const libelleJour = (jour: string): string =>
  new Date(`${jour}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

export default function Temperatures() {
  const aujourd = aujourdhui()
  const [jour, setJour] = useState(aujourd)
  const estAujourdhui = jour === aujourd
  const [releveEnEdition, setReleveEnEdition] = useState<string | null>(null)
  const [operateur, setOperateur, operateurs] = useOperateur()
  const [saisies, setSaisies] = useState<Record<string, string>>({})
  const [moments, setMoments] = useState<Record<string, Moment>>({})
  const [actions, setActions] = useState<Record<string, string>>({})
  const [jours, setJours] = useState(30)
  const [enEdition, setEnEdition] = useState<string | null>(null)

  // Tous les équipements, y compris les retirés : sans eux, l'historique et le
  // registre PDF afficheraient « Équipement supprimé » à la place du nom.
  const tousEquipements = useLiveQuery(
    async () => (await db.equipements.toArray()).sort((a, b) => a.ordre - b.ordre),
    [], [],
  ) ?? []
  const equipements = tousEquipements.filter((e) => e.actif === 1)
  const retires = tousEquipements.filter((e) => e.actif !== 1)

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
  // Classés par saisie (et non par date du relevé) : un relevé daté par erreur
  // au mauvais jour resterait sinon introuvable en tête de liste.
  const recents = useLiveQuery(
    async () => (await db.releves.toArray())
      .sort((a, b) => (b.majLe ?? '').localeCompare(a.majLe ?? ''))
      .slice(0, 15),
    [], [],
  ) ?? []

  /** Les équipements éteints ce jour-là figurent au relevé, au lieu d'y manquer. */
  const eteints = equipements.filter((e) => estEteint(e, jour))

  const historique = [...relevesJour].sort((a, b) => b.date.localeCompare(a.date))

  const momentDuJour: Moment = estAujourdhui ? momentParDefaut() : 'matin'

  /** Changer de jour repart de zéro : une saisie ne doit pas suivre au mauvais jour. */
  const changeJour = (j: string) => {
    if (!j || j > aujourd) return
    setJour(j)
    setSaisies({})
    setActions({})
    setMoments({})
    setReleveEnEdition(null)
  }

  /** Éteint (ou rallume) un équipement pour le jour affiché. */
  const basculeEteint = async (eq: Equipement) => {
    await db.equipements.update(eq.id, { exceptions: exceptionsApresBascule(eq, jour) })
  }

  const basculeJourOuverture = async (eq: Equipement, numero: number) => {
    const ouverts = joursOuverts(eq)
    const suivants = ouverts.includes(numero) ? ouverts.filter((n) => n !== numero) : [...ouverts, numero]
    if (suivants.length === 0) return
    await db.equipements.update(eq.id, { joursOuverture: versJoursOuverture(suivants) })
  }

  const nomEquipement = (id: string) =>
    tousEquipements.find((e) => e.id === id)?.nom ?? 'Équipement supprimé'

  /**
   * Retirer plutôt qu'effacer : les relevés déjà faits restent au registre avec
   * le nom de leur équipement, et on peut le remettre quand on veut.
   */
  const retire = async (id: string, nom: string) => {
    if (!confirm(
      `Retirer « ${nom} » de la page ?

`
      + 'Ses relevés passés restent au registre, et tu peux le remettre à tout moment.',
    )) return
    await db.equipements.update(id, { actif: 0 })
  }

  const remet = async (id: string) => {
    await db.equipements.update(id, { actif: 1 })
  }

  /** Effacement réel : réservé à un équipement créé par erreur. */
  const supprimeEquipement = async (eq: Equipement) => {
    const combien = await db.releves.where('equipementId').equals(eq.id).count()
    if (!confirm(
      `Supprimer définitivement « ${eq.nom} » ?

`
      + (combien > 0
        ? `Ses ${combien} relevé(s) resteront au registre, mais sous la mention `
          + '« Équipement supprimé ». Si tu veux garder leur nom lisible, utilise plutôt la corbeille, qui retire sans effacer.'
        : "Aucun relevé n'y est rattaché."),
    )) return
    await db.equipements.delete(eq.id)
    setEnEdition(null)
  }

  const TYPES: Array<[TypeEquipement, string]> = [
    ['frigo', 'Frigo'], ['congelateur', 'Congélateur'],
    ['vitrine', 'Vitrine'], ['reserve', 'Réserve'],
  ]

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
    const moment = moments[eq.id] ?? momentDuJour
    const quand = dateDuReleve(jour, moment)
    await db.releves.add({
      id: uid(),
      equipementId: eq.id,
      temp,
      date: quand.toISOString(),
      jour: jourDe(quand),
      moment,
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

      <div className="carte pile">
        <div className="ligne-espace">
          <button type="button" aria-label="Jour précédent" onClick={() => changeJour(decale(jour, -1))}>‹</button>
          <div style={{ textAlign: 'center' }}>
            <strong style={{ textTransform: 'capitalize' }}>{libelleJour(jour)}</strong>
            <div className="petit doux">{estAujourdhui ? "Aujourd'hui" : dateFr(jour)}</div>
          </div>
          <button type="button" aria-label="Jour suivant" disabled={estAujourdhui}
            onClick={() => changeJour(decale(jour, 1))}>›</button>
        </div>
        <div className="ligne">
          <input type="date" aria-label="Choisir la date" value={jour} max={aujourd}
            onChange={(e) => changeJour(e.target.value)} />
          {!estAujourdhui && <button type="button" onClick={() => changeJour(aujourd)}>Aujourd'hui</button>}
        </div>
        {!estAujourdhui && (
          <div className="bandeau">
            <IconeAlerte />
            <span>Tu consultes le {dateFr(jour)}. Un relevé enregistré ici sera daté de ce jour-là.</span>
          </div>
        )}
      </div>

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

      {equipements.length === 0 && <AjoutEquipement nombreExistant={0} premier />}

      {equipements.map((eq) => {
        const dejaFaits = relevesJour.filter((r) => r.equipementId === eq.id)
        const brut = (saisies[eq.id] ?? '').replace(',', '.')
        const valeur = brut === '' ? null : Number(brut)
        const horsZone = valeur != null && !Number.isNaN(valeur) && (valeur < eq.tempMin || valeur > eq.tempMax)
        const eteint = estEteint(eq, jour)

        return (
          <div key={eq.id} className="carte pile">
            <div className="pile" style={{ gap: 6 }}>
              <div className="ligne-espace">
                <h2 style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{eq.nom}</h2>
                <div className="ligne" style={{ flex: '0 0 auto' }}>
                  <button type="button" className="discret" aria-label={`Modifier ${eq.nom}`}
                    aria-expanded={enEdition === eq.id}
                    onClick={() => setEnEdition(enEdition === eq.id ? null : eq.id)}>
                    <IconeReglages />
                  </button>
                  <button type="button" className="discret" aria-label={`Retirer ${eq.nom}`}
                    onClick={() => retire(eq.id, eq.nom)}>
                    <IconeCorbeille />
                  </button>
                </div>
              </div>
              <div className="ligne" style={{ flexWrap: 'wrap' }}>
                <span className="petit doux">Zone admise : {eq.tempMin} °C à {eq.tempMax} °C</span>
                {eteint && <span className="etiquette">Éteint ce jour</span>}
                {dejaFaits.length > 0 && (
                  <span className="etiquette ok">
                    <IconeValide /> {dejaFaits.length} relevé{dejaFaits.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>

            {enEdition === eq.id && (
              <div className="pile" style={{ paddingBottom: 4 }}>
                <div>
                  <label htmlFor={`en-${eq.id}`}>Nom</label>
                  <input id={`en-${eq.id}`} value={eq.nom}
                    onChange={(e) => void db.equipements.update(eq.id, { nom: e.target.value })} />
                </div>
                <div className="deux-champs">
                  <div>
                    <label htmlFor={`et-${eq.id}`}>Type</label>
                    <select id={`et-${eq.id}`} value={eq.type}
                      onChange={(e) => void db.equipements.update(eq.id, { type: e.target.value as TypeEquipement })}>
                      {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div className="deux-champs">
                    <div>
                      <label htmlFor={`emin-${eq.id}`}>Mini °C</label>
                      <input id={`emin-${eq.id}`} className="mono" type="number" step="0.5"
                        value={eq.tempMin}
                        onChange={(e) => void db.equipements.update(eq.id, { tempMin: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label htmlFor={`emax-${eq.id}`}>Maxi °C</label>
                      <input id={`emax-${eq.id}`} className="mono" type="number" step="0.5"
                        value={eq.tempMax}
                        onChange={(e) => void db.equipements.update(eq.id, { tempMax: Number(e.target.value) })} />
                    </div>
                  </div>
                </div>
                <div>
                  <label>Jours d'ouverture</label>
                  <div className="ligne" style={{ flexWrap: 'wrap' }}>
                    {JOURS_SEMAINE.map(([numero, libelle]) => (
                      <button key={numero} type="button" aria-pressed={joursOuverts(eq).includes(numero)}
                        className={joursOuverts(eq).includes(numero) ? 'principal' : ''}
                        onClick={() => void basculeJourOuverture(eq, numero)}>
                        {libelle}
                      </button>
                    ))}
                  </div>
                  <p className="petit doux" style={{ marginTop: 4 }}>
                    Les autres jours, l'équipement est éteint : aucun relevé n'est demandé.
                  </p>
                </div>
                <button type="button" className="destructif large" onClick={() => supprimeEquipement(eq)}>
                  <IconeCorbeille /> Supprimer définitivement
                </button>
              </div>
            )}

            <GraphiqueTemperatures
              equipement={eq}
              releves={relevesPeriode.filter((r) => r.equipementId === eq.id)}
            />

            {dejaFaits.length > 0 && (
              <div className="ligne petit doux" style={{ flexWrap: 'wrap' }}>
                {dejaFaits.map((r) => (
                  <span key={r.id} className={`etiquette ${r.conforme ? 'ok' : 'danger'}`}>
                    {r.moment} : {nombre(r.temp, 1)} °C
                  </span>
                ))}
              </div>
            )}

            {eteint ? (
              <div className="pile">
                <div className="bandeau">
                  <IconeAlerte />
                  <span>Éteint le {dateFr(jour)} : aucun relevé attendu ce jour-là.</span>
                </div>
                <button type="button" className="large" onClick={() => void basculeEteint(eq)}>
                  Il était allumé ce jour-là
                </button>
              </div>
            ) : (
              <>
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
                <select id={`m-${eq.id}`} value={moments[eq.id] ?? momentDuJour}
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
            <button type="button" className="discret" onClick={() => void basculeEteint(eq)}>
              {dejaFaits.length > 0 ? "Éteint ce jour (les relevés restent)" : 'Éteint ce jour'}
            </button>
              </>
            )}
          </div>
        )
      })}

      {equipements.length > 0 && <AjoutEquipement nombreExistant={tousEquipements.length} />}

      {retires.length > 0 && (
        <div className="carte">
          <h2>Équipements retirés</h2>
          <p className="petit doux" style={{ marginTop: 4 }}>
            Ils ne sont plus à relever, mais leurs relevés passés restent au registre.
          </p>
          <div className="liste" style={{ marginTop: 8 }}>
            {retires.map((eq) => (
              <div key={eq.id} className="item">
                <div className="item-corps">
                  <div className="item-nom">{eq.nom}</div>
                  <div className="petit doux">{eq.tempMin} °C à {eq.tempMax} °C</div>
                </div>
                <button type="button" onClick={() => remet(eq.id)}>Remettre</button>
                <button type="button" className="discret" aria-label={`Supprimer définitivement ${eq.nom}`}
                  onClick={() => supprimeEquipement(eq)}>
                  <IconeCorbeille />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="carte">
        <div className="ligne-espace">
          <h2>Relevés du {dateFr(jour)}</h2>
          <button type="button" className="discret"
            onClick={() => exporteTemperaturesCsv(relevesPeriode, nomEquipement)}>
            <IconeExport /> CSV {jours} j
          </button>
        </div>
        {historique.length === 0 && eteints.length === 0 && (
          <p className="petit doux" style={{ marginTop: 8 }}>Aucun relevé ce jour-là.</p>
        )}
        <div className="liste" style={{ marginTop: 8 }}>
            {eteints.map((eq) => (
              <div key={`eteint-${eq.id}`} className="item">
                <div className="item-corps">
                  <div className="item-nom">{eq.nom}</div>
                  <div className="petit doux">Éteint ce jour-là : aucun relevé attendu</div>
                </div>
                <span className="etiquette">Éteint</span>
                <button type="button" onClick={() => void basculeEteint(eq)}>Il était allumé</button>
              </div>
            ))}
            {historique.map((r) => (
              releveEnEdition === r.id ? (
                <EditionReleve
                  key={r.id}
                  releve={r}
                  equipement={tousEquipements.find((e) => e.id === r.equipementId)}
                  surFermer={() => setReleveEnEdition(null)}
                  surEnregistre={(j) => { setReleveEnEdition(null); changeJour(j) }}
                />
              ) : (
              <div key={r.id} className="item">
                <div className="item-corps">
                  <div className="item-nom mono">{nombre(r.temp, 1)} °C</div>
                  <div className="petit doux" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {dateHeureFr(r.date)} · {nomEquipement(r.equipementId)}
                    {r.operateur && ` · ${r.operateur}`}
                  </div>
                </div>
                <span className={`etiquette ${r.conforme ? 'ok' : 'danger'}`}>
                  {r.conforme ? 'Conforme' : 'Hors zone'}
                </span>
                <button type="button"
                  aria-label={`Modifier le relevé de ${dateHeureFr(r.date)}`}
                  onClick={() => setReleveEnEdition(r.id)}>
                  Modifier
                </button>
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
              )
            ))}
        </div>
      </div>

      {recents.length > 0 && (
        <div className="carte">
          <h2>Derniers relevés saisis</h2>
          <p className="petit doux" style={{ marginTop: 4 }}>
            Tous jours confondus : c'est ici qu'on retrouve un relevé saisi à la mauvaise date.
          </p>
          <div className="liste" style={{ marginTop: 8 }}>
            {recents.map((r) => (
              <div key={r.id} className="item">
                <div className="item-corps">
                  <div className="item-nom mono">{nombre(r.temp, 1)} °C</div>
                  <div className="petit doux" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {dateHeureFr(r.date)} · {nomEquipement(r.equipementId)}
                  </div>
                </div>
                <button type="button"
                  aria-label={`Modifier la date du relevé du ${dateHeureFr(r.date)}`}
                  onClick={() => { changeJour(r.jour); setReleveEnEdition(r.id) }}>
                  Modifier la date
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
