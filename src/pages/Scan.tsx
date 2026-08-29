import { useCallback, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Scanner from '../components/Scanner'
import { IconeBoite, IconeValide } from '../components/Icones'
import { db, uid } from '../db/db'
import type { Produit } from '../db/types'
import { chercheParEan } from '../lib/openfoodfacts'
import { eanValide, euro, marge } from '../lib/format'

type Etat =
  | { phase: 'camera' }
  | { phase: 'recherche'; ean: string }
  | { phase: 'fiche'; produit: Produit; nouveau: boolean; quantite: number }

interface Passage { id: string; nom: string; ean: string; quantite: number; nouveau: boolean }

const produitVierge = (ean: string): Produit => ({
  id: uid(),
  ean,
  nom: '',
  marque: '',
  contenance: '',
  rayon: '',
  photoUrl: '',
  prixAchat: null,
  prixVente: null,
  tva: 5.5,
  stock: 0,
  seuilAlerte: null,
  fournisseur: '',
  allergenes: '',
  nutriscore: '',
  source: 'manuel',
  note: '',
  creeLe: new Date().toISOString(),
  majLe: new Date().toISOString(),
})

export default function Scan() {
  const [etat, setEtat] = useState<Etat>({ phase: 'camera' })
  const [historique, setHistorique] = useState<Passage[]>([])
  const [horsLigne, setHorsLigne] = useState(false)
  const enCoursRef = useRef(false)

  const surCode = useCallback(async (ean: string) => {
    if (enCoursRef.current) return
    enCoursRef.current = true
    setEtat({ phase: 'recherche', ean })
    setHorsLigne(false)

    try {
      const connu = await db.produits.where('ean').equals(ean).first()
      if (connu) {
        setEtat({ phase: 'fiche', produit: connu, nouveau: false, quantite: 1 })
        return
      }
      const fiche = await chercheParEan(ean)
      const produit = produitVierge(ean)
      if (fiche) {
        Object.assign(produit, fiche, { source: 'openfoodfacts' as const })
      } else {
        setHorsLigne(true)
      }
      setEtat({ phase: 'fiche', produit, nouveau: true, quantite: 1 })
    } finally {
      enCoursRef.current = false
    }
  }, [])

  const majProduit = (champs: Partial<Produit>) =>
    setEtat((e) => (e.phase === 'fiche' ? { ...e, produit: { ...e.produit, ...champs } } : e))

  const annule = () => setEtat({ phase: 'camera' })

  const enregistre = async () => {
    if (etat.phase !== 'fiche') return
    const { produit, nouveau, quantite } = etat
    const aJour: Produit = {
      ...produit,
      nom: produit.nom.trim() || `Article ${produit.ean}`,
      stock: produit.stock + quantite,
      majLe: new Date().toISOString(),
    }
    await db.produits.put(aJour)
    setHistorique((h) => [
      { id: aJour.id, nom: aJour.nom, ean: aJour.ean, quantite, nouveau },
      ...h,
    ].slice(0, 30))
    setEtat({ phase: 'camera' })
  }

  if (etat.phase === 'fiche') {
    const { produit, nouveau, quantite } = etat
    const m = marge(produit.prixAchat, produit.prixVente, produit.tva)
    const codeSuspect = !eanValide(produit.ean)

    return (
      <div className="pile">
        <div className="carte pile">
          <div className="ligne">
            {produit.photoUrl
              ? <img className="vignette" src={produit.photoUrl} alt="" />
              : <div className="vignette" style={{ display: 'grid', placeItems: 'center' }}><IconeBoite /></div>}
            <div className="item-corps">
              <span className={`etiquette ${nouveau ? 'accent' : 'ok'}`}>
                {nouveau ? 'Nouveau produit' : 'Deja au catalogue'}
              </span>
              <div className="petit doux mono" style={{ marginTop: 4 }}>{produit.ean}</div>
            </div>
          </div>

          {horsLigne && nouveau && (
            <div className="bandeau alerte">
              <IconeBoite />
              <span>Produit introuvable en ligne (ou pas de réseau) : remplis le nom à la main, il sera mémorisé pour les prochains scans.</span>
            </div>
          )}
          {codeSuspect && (
            <div className="bandeau alerte">
              <IconeBoite />
              <span>Ce code ne ressemble pas a un EAN standard. Vérifie-le avant d'enregistrer.</span>
            </div>
          )}

          <div>
            <label htmlFor="nom">Désignation</label>
            <input id="nom" value={produit.nom} autoFocus={!produit.nom}
              onChange={(e) => majProduit({ nom: e.target.value })} placeholder="Nom du produit" />
          </div>

          <div className="deux-champs">
            <div>
              <label htmlFor="marque">Marque</label>
              <input id="marque" value={produit.marque} onChange={(e) => majProduit({ marque: e.target.value })} />
            </div>
            <div>
              <label htmlFor="contenance">Contenance</label>
              <input id="contenance" value={produit.contenance} placeholder="500 g"
                onChange={(e) => majProduit({ contenance: e.target.value })} />
            </div>
          </div>

          <div className="deux-champs">
            <div>
              <label htmlFor="achat">Prix d'achat HT</label>
              <input id="achat" type="number" inputMode="decimal" step="0.01" min="0"
                value={produit.prixAchat ?? ''}
                onChange={(e) => majProduit({ prixAchat: e.target.value === '' ? null : Number(e.target.value) })} />
            </div>
            <div>
              <label htmlFor="vente">Prix de vente TTC</label>
              <input id="vente" type="number" inputMode="decimal" step="0.01" min="0"
                value={produit.prixVente ?? ''}
                onChange={(e) => majProduit({ prixVente: e.target.value === '' ? null : Number(e.target.value) })} />
            </div>
          </div>

          {m && (
            <div className="bandeau">
              <IconeValide />
              <span>Marge : <strong>{euro(m.euros)}</strong> par unité, soit <strong>{m.pourcent.toFixed(1)} %</strong></span>
            </div>
          )}

          <div>
            <label htmlFor="qte">Quantité comptée{!nouveau && ` (stock actuel : ${produit.stock})`}</label>
            <div className="ligne">
              <button type="button" onClick={() => setEtat((e) => e.phase === 'fiche' ? { ...e, quantite: Math.max(1, e.quantite - 1) } : e)}>−</button>
              <input id="qte" className="champ mono" type="number" inputMode="numeric" min="1" value={quantite}
                style={{ textAlign: 'center' }}
                onChange={(e) => setEtat((s) => s.phase === 'fiche' ? { ...s, quantite: Math.max(1, Number(e.target.value) || 1) } : s)} />
              <button type="button" onClick={() => setEtat((e) => e.phase === 'fiche' ? { ...e, quantite: e.quantite + 1 } : e)}>+</button>
            </div>
          </div>

          <div className="ligne">
            <button type="button" className="champ" onClick={annule}>Annuler</button>
            <button type="button" className="champ principal haut" onClick={enregistre}>
              <IconeValide /> Enregistrer
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="pile">
      {etat.phase === 'recherche' ? (
        <div className="carte vide">
          <IconeBoite />
          <p>Lecture de <span className="mono">{etat.ean}</span>…</p>
          <p className="petit">Recherche de la fiche produit</p>
        </div>
      ) : (
        <Scanner surCode={surCode} />
      )}

      {historique.length > 0 && (
        <div className="carte">
          <div className="ligne-espace">
            <h2>Scannés dans cette session</h2>
            <span className="etiquette">{historique.length}</span>
          </div>
          <div className="liste" style={{ marginTop: 8 }}>
            {historique.map((p, i) => (
              <Link key={`${p.id}-${i}`} to={`/produit/${p.id}`} className="item">
                <span className={`etiquette ${p.nouveau ? 'accent' : 'ok'}`}>{p.nouveau ? 'N' : '✓'}</span>
                <div className="item-corps">
                  <div className="item-nom">{p.nom}</div>
                  <div className="petit doux mono">{p.ean}</div>
                </div>
                <span className="mono">×{p.quantite}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
