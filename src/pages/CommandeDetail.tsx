import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, uid } from '../db/db'
import type { ModeRemise, StatutCommande } from '../db/types'
import { dateHeureFr, euro, nombre, normalise } from '../lib/format'
import { changeStatut, motRemise, nomStatut, STATUTS, tonStatut, totalLignes } from '../lib/commandes'
import {
  IconeBoite, IconeCorbeille, IconeExport, IconePlus, IconeRecherche, IconeValide,
} from '../components/Icones'

/** Le moteur PDF pèse plusieurs centaines de Ko : chargé seulement au clic. */
const chargePdf = () => import('../lib/pdf')

export default function CommandeDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [recherche, setRecherche] = useState('')
  const [quantite, setQuantite] = useState(1)
  const [libelleLibre, setLibelleLibre] = useState('')

  const commande = useLiveQuery(() => db.commandes.get(id), [id], undefined)
  const lignes = useLiveQuery(
    () => db.lignesCommande.where('commandeId').equals(id).toArray(), [id], [],
  ) ?? []
  const produits = useLiveQuery(() => db.produits.toArray(), [], []) ?? []
  const client = useLiveQuery(
    async () => (commande ? db.clients.get(commande.clientId) : undefined),
    [commande?.clientId], undefined,
  )
  const magasin = useLiveQuery(async () => (await db.reglages.get('magasin'))?.valeur ?? '', [], '') ?? ''

  const resultats = useMemo(() => {
    const cle = normalise(recherche)
    if (!cle) return []
    return produits
      .filter((p) => normalise(`${p.nom} ${p.marque} ${p.ean}`).includes(cle))
      .slice(0, 6)
  }, [produits, recherche])

  if (commande === undefined) return <div className="carte vide">Chargement…</div>
  if (commande === null) {
    return <div className="carte vide"><IconeBoite /><p>Commande introuvable.</p></div>
  }

  const verrouillee = commande.statut === 'retiree' || commande.statut === 'annulee'

  const ajouteProduit = async (produitId: string, nom: string, prix: number | null) => {
    await db.lignesCommande.add({
      id: uid(), commandeId: commande.id, produitId,
      libelle: nom, quantite: Math.max(1, quantite), prixUnitaire: prix,
    })
    setRecherche('')
    setQuantite(1)
  }

  const ajouteLibre = async () => {
    const libelle = libelleLibre.trim()
    if (!libelle) return
    await db.lignesCommande.add({
      id: uid(), commandeId: commande.id, produitId: '',
      libelle, quantite: Math.max(1, quantite), prixUnitaire: null,
    })
    setLibelleLibre('')
    setQuantite(1)
  }

  const supprimeCommande = async () => {
    if (!confirm(`Supprimer la commande de ${client?.nom ?? 'ce client'} ?`)) return
    // Si elle avait été retirée, le stock a été débité : on le rend avant d'effacer.
    if (commande.statut === 'retiree') await changeStatut(commande, 'a_commander')
    await db.lignesCommande.where('commandeId').equals(commande.id).delete()
    await db.commandes.delete(commande.id)
    navigate('/commandes', { replace: true })
  }

  const imprime = async () => {
    const { bonDeCommandePdf } = await chargePdf()
    await bonDeCommandePdf({
      magasin,
      client: {
        nom: client?.nom ?? '',
        telephone: client?.telephone ?? '',
        adresse: commande.adresseLivraison || client?.adresse || '',
      },
      commande,
      lignes,
    })
  }

  const total = totalLignes(lignes)
  const sansPrix = lignes.filter((l) => l.prixUnitaire == null).length

  return (
    <div className="pile">
      <div className="carte pile">
        <div className="ligne-espace">
          <div style={{ minWidth: 0 }}>
            <h2>{client?.nom ?? 'Client supprimé'}</h2>
            <div className="petit doux mono">{client?.telephone || 'sans numéro'}</div>
          </div>
          <span className={`etiquette ${tonStatut(commande.statut)}`}>
            {nomStatut(commande.statut, commande.mode)}
          </span>
        </div>

        <div>
          <label>Comment la récupère-t-il ?</label>
          <div className="onglets">
            <button type="button" className={commande.mode === 'retrait' ? 'actif' : ''}
              aria-pressed={commande.mode === 'retrait'}
              onClick={() => void db.commandes.update(commande.id, { mode: 'retrait' as ModeRemise })}>
              Il passe la prendre
            </button>
            <button type="button" className={commande.mode === 'livraison' ? 'actif' : ''}
              aria-pressed={commande.mode === 'livraison'}
              onClick={() => void db.commandes.update(commande.id, { mode: 'livraison' as ModeRemise })}>
              On le livre
            </button>
          </div>
        </div>

        {commande.mode === 'livraison' && (
          <div>
            <label htmlFor="adresse">Adresse de livraison</label>
            <textarea id="adresse"
              value={commande.adresseLivraison || client?.adresse || ''}
              placeholder="Rue, complément, village"
              onChange={(e) => void db.commandes.update(commande.id, { adresseLivraison: e.target.value })} />
            {!commande.adresseLivraison && client?.adresse && (
              <p className="petit doux" style={{ marginTop: 4 }}>
                Adresse reprise de sa fiche. La modifier ici ne vaut que pour cette commande.
              </p>
            )}
          </div>
        )}

        <div className="deux-champs">
          <div>
            <label htmlFor="retrait">{motRemise(commande.mode).date}</label>
            <input id="retrait" type="date" value={commande.dateRetrait}
              onChange={(e) => void db.commandes.update(commande.id, { dateRetrait: e.target.value })} />
          </div>
          <div>
            <label htmlFor="statut">Où en est-elle ?</label>
            <select id="statut" value={commande.statut}
              onChange={(e) => void changeStatut(commande, e.target.value as StatutCommande)}>
              {STATUTS.map((s) => (
                <option key={s.cle} value={s.cle}>{nomStatut(s.cle, commande.mode)}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="note">Note</label>
          <textarea id="note" value={commande.note} placeholder="Précisions données au téléphone…"
            onChange={(e) => void db.commandes.update(commande.id, { note: e.target.value })} />
        </div>

        {commande.statut === 'retiree' && (
          <div className="bandeau">
            <IconeValide />
            <span>
              {motRemise(commande.mode).fait} {dateHeureFr(commande.retireLe)}. Les articles
              du catalogue ont été déduits du stock.
            </span>
          </div>
        )}
      </div>

      {!verrouillee && (
        <div className="carte pile">
          <h2>Ajouter un article</h2>

          <div className="ligne">
            <IconeRecherche className="doux" />
            <input className="champ" placeholder="Chercher au catalogue…" value={recherche}
              onChange={(e) => setRecherche(e.target.value)} autoComplete="off" />
            <div style={{ width: 84 }}>
              <input className="mono" type="number" min="1" inputMode="numeric" value={quantite}
                aria-label="Quantité" style={{ textAlign: 'center' }}
                onChange={(e) => setQuantite(Math.max(1, Number(e.target.value) || 1))} />
            </div>
          </div>

          {resultats.length > 0 && (
            <div className="liste">
              {resultats.map((p) => (
                <button key={p.id} type="button" className="item"
                  onClick={() => ajouteProduit(p.id, p.nom, p.prixVente)}>
                  <div className="item-corps">
                    <div className="item-nom">{p.nom}</div>
                    <div className="petit doux">
                      {[p.marque, p.contenance].filter(Boolean).join(' · ') || p.ean}
                    </div>
                  </div>
                  <span className="mono">{euro(p.prixVente)}</span>
                </button>
              ))}
            </div>
          )}

          {recherche.trim() !== '' && resultats.length === 0 && (
            <p className="petit doux">Rien au catalogue sous ce nom. Ajoute-le à la main ci-dessous.</p>
          )}

          <div className="ligne">
            <input className="champ" placeholder="Article hors catalogue (ex. 2 kg de pommes de terre)"
              value={libelleLibre} onChange={(e) => setLibelleLibre(e.target.value)} />
            <button type="button" className="principal" onClick={ajouteLibre}
              disabled={!libelleLibre.trim()}>
              <IconePlus />
            </button>
          </div>
        </div>
      )}

      <div className="carte">
        <div className="ligne-espace">
          <h2>{lignes.length} article{lignes.length > 1 ? 's' : ''}</h2>
          {lignes.length > 0 && <span className="mono" style={{ fontWeight: 700 }}>{euro(total)}</span>}
        </div>

        {lignes.length === 0 ? (
          <div className="vide"><IconeBoite /><p>Commande vide pour l'instant.</p></div>
        ) : (
          <div className="liste" style={{ marginTop: 8 }}>
            {lignes.map((l) => (
              <div key={l.id} className="item">
                <div className="item-corps">
                  <div className="item-nom">{l.libelle}</div>
                  <div className="petit doux">
                    {nombre(l.quantite)} × {l.prixUnitaire == null ? 'prix à définir' : euro(l.prixUnitaire)}
                    {!l.produitId && ' · hors catalogue'}
                  </div>
                </div>
                <span className="mono" style={{ fontWeight: 600 }}>
                  {l.prixUnitaire == null ? '—' : euro(l.quantite * l.prixUnitaire)}
                </span>
                {!verrouillee && (
                  <button type="button" className="discret" aria-label={`Retirer ${l.libelle}`}
                    onClick={() => void db.lignesCommande.delete(l.id)}>
                    <IconeCorbeille />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {sansPrix > 0 && (
          <p className="petit doux" style={{ marginTop: 8 }}>
            {sansPrix} article{sansPrix > 1 ? 's' : ''} sans prix : le total affiché est donc incomplet.
          </p>
        )}
      </div>

      <button type="button" className="large" onClick={imprime} disabled={lignes.length === 0}>
        <IconeExport /> Bon de commande PDF
      </button>

      <button type="button" className="destructif large" onClick={supprimeCommande}>
        <IconeCorbeille /> Supprimer la commande
      </button>
    </div>
  )
}
