import type { Produit } from '../db/types'
import { normalise } from './format'

export interface DossierCatalogue {
  id: string
  nom: string
  motsCles: string
}

export function litDossiersCatalogue(valeur: string | undefined): DossierCatalogue[] {
  try {
    const donnee: unknown = JSON.parse(valeur ?? '[]')
    if (!Array.isArray(donnee)) return []
    return donnee.filter((d): d is DossierCatalogue =>
      d && typeof d.id === 'string' && typeof d.nom === 'string' && typeof d.motsCles === 'string',
    )
  } catch {
    return []
  }
}

/** Le premier dossier dont un mot-clé apparaît dans la fiche prend le produit. */
export function dossierDuProduit(produit: Produit, dossiers: DossierCatalogue[]): string {
  const texte = normalise([
    produit.nom, produit.marque, produit.ean, produit.fournisseur, produit.rayon,
  ].join(' '))

  for (const dossier of dossiers) {
    const mots = dossier.motsCles.split(/[,;\n]/).map(normalise).filter(Boolean)
    if (mots.some((mot) => texte.includes(mot))) return dossier.id
  }
  return ''
}
