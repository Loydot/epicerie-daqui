import Dexie, { type EntityTable } from 'dexie'
import type {
  Equipement, Lot, Nettoyage, Operateur, Produit, Reception, Reglage, Releve, Tache,
} from './types'

/**
 * Base locale (IndexedDB). Elle est la source de verite pendant la saisie :
 * tout marche hors-ligne dans la reserve, la synchro Supabase viendra par-dessus.
 */
class HaccpDb extends Dexie {
  produits!: EntityTable<Produit, 'id'>
  equipements!: EntityTable<Equipement, 'id'>
  releves!: EntityTable<Releve, 'id'>
  receptions!: EntityTable<Reception, 'id'>
  lots!: EntityTable<Lot, 'id'>
  taches!: EntityTable<Tache, 'id'>
  nettoyages!: EntityTable<Nettoyage, 'id'>
  operateurs!: EntityTable<Operateur, 'id'>
  reglages!: EntityTable<Reglage, 'cle'>

  constructor() {
    super('haccp-epicerie')
    this.version(1).stores({
      produits: 'id, &ean, nom, marque, rayon, fournisseur, majLe',
      equipements: 'id, nom, type, ordre',
      releves: 'id, equipementId, jour, date, [equipementId+jour], [jour+moment]',
      receptions: 'id, jour, date, fournisseur',
      lots: 'id, produitId, ean, dlc, statut, [statut+dlc]',
      taches: 'id, frequence, ordre',
      nettoyages: 'id, tacheId, date, periode, [tacheId+periode]',
      operateurs: 'id, nom',
      reglages: 'cle',
    })
  }
}

export const db = new HaccpDb()

export const uid = (): string => crypto.randomUUID()

export async function getReglage(cle: string, defaut = ''): Promise<string> {
  const r = await db.reglages.get(cle)
  return r?.valeur ?? defaut
}

export async function setReglage(cle: string, valeur: string): Promise<void> {
  await db.reglages.put({ cle, valeur })
}
