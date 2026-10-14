import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Facture, LigneFacture } from '../db/types'
import { euro, normalise } from '../lib/format'
import {
  ENTREPRISE_DEFAUT, litEntreprise, litLignes, MODES_PAIEMENT, TAUX_TVA, totaux,
} from '../lib/factures'
import { IconeBoite, IconeCorbeille, IconeExport, IconePlus, IconeRecherche } from '../components/Icones'

/** Le moteur PDF pèse plusieurs centaines de Ko : chargé seulement au clic. */
const chargePdf = () => import('../lib/pdf')

const arrondi = (n: number) => Math.round(n * 100) / 100

/** Accepte la virgule, comme on l'écrit en France. */
const versNombre = (s: string): number => {
  const n = Number.parseFloat(s.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

export default function FactureDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [recherche, setRecherche] = useState('')

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
    if (!cle) return []
    return produits
      .filter((p) => normalise(`${p.nom} ${p.marque} ${p.ean}`).includes(cle))
      .slice(0, 6)
  }, [produits, recherche])

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

  const ajouteProduit = (nom: string, prixTTC: number | null, tva: number) => {
    // Le catalogue connaît le prix TTC ; la facture part du prix HT.
    const prixHT = prixTTC == null ? 0 : arrondi(prixTTC / (1 + tva / 100))
    majLignes([...lignes, { libelle: nom, quantite: 1, prixHT, tva }])
    setRecherche('')
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
        <div className="deux-champs">
          {champ('numero', 'Numéro', { className: 'mono' })}
          {champ('date', "Date d'émission", { type: 'date' })}
        </div>
        {doublon && (
          <p className="petit" style={{ color: 'var(--danger)' }}>
            Ce numéro existe déjà sur une autre facture : chaque numéro doit être unique.
          </p>
        )}
        <div className="deux-champs">
          {champ('dateVente', 'Date de la vente (si différente)', { type: 'date' })}
          {champ('echeance', 'Échéance de paiement', { type: 'date' })}
        </div>
      </div>

      <div className="carte pile">
        <h2>Client</h2>
        {champ('clientNom', 'Nom ou raison sociale', { autoComplete: 'off' })}
        {champ('clientAdresse', 'Adresse')}
        <div className="deux-champs">
          {champ('clientCodePostal', 'Code postal', { inputMode: 'numeric', className: 'mono' })}
          {champ('clientVille', 'Ville')}
        </div>
        <div className="deux-champs">
          {champ('clientTelephone', 'Téléphone', { type: 'tel', className: 'mono' })}
          {champ('clientEmail', 'E-mail', { type: 'email' })}
        </div>
        <p className="petit doux">Pour un client professionnel :</p>
        <div className="deux-champs">
          {champ('clientSiret', 'SIRET', { className: 'mono' })}
          {champ('clientTva', 'N° TVA intracom.', { className: 'mono' })}
        </div>
      </div>

      <div className="carte pile">
        <h2>Articles</h2>

        {lignes.map((l, i) => (
          <div key={`${i}:${lignes.length}:${l.quantite}:${l.prixHT}`} className="pile" style={{ borderBottom: '1px solid var(--bord)', paddingBottom: 10 }}>
            <div className="ligne">
              <input className="champ" value={l.libelle} placeholder="Désignation"
                onChange={(e) => majLigne(i, { libelle: e.target.value })} />
              <button type="button" className="discret" aria-label="Retirer la ligne"
                onClick={() => majLignes(lignes.filter((_, j) => j !== i))}>
                <IconeCorbeille />
              </button>
            </div>
            <div className="deux-champs">
              <div>
                <label>Quantité</label>
                <input type="text" inputMode="decimal" className="mono"
                  defaultValue={String(l.quantite).replace('.', ',')}
                  onBlur={(e) => majLigne(i, { quantite: versNombre(e.target.value) })} />
              </div>
              <div>
                <label>Prix unitaire HT</label>
                <input type="text" inputMode="decimal" className="mono"
                  defaultValue={String(l.prixHT).replace('.', ',')}
                  onBlur={(e) => majLigne(i, { prixHT: versNombre(e.target.value) })} />
              </div>
            </div>
            <div className="ligne-espace">
              {franchise ? <span className="petit doux">Sans TVA</span> : (
                <select value={l.tva} style={{ width: 'auto' }}
                  onChange={(e) => majLigne(i, { tva: Number(e.target.value) })}>
                  {TAUX_TVA.map((taux) => (
                    <option key={taux} value={taux}>TVA {String(taux).replace('.', ',')} %</option>
                  ))}
                </select>
              )}
              <span className="mono" style={{ fontWeight: 600 }}>
                {euro(arrondi(l.quantite * l.prixHT))} HT
              </span>
            </div>
          </div>
        ))}

        <div className="ligne">
          <IconeRecherche className="doux" />
          <input className="champ" placeholder="Ajouter un produit du catalogue…" value={recherche}
            onChange={(e) => setRecherche(e.target.value)} autoComplete="off" />
        </div>
        {resultats.length > 0 && (
          <div className="liste">
            {resultats.map((p) => (
              <button key={p.id} type="button" className="item"
                onClick={() => ajouteProduit(p.nom, p.prixVente, p.tva ?? 5.5)}>
                <div className="item-corps">
                  <div className="item-nom">{p.nom}</div>
                  <div className="petit doux">{p.marque}</div>
                </div>
                <span className="mono">{euro(p.prixVente)} TTC</span>
              </button>
            ))}
          </div>
        )}
        <button type="button" className="large"
          onClick={() => majLignes([...lignes, { libelle: '', quantite: 1, prixHT: 0, tva: 5.5 }])}>
          <IconePlus /> Ligne libre
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
