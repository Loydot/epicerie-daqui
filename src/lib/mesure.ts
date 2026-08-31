/**
 * Prix à l'unité de mesure (€/kg, €/L).
 *
 * L'arrêté du 3 décembre 1987 sur l'information du consommateur sur les prix
 * impose de l'afficher à côté du prix de vente pour tout produit vendu au poids
 * ou au volume. Les produits vendus à la pièce en sont dispensés : quand la
 * contenance ne porte ni masse ni volume, on ne renvoie rien, et l'étiquette
 * n'affiche alors que le prix.
 */

export interface Pum {
  /** Prix ramené au kilo ou au litre. */
  valeur: number
  unite: 'kg' | 'L'
}

/** Facteurs de conversion vers le gramme, puis vers le millilitre. */
const MASSES: Record<string, number> = { mg: 0.001, g: 1, gramme: 1, grammes: 1, gr: 1, kg: 1000 }
const VOLUMES: Record<string, number> = { ml: 1, cl: 10, dl: 100, l: 1000, litre: 1000, litres: 1000 }

/**
 * Un lot compte pour son total : « 6 x 33 cl » fait 1,98 L, et c'est bien sur
 * ce total que le prix au litre se calcule.
 *
 * Les unités longues passent avant les courtes dans l'alternance, sinon « gr »
 * serait lu comme « g » suivi d'un « r » parasite.
 */
const MESURE = /(?:(\d+(?:[.,]\d+)?)\s*[x×*]\s*)?(\d+(?:[.,]\d+)?)\s*(grammes|gramme|litres|litre|mg|kg|gr|g|ml|cl|dl|l)\b/

/**
 * Lit une contenance libre (« 500 g », « 1,5 L », « 6 x 33 cl ») et en tire le
 * prix à l'unité de mesure. Renvoie null si la contenance n'est pas lisible,
 * si elle n'a pas d'unité, ou si le prix manque.
 */
export function pum(contenance: string, prixVente: number | null): Pum | null {
  if (prixVente == null || prixVente <= 0 || !contenance) return null

  const m = MESURE.exec(contenance.toLowerCase().replace(',', '.'))
  if (!m) return null

  const lot = m[1] ? Number(m[1].replace(',', '.')) : 1
  const quantite = Number(m[2].replace(',', '.'))
  const unite = m[3]
  if (!Number.isFinite(lot) || !Number.isFinite(quantite) || quantite <= 0) return null

  const facteurMasse = MASSES[unite]
  const facteurVolume = VOLUMES[unite]
  const base = lot * quantite * (facteurMasse ?? facteurVolume ?? 0)
  if (base <= 0) return null

  return {
    valeur: prixVente / (base / 1000),
    unite: facteurMasse ? 'kg' : 'L',
  }
}

/** « 9,80 €/kg ». Deux décimales, comme le prix de vente. */
export const formatePum = (p: Pum): string =>
  `${p.valeur.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €/${p.unite}`

/** Le texte prêt à poser sur une étiquette, ou une chaîne vide s'il n'y a pas lieu. */
export function texteEtiquettePum(contenance: string, prixVente: number | null): string {
  const p = pum(contenance, prixVente)
  return p ? formatePum(p) : ''
}
