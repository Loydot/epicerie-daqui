import { db } from '../db/db'
import { chercheParEan } from './openfoodfacts'

/**
 * Rattrapage des fiches scannées sans réseau.
 *
 * En magasin il n'y a pas de connexion : on enregistre alors le code-barres, le
 * prix et la quantité, et la fiche reste marquée « à enrichir ». Dès que le
 * téléphone retrouve du réseau, on va chercher le nom, la marque et la photo
 * sans rien demander à personne.
 *
 * Ce que la personne a saisi à la main n'est jamais écrasé : seuls les champs
 * restés vides sont complétés.
 */

let enCours = false

export async function enrichitEnAttente(): Promise<number> {
  if (enCours || !navigator.onLine) return 0
  enCours = true
  let completes = 0

  try {
    const attente = await db.produits.where('aEnrichir').equals(1).toArray()
    for (const produit of attente) {
      if (!navigator.onLine) break
      const fiche = await chercheParEan(produit.ean)
      if (!fiche) {
        // Produit réellement inconnu de la base : inutile de le redemander sans fin.
        await db.produits.update(produit.id, { aEnrichir: 0 })
        continue
      }
      const nomAuto = produit.nom === '' || produit.nom === `Article ${produit.ean}`
      await db.produits.update(produit.id, {
        nom: nomAuto ? fiche.nom : produit.nom,
        marque: produit.marque || fiche.marque,
        contenance: produit.contenance || fiche.contenance,
        rayon: produit.rayon || fiche.rayon,
        photoUrl: produit.photoUrl || fiche.photoUrl,
        allergenes: produit.allergenes || fiche.allergenes,
        nutriscore: produit.nutriscore || fiche.nutriscore,
        source: 'openfoodfacts',
        aEnrichir: 0,
        majLe: new Date().toISOString(),
      })
      completes += 1
    }
  } finally {
    enCours = false
  }

  return completes
}

/** Au démarrage, puis à chaque retour du réseau. */
export function surveilleLeReseau(): () => void {
  const relance = () => void enrichitEnAttente()
  relance()
  window.addEventListener('online', relance)
  return () => window.removeEventListener('online', relance)
}
