import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { euro, nombre, normalise } from '../lib/format'
import { IconeBoite, IconeExport, IconeRecherche, IconeScan } from '../components/Icones'
import { exporteCatalogueCsv } from '../lib/export'

type Tri = 'nom' | 'recent' | 'stock' | 'valeur'

export default function Catalogue() {
  const produits = useLiveQuery(() => db.produits.toArray(), [], undefined)
  const [q, setQ] = useState('')
  const [rayon, setRayon] = useState('')
  const [tri, setTri] = useState<Tri>('recent')

  const rayons = useMemo(
    () => [...new Set((produits ?? []).map((p) => p.rayon).filter(Boolean))].sort(),
    [produits],
  )

  const liste = useMemo(() => {
    if (!produits) return []
    const cle = normalise(q)
    const filtres = produits.filter((p) => {
      if (rayon && p.rayon !== rayon) return false
      if (!cle) return true
      return normalise(`${p.nom} ${p.marque} ${p.ean} ${p.fournisseur}`).includes(cle)
    })
    const comparateurs: Record<Tri, (a: typeof filtres[0], b: typeof filtres[0]) => number> = {
      nom: (a, b) => a.nom.localeCompare(b.nom, 'fr'),
      recent: (a, b) => b.majLe.localeCompare(a.majLe),
      stock: (a, b) => b.stock - a.stock,
      valeur: (a, b) => (b.stock * (b.prixAchat ?? 0)) - (a.stock * (a.prixAchat ?? 0)),
    }
    return filtres.sort(comparateurs[tri])
  }, [produits, q, rayon, tri])

  const total = useMemo(() => ({
    references: liste.length,
    unites: liste.reduce((s, p) => s + p.stock, 0),
    valeur: liste.reduce((s, p) => s + p.stock * (p.prixAchat ?? 0), 0),
  }), [liste])

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
          <select value={rayon} onChange={(e) => setRayon(e.target.value)} aria-label="Rayon">
            <option value="">Tous les rayons</option>
            {rayons.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={tri} onChange={(e) => setTri(e.target.value as Tri)} aria-label="Tri">
            <option value="recent">Modifiés récemment</option>
            <option value="nom">Ordre alphabétique</option>
            <option value="stock">Stock décroissant</option>
            <option value="valeur">Valeur de stock</option>
          </select>
        </div>
      </div>

      <div className="grille">
        <div className="carte">
          <div className="petit doux">Références</div>
          <div className="gros-chiffre">{nombre(total.references)}</div>
        </div>
        <div className="carte">
          <div className="petit doux">Unités en stock</div>
          <div className="gros-chiffre">{nombre(total.unites)}</div>
        </div>
        <div className="carte">
          <div className="petit doux">Valeur du stock (prix d'achat)</div>
          <div className="gros-chiffre">{euro(total.valeur)}</div>
        </div>
      </div>

      <div className="carte">
        <div className="ligne-espace" style={{ marginBottom: 6 }}>
          <h2>{liste.length} produit{liste.length > 1 ? 's' : ''}</h2>
          <button type="button" className="discret" onClick={() => exporteCatalogueCsv(liste)}>
            <IconeExport /> Export CSV
          </button>
        </div>
        {liste.length === 0 ? (
          <div className="vide"><IconeRecherche /><p>Aucun résultat</p></div>
        ) : (
          <div className="liste">
            {liste.map((p) => (
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
        )}
      </div>
    </div>
  )
}
