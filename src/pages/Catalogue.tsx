import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { euro, nombre, normalise } from '../lib/format'
import { IconeBoite, IconeExport, IconeRecherche, IconeScan } from '../components/Icones'
import { exporteCatalogueCsv } from '../lib/export'
import { rangSection, SECTIONS } from '../lib/sections'
import type { Produit, Section } from '../db/types'

type Tri = 'rayon' | 'recent' | 'stock' | 'valeur'

const parNom = (a: Produit, b: Produit) => a.nom.localeCompare(b.nom, 'fr')

export default function Catalogue() {
  const produits = useLiveQuery(() => db.produits.toArray(), [], undefined)
  const [q, setQ] = useState('')
  const [rayon, setRayon] = useState<Section | ''>('')
  const [tri, setTri] = useState<Tri>('rayon')

  const liste = useMemo(() => {
    if (!produits) return []
    const cle = normalise(q)
    const filtres = produits.filter((p) => {
      if (rayon && p.section !== rayon) return false
      if (!cle) return true
      return normalise(`${p.nom} ${p.marque} ${p.ean} ${p.fournisseur}`).includes(cle)
    })
    const comparateurs: Record<Tri, (a: Produit, b: Produit) => number> = {
      // Rayon d'abord, puis alphabétique : l'ordre dans lequel on parcourt le magasin.
      rayon: (a, b) => rangSection(a.section) - rangSection(b.section) || parNom(a, b),
      recent: (a, b) => (b.majLe ?? '').localeCompare(a.majLe ?? ''),
      stock: (a, b) => b.stock - a.stock,
      valeur: (a, b) => (b.stock * (b.prixAchat ?? 0)) - (a.stock * (a.prixAchat ?? 0)),
    }
    return filtres.sort(comparateurs[tri])
  }, [produits, q, rayon, tri])

  /** En mode « rayon », la liste est découpée ; sinon elle reste d'un bloc. */
  const groupes = useMemo(() => {
    if (tri !== 'rayon') return [{ cle: null as Section | null, nom: '', produits: liste }]
    return SECTIONS
      .map((s) => ({ cle: s.cle, nom: s.nom, produits: liste.filter((p) => p.section === s.cle) }))
      .filter((g) => g.produits.length > 0)
  }, [liste, tri])

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
        </div>
      </div>

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
          <button type="button" className="discret" onClick={() => exporteCatalogueCsv(liste)}>
            <IconeExport /> Export CSV
          </button>
        </div>
        {liste.length === 0 ? (
          <div className="vide"><IconeRecherche /><p>Aucun résultat</p></div>
        ) : (
          groupes.map((groupe) => (
            <section key={groupe.cle ?? 'tout'}>
              {groupe.cle && (
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
