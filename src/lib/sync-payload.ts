/** Prépare aussi les anciens équipements, créés avant les calendriers. */
export function versServeur(nom: string, ligne: Record<string, unknown>): Record<string, unknown> {
  const sortie: Record<string, unknown> = {}
  for (const [cle, valeur] of Object.entries(ligne)) {
    if (cle === 'aSynchroniser' || valeur === undefined) continue
    sortie[cle.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)] = valeur
  }
  if (nom === 'equipements') {
    // Un upsert groupé peut transformer les champs absents en NULL.
    // Vide signifie tous les jours / aucune exception dans le modèle existant.
    sortie.jours_ouverture ??= ''
    sortie.exceptions ??= ''
  }
  if (nom === 'factures') {
    // Factures créées avant les devis : mêmes raisons qu'au-dessus.
    sortie.type ??= 'facture'
    sortie.lien ??= ''
  }
  if (nom === 'ouvertures') {
    // Pièces ouvertes avant l'ajout des photos.
    sortie.photo ??= ''
  }
  return sortie
}
