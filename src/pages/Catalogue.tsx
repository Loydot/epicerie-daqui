import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getReglage, setReglage, uid } from '../db/db'
import { euro, nombre, normalise } from '../lib/format'
import { IconeBoite, IconeEtiquette, IconeExport, IconeRecherche, IconeScan } from '../components/Icones'
import { exporteCatalogueCsv } from '../lib/export'
import { rangSection, SECTIONS } from '../lib/sections'
import type { Produit, Section } from '../db/types'
import { dossierDuProduit, litDossiersCatalogue, type DossierCatalogue } from '../lib/dossiers'
import ALaCoupe from './ALaCoupe'

type Tri = 'rayon' | 'recent' | 'stock' | 'valeur'

/** Le moteur PDF pese plusieurs centaines de Ko : charge seulement au clic. */
const chargePdf = () => import('../lib/pdf')

const parNom = (a: Produit, b: Produit) => a.nom.localeCompare(b.nom, 'fr')

export default function Catalogue() {
  const [params, setParams] = useSearchParams()
  const vue = params.get('vue') === 'coupe' ? 'coupe' : 'produits'
  return (
    <div className="pile">
      <div className="onglets">
        <button type="button" className={vue === 'produits' ? 'actif' : ''}
          onClick={() => setParams({}, { replace: true })}>Produits</button>
        <button type="button" className={vue === 'coupe' ? 'actif' : ''}
          onClick={() => setParams({ vue: 'coupe' }, { replace: true })}>À la coupe</button>
      </div>
      {vue === 'coupe' ? <ALaCoupe /> : <CatalogueProduits />}
    </div>
  )
}

function CatalogueProduits() {
  const produits = useLiveQuery(() => db.produits.toArray(), [], undefined)
  const [q, setQ] = useState('')
  const [rayon, setRayon] = useState<Section | ''>('')
  const [dossier, setDossier] = useState('')
  const [choixGroupe, setChoixGroupe] = useState<'rayon' | 'dossier' | null>(null)
  const [editeDossiers, setEditeDossiers] = useState<DossierCatalogue[] | null>(null)
  const [tri, setTri] = useState<Tri>('rayon')
  const [enCoursPdf, setEnCoursPdf] = useState(false)
  const magasin = useLiveQuery(async () => (await db.reglages.get('magasin'))?.valeur ?? '', [], '') ?? ''
  const dossiers = useLiveQuery(async () =>
    litDossiersCatalogue(await getReglage('dossiersCatalogue')),
  [], []) ?? []
  const grouperPar = choixGroupe ?? (dossiers.length > 0 ? 'dossier' : 'rayon')
  const dossiersEditeur = editeDossiers ?? dossiers

  const dossierParProduit = useMemo(() => new Map(
    (produits ?? []).map((p) => [p.id, dossierDuProduit(p, dossiers)]),
  ), [produits, dossiers])

  const liste = useMemo(() => {
    if (!produits) return []
    const cle = normalise(q)
    const filtres = produits.filter((p) => {
      if (rayon && p.section !== rayon) return false
      if (dossier === 'sans-dossier' && dossierParProduit.get(p.id)) return false
      if (dossier && dossier !== 'sans-dossier' && dossierParProduit.get(p.id) !== dossier) return false
      if (!cle) return true
      return normalise(`${p.nom} ${p.marque} ${p.ean} ${p.fournisseur}`).includes(cle)
    })
    const comparateurs: Record<Tri, (a: Produit, b: Produit) => number> = {
      // Rayon d'abord, puis alphabétique : l'ordre dans lequel on parcourt le magasin.
      rayon: (a, b) => {
        if (grouperPar === 'dossier') {
          const rang = (id: string) => {
            const n = dossiers.findIndex((d) => d.id === id)
            return n < 0 ? dossiers.length : n
          }
          return rang(dossierParProduit.get(a.id) ?? '') - rang(dossierParProduit.get(b.id) ?? '') || parNom(a, b)
        }
        return rangSection(a.section) - rangSection(b.section) || parNom(a, b)
      },
      recent: (a, b) => (b.majLe ?? '').localeCompare(a.majLe ?? ''),
      stock: (a, b) => b.stock - a.stock,
      valeur: (a, b) => (b.stock * (b.prixAchat ?? 0)) - (a.stock * (a.prixAchat ?? 0)),
    }
    return filtres.sort(comparateurs[tri])
  }, [produits, q, rayon, dossier, dossierParProduit, grouperPar, dossiers, tri])

  /** Regroupe la liste par rayon ou selon les règles des dossiers personnalisés. */
  const groupes = useMemo(() => {
    if (grouperPar === 'dossier') {
      const groupesDossiers = [
        ...dossiers.map((d) => ({ cle: d.id, nom: d.nom })),
        { cle: '', nom: 'Sans dossier' },
      ]
      return groupesDossiers
        .map((g) => ({ ...g, produits: liste.filter((p) => dossierParProduit.get(p.id) === g.cle) }))
        .filter((g) => g.produits.length > 0)
    }
    if (tri !== 'rayon') return [{ cle: null, nom: '', produits: liste }]
    return SECTIONS
      .map((s) => ({ cle: s.cle, nom: s.nom, produits: liste.filter((p) => p.section === s.cle) }))
      .filter((g) => g.produits.length > 0)
  }, [liste, tri, grouperPar, dossiers, dossierParProduit])

  const total = useMemo(() => ({
    references: liste.length,
    unites: liste.reduce((s, p) => s + p.stock, 0),
    valeur: liste.reduce((s, p) => s + p.stock * (p.prixAchat ?? 0), 0),
  }), [liste])

  /**
   * On etiquette exactement ce qui est affiche : filtrer sur un rayon avant de
   * cliquer suffit donc a n'imprimer que la planche de ce rayon.
   */
  const imprimeEtiquettes = async () => {
    const avecPrix = liste.filter((p) => p.prixVente != null)
    if (avecPrix.length === 0) {
      alert("Aucun des produits affiches n'a de prix de vente : il n'y a rien a etiqueter.")
      return
    }
    setEnCoursPdf(true)
    try {
      const { etiquettesPdf } = await chargePdf()
      await etiquettesPdf(avecPrix, magasin)
    } finally {
      setEnCoursPdf(false)
    }
  }

  const ouvreEditeurDossiers = () => setEditeDossiers(dossiers.map((d) => ({ ...d })))
  const ajouteDossier = () => setEditeDossiers((anciens) => [
    ...(anciens ?? dossiers), { id: uid(), nom: '', motsCles: '' },
  ])
  const enregistreDossiers = async () => {
    if (!editeDossiers) return
    const propres = editeDossiers.map((d) => ({
      ...d, nom: d.nom.trim(), motsCles: d.motsCles.trim(),
    }))
    if (propres.some((d) => !d.nom || !d.motsCles)) {
      alert('Chaque dossier doit avoir un nom et au moins un mot-clé.')
      return
    }
    await setReglage('dossiersCatalogue', JSON.stringify(propres))
    setChoixGroupe('dossier')
    setEditeDossiers(null)
  }

  if (!produits) return <div className="carte vide">Chargement…</div>

  if (produits.length === 0) {
    return (
      <div className="carte vide">
        <IconeScan />
        <h2>Catalogue vide</h2>
        <p className="petit" style={{ margin: '6px 0 18px' }}>
          Scanne un premier produit pour le remplir.
        </p>
        <Link to="/scan" className="bouton principal">Ouvrir le scanner</Link>
      </div>
    )
  }

  return (
    <div className="pile">
      <div className="carte pile">
        <div className="ligne">
          <IconeRecherche className="doux" />
          <input className="champ" placeholder="Nom, marque, code-barres…" value={q}
            onChange={(e) => setQ(e.target.value)} autoComplete="off" />
        </div>
        <div className="deux-champs">
          <select value={rayon} onChange={(e) => setRayon(e.target.value as Section | '')} aria-label="Rayon">
            <option value="">Tous les rayons</option>
            {SECTIONS.map((s) => <option key={s.cle} value={s.cle}>{s.nom}</option>)}
          </select>
          <select value={tri} onChange={(e) => setTri(e.target.value as Tri)} aria-label="Tri">
            <option value="rayon">Par rayon, puis A→Z</option>
            <option value="recent">Modifiés récemment</option>
            <option value="stock">Stock décroissant</option>
            <option value="valeur">Valeur de stock</option>
          </select>
          <select value={grouperPar} onChange={(e) => setChoixGroupe(e.target.value as 'rayon' | 'dossier')} aria-label="Regrouper par">
            <option value="rayon">Afficher par rayon</option>
            <option value="dossier">Afficher par dossier</option>
          </select>
          {dossiers.length > 0 && (
            <select value={dossier} onChange={(e) => setDossier(e.target.value)} aria-label="Filtrer par dossier">
              <option value="">Tous les dossiers</option>
              {dossiers.map((d) => <option key={d.id} value={d.id}>{d.nom}</option>)}
              <option value="sans-dossier">Sans dossier</option>
            </select>
          )}
        </div>
      </div>

      <details className="carte dossiers-editeur">
        <summary><h2>Mes dossiers personnalisés</h2></summary>
        <p className="petit doux" style={{ marginTop: 8 }}>
          Ajoute des mots-clés séparés par des virgules. Un produit rejoint le premier dossier dont un mot-clé apparaît dans son nom, sa marque, son code-barres, son fournisseur ou sa catégorie.
        </p>
        {editeDossiers !== null && (
          <div className="pile" style={{ marginTop: 12 }}>
            {dossiersEditeur.map((d) => (
              <div className="dossier-editeur-ligne" key={d.id}>
                <div>
                  <label htmlFor={`dossier-nom-${d.id}`}>Nom du dossier</label>
                  <input id={`dossier-nom-${d.id}`} value={d.nom} placeholder="Boissons"
                    onChange={(e) => setEditeDossiers((liste) => (liste ?? []).map((x) =>
                      x.id === d.id ? { ...x, nom: e.target.value } : x,
                    ))} />
                </div>
                <div>
                  <label htmlFor={`dossier-mots-${d.id}`}>Mots-clés</label>
                  <input id={`dossier-mots-${d.id}`} value={d.motsCles} placeholder="eau, jus, soda"
                    onChange={(e) => setEditeDossiers((liste) => (liste ?? []).map((x) =>
                      x.id === d.id ? { ...x, motsCles: e.target.value } : x,
                    ))} />
                </div>
                <button type="button" className="discret" onClick={() =>
                  setEditeDossiers((liste) => (liste ?? []).filter((x) => x.id !== d.id))
                }>Supprimer</button>
              </div>
            ))}
            <div className="ligne" style={{ flexWrap: 'wrap' }}>
              <button type="button" onClick={ajouteDossier}>Ajouter un dossier</button>
              <button type="button" className="principal" onClick={() => void enregistreDossiers()}>Enregistrer</button>
              <button type="button" className="discret" onClick={() => setEditeDossiers(null)}>Annuler</button>
            </div>
          </div>
        )}
        {editeDossiers === null && (
          <button type="button" style={{ marginTop: 12 }} onClick={ouvreEditeurDossiers}>
            {dossiers.length ? 'Modifier mes dossiers' : 'Créer mes dossiers'}
          </button>
        )}
      </details>

      <div className="tuiles">
        <div className="tuile">
          <span className="tuile-libelle">Références</span>
          <div>
            <div className="tuile-valeur mono">{nombre(total.references)}</div>
            <span className="tuile-note">au catalogue</span>
          </div>
        </div>
        <div className="tuile">
          <span className="tuile-libelle">Unités</span>
          <div>
            <div className="tuile-valeur mono">{nombre(total.unites)}</div>
            <span className="tuile-note">en stock</span>
          </div>
        </div>
        <div className="tuile">
          <span className="tuile-libelle">Valeur</span>
          <div>
            <div className="tuile-valeur mono long">{euro(total.valeur)}</div>
            <span className="tuile-note">au prix d'achat</span>
          </div>
        </div>
      </div>

      <div className="carte">
        <div className="ligne-espace" style={{ marginBottom: 6 }}>
          <h2>{liste.length} produit{liste.length > 1 ? 's' : ''}</h2>
          <div className="ligne">
            <button type="button" className="discret" onClick={imprimeEtiquettes} disabled={enCoursPdf}>
              <IconeEtiquette /> {enCoursPdf ? 'PDF…' : 'Étiquettes'}
            </button>
            <button type="button" className="discret" onClick={() => exporteCatalogueCsv(liste)}>
              <IconeExport /> CSV
            </button>
          </div>
        </div>
        {liste.length === 0 ? (
          <div className="vide"><IconeRecherche /><p>Aucun résultat</p></div>
        ) : (
          groupes.map((groupe) => (
            <section key={groupe.cle ?? 'tout'}>
              {groupe.cle !== null && groupe.cle !== undefined && (
                <div className="entete-rayon">
                  <span className="section-titre" style={{ margin: 0 }}>{groupe.nom}</span>
                  <span className="petit doux mono">
                    {nombre(groupe.produits.length)} réf. ·{' '}
                    {euro(groupe.produits.reduce((t, p) => t + p.stock * (p.prixAchat ?? 0), 0))}
                  </span>
                </div>
              )}
              <div className="liste">
                {groupe.produits.map((p) => (
                  <Link key={p.id} to={`/produit/${p.id}`} className="item">
                    {p.photoUrl
                      ? <img className="vignette" src={p.photoUrl} alt="" loading="lazy" />
                      : <div className="vignette" style={{ display: 'grid', placeItems: 'center' }}><IconeBoite /></div>}
                    <div className="item-corps">
                      <div className="item-nom">{p.nom}</div>
                      <div className="petit doux">
                        {[p.marque, p.contenance].filter(Boolean).join(' · ') || <span className="mono">{p.ean}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="mono" style={{ fontWeight: 600 }}>{euro(p.prixVente)}</div>
                      <div className="petit doux mono">{nombre(p.stock)} u.</div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  )
}
