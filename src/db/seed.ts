import { db } from './db'

/**
 * L'application démarre vide.
 *
 * Elle pré-remplissait cinq équipements et neuf tâches de nettoyage « types ».
 * C'était une mauvaise idée : chaque magasin a ses frigos et ses habitudes, et
 * on se retrouvait à supprimer du contenu imposé avant de saisir le sien.
 * Les propositions existent toujours, mais sous forme de raccourcis d'ajout —
 * un geste pour les prendre, aucun pour les refuser.
 */
export async function amorceSiVide(): Promise<void> {
  const dejaFait = await db.reglages.get('amorce')
  if (dejaFait) return
  await db.reglages.put({ cle: 'amorce', valeur: new Date().toISOString() })
}
