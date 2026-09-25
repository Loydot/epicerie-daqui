import type { Equipement } from '../db/types'

/** Numéro de jour JS (0 = dimanche), dans l'ordre d'une semaine française. */
export const JOURS_SEMAINE: Array<[number, string]> = [
  [1, 'Lun'], [2, 'Mar'], [3, 'Mer'], [4, 'Jeu'], [5, 'Ven'], [6, 'Sam'], [0, 'Dim'],
]

const elements = (s: string | undefined): string[] =>
  (s ?? '').split(',').map((x) => x.trim()).filter(Boolean)

/** Jours d'ouverture du calendrier ; les sept jours quand rien n'est limité. */
export function joursOuverts(eq: Pick<Equipement, 'joursOuverture'>): number[] {
  const liste = elements(eq.joursOuverture).map(Number).filter((n) => n >= 0 && n <= 6)
  return liste.length ? liste : [0, 1, 2, 3, 4, 5, 6]
}

/** Le calendrier limite-t-il l'ouverture ? */
export const aUnCalendrier = (eq: Pick<Equipement, 'joursOuverture'>): boolean =>
  joursOuverts(eq).length < 7

/** Sérialise des jours cochés : les sept jours se stockent comme « vide ». */
export const versJoursOuverture = (jours: number[]): string =>
  jours.length >= 7 ? '' : [...jours].sort((a, b) => a - b).join(',')

const jourDeSemaine = (jour: string): number => new Date(`${jour}T12:00:00`).getDay()

/** Ce que dit le calendrier seul, sans les exceptions. */
const eteintParCalendrier = (eq: Pick<Equipement, 'joursOuverture'>, jour: string): boolean =>
  !joursOuverts(eq).includes(jourDeSemaine(jour))

/** L'équipement est-il éteint ce jour-là (aucun relevé attendu) ? */
export function estEteint(eq: Pick<Equipement, 'joursOuverture' | 'exceptions'>, jour: string): boolean {
  const exceptions = elements(eq.exceptions)
  if (exceptions.includes(`+${jour}`)) return false
  if (exceptions.includes(`-${jour}`)) return true
  return eteintParCalendrier(eq, jour)
}

/**
 * Inverse l'état d'un jour. On ne garde une exception que si elle diffère du
 * calendrier : remettre un jour « normal » efface la trace au lieu de l'empiler.
 */
export function exceptionsApresBascule(eq: Pick<Equipement, 'joursOuverture' | 'exceptions'>, jour: string): string {
  const veutEteint = !estEteint(eq, jour)
  const autres = elements(eq.exceptions).filter((e) => e.slice(1) !== jour)
  if (veutEteint !== eteintParCalendrier(eq, jour)) autres.push(`${veutEteint ? '-' : '+'}${jour}`)
  return autres.sort().join(',')
}

/** Jours explicitement éteints par une exception, dans une période AAAA-MM-JJ. */
export function joursEteintsManuels(eq: Pick<Equipement, 'exceptions'>, du: string, au: string): string[] {
  return elements(eq.exceptions)
    .filter((e) => e.startsWith('-'))
    .map((e) => e.slice(1))
    .filter((j) => j >= du && j <= au)
    .sort()
}

/** « lun., jeu. » : lisible dans le registre. */
export function libelleOuverture(eq: Pick<Equipement, 'joursOuverture'>): string {
  const ouverts = joursOuverts(eq)
  return JOURS_SEMAINE.filter(([n]) => ouverts.includes(n)).map(([, l]) => l.toLowerCase() + '.').join(', ')
}
