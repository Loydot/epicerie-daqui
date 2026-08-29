/**
 * Recherche d'un produit par code-barres sur Open Food Facts (base libre, tres
 * fournie sur l'alimentaire francais), avec repli sur Open Products Facts pour
 * le non-alimentaire (droguerie, entretien) qu'une épicerie vend aussi.
 */

export interface FicheOff {
  nom: string
  marque: string
  contenance: string
  rayon: string
  photoUrl: string
  allergenes: string
  nutriscore: string
}

const BASES = [
  'https://world.openfoodfacts.org',
  'https://world.openproductsfacts.org',
]

const CHAMPS = [
  'product_name', 'product_name_fr', 'generic_name_fr', 'brands', 'quantity',
  'categories', 'allergens', 'nutriscore_grade', 'image_front_small_url', 'image_front_url',
].join(',')

/** Open Food Facts demande d'identifier l'appli appelante. */
const APP = 'HaccpEpicerie/1.0'

const premier = (...vals: unknown[]): string => {
  for (const v of vals) if (typeof v === 'string' && v.trim()) return v.trim()
  return ''
}

/** "Épicerie, Conserves, Legumes" -> "Conserves" : on garde une catégorie lisible. */
function rayonDepuisCategories(categories: string): string {
  const parts = categories.split(',').map((c) => c.replace(/^[a-z]{2}:/, '').trim()).filter(Boolean)
  if (!parts.length) return ''
  const dernier = parts[parts.length - 1]
  return dernier.charAt(0).toUpperCase() + dernier.slice(1)
}

async function interroge(base: string, ean: string, signal: AbortSignal): Promise<FicheOff | null> {
  const url = `${base}/api/v2/product/${encodeURIComponent(ean)}.json?fields=${CHAMPS}&app_name=${APP}`
  const rep = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  if (!rep.ok) return null
  const data = await rep.json()
  if (data.status !== 1 || !data.product) return null
  const p = data.product
  const nom = premier(p.product_name_fr, p.product_name, p.generic_name_fr)
  if (!nom) return null
  return {
    nom,
    marque: premier(p.brands).split(',')[0]?.trim() ?? '',
    contenance: premier(p.quantity),
    rayon: rayonDepuisCategories(premier(p.categories)),
    photoUrl: premier(p.image_front_small_url, p.image_front_url),
    allergenes: premier(p.allergens).split(',').map((a: string) => a.replace(/^[a-z]{2}:/, '')).join(', '),
    nutriscore: premier(p.nutriscore_grade).toUpperCase(),
  }
}

/**
 * Renvoie null si le produit est inconnu ou si le réseau ne repond pas : dans les
 * deux cas l'appli bascule sur la saisie manuelle, sans jamais bloquer le scan.
 */
export async function chercheParEan(ean: string, timeoutMs = 3500): Promise<FicheOff | null> {
  // En magasin il n'y a pas de reseau : inutile de faire patienter la personne
  // pendant tout le delai d'expiration a chaque produit inconnu.
  if (!navigator.onLine) return null

  const ctrl = new AbortController()
  const minuteur = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    for (const base of BASES) {
      try {
        const fiche = await interroge(base, ean, ctrl.signal)
        if (fiche) return fiche
      } catch {
        // base injoignable : on tente la suivante
      }
    }
    return null
  } finally {
    clearTimeout(minuteur)
  }
}
