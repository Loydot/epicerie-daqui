import Dexie, { type EntityTable, type Table } from 'dexie'
import type {
  Client, Commande, Equipement, LigneCommande, Lot, Nettoyage, Operateur, Produit,
  Reception, Reglage, Releve, Suppression, Tache,
} from './types'

/** Les tables qui font l'objet d'une synchronisation. */
export const TABLES_SYNCHRONISEES = [
  'produits', 'equipements', 'releves', 'receptions', 'lots',
  'taches', 'nettoyages', 'operateurs', 'reglages',
  'clients', 'commandes', 'lignesCommande',
] as const

export type TableSynchronisee = typeof TABLES_SYNCHRONISEES[number]

/**
 * Vrai pendant qu'on écrit ce qui vient du serveur. Les crochets ci-dessous s'en
 * servent pour ne pas renvoyer au serveur ce qu'il vient de nous donner, ni créer
 * une pierre tombale pour une suppression qui vient déjà de lui.
 */
let applicationDuServeur = false

export function pendantApplicationDuServeur<T>(action: () => Promise<T>): Promise<T> {
  applicationDuServeur = true
  return action().finally(() => { applicationDuServeur = false })
}

/**
 * Base locale (IndexedDB). Elle reste la source de vérité pendant la saisie :
 * tout marche hors-ligne dans la réserve, la synchronisation vient par-dessus.
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
  clients!: EntityTable<Client, 'id'>
  commandes!: EntityTable<Commande, 'id'>
  lignesCommande!: EntityTable<LigneCommande, 'id'>
  suppressions!: EntityTable<Suppression, 'id'>

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

    // v2 : file d'attente des fiches scannées hors ligne.
    this.version(2).stores({
      produits: 'id, &ean, nom, marque, rayon, fournisseur, majLe, aEnrichir',
    }).upgrade((tx) => tx.table('produits').toCollection().modify((p) => {
      p.aEnrichir = 0
    }))

    // v3 : synchronisation. "aSynchroniser" marque ce qui reste à envoyer ;
    // "suppressions" garde la trace des effacements, sinon un produit supprimé
    // ici réapparaîtrait au prochain échange avec le serveur.
    this.version(3).stores({
      produits: 'id, &ean, nom, marque, rayon, fournisseur, majLe, aEnrichir, aSynchroniser',
      equipements: 'id, nom, type, ordre, aSynchroniser',
      releves: 'id, equipementId, jour, date, [equipementId+jour], [jour+moment], aSynchroniser',
      receptions: 'id, jour, date, fournisseur, aSynchroniser',
      lots: 'id, produitId, ean, dlc, statut, [statut+dlc], aSynchroniser',
      taches: 'id, frequence, ordre, aSynchroniser',
      nettoyages: 'id, tacheId, date, periode, [tacheId+periode], aSynchroniser',
      operateurs: 'id, nom, aSynchroniser',
      reglages: 'cle, aSynchroniser',
      suppressions: 'id, table',
    }).upgrade(async (tx) => {
      // Tout ce qui existe déjà doit partir au serveur au premier échange.
      for (const nom of TABLES_SYNCHRONISEES) {
        await tx.table(nom).toCollection().modify((ligne: Record<string, unknown>) => {
          ligne.aSynchroniser = 1
          ligne.majLe ??= new Date().toISOString()
        })
      }
    })

    // v4 : rayon du magasin, pour ranger l'inventaire.
    this.version(4).stores({
      produits: 'id, &ean, nom, marque, rayon, section, fournisseur, majLe, aEnrichir, aSynchroniser',
    }).upgrade(async (tx) => {
      const { devineSection } = await import('../lib/sections')
      await tx.table('produits').toCollection().modify((p: Record<string, unknown>) => {
        // Les fiches déjà saisies héritent d'une proposition, corrigeable ensuite.
        p.section ??= devineSection(p.rayon as string, p.nom as string)
      })
    })

    // v5 : commandes clients prises au téléphone.
    this.version(5).stores({
      clients: 'id, nom, telephone, aSynchroniser',
      commandes: 'id, clientId, statut, date, dateRetrait, aSynchroniser',
      lignesCommande: 'id, commandeId, produitId, aSynchroniser',
    })

    this.brancheLesCrochets()
  }

  /**
   * Marquer les écritures à la main dans chaque page serait une source d'oublis
   * silencieux : une modification non marquée ne partirait jamais. Les crochets
   * de Dexie couvrent toutes les écritures, d'où qu'elles viennent.
   */
  private brancheLesCrochets(): void {
    for (const nom of TABLES_SYNCHRONISEES) {
      // Dexie ne sait pas typer les crochets sur une table obtenue par son nom.
      const table = this.table(nom) as unknown as Table<Record<string, unknown>, string>

      table.hook('creating', (_cle, objet) => {
        if (applicationDuServeur) return
        objet.aSynchroniser = 1
        objet.majLe ??= new Date().toISOString()
      })

      table.hook('updating', (modifs) => {
        if (applicationDuServeur) return undefined
        // Une écriture qui ne fait que retirer le drapeau ne doit pas le remettre.
        if (Object.keys(modifs).every((c) => c === 'aSynchroniser')) return undefined
        return { ...modifs, aSynchroniser: 1, majLe: new Date().toISOString() }
      })

      table.hook('deleting', (cle) => {
        if (applicationDuServeur) return
        void this.suppressions.put({
          id: String(cle), table: nom, le: new Date().toISOString(),
        })
      })
    }
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
