export const euro = (v: number | null | undefined): string =>
  v == null ? '—' : v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })

export const nombre = (v: number, dec = 0): string =>
  v.toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec })

/** Cle jour locale AAAA-MM-JJ (surtout pas toISOString, qui bascule en UTC). */
export function jourDe(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export const aujourdhui = (): string => jourDe()

/** Numero de semaine ISO, ex. 2026-S09. */
export function semaineDe(d: Date = new Date()): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7))
  const debut = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  const n = Math.ceil(((t.getTime() - debut.getTime()) / 86400000 + 1) / 7)
  return `${t.getUTCFullYear()}-S${String(n).padStart(2, '0')}`
}

/** Mois AAAA-MM. */
export function moisDe(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function dateFr(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR')
}

export function dateHeureFr(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** Nombre de jours entiers entre aujourd'hui et une date AAAA-MM-JJ. Negatif = depasse. */
export function joursRestants(dlc: string): number {
  if (!dlc) return Number.POSITIVE_INFINITY
  const cible = new Date(`${dlc}T12:00:00`).getTime()
  const now = new Date()
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12).getTime()
  return Math.round((cible - base) / 86400000)
}

/** Marge en euros et en % sur le prix de vente TTC. */
export function marge(prixAchat: number | null, prixVente: number | null, tva: number) {
  if (prixAchat == null || prixVente == null || prixVente <= 0) return null
  const venteHt = prixVente / (1 + tva / 100)
  const euros = venteHt - prixAchat
  return { euros, pourcent: (euros / venteHt) * 100 }
}

/** Cle de recherche sans accents ni casse. */
export const normalise = (s: string): string =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()

/** Verifie la cle de controle d'un EAN-8 / EAN-13 / UPC-A. */
export function eanValide(code: string): boolean {
  if (!/^\d{8}$|^\d{12,13}$/.test(code)) return false
  const chiffres = code.split('').map(Number)
  const cle = chiffres.pop()!
  const somme = chiffres
    .reverse()
    .reduce((acc, n, i) => acc + n * (i % 2 === 0 ? 3 : 1), 0)
  return (10 - (somme % 10)) % 10 === cle
}
