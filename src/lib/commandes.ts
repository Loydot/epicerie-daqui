import { db } from '../db/db'
import type { Commande, LigneCommande, ModeRemise, StatutCommande } from '../db/types'

/**
 * Cycle de vie d'une commande téléphonique, dans l'ordre où elle avance.
 * « annulee » est à part : elle peut survenir à n'importe quel moment.
 */
export const STATUTS: Array<{ cle: StatutCommande; nom: string; ton: string }> = [
  { cle: 'a_commander', nom: 'À commander', ton: 'alerte' },
  { cle: 'commandee', nom: 'Commandée', ton: 'accent' },
  { cle: 'arrivee', nom: 'Arrivée', ton: 'ok' },
  { cle: 'retiree', nom: 'Retirée', ton: '' },
  { cle: 'annulee', nom: 'Annulée', ton: 'danger' },
]

/**
 * « Retirée » ou « Livrée » selon le mode : c'est le même état, mais on ne dit
 * pas la même chose à un client qui passe qu'à un client qu'on livre.
 */
export const nomStatut = (s: StatutCommande, mode: ModeRemise = 'retrait'): string => {
  if (s === 'retiree') return mode === 'livraison' ? 'Livrée' : 'Retirée'
  return STATUTS.find((x) => x.cle === s)?.nom ?? s
}

export const motRemise = (mode: ModeRemise) =>
  mode === 'livraison'
    ? { verbe: 'Livraison', date: 'Livraison souhaitée', fait: 'Livrée le' }
    : { verbe: 'Retrait', date: 'Retrait souhaité', fait: 'Retirée le' }

export const tonStatut = (s: StatutCommande): string =>
  STATUTS.find((x) => x.cle === s)?.ton ?? ''

/** Une commande est « en cours » tant qu'elle n'est ni retirée ni annulée. */
export const enCours = (s: StatutCommande): boolean =>
  s !== 'retiree' && s !== 'annulee'

export const totalLignes = (lignes: LigneCommande[]): number =>
  lignes.reduce((t, l) => t + l.quantite * (l.prixUnitaire ?? 0), 0)

/**
 * Change le statut d'une commande, en gérant la sortie de stock.
 *
 * Le stock ne bouge qu'au retrait : c'est le moment où la marchandise quitte
 * réellement le magasin. Repasser une commande retirée en arrière remet le
 * stock comme il était, sinon une erreur de manipulation fausserait l'inventaire.
 */
export async function changeStatut(commande: Commande, statut: StatutCommande): Promise<void> {
  if (commande.statut === statut) return

  const versRetiree = statut === 'retiree' && commande.statut !== 'retiree'
  const quitteRetiree = commande.statut === 'retiree' && statut !== 'retiree'

  if (versRetiree || quitteRetiree) {
    const lignes = await db.lignesCommande.where('commandeId').equals(commande.id).toArray()
    const signe = versRetiree ? -1 : 1
    for (const ligne of lignes) {
      if (!ligne.produitId) continue
      const produit = await db.produits.get(ligne.produitId)
      if (!produit) continue
      await db.produits.update(produit.id, { stock: produit.stock + signe * ligne.quantite })
    }
  }

  await db.commandes.update(commande.id, {
    statut,
    retireLe: statut === 'retiree' ? new Date().toISOString() : '',
  })
}
