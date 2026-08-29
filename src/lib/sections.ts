import type { Section } from '../db/types'

/**
 * Les rayons du magasin, dans l'ordre où l'inventaire se lit.
 *
 * L'ordre n'est pas alphabétique volontairement : il suit la logique du magasin,
 * du plus contraignant au moins contraignant. Le froid négatif d'abord, parce que
 * c'est là que se joue la sécurité alimentaire.
 */
export const SECTIONS: Array<{ cle: Section; nom: string; aide: string }> = [
  { cle: 'negatif', nom: 'Froid négatif', aide: 'Surgelés, glaces — conservés à −18 °C ou moins' },
  { cle: 'positif', nom: 'Froid positif', aide: 'Frais, laitages, charcuterie — entre 0 et 4 °C' },
  { cle: 'menager', nom: 'Ménager', aide: 'Entretien, droguerie, papier — non alimentaire' },
  { cle: 'epicerie', nom: 'Épicerie', aide: 'Sec, conserves, boissons — température ambiante' },
  { cle: 'nonclasse', nom: 'À classer', aide: "Produits dont le rayon n'a pas encore été choisi" },
]

export const nomSection = (cle: Section): string =>
  SECTIONS.find((s) => s.cle === cle)?.nom ?? 'À classer'

export const rangSection = (cle: Section): number => {
  const i = SECTIONS.findIndex((s) => s.cle === cle)
  return i === -1 ? SECTIONS.length : i
}

/**
 * Devine le rayon à partir de la catégorie renvoyée par Open Food Facts.
 *
 * C'est une proposition, pas une vérité : elle évite de classer 300 produits à la
 * main, et reste corrigeable d'un menu déroulant sur la fiche. En cas de doute on
 * ne devine pas — mieux vaut « À classer », qui se voit, qu'un rayon faux qui passe
 * inaperçu.
 */

const INDICES: Array<{ section: Section; mots: string[] }> = [
  {
    section: 'negatif',
    mots: ['surgel', 'congel', 'glace', 'glaces', 'creme glacee', 'sorbet', 'frozen'],
  },
  {
    section: 'positif',
    mots: [
      'frais', 'fraiche', 'yaourt', 'yaourts', 'fromage', 'fromages', 'lait', 'laitier',
      'laitiers', 'beurre', 'creme fraiche', 'charcuterie', 'jambon', 'saucisse',
      'viande', 'volaille', 'poisson', 'oeuf', 'oeufs', 'traiteur', 'pate a tartiner fraiche',
      'dessert lacte', 'compote fraiche', 'salade',
    ],
  },
  {
    section: 'menager',
    mots: [
      'lessive', 'nettoyant', 'detergent', 'desinfectant', 'entretien', 'menager',
      'vaisselle', 'papier toilette', 'essuie-tout', 'sac poubelle', 'eponge',
      'savon', 'shampoing', 'dentifrice', 'hygiene', 'couche', 'mouchoir',
    ],
  },
]

const sansAccent = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

export function devineSection(...textes: Array<string | undefined>): Section {
  const foin = sansAccent(textes.filter(Boolean).join(' '))
  if (!foin.trim()) return 'nonclasse'

  for (const { section, mots } of INDICES) {
    if (mots.some((m) => foin.includes(m))) return section
  }

  // Une catégorie alimentaire reconnue mais sans indice de froid est de l'épicerie
  // sèche neuf fois sur dix ; sans catégorie du tout, on ne présume rien.
  return foin.trim() ? 'epicerie' : 'nonclasse'
}
