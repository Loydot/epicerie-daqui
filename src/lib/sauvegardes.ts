import Dexie, { type EntityTable } from 'dexie'
import { db, getReglage, setReglage, TABLES_SYNCHRONISEES, type TableSynchronisee } from '../db/db'
import { exporteSauvegarde } from './export'
import { dateFr, dateHeureFr } from './format'

/**
 * Sauvegardes de l'entreprise.
 *
 * L'export prend TOUTES les tables synchronisées : HACCP, catalogue, clients,
 * commandes, factures et réglages (dont les informations de l'entreprise).
 *
 * Une sauvegarde rouverte n'est jamais versée dans les données en service :
 * elle est rangée à part, dans une base distincte et non synchronisée, et l'on
 * en récupère fiche par fiche ce qui nous intéresse. Rien n'est supprimé.
 */

/** Une sauvegarde par semaine : au-delà, on le rappelle. */
export const RYTHME_JOURS = 7

const CLE_DERNIERE = 'derniereSauvegarde'

export interface Archive {
  id: string
  /** Nom du fichier ouvert. */
  nom: string
  /** Date de l'export, lue dans le fichier. */
  exporteLe: string
  ouvertLe: string
  donnees: Record<string, Array<Record<string, unknown>>>
}

/** Base à part : ce qu'elle contient ne part jamais au serveur. */
class ArchivesDb extends Dexie {
  archives!: EntityTable<Archive, 'id'>
  constructor() {
    super('haccp-sauvegardes-ouvertes')
    this.version(1).stores({ archives: 'id, ouvertLe' })
  }
}

export const archives = new ArchivesDb()

export async function exporteTout(): Promise<number> {
  const donnees: Record<string, unknown[]> = {}
  let total = 0
  for (const t of TABLES_SYNCHRONISEES) {
    donnees[t] = await db.table(t).toArray()
    total += donnees[t].length
  }
  exporteSauvegarde(donnees)
  // Partagé entre appareils : le rappel tombe dès que l'un d'eux a sauvegardé.
  await setReglage(CLE_DERNIERE, new Date().toISOString())
  return total
}

export const derniereSauvegarde = () => getReglage(CLE_DERNIERE)

/** Jours écoulés depuis la dernière sauvegarde ; null si jamais faite. */
export function joursDepuis(iso: string): number | null {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

export async function ouvreFichier(fichier: File): Promise<string> {
  const contenu = JSON.parse(await fichier.text())
  const donnees = contenu?.donnees
  if (!donnees || typeof donnees !== 'object') throw new Error('format')
  const id = crypto.randomUUID()
  await archives.archives.add({
    id, nom: fichier.name, exporteLe: String(contenu.exporteLe ?? ''),
    ouvertLe: new Date().toISOString(), donnees,
  })
  return id
}

/* --------------------------------------------------------- présentation */

export const NOMS_TABLES: Record<TableSynchronisee, string> = {
  produits: 'Catalogue', equipements: 'Équipements', releves: 'Relevés de température',
  receptions: 'Réceptions', lots: 'Dates limites (lots)', taches: 'Tâches de nettoyage',
  nettoyages: 'Nettoyages effectués', operateurs: 'Personnes', reglages: 'Réglages',
  clients: 'Clients', commandes: 'Commandes', lignesCommande: 'Lignes de commande',
  factures: 'Factures', ouvertures: 'À la coupe',
}

const CLE: Partial<Record<TableSynchronisee, string>> = { reglages: 'cle' }
export const cleDe = (table: TableSynchronisee, ligne: Record<string, unknown>) =>
  String(ligne[CLE[table] ?? 'id'] ?? '')

const s = (v: unknown) => (v == null ? '' : String(v))

/** Ce qu'on affiche d'une fiche pour la reconnaître. */
export function decrit(
  table: TableSynchronisee, l: Record<string, unknown>, archive: Archive,
): { titre: string; detail: string } {
  const nomDans = (t: string, id: unknown) =>
    s(archive.donnees[t]?.find((x) => x.id === id)?.nom) || '—'
  switch (table) {
    case 'produits': return { titre: s(l.nom) || s(l.ean), detail: [s(l.marque), s(l.ean)].filter(Boolean).join(' · ') }
    case 'equipements': return { titre: s(l.nom), detail: `${s(l.tempMin)} à ${s(l.tempMax)} °C` }
    case 'releves': return {
      titre: `${nomDans('equipements', l.equipementId)} — ${s(l.temp)} °C`,
      detail: `${dateHeureFr(s(l.date))} · ${s(l.moment)}${l.operateur ? ` · ${s(l.operateur)}` : ''}`,
    }
    case 'receptions': return { titre: s(l.fournisseur) || 'Réception', detail: dateHeureFr(s(l.date)) }
    case 'lots': return { titre: `Lot ${s(l.numeroLot) || '—'} · ${s(l.ean)}`, detail: `DLC ${dateFr(s(l.dlc))}` }
    case 'taches': return { titre: s(l.nom), detail: `${s(l.zone)} · ${s(l.frequence)}` }
    case 'nettoyages': return { titre: nomDans('taches', l.tacheId), detail: dateHeureFr(s(l.date)) }
    case 'operateurs': return { titre: s(l.nom), detail: '' }
    case 'reglages': return { titre: s(l.cle), detail: s(l.valeur).slice(0, 80) }
    case 'clients': return { titre: s(l.nom), detail: s(l.telephone) }
    case 'commandes': return { titre: nomDans('clients', l.clientId), detail: dateHeureFr(s(l.date)) }
    case 'lignesCommande': return { titre: s(l.libelle), detail: `Quantité ${s(l.quantite)}` }
    case 'ouvertures': return { titre: s(l.nom), detail: `${s(l.categorie)} · ouvert le ${dateHeureFr(s(l.ouvertLe))}` }
    case 'factures': return { titre: `N° ${s(l.numero)} — ${s(l.clientNom) || 'client'}`, detail: dateFr(s(l.date)) }
  }
}

/** Remet une fiche en service. Elle repart au serveur comme une saisie normale. */
export async function recupere(table: TableSynchronisee, ligne: Record<string, unknown>): Promise<void> {
  const copie = { ...ligne }
  delete copie.aSynchroniser
  delete copie.majLe
  await db.table(table).put(copie)
}

/** Ne récupère que les fiches absentes aujourd'hui : rien d'existant n'est touché. */
export async function recupereLesManquantes(
  table: TableSynchronisee, lignes: Array<Record<string, unknown>>,
): Promise<number> {
  let n = 0
  for (const l of lignes) {
    if (await db.table(table).get(cleDe(table, l))) continue
    await recupere(table, l)
    n += 1
  }
  return n
}
