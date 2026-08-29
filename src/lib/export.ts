import type { Lot, Produit, Reception, Releve } from '../db/types'
import { dateFr, dateHeureFr, jourDe, marge } from './format'

/** Excel francais attend le point-virgule et la virgule decimale. */
const SEP = ';'

const cellule = (v: unknown): string => {
  if (v == null) return ''
  const s = typeof v === 'number' ? String(v).replace('.', ',') : String(v)
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function versCsv(entetes: string[], lignes: unknown[][]): string {
  const corps = [entetes, ...lignes].map((l) => l.map(cellule).join(SEP)).join('\r\n')
  return `﻿${corps}` // BOM : sans lui Excel casse les accents
}

export function telecharge(nomFichier: string, contenu: BlobPart, type: string): void {
  const url = URL.createObjectURL(new Blob([contenu], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = nomFichier
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const csv = (nom: string, entetes: string[], lignes: unknown[][]) =>
  telecharge(`${nom}-${jourDe()}.csv`, versCsv(entetes, lignes), 'text/csv;charset=utf-8')

export function exporteCatalogueCsv(produits: Produit[]): void {
  csv('catalogue', [
    'Code-barres', 'Désignation', 'Marque', 'Contenance', 'Rayon', 'Fournisseur',
    'Prix achat HT', 'Prix vente TTC', 'TVA %', 'Marge EUR', 'Marge %',
    'Stock', 'Valeur stock', 'Allergènes', 'Nutri-Score', 'Modifié le',
  ], produits.map((p) => {
    const m = marge(p.prixAchat, p.prixVente, p.tva)
    return [
      p.ean, p.nom, p.marque, p.contenance, p.rayon, p.fournisseur,
      p.prixAchat, p.prixVente, p.tva,
      m ? Number(m.euros.toFixed(2)) : '', m ? Number(m.pourcent.toFixed(1)) : '',
      p.stock, Number((p.stock * (p.prixAchat ?? 0)).toFixed(2)),
      p.allergenes, p.nutriscore, dateHeureFr(p.majLe),
    ]
  }))
}

export function exporteTemperaturesCsv(
  releves: Releve[],
  nomEquipement: (id: string) => string,
): void {
  csv('temperatures', ['Date', 'Équipement', 'Moment', 'Température', 'Conforme', 'Action corrective', 'Relevé par'],
    releves.map((r) => [
      dateHeureFr(r.date), nomEquipement(r.equipementId), r.moment,
      r.temp, r.conforme ? 'Oui' : 'Non', r.actionCorrective, r.operateur,
    ]))
}

export function exporteReceptionsCsv(receptions: Reception[]): void {
  csv('receptions', ['Date', 'Fournisseur', 'Bon de livraison', 'Température', 'Emballages', 'DLC', 'Conforme', 'Motif', 'Contrôle par'],
    receptions.map((r) => [
      dateHeureFr(r.date), r.fournisseur, r.bonLivraison, r.tempProduit,
      r.emballageOk ? 'Conformes' : 'Non conformes', r.dlcOk ? 'Conformes' : 'Non conformes',
      r.conforme ? 'Acceptée' : 'Refusée', r.motif, r.operateur,
    ]))
}

export function exporteLotsCsv(lots: Lot[], nomProduit: (id: string) => string): void {
  csv('dlc', ['Produit', 'Code-barres', 'Lot', 'DLC', 'Quantité', 'Statut', 'Saisi par', 'Retiré le'],
    lots.map((l) => [
      nomProduit(l.produitId), l.ean, l.numeroLot, dateFr(l.dlc),
      l.quantite, l.statut, l.operateur, l.retireLe ? dateHeureFr(l.retireLe) : '',
    ]))
}

/** Sauvegarde complete : sert de filet de sécurité avant la synchro Supabase. */
export function exporteSauvegarde(donnees: Record<string, unknown[]>): void {
  telecharge(
    `sauvegarde-haccp-${jourDe()}.json`,
    JSON.stringify({ version: 1, exporteLe: new Date().toISOString(), donnees }, null, 2),
    'application/json',
  )
}
