import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, uid } from '../db/db'
import type { Lot } from '../db/types'
import { aujourdhui, dateFr, joursRestants, normalise } from '../lib/format'
import { ChoixOperateur, useOperateur } from '../lib/operateur'
import { exporteLotsCsv } from '../lib/export'
import { IconeCalendrier, IconeExport, IconePlus, IconeValide } from '../components/Icones'

type Filtre = 'actifs' | 'urgents' | 'historique'

export default function Dlc() {
  const [operateur, setOperateur, operateurs] = useOperateur()
  const [filtre, setFiltre] = useState<Filtre>('actifs')
  const [ouvert, setOuvert] = useState(false)
  const [recherche, setRecherche] = useState('')
  const [choisi, setChoisi] = useState<string>('')
  const [dlc, setDlc] = useState(aujourdhui())
  const [numeroLot, setNumeroLot] = useState('')
  const [quantite, setQuantite] = useState(1)

  const lots = useLiveQuery(() => db.lots.toArray(), [], []) ?? []
  const produits = useLiveQuery(() => db.produits.toArray(), [], []) ?? []

  const nomProduit = (id: string) => produits.find((p) => p.id === id)?.nom ?? 'Produit supprimé'

  const resultats = useMemo(() => {
    const cle = normalise(recherche)
    if (!cle) return produits.slice(0, 8)
    return produits.filter((p) => normalise(`${p.nom} ${p.marque} ${p.ean}`).includes(cle)).slice(0, 8)
  }, [produits, recherche])

  const affiches = useMemo(() => {
    const actifs = lots.filter((l) => l.statut === 'en_stock')
    const tri = (a: Lot, b: Lot) => a.dlc.localeCompare(b.dlc)
    if (filtre === 'actifs') return actifs.sort(tri)
    if (filtre === 'urgents') return actifs.filter((l) => joursRestants(l.dlc) <= 3).sort(tri)
    return lots.filter((l) => l.statut !== 'en_stock').sort((a, b) => b.dlc.localeCompare(a.dlc))
  }, [lots, filtre])

  const ajoute = async () => {
    const p = produits.find((x) => x.id === choisi)
    if (!p) return
    await db.lots.add({
      id: uid(), produitId: p.id, ean: p.ean, numeroLot: numeroLot.trim(), dlc,
      quantite: Math.max(1, quantite), statut: 'en_stock', operateur,
      creeLe: new Date().toISOString(), retireLe: '',
    })
    setOuvert(false); setChoisi(''); setRecherche(''); setNumeroLot(''); setQuantite(1)
  }

  const change = async (l: Lot, statut: Lot['statut']) => {
    await db.lots.update(l.id, { statut, retireLe: new Date().toISOString(), operateur })
  }

  const urgents = lots.filter((l) => l.statut === 'en_stock' && joursRestants(l.dlc) <= 3).length

  return (
    <div className="pile">
      {!ouvert && (
        <button type="button" className="principal haut large" onClick={() => setOuvert(true)}>
          <IconePlus /> Enregistrer un lot
        </button>
      )}

      {ouvert && (
        <div className="carte pile">
          <h2>Nouveau lot</h2>

          <div>
            <label htmlFor="l-prod">Produit</label>
            <input id="l-prod" placeholder="Chercher au catalogue…" value={recherche}
              onChange={(e) => { setRecherche(e.target.value); setChoisi('') }} autoComplete="off" />
          </div>

          {!choisi && (
            <div className="liste">
              {resultats.map((p) => (
                <button key={p.id} type="button" className="item"
                  onClick={() => { setChoisi(p.id); setRecherche(p.nom) }}>
                  <div className="item-corps">
                    <div className="item-nom">{p.nom}</div>
                    <div className="petit doux mono">{p.ean}</div>
                  </div>
                </button>
              ))}
              {resultats.length === 0 && <p className="petit doux">Aucun produit trouvé. Scanne-le d'abord.</p>}
            </div>
          )}

          <div className="deux-champs">
            <div>
              <label htmlFor="l-dlc">DLC / DDM</label>
              <input id="l-dlc" type="date" value={dlc} onChange={(e) => setDlc(e.target.value)} />
            </div>
            <div>
              <label htmlFor="l-qte">Quantité</label>
              <input id="l-qte" className="mono" type="number" min="1" inputMode="numeric" value={quantite}
                onChange={(e) => setQuantite(Number(e.target.value) || 1)} />
            </div>
          </div>

          <div>
            <label htmlFor="l-num">N° de lot (facultatif)</label>
            <input id="l-num" className="mono" value={numeroLot} onChange={(e) => setNumeroLot(e.target.value)} />
          </div>

          {operateurs.length > 0 && (
            <ChoixOperateur valeur={operateur} surChangement={setOperateur} options={operateurs} />
          )}

          <div className="ligne">
            <button type="button" className="champ" onClick={() => setOuvert(false)}>Annuler</button>
            <button type="button" className="champ principal" onClick={ajoute} disabled={!choisi}>
              <IconeValide /> Ajouter
            </button>
          </div>
        </div>
      )}

      <div className="onglets">
        <button type="button" className={filtre === 'actifs' ? 'actif' : ''} onClick={() => setFiltre('actifs')}>
          En stock
        </button>
        <button type="button" className={filtre === 'urgents' ? 'actif' : ''} onClick={() => setFiltre('urgents')}>
          Urgents{urgents > 0 && ` (${urgents})`}
        </button>
        <button type="button" className={filtre === 'historique' ? 'actif' : ''} onClick={() => setFiltre('historique')}>
          Historique
        </button>
      </div>

      <div className="carte">
        <div className="ligne-espace">
          <h2>{affiches.length} lot{affiches.length > 1 ? 's' : ''}</h2>
          {lots.length > 0 && (
            <button type="button" className="discret" onClick={() => exporteLotsCsv(lots, nomProduit)}>
              <IconeExport /> CSV
            </button>
          )}
        </div>

        {affiches.length === 0 ? (
          <div className="vide">
            <IconeCalendrier />
            <p>{filtre === 'urgents' ? 'Rien n\'arrive a echeance. ' : 'Aucun lot ici.'}</p>
          </div>
        ) : (
          <div className="liste" style={{ marginTop: 8 }}>
            {affiches.map((l) => {
              const j = joursRestants(l.dlc)
              const niveau = l.statut !== 'en_stock' ? '' : j < 0 ? 'danger' : j <= 3 ? 'alerte' : 'ok'
              return (
                <div key={l.id} className="item" style={{ flexWrap: 'wrap' }}>
                  <div className="item-corps">
                    <div className="item-nom">{nomProduit(l.produitId)}</div>
                    <div className="petit doux">
                      {dateFr(l.dlc)} · {l.quantite} u.{l.numeroLot && ` · lot ${l.numeroLot}`}
                    </div>
                  </div>
                  <span className={`etiquette ${niveau}`}>
                    {l.statut === 'retire' ? 'Retiré' : l.statut === 'vendu' ? 'Vendu'
                      : j < 0 ? `Dépassée de ${-j} j` : j === 0 ? 'Dernier jour' : `J-${j}`}
                  </span>
                  {l.statut === 'en_stock' && (
                    <div className="ligne" style={{ width: '100%', marginTop: 6 }}>
                      <button type="button" className="champ discret" onClick={() => change(l, 'vendu')}>
                        Écoulé
                      </button>
                      <button type="button" className="champ destructif" onClick={() => change(l, 'retire')}>
                        Retirer de la vente
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
