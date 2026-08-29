import { db, uid } from './db'
import type { Equipement, Tache } from './types'

/**
 * Contenu de depart d'une épicerie : les équipements et le plan de nettoyage
 * les plus courants. Tout est modifiable dans les reglages, rien n'est fige.
 */

const EQUIPEMENTS: Array<Omit<Equipement, 'id'>> = [
  { nom: 'Frigo produits laitiers', type: 'frigo', tempMin: 0, tempMax: 4, actif: 1, ordre: 1 },
  { nom: 'Frigo charcuterie / traiteur', type: 'frigo', tempMin: 0, tempMax: 4, actif: 1, ordre: 2 },
  { nom: 'Vitrine boissons', type: 'vitrine', tempMin: 0, tempMax: 8, actif: 1, ordre: 3 },
  { nom: 'Congélateur', type: 'congelateur', tempMin: -25, tempMax: -18, actif: 1, ordre: 4 },
  { nom: 'Réserve sèche', type: 'reserve', tempMin: 10, tempMax: 25, actif: 1, ordre: 5 },
]

const TACHES: Array<Omit<Tache, 'id'>> = [
  { nom: 'Nettoyage du sol de la surface de vente', zone: 'Magasin', frequence: 'quotidien', produitUtilise: 'Détergent sols', actif: 1, ordre: 1 },
  { nom: 'Nettoyage du plan de travail et de la caisse', zone: 'Caisse', frequence: 'quotidien', produitUtilise: 'Désinfectant contact alimentaire', actif: 1, ordre: 2 },
  { nom: 'Sortie des déchets et nettoyage des poubelles', zone: 'Réserve', frequence: 'quotidien', produitUtilise: 'Détergent désinfectant', actif: 1, ordre: 3 },
  { nom: 'Nettoyage intérieur des vitrines réfrigérées', zone: 'Rayon frais', frequence: 'hebdomadaire', produitUtilise: 'Désinfectant contact alimentaire', actif: 1, ordre: 4 },
  { nom: 'Nettoyage des rayonnages et facing', zone: 'Magasin', frequence: 'hebdomadaire', produitUtilise: 'Détergent multi-usage', actif: 1, ordre: 5 },
  { nom: 'Nettoyage du local poubelles', zone: 'Extérieur', frequence: 'hebdomadaire', produitUtilise: 'Détergent désinfectant', actif: 1, ordre: 6 },
  { nom: 'Dégivrage et nettoyage complet du congélateur', zone: 'Réserve', frequence: 'mensuel', produitUtilise: 'Désinfectant contact alimentaire', actif: 1, ordre: 7 },
  { nom: 'Dépoussiérage des grilles de condenseur', zone: 'Réserve', frequence: 'mensuel', produitUtilise: 'Aspirateur', actif: 1, ordre: 8 },
  { nom: 'Vérification du plan de lutte contre les nuisibles', zone: 'Magasin', frequence: 'mensuel', produitUtilise: '', actif: 1, ordre: 9 },
]

/** Ne s'execute qu'au tout premier lancement, sur une base vide. */
export async function amorceSiVide(): Promise<void> {
  const dejaFait = await db.reglages.get('amorce')
  if (dejaFait) return

  await db.transaction('rw', db.equipements, db.taches, db.reglages, async () => {
    if ((await db.equipements.count()) === 0) {
      await db.equipements.bulkAdd(EQUIPEMENTS.map((e) => ({ ...e, id: uid() })))
    }
    if ((await db.taches.count()) === 0) {
      await db.taches.bulkAdd(TACHES.map((t) => ({ ...t, id: uid() })))
    }
    await db.reglages.put({ cle: 'amorce', valeur: new Date().toISOString() })
  })
}
