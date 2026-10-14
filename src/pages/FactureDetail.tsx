import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Facture, LigneFacture } from '../db/types'
import { euro, normalise } from '../lib/format'
import {
  ENTREPRISE_DEFAUT, litEntreprise, litLignes, MODES_PAIEMENT, TAUX_TVA, totaux,
} from '../lib/factures'
import { IconeBoite, IconeCorbeille, IconeExport, IconePlus, IconeRecherche, IconeScan } from '../components/Icones'
import Scanner from '../components/Scanner'
import type { Produit } from '../db/types'

/** Le moteur PDF pèse plusieurs centaines de Ko : chargé seulement au clic. */
const chargePdf = () => import('../lib/pdf')

const arrondi = (n: number) => Math.round(n * 100) / 100

/** Le prix de l'épicerie est TTC : on en déduit le HT, gardé précis pour retomber juste. */
const versHT = (ttc: number, tva: number) => Math.round((ttc / (1 + tva / 100)) * 10000) / 10000
const versTTC = (ht: number, tva: number) => arrondi(ht * (1 + tva / 100))

/** Accepte la virgule, comme on l'écrit en France. */
const versNombre = (s: string): number => {
  const n = Number.parseFloat(s.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

export default function FactureDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [recherche, setRecherche] = useState('')
  const [parcourir, setParcourir] = useState(false)
  const [scan, setScan] = useState(false)
  const [message, setMessage] = useState('')

  const facture = useLiveQuery(() => db.factures.get(id), [id], undefined)
  const produits = useLiveQuery(() => db.produits.toArray(), [], []) ?? []
  const entreprise = useLiveQuery(litEntreprise, [], ENTREPRISE_DEFAUT) ?? ENTREPRISE_DEFAUT
  const doublon = useLiveQuery(
    async () => (facture?.numero
      ? (await db.factures.where('numero').equals(facture.numero).count()) > 1
      : false),
    [facture?.numero], false,
  )

  const resultats = useMemo(() => {
    const cle = normalise(recherche)
    if (!cle && !parcourir) return []
    // Chaque mot doit se retrouver quelque part : « nutella 400 » trouve le bon pot.
    const mots = cle.split(/\s+/).filter(Boolean)
    return produits
      .filter((p) => {
        const texte = normalise(`${p.nom} ${p.marque} ${p.contenance} ${p.ean} ${p.rayon} ${p.fournisseur}`)
        return mots.every((m) => texte.includes(m))
      })
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
      .slice(0, cle ? 30 : 300)
  }, [produits, recherche, parcourir])

  if (facture === undefined) return <div className="carte vide">Chargement…</div>
  if (facture === null) {
    return <div className="carte vide"><IconeBoite /><p>Facture introuvable.</p></div>
  }

  const franchise = entreprise.franchiseTva === '1'
  const lignes = litLignes(facture)
  const t = totaux(lignes, franchise)

  const maj = (modifs: Partial<Facture>) => void db.factures.update(facture.id, modifs)
  const majLignes = (nouvelles: LigneFacture[]) => maj({ lignes: JSON.stringify(nouvelles) })
  const majLigne = (i: number, modifs: Partial<LigneFacture>) =>
    majLignes(lignes.map((l, j) => (j === i ? { ...l, ...modifs } : l)))

  const ajouteProduit = (p: Produit) => {
    const deja = lignes.findIndex((l) => l.produitId === p.id)
    if (deja >= 0) {
      // Déjà sur la facture : on ajoute une unité plutôt qu'une seconde ligne.
      majLigne(deja, { quantite: lignes[deja].quantite + 1 })
    } else {
      const tva = p.tva ?? 5.5
      const libelle = [p.nom, p.marque, p.contenance].filter(Boolean).join(' — ')
      majLignes([...lignes, {
        produitId: p.id, libelle, quantite: 1, tva,
        prixHT: p.prixVente == null ? 0 : versHT(p.prixVente, tva),
      }])
    }
    setMessage(p.prixVente == null
      ? `${p.nom} ajouté — pas de prix dans le catalogue, saisissez-le ci-dessous.`
      : `${p.nom} ajouté.`)
    setRecherche('')
  }

  const surCode = (code: string) => {
    const p = produits.find((x) => x.ean === code)
    if (p) ajouteProduit(p)
    else setMessage(`Code ${code} absent du catalogue.`)
  }

  const supprime = async () => {
    if (!confirm(`Supprimer la facture n° ${facture.numero} ?`)) return
    await db.factures.delete(facture.id)
    navigate('/factures', { replace: true })
  }

  const imprime = async () => {
    const { facturePdf } = await chargePdf()
    await facturePdf(facture, lignes, entreprise)
  }

  const champ = (cle: keyof Facture, titre: string, extra: Record<string, string> = {}) => (
    <div>
      <label htmlFor={`f-${cle}`}>{titre}</label>
      <input id={`f-${cle}`} value={String(facture[cle] ?? '')} {...extra}
        onChange={(e) => maj({ [cle]: e.target.value } as Partial<Facture>)} />
    </div>
  )

  return (
    <div className="pile">
      <div className="carte pile">
        <h2>Facture</h2>
        <div className="f-grille">
          {champ('numero', 'Numéro', { className: 'mono' })}
          {champ('date', "Date d'émission", { type: 'date' })}
        </div>
        {doublon && (
          <p className="petit" style={{ color: 'var(--danger)' }}>
            Ce numéro existe déjà sur une autre facture : chaque numéro doit être unique.
          </p>
        )}
        <div className="f-grille">
          {champ('dateVente', 'Date de la vente (si différente)', { type: 'date' })}
          {champ('echeance', 'Échéance de paiement', { type: 'date' })}
        </div>
      </div>

      <div className="carte pile">
        <h2>Client</h2>
        {champ('clientNom', 'Nom ou raison sociale', { autoComplete: 'off' })}
        {champ('clientAdresse', 'Adresse')}
        <div className="f-cp">
          {champ('clientCodePostal', 'Code postal', { inputMode: 'numeric', className: 'mono' })}
          {champ('clientVille', 'Ville')}
        </div>
        <div className="f-grille">
          {champ('clientTelephone', 'Téléphone', { type: 'tel', className: 'mono' })}
          {champ('clientEmail', 'E-mail', { type: 'email' })}
        </div>
        <p className="petit doux">Pour un client professionnel :</p>
        <div className="f-grille">
          {champ('clientSiret', 'SIRET', { className: 'mono' })}
          {champ('clientTva', 'N° TVA intracom.', { className: 'mono' })}
        </div>
      </div>

      <div className="carte pile">
        <h2>Articles</h2>

        <div className="ligne">
          <IconeRecherche className="doux" />
          <input className="champ" placeholder="Chercher : nom, marque, code-barres…"
            value={recherche} onChange={(e) => setRecherche(e.target.value)} autoComplete="off" />
          <button type="button" className={scan ? 'principal' : ''} aria-label="Scanner un code-barres"
            onClick={() => setScan(!scan)}>
            <IconeScan />
          </button>
        </div>
        {scan && <Scanner surCode={surCode} />}
        {!recherche && (
          <button type="button" className="large" onClick={() => setParcourir(!parcourir)}>
            {parcourir ? 'Masquer le catalogue' : `Parcourir tout le catalogue (${produits.length})`}
          </button>
        )}
        {message && <p className="petit doux">{message}</p>}

        {resultats.length > 0 && (
          <div className="liste" style={{ maxHeight: 360, overflowY: 'auto' }}>
            {resultats.map((p) => (
              <button key={p.id} type="button" className="item" onClick={() => ajouteProduit(p)}>
                <div className="item-corps">
                  <div className="item-nom">{p.nom}</div>
                  <div className="petit doux">
                    {[p.marque, p.contenance].filter(Boolean).join(' · ')}
                    {!franchise && ` · TVA ${String(p.tva ?? 5.5).replace('.', ',')} %`}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="mono" style={{ fontWeight: 600 }}>
                    {p.prixVente == null ? 'sans prix' : euro(p.prixVente)}
                  </div>
                  <div className="petit doux">+ Ajouter</div>
                </div>
              </button>
            ))}
          </div>
        )}
        {recherche && resultats.length === 0 && <p className="petit doux">Aucun produit trouvé.</p>}

        {lignes.map((l, i) => {
          const taux = franchise ? 0 : l.tva
          const ttc = versTTC(l.prixHT, taux)
          const totalHT = arrondi(l.quantite * l.prixHT)
          return (
            <div key={`${i}:${lignes.length}:${l.quantite}:${l.prixHT}:${l.tva}`} className="pile f-ligne">
              <div className="ligne">
                <textarea className="champ" rows={2} value={l.libelle} placeholder="Désignation"
                  style={{ minHeight: 0, resize: 'none', fontWeight: 600 }}
                  onChange={(e) => majLigne(i, { libelle: e.target.value })} />
                <button type="button" className="discret" aria-label="Retirer la ligne"
                  onClick={() => majLignes(lignes.filter((_, j) => j !== i))}>
                  <IconeCorbeille />
                </button>
              </div>
              <div className="f-chiffres">
                <div>
                  <label>Quantité</label>
                  <div className="f-stepper">
                    <button type="button" aria-label="Moins"
                      onClick={() => majLigne(i, { quantite: Math.max(0, l.quantite - 1) })}>−</button>
                    <input type="text" inputMode="decimal" className="mono" aria-label="Quantité"
                      defaultValue={String(l.quantite).replace('.', ',')}
                      onBlur={(e) => majLigne(i, { quantite: versNombre(e.target.value) })} />
                    <button type="button" aria-label="Plus"
                      onClick={() => majLigne(i, { quantite: l.quantite + 1 })}>+</button>
                  </div>
                </div>
                <div>
                  <label>{franchise ? 'Prix unitaire' : 'Prix unit. TTC'}</label>
                  <input type="text" inputMode="decimal" className="mono"
                    defaultValue={ttc.toFixed(2).replace('.', ',')}
                    onBlur={(e) => majLigne(i, { prixHT: versHT(versNombre(e.target.value), taux) })} />
                </div>
              </div>
              <div className="ligne-espace">
                {franchise ? <span className="petit doux">Sans TVA</span> : (
                  <select value={l.tva} style={{ width: 'auto' }}
                    onChange={(e) => {
                      // Le prix affiché en rayon ne bouge pas : seul le HT est recalculé.
                      const tva = Number(e.target.value)
                      majLigne(i, { tva, prixHT: versHT(ttc, tva) })
                    }}>
                    {TAUX_TVA.map((t) => (
                      <option key={t} value={t}>TVA {String(t).replace('.', ',')} %</option>
                    ))}
                  </select>
                )}
                <span className="mono f-total">
                  <strong>{euro(versTTC(totalHT, taux))}</strong>
                  {!franchise && <span className="petit doux" style={{ display: 'block' }}>{euro(totalHT)} HT</span>}
                </span>
              </div>
            </div>
          )
        })}

        <button type="button" className="large"
          onClick={() => majLignes([...lignes, { libelle: '', quantite: 1, prixHT: 0, tva: 5.5 }])}>
          <IconePlus /> Ligne libre (hors catalogue)
        </button>
      </div>

      <div className="carte pile">
        <div className="ligne-espace"><span>Total HT</span><span className="mono">{euro(t.ht)}</span></div>
        {!franchise && t.parTaux.map((d) => (
          <div key={d.taux} className="ligne-espace petit doux">
            <span>TVA {String(d.taux).replace('.', ',')} % sur {euro(d.base)}</span>
            <span className="mono">{euro(d.montant)}</span>
          </div>
        ))}
        <div className="ligne-espace" style={{ fontWeight: 700 }}>
          <span>Total TTC</span><span className="mono">{euro(t.ttc)}</span>
        </div>
        {franchise && <p className="petit doux">TVA non applicable, art. 293 B du CGI</p>}
      </div>

      <div className="carte pile">
        <h2>Paiement</h2>
        <div>
          <label htmlFor="f-mode">Mode de paiement</label>
          <select id="f-mode" value={facture.modePaiement}
            onChange={(e) => maj({ modePaiement: e.target.value })}>
            <option value="">—</option>
            {MODES_PAIEMENT.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <label className="ligne" style={{ gap: 10 }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={facture.acquittee === 1}
            onChange={(e) => maj({ acquittee: e.target.checked ? 1 : 0 })} />
          <span>Facture payée (mention « Acquittée » sur le PDF)</span>
        </label>
        <div>
          <label htmlFor="f-note">Note sur la facture</label>
          <textarea id="f-note" value={facture.note} onChange={(e) => maj({ note: e.target.value })} />
        </div>
      </div>

      <button type="button" className="principal large" onClick={imprime}>
        <IconeExport /> Télécharger la facture (PDF)
      </button>
      <button type="button" className="destructif large" onClick={supprime}>
        <IconeCorbeille /> Supprimer la facture
      </button>
    </div>
  )
}
