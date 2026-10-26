import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getReglage, setReglage, uid } from '../db/db'
import type { CategorieCoupe, Ouverture } from '../db/types'
import { normalise } from '../lib/format'
import { useOperateur } from '../lib/operateur'
import { IconeCorbeille, IconePlus, IconeRecherche, IconeValide } from '../components/Icones'

/** L'ordre des rayons de la coupe, tel qu'on les range au magasin. */
const DE_BASE: Array<{ cle: CategorieCoupe; nom: string }> = [
  { cle: 'charcuterie', nom: 'Charcuterie' },
  { cle: 'boucherie', nom: 'Boucherie' },
  { cle: 'fromage', nom: 'Fromage' },
  { cle: 'traiteur', nom: 'Traiteur' },
]

/** Rayons ajoutés à la main, partagés entre appareils (réglage synchronisé). */
const CLE_RAYONS = 'rayonsCoupe'

function litRayons(valeur: string): string[] {
  try {
    const l = JSON.parse(valeur)
    return Array.isArray(l) ? l.filter((x) => typeof x === 'string' && x.trim()) : []
  } catch {
    return []
  }
}

/** Les rayons de base puis ceux ajoutés, et « + » pour en créer un. */
function useCategories() {
  const ajoutes = useLiveQuery(async () => litRayons(await getReglage(CLE_RAYONS)), [], []) ?? []
  const categories = [...DE_BASE, ...ajoutes.map((n) => ({ cle: n, nom: n }))]
  const ajoute = async (): Promise<string> => {
    const nom = prompt('Nom du nouveau rayon :')?.trim()
    if (!nom) return ''
    const existant = categories.find((c) => normalise(c.nom) === normalise(nom))
    if (existant) return existant.cle
    await setReglage(CLE_RAYONS, JSON.stringify([...ajoutes, nom]))
    return nom
  }
  return { categories, ajoute }
}

/** Nom affiché, y compris pour une catégorie qui n'est plus dans la liste (ancien « Autre »). */
const nomDe = (cle: string, categories: Array<{ cle: string; nom: string }>) =>
  categories.find((c) => c.cle === cle)?.nom ?? (cle === 'autre' || !cle ? 'Autre' : cle)

/** « 2026-10-26T09:12 » à l'heure locale : c'est ce qu'attend un champ datetime-local. */
function maintenant(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function quand(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('fr-FR', {
    weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

/** « aujourd'hui », « hier », « il y a 4 jours ». */
function depuis(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const jour = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const n = Math.round((jour(new Date()) - jour(d)) / 86_400_000)
  if (n <= 0) return 'aujourd’hui'
  if (n === 1) return 'hier'
  return `il y a ${n} jours`
}

/**
 * Dans le catalogue, la recherche est celle du catalogue : on la reçoit en
 * « recherche » et l'on n'affiche pas la sienne.
 */
export default function ALaCoupe({ recherche }: { recherche?: string } = {}) {
  const [operateur] = useOperateur()
  const { categories, ajoute } = useCategories()
  const [qLocal, setQ] = useState('')
  const integre = recherche !== undefined
  const q = integre ? recherche : qLocal
  const [filtre, setFiltre] = useState<CategorieCoupe | ''>('')
  const [voirFinies, setVoirFinies] = useState(true)
  const [ouvert, setOuvert] = useState(false)
  const [nom, setNom] = useState('')
  const [categorie, setCategorie] = useState<CategorieCoupe>('fromage')
  const [date, setDate] = useState(maintenant())
  const [detail, setDetail] = useState('')

  const toutes = useLiveQuery(() => db.ouvertures.toArray(), [], []) ?? []

  const groupes = useMemo(() => {
    const mots = normalise(q).split(/\s+/).filter(Boolean)
    const gardees = toutes
      .filter((o) => !filtre || o.categorie === filtre)
      .filter((o) => voirFinies || !o.finiLe)
      .filter((o) => {
        const texte = normalise(`${o.nom} ${o.note}`)
        return mots.every((m) => texte.includes(m))
      })
      // La plus récemment ouverte en premier.
      .sort((a, b) => b.ouvertLe.localeCompare(a.ouvertLe))
    // Les rayons de la liste dans l'ordre, puis ceux de pièces plus anciennes.
    const cles = [...categories.map((c) => c.cle)]
    for (const o of gardees) if (!cles.includes(o.categorie || 'autre')) cles.push(o.categorie || 'autre')
    return cles
      .map((cle) => ({ cle, nom: nomDe(cle, categories), pieces: gardees.filter((o) => (o.categorie || 'autre') === cle) }))
      .filter((g) => g.pieces.length > 0)
  }, [toutes, q, filtre, voirFinies, categories])

  /** Les noms déjà saisis, pour ne pas les retaper à chaque nouvelle pièce. */
  const suggestions = useMemo(() => {
    const cle = normalise(nom)
    if (!cle) return []
    const vus = new Map<string, Ouverture>()
    for (const o of [...toutes].sort((a, b) => b.ouvertLe.localeCompare(a.ouvertLe))) {
      const k = normalise(o.nom)
      if (k.includes(cle) && k !== cle && !vus.has(k)) vus.set(k, o)
    }
    return [...vus.values()].slice(0, 5)
  }, [toutes, nom])

  const enregistre = async () => {
    if (!nom.trim()) return
    await db.ouvertures.add({
      id: uid(), nom: nom.trim(), categorie, ouvertLe: date || maintenant(), finiLe: '',
      operateur, note: '', creeLe: new Date().toISOString(),
    })
    setNom('')
    setDate(maintenant())
    setOuvert(false)
  }

  const total = groupes.reduce((n, g) => n + g.pieces.length, 0)

  return (
    <div className="pile">
      <div className="carte pile">
        {integre ? <h2>À la coupe</h2> : (
          <div className="ligne">
            <IconeRecherche className="doux" />
            <input className="champ" placeholder="Chercher : brebis, jambon, terrine…" value={q}
              onChange={(e) => setQ(e.target.value)} autoComplete="off" />
          </div>
        )}
        <div className="puces">
          <button type="button" className={filtre === '' ? 'actif' : ''} onClick={() => setFiltre('')}>Tout</button>
          {categories.map((c) => (
            <button key={c.cle} type="button" className={filtre === c.cle ? 'actif' : ''}
              onClick={() => setFiltre(filtre === c.cle ? '' : c.cle)}>{c.nom}</button>
          ))}
          <button type="button" aria-label="Ajouter un rayon"
            onClick={async () => { const c = await ajoute(); if (c) setFiltre(c) }}>+</button>
        </div>
        <label className="ligne petit" style={{ gap: 8, margin: 0 }}>
          <input type="checkbox" style={{ width: 'auto', minHeight: 0 }} checked={voirFinies}
            onChange={(e) => setVoirFinies(e.target.checked)} />
          Afficher aussi les pièces terminées
        </label>
      </div>

      {!ouvert ? (
        <button type="button" className="principal haut large" onClick={() => { setDate(maintenant()); setOuvert(true) }}>
          <IconePlus /> Ouvrir une pièce
        </button>
      ) : (
        <div className="carte pile">
          <h2>Nouvelle pièce ouverte</h2>
          <div>
            <label htmlFor="c-nom">Article</label>
            <input id="c-nom" autoFocus value={nom} placeholder="Ex. Brebis Ossau-Iraty" autoComplete="off"
              onChange={(e) => setNom(e.target.value)} />
          </div>
          {suggestions.length > 0 && (
            <div className="liste">
              {suggestions.map((o) => (
                <button key={o.id} type="button" className="item"
                  onClick={() => { setNom(o.nom); setCategorie(o.categorie) }}>
                  <div className="item-corps"><div className="item-nom">{o.nom}</div></div>
                  <span className="petit doux">{nomDe(o.categorie, categories)}</span>
                </button>
              ))}
            </div>
          )}
          <div>
            <label>Rayon</label>
            <div className="puces">
              {categories.map((c) => (
                <button key={c.cle} type="button" className={categorie === c.cle ? 'actif' : ''}
                  onClick={() => setCategorie(c.cle)}>{c.nom}</button>
              ))}
              <button type="button" aria-label="Ajouter un rayon"
                onClick={async () => { const c = await ajoute(); if (c) setCategorie(c) }}>+</button>
            </div>
          </div>
          <div>
            <label htmlFor="c-date">Ouvert le</label>
            <input id="c-date" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="ligne">
            <button type="button" className="champ" onClick={() => setOuvert(false)}>Annuler</button>
            <button type="button" className="champ principal" disabled={!nom.trim()} onClick={enregistre}>
              <IconeValide /> Enregistrer
            </button>
          </div>
        </div>
      )}

      {total === 0 && !(integre && q) && (
        <div className="carte vide">
          <p>{toutes.length === 0 ? 'Aucune pièce enregistrée pour l’instant.' : 'Rien ne correspond.'}</p>
        </div>
      )}

      {groupes.map((g) => (
        <div key={g.cle} className="carte pile">
          <div className="ligne-espace">
            <h2>{g.nom}</h2>
            <span className="petit doux">{g.pieces.length}</span>
          </div>
          <div className="liste">
            {g.pieces.map((o) => (
              <div key={o.id}>
                <button type="button" className="item" style={{ width: '100%', textAlign: 'left' }}
                  onClick={() => setDetail(detail === o.id ? '' : o.id)}>
                  <div className="item-corps">
                    <div className="item-nom">{o.nom}</div>
                    <div className="petit doux">
                      Ouvert {quand(o.ouvertLe)} · {depuis(o.ouvertLe)}
                      {o.operateur && ` · ${o.operateur}`}
                    </div>
                  </div>
                  {o.finiLe
                    ? <span className="etiquette">Terminé</span>
                    : <span className="etiquette ok">En vente</span>}
                </button>
                {detail === o.id && <EditionPiece piece={o} categories={categories} ajoute={ajoute} surFermer={() => setDetail('')} />}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function EditionPiece({ piece, categories, ajoute, surFermer }: {
  piece: Ouverture
  categories: Array<{ cle: string; nom: string }>
  ajoute: () => Promise<string>
  surFermer: () => void
}) {
  const maj = (m: Partial<Ouverture>) => void db.ouvertures.update(piece.id, m)
  return (
    <div className="pile" style={{ padding: '4px 0 14px' }}>
      <div>
        <label>Article</label>
        <input value={piece.nom} onChange={(e) => maj({ nom: e.target.value })} />
      </div>
      <div className="puces">
        {categories.map((c) => (
          <button key={c.cle} type="button" className={piece.categorie === c.cle ? 'actif' : ''}
            onClick={() => maj({ categorie: c.cle })}>{c.nom}</button>
        ))}
        <button type="button" aria-label="Ajouter un rayon"
          onClick={async () => { const c = await ajoute(); if (c) maj({ categorie: c }) }}>+</button>
      </div>
      <div>
        <label>Ouvert le</label>
        <input type="datetime-local" value={piece.ouvertLe} onChange={(e) => maj({ ouvertLe: e.target.value })} />
      </div>
      <div>
        <label>Note</label>
        <input value={piece.note} placeholder="Ex. lot, fournisseur…" onChange={(e) => maj({ note: e.target.value })} />
      </div>
      <div className="ligne">
        {piece.finiLe ? (
          <button type="button" className="champ" onClick={() => maj({ finiLe: '' })}>Remettre en vente</button>
        ) : (
          <button type="button" className="champ principal" onClick={() => { maj({ finiLe: maintenant() }); surFermer() }}>
            <IconeValide /> Pièce terminée
          </button>
        )}
        <button type="button" className="destructif" aria-label="Supprimer"
          onClick={() => {
            if (!confirm(`Supprimer « ${piece.nom} » ouvert ${quand(piece.ouvertLe)} ?`)) return
            void db.ouvertures.delete(piece.id)
            surFermer()
          }}>
          <IconeCorbeille />
        </button>
      </div>
    </div>
  )
}
