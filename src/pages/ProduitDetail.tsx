import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, uid } from '../db/db'
import type { Produit } from '../db/types'
import { dateFr, dateHeureFr, euro, joursRestants, marge, nombre } from '../lib/format'
import { texteEtiquettePum } from '../lib/mesure'
import { IconeBoite, IconeCorbeille, IconeExport, IconeValide } from '../components/Icones'
import { SECTIONS } from '../lib/sections'

/** Le moteur PDF pese plusieurs centaines de Ko : charge seulement au clic. */
const chargePdf = () => import('../lib/pdf')

export default function ProduitDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const enregistre = useLiveQuery(() => db.produits.get(id), [id], undefined)
  const lots = useLiveQuery(
    () => db.lots.where('produitId').equals(id).toArray(),
    [id], [],
  ) ?? []
  const magasin = useLiveQuery(async () => (await db.reglages.get('magasin'))?.valeur ?? '', [], '') ?? ''

  const [brouillon, setBrouillon] = useState<Produit | null>(null)
  const [sauve, setSauve] = useState(false)

  useEffect(() => { if (enregistre && !brouillon) setBrouillon(enregistre) }, [enregistre, brouillon])

  if (enregistre === undefined) return <div className="carte vide">Chargement…</div>
  if (enregistre === null) return <div className="carte vide"><IconeBoite /><p>Produit introuvable.</p></div>
  if (!brouillon) return null

  const p = brouillon
  const maj = (champs: Partial<Produit>) => { setBrouillon({ ...p, ...champs }); setSauve(false) }
  const m = marge(p.prixAchat, p.prixVente, p.tva)
  const mesure = texteEtiquettePum(p.contenance, p.prixVente)
  const modifie = JSON.stringify({ ...p, majLe: '' }) !== JSON.stringify({ ...enregistre, majLe: '' })

  const enregistrer = async () => {
    await db.produits.put({ ...p, majLe: new Date().toISOString() })
    setSauve(true)
  }

  const supprimer = async () => {
    if (!confirm(`Supprimer définitivement "${p.nom}" du catalogue ?`)) return
    await db.lots.where('produitId').equals(p.id).delete()
    await db.produits.delete(p.id)
    navigate('/catalogue', { replace: true })
  }

  const ajouteLot = async () => {
    const dlc = prompt('Date limite de consommation (JJ/MM/AAAA)')
    if (!dlc) return
    const [j, mo, a] = dlc.split(/[/\-.]/)
    if (!j || !mo || !a) { alert('Format attendu : JJ/MM/AAAA'); return }
    const iso = `${a.padStart(4, '20')}-${mo.padStart(2, '0')}-${j.padStart(2, '0')}`
    const qte = Number(prompt('Quantité de ce lot', '1')) || 1
    await db.lots.add({
      id: uid(), produitId: p.id, ean: p.ean, numeroLot: '', dlc: iso,
      quantite: qte, statut: 'en_stock', operateur: '', creeLe: new Date().toISOString(), retireLe: '',
    })
  }

  return (
    <div className="pile">
      <div className="carte">
        <div className="ligne">
          {p.photoUrl
            ? <img className="vignette" style={{ width: 68, height: 68, flexBasis: 68 }} src={p.photoUrl} alt="" />
            : <div className="vignette" style={{ width: 68, height: 68, flexBasis: 68, display: 'grid', placeItems: 'center' }}><IconeBoite /></div>}
          <div className="item-corps">
            <h2>{p.nom || 'Sans nom'}</h2>
            <div className="petit doux">{[p.marque, p.contenance].filter(Boolean).join(' · ') || '—'}</div>
            <div className="petit doux mono">{p.ean}</div>
          </div>
        </div>
      </div>

      <div className="carte pile">
        <div className="section-titre">Identification</div>
        <div>
          <label htmlFor="d-nom">Désignation</label>
          <input id="d-nom" value={p.nom} onChange={(e) => maj({ nom: e.target.value })} />
        </div>
        <div className="deux-champs">
          <div>
            <label htmlFor="d-marque">Marque</label>
            <input id="d-marque" value={p.marque} onChange={(e) => maj({ marque: e.target.value })} />
          </div>
          <div>
            <label htmlFor="d-cont">Contenance</label>
            <input id="d-cont" value={p.contenance} onChange={(e) => maj({ contenance: e.target.value })} />
          </div>
        </div>
        <div className="deux-champs">
          <div>
            <label htmlFor="d-section">Rayon</label>
            <select id="d-section" value={p.section}
              onChange={(e) => maj({ section: e.target.value as Produit['section'] })}>
              {SECTIONS.map((s) => <option key={s.cle} value={s.cle}>{s.nom}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="d-four">Fournisseur</label>
            <input id="d-four" value={p.fournisseur} onChange={(e) => maj({ fournisseur: e.target.value })} />
          </div>
        </div>

        <div className="section-titre">Prix et marge</div>
        <div className="deux-champs">
          <div>
            <label htmlFor="d-achat">Prix d'achat HT</label>
            <input id="d-achat" type="number" step="0.01" min="0" inputMode="decimal" value={p.prixAchat ?? ''}
              onChange={(e) => maj({ prixAchat: e.target.value === '' ? null : Number(e.target.value) })} />
          </div>
          <div>
            <label htmlFor="d-vente">Prix de vente TTC</label>
            <input id="d-vente" type="number" step="0.01" min="0" inputMode="decimal" value={p.prixVente ?? ''}
              onChange={(e) => maj({ prixVente: e.target.value === '' ? null : Number(e.target.value) })} />
          </div>
        </div>
        {p.prixVente != null && (
          <p className="petit doux">
            {mesure
              ? <>Prix à l'unité de mesure : <strong className="mono">{mesure}</strong>, imprimé sous le prix sur l'étiquette.</>
              : <>Contenance illisible : écris-la « 500 g », « 1 L » ou « 6 x 33 cl » pour que
                l'étiquette porte le prix au kilo ou au litre, obligatoire dès qu'un produit se
                vend au poids ou au volume.</>}
          </p>
        )}
        <div className="deux-champs">
          <div>
            <label htmlFor="d-tva">TVA (%)</label>
            <select id="d-tva" value={p.tva} onChange={(e) => maj({ tva: Number(e.target.value) })}>
              <option value={5.5}>5,5 % — alimentaire courant</option>
              <option value={20}>20 % — alcool, entretien, non alimentaire</option>
              <option value={10}>10 % — consommation immédiate</option>
              <option value={2.1}>2,1 % — presse, médicaments</option>
              <option value={0}>0 %</option>
            </select>
          </div>
          <div>
            <label htmlFor="d-stock">Stock</label>
            <input id="d-stock" type="number" step="1" inputMode="numeric" value={p.stock}
              onChange={(e) => maj({ stock: Number(e.target.value) || 0 })} />
          </div>
        </div>
        {m && (
          <div className="bandeau">
            <IconeValide />
            <span>Marge : <strong>{euro(m.euros)}</strong> par unité ({nombre(m.pourcent, 1)} %) · Stock valorisé {euro(p.stock * (p.prixAchat ?? 0))}</span>
          </div>
        )}

        <div className="section-titre">Notes</div>
        <textarea value={p.note} placeholder="Conditions de stockage, remarque fournisseur…"
          onChange={(e) => maj({ note: e.target.value })} />

        <div className="ligne">
          <button type="button" className="champ principal haut" onClick={enregistrer} disabled={!modifie}>
            <IconeValide /> {sauve && !modifie ? 'Enregistré' : 'Enregistrer'}
          </button>
        </div>
      </div>

      <div className="carte">
        <div className="ligne-espace">
          <h2>Lots et dates limites</h2>
          <button type="button" className="discret" onClick={ajouteLot}>+ Ajouter</button>
        </div>
        {lots.length === 0 ? (
          <p className="petit doux" style={{ marginTop: 8 }}>Aucun lot suivi pour ce produit.</p>
        ) : (
          <div className="liste" style={{ marginTop: 8 }}>
            {lots.sort((a, b) => a.dlc.localeCompare(b.dlc)).map((l) => {
              const j = joursRestants(l.dlc)
              const niveau = l.statut !== 'en_stock' ? '' : j < 0 ? 'danger' : j <= 3 ? 'alerte' : 'ok'
              return (
                <div key={l.id} className="item">
                  <div className="item-corps">
                    <div className="item-nom">{dateFr(l.dlc)}</div>
                    <div className="petit doux">{l.quantite} u.{l.numeroLot && ` · lot ${l.numeroLot}`}</div>
                  </div>
                  <span className={`etiquette ${niveau}`}>
                    {l.statut === 'retire' ? 'Retiré' : l.statut === 'vendu' ? 'Vendu'
                      : j < 0 ? `Dépassée de ${-j} j` : j === 0 ? "Dernier jour" : `J-${j}`}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="carte">
        <div className="section-titre">Documents</div>
        <div className="ligne" style={{ flexWrap: 'wrap' }}>
          <button type="button" onClick={async () => (await chargePdf()).ficheProduitPdf(enregistre, magasin)}>
            <IconeExport /> Fiche produit PDF
          </button>
          <button type="button" onClick={async () => (await chargePdf()).etiquettesPdf([enregistre], magasin)}>
            <IconeExport /> Étiquette de rayon
          </button>
        </div>
        <p className="petit doux" style={{ marginTop: 10 }}>
          Fiche créée le {dateHeureFr(p.creeLe)} · dernière modification {dateHeureFr(enregistre.majLe)}
          {p.source === 'openfoodfacts' && ' · données initiales Open Food Facts'}
        </p>
      </div>

      <button type="button" className="destructif large" onClick={supprimer}>
        <IconeCorbeille /> Supprimer du catalogue
      </button>
    </div>
  )
}
