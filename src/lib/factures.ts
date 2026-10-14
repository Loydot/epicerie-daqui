import { db } from '../db/db'
import type { Facture, LigneFacture } from '../db/types'

/**
 * Les informations de l'entreprise qui figurent sur chaque facture.
 * Elles vivent dans les réglages synchronisés, sous la clé « ent.<champ> ».
 */
export interface Entreprise {
  raisonSociale: string
  formeJuridique: string
  capital: string
  adresse: string
  codePostal: string
  ville: string
  telephone: string
  email: string
  siret: string
  rcs: string
  tvaIntra: string
  /** « 1 » : micro-entreprise en franchise, pas de TVA facturée. */
  franchiseTva: string
  iban: string
  bic: string
  conditionsPaiement: string
  mentions: string
}

/** Repris de l'affiche du magasin : il ne reste qu'à vérifier et compléter. */
export const ENTREPRISE_DEFAUT: Entreprise = {
  raisonSociale: "L'Épicerie d'Aquí",
  formeJuridique: '',
  capital: '',
  adresse: '35 rue Maréchal Joffre',
  codePostal: '66600',
  ville: 'Vingrau',
  telephone: '07 70 80 12 35',
  email: 'lepiceriedaqui@orange.fr',
  siret: '',
  rcs: '',
  tvaIntra: '',
  franchiseTva: '',
  iban: '',
  bic: '',
  conditionsPaiement: 'Paiement à réception de facture.',
  mentions:
    "En cas de retard de paiement : pénalités au taux de 3 fois le taux d'intérêt légal. "
    + 'Pour les professionnels : indemnité forfaitaire pour frais de recouvrement de 40 €. '
    + "Pas d'escompte pour paiement anticipé.",
}

export const CHAMPS_ENTREPRISE = Object.keys(ENTREPRISE_DEFAUT) as Array<keyof Entreprise>

export const cleEntreprise = (champ: keyof Entreprise) => `ent.${champ}`

/** Une valeur jamais saisie prend la valeur par défaut ; une valeur effacée reste vide. */
export async function litEntreprise(): Promise<Entreprise> {
  const lignes = await db.reglages.where('cle').startsWith('ent.').toArray()
  const e = { ...ENTREPRISE_DEFAUT }
  for (const l of lignes) {
    const champ = l.cle.slice(4) as keyof Entreprise
    if (champ in e) e[champ] = l.valeur
  }
  return e
}

export function litLignes(f: Pick<Facture, 'lignes'>): LigneFacture[] {
  try {
    const l = JSON.parse(f.lignes || '[]')
    return Array.isArray(l) ? l : []
  } catch {
    return []
  }
}

const arrondi = (n: number) => Math.round(n * 100) / 100

export interface Totaux {
  ht: number
  tva: number
  ttc: number
  /** Détail par taux, exigé sur la facture quand plusieurs taux coexistent. */
  parTaux: Array<{ taux: number; base: number; montant: number }>
}

export function totaux(lignes: LigneFacture[], franchise: boolean): Totaux {
  const parTaux = new Map<number, number>()
  let ht = 0
  for (const l of lignes) {
    const montant = arrondi((l.quantite || 0) * (l.prixHT || 0))
    ht += montant
    const taux = franchise ? 0 : (l.tva || 0)
    parTaux.set(taux, (parTaux.get(taux) ?? 0) + montant)
  }
  const detail = [...parTaux.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([taux, base]) => ({ taux, base: arrondi(base), montant: arrondi(base * taux / 100) }))
  const tva = arrondi(detail.reduce((s, d) => s + d.montant, 0))
  ht = arrondi(ht)
  return { ht, tva, ttc: arrondi(ht + tva), parTaux: detail }
}

/**
 * Numéro suivant pour l'année : 2026-0001, 2026-0002…
 * La loi impose une suite continue, sans trou : on repart du plus grand existant.
 */
export async function prochainNumero(annee: string): Promise<string> {
  const factures = await db.factures.toArray()
  const prefixe = `${annee}-`
  const max = factures
    .map((f) => f.numero)
    .filter((n) => n.startsWith(prefixe))
    .map((n) => Number.parseInt(n.slice(prefixe.length), 10))
    .filter((n) => Number.isFinite(n))
    .reduce((a, b) => Math.max(a, b), 0)
  return `${prefixe}${String(max + 1).padStart(4, '0')}`
}

export const MODES_PAIEMENT = ['Espèces', 'Carte bancaire', 'Chèque', 'Virement']

export const TAUX_TVA = [5.5, 10, 20, 2.1, 0]
