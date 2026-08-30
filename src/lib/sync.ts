import { db, pendantApplicationDuServeur, TABLES_SYNCHRONISEES, type TableSynchronisee } from '../db/db'
import { supabase } from './supabase'

/**
 * Synchronisation entre la base locale et Supabase.
 *
 * Règle du jeu : on envoie d'abord ce qu'on a de nouveau, on récupère ensuite ce
 * que les autres ont fait. Dans cet ordre, une modification locale non encore
 * envoyée ne peut pas être écrasée par la version du serveur.
 *
 * En cas de conflit réel sur une même fiche, la modification la plus récente
 * l'emporte — c'est l'horloge du serveur qui tranche, pas celle du téléphone.
 */

/** La clé primaire n'est pas la même partout. */
const CLE_PRIMAIRE: Record<TableSynchronisee, string> = {
  produits: 'id', equipements: 'id', releves: 'id', receptions: 'id', lots: 'id',
  taches: 'id', nettoyages: 'id', operateurs: 'id', reglages: 'cle',
  clients: 'id', commandes: 'id', lignesCommande: 'id',
}

/**
 * Postgres n'aime pas le camelCase : une table « lignesCommande » devrait être
 * citée entre guillemets partout. Elle s'appelle donc « lignes_commande » côté
 * serveur, et seule cette correspondance le sait.
 */
const TABLE_DISTANTE: Partial<Record<TableSynchronisee, string>> = {
  lignesCommande: 'lignes_commande',
}

const distante = (nom: TableSynchronisee): string => TABLE_DISTANTE[nom] ?? nom

/** Les curseurs sont propres à chaque appareil : ils ne se synchronisent pas. */
const cleCurseur = (table: string) => `epicerie-curseur-${table}`

const litCurseur = (table: string): string => {
  try {
    return localStorage.getItem(cleCurseur(table)) ?? '1970-01-01T00:00:00Z'
  } catch {
    return '1970-01-01T00:00:00Z'
  }
}

const ecritCurseur = (table: string, valeur: string): void => {
  try {
    localStorage.setItem(cleCurseur(table), valeur)
  } catch {
    // stockage indisponible : on refera un échange complet, sans dommage
  }
}

const versSnake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
const versCamel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())

/** Champs purement locaux : ils n'ont rien à faire sur le serveur. */
const LOCAUX = new Set(['aSynchroniser'])

function versServeur(ligne: Record<string, unknown>): Record<string, unknown> {
  const sortie: Record<string, unknown> = {}
  for (const [cle, valeur] of Object.entries(ligne)) {
    if (LOCAUX.has(cle) || valeur === undefined) continue
    sortie[versSnake(cle)] = valeur
  }
  return sortie
}

function versLocal(ligne: Record<string, unknown>): Record<string, unknown> {
  const sortie: Record<string, unknown> = {}
  for (const [cle, valeur] of Object.entries(ligne)) {
    if (cle === 'supprime') continue
    sortie[versCamel(cle)] = valeur
  }
  sortie.aSynchroniser = 0
  return sortie
}

export interface Resultat {
  envoyees: number
  recues: number
  supprimees: number
}

let enCours = false

/* ------------------------------------------------------------------ envoi */

async function envoie(): Promise<number> {
  let total = 0

  for (const nom of TABLES_SYNCHRONISEES) {
    const table = db.table(nom)
    const aEnvoyer = await table.where('aSynchroniser').equals(1).toArray()
    if (!aEnvoyer.length) continue

    const { error } = await supabase
      .from(distante(nom))
      .upsert(aEnvoyer.map((l) => versServeur(l as Record<string, unknown>)), {
        onConflict: CLE_PRIMAIRE[nom],
      })
    if (error) throw new Error(`envoi ${nom} : ${error.message}`)

    // Le drapeau ne tombe qu'après confirmation du serveur : une coupure de
    // réseau en plein envoi fait au pire un renvoi, jamais une perte.
    const cle = CLE_PRIMAIRE[nom]
    await db.transaction('rw', table, async () => {
      for (const ligne of aEnvoyer) {
        await table.update((ligne as Record<string, unknown>)[cle] as string, { aSynchroniser: 0 })
      }
    })
    total += aEnvoyer.length
  }

  return total
}

async function envoieLesSuppressions(): Promise<number> {
  const pierres = await db.suppressions.toArray()
  let total = 0

  for (const pierre of pierres) {
    const nom = pierre.table as TableSynchronisee
    if (!TABLES_SYNCHRONISEES.includes(nom)) {
      await db.suppressions.delete(pierre.id)
      continue
    }
    // On met à jour sans insérer : si la ligne n'a jamais atteint le serveur,
    // il n'y a rien à effacer et rien à créer.
    const { error } = await supabase
      .from(distante(nom))
      .update({ supprime: true })
      .eq(CLE_PRIMAIRE[nom], pierre.id)
    if (error) throw new Error(`suppression ${nom} : ${error.message}`)
    await db.suppressions.delete(pierre.id)
    total += 1
  }

  return total
}

/* ---------------------------------------------------------------- réception */

async function recoit(): Promise<number> {
  let total = 0

  for (const nom of TABLES_SYNCHRONISEES) {
    const depuis = litCurseur(nom)
    const { data, error } = await supabase
      .from(distante(nom))
      .select('*')
      .gt('maj_le', depuis)
      .order('maj_le', { ascending: true })
      .limit(1000)
    if (error) throw new Error(`réception ${nom} : ${error.message}`)
    if (!data?.length) continue

    const table = db.table(nom)
    const cle = CLE_PRIMAIRE[nom]

    await pendantApplicationDuServeur(async () => {
      await db.transaction('rw', table, async () => {
        for (const ligneDistante of data as Array<Record<string, unknown>>) {
          const identifiant = ligneDistante[cle] as string
          if (ligneDistante.supprime === true) {
            await table.delete(identifiant)
            continue
          }
          const locale = await table.get(identifiant) as Record<string, unknown> | undefined
          // Une modification locale pas encore partie est plus récente que ce
          // que le serveur connaît : on la garde, elle partira au prochain envoi.
          if (locale?.aSynchroniser === 1) continue
          await table.put(versLocal(ligneDistante))
        }
      })
    })

    const dernier = (data[data.length - 1] as Record<string, unknown>).maj_le as string
    ecritCurseur(nom, dernier)
    total += data.length
  }

  return total
}

/* ------------------------------------------------------------------ pilote */

export async function synchronise(): Promise<Resultat> {
  if (enCours || !navigator.onLine) return { envoyees: 0, recues: 0, supprimees: 0 }
  const { data } = await supabase.auth.getSession()
  if (!data.session) return { envoyees: 0, recues: 0, supprimees: 0 }

  enCours = true
  try {
    const supprimees = await envoieLesSuppressions()
    const envoyees = await envoie()
    const recues = await recoit()
    return { envoyees, recues, supprimees }
  } finally {
    enCours = false
  }
}

/** Nombre de lignes qui attendent d'être envoyées. */
export async function resteAEnvoyer(): Promise<number> {
  let total = await db.suppressions.count()
  for (const nom of TABLES_SYNCHRONISEES) {
    total += await db.table(nom).where('aSynchroniser').equals(1).count()
  }
  return total
}

/**
 * Écoute permanente : le retour du réseau, les changements venus des autres
 * appareils, et un filet de sécurité toutes les deux minutes si jamais la
 * connexion temps réel tombe sans prévenir.
 */
export function demarreLaSynchronisation(
  surEtat?: (etat: { enCours: boolean; erreur: string }) => void,
): () => void {
  let vivant = true
  let minuteur: number | undefined

  const lance = async () => {
    if (!vivant) return
    surEtat?.({ enCours: true, erreur: '' })
    try {
      await synchronise()
      surEtat?.({ enCours: false, erreur: '' })
    } catch (e) {
      surEtat?.({ enCours: false, erreur: (e as Error).message })
    }
  }

  // Un changement distant en déclenche souvent plusieurs d'affilée : on attend
  // que ça se calme plutôt que de relancer un échange par ligne modifiée.
  const lanceBientot = () => {
    window.clearTimeout(minuteur)
    minuteur = window.setTimeout(() => void lance(), 600)
  }

  void lance()

  const canal = supabase.channel('epicerie-changements')
  for (const nom of TABLES_SYNCHRONISEES) {
    canal.on('postgres_changes', { event: '*', schema: 'public', table: distante(nom) }, lanceBientot)
  }
  canal.subscribe()

  const surReseau = () => void lance()
  window.addEventListener('online', surReseau)
  const battement = window.setInterval(() => void lance(), 120_000)

  return () => {
    vivant = false
    window.clearTimeout(minuteur)
    window.clearInterval(battement)
    window.removeEventListener('online', surReseau)
    void supabase.removeChannel(canal)
  }
}
