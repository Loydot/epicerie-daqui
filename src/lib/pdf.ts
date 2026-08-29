import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import JsBarcode from 'jsbarcode'
import type { Lot, Nettoyage, Produit, Reception, Releve, Tache } from '../db/types'
import { dateFr, dateHeureFr, euro, jourDe, marge, nombre } from './format'

const MARGE = 14
const GRIS: [number, number, number] = [92, 102, 117]
const ACCENT: [number, number, number] = [15, 111, 212]

/** En-tete commun a tous les documents : identifie l'etablissement pour un contrôle. */
function entete(doc: jsPDF, titre: string, magasin: string, sousTitre = ''): number {
  doc.setFillColor(...ACCENT)
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 3, 'F')

  doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(20, 24, 32)
  doc.text(titre, MARGE, 20)

  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...GRIS)
  doc.text(magasin || 'Établissement', MARGE, 27)
  if (sousTitre) doc.text(sousTitre, MARGE, 33)

  doc.setFontSize(8)
  doc.text(
    `Édité le ${dateHeureFr(new Date().toISOString())}`,
    doc.internal.pageSize.getWidth() - MARGE, 20, { align: 'right' },
  )
  return sousTitre ? 40 : 34
}

function piedDePage(doc: jsPDF): void {
  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...GRIS)
    doc.text(
      `Page ${i} / ${total}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'center' },
    )
  }
}

const styleTable = {
  theme: 'grid' as const,
  headStyles: { fillColor: [238, 241, 245] as [number, number, number], textColor: 40, fontStyle: 'bold' as const, fontSize: 8.5 },
  bodyStyles: { fontSize: 8.5, textColor: 30 },
  alternateRowStyles: { fillColor: [250, 251, 253] as [number, number, number] },
  margin: { left: MARGE, right: MARGE },
}

/** Code-barres EAN en PNG, ou null si le code n'est pas encodable. */
function codeBarresPng(ean: string, largeur = 2, hauteur = 40): string | null {
  try {
    const canvas = document.createElement('canvas')
    JsBarcode(canvas, ean, {
      format: ean.length === 8 ? 'EAN8' : 'EAN13',
      width: largeur, height: hauteur, fontSize: 14, margin: 4, displayValue: true,
    })
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

/* ------------------------- Fiche produit ------------------------- */

export function ficheProduitPdf(p: Produit, magasin: string): void {
  const doc = new jsPDF()
  let y = entete(doc, p.nom || 'Fiche produit', magasin, [p.marque, p.contenance].filter(Boolean).join(' · '))

  const png = codeBarresPng(p.ean)
  if (png) doc.addImage(png, 'PNG', doc.internal.pageSize.getWidth() - MARGE - 46, y - 12, 46, 22)

  const m = marge(p.prixAchat, p.prixVente, p.tva)
  autoTable(doc, {
    ...styleTable,
    startY: y + 16,
    head: [['Caractéristique', 'Valeur']],
    columnStyles: { 0: { cellWidth: 55, fontStyle: 'bold' } },
    body: [
      ['Code-barres', p.ean],
      ['Désignation', p.nom],
      ['Marque', p.marque || '—'],
      ['Contenance', p.contenance || '—'],
      ['Rayon', p.rayon || '—'],
      ['Fournisseur', p.fournisseur || '—'],
      ['Prix d\'achat HT', euro(p.prixAchat)],
      ['Prix de vente TTC', euro(p.prixVente)],
      ['TVA', `${p.tva} %`],
      ['Marge unitaire', m ? `${euro(m.euros)}  (${nombre(m.pourcent, 1)} %)` : '—'],
      ['Stock', `${p.stock} unité(s)`],
      ['Valeur du stock', euro(p.stock * (p.prixAchat ?? 0))],
      ['Allergènes', p.allergenes || 'Non renseignés'],
      ['Nutri-Score', p.nutriscore || '—'],
      ['Fiche créée le', dateHeureFr(p.creeLe)],
      ['Dernière modification', dateHeureFr(p.majLe)],
    ],
  })

  if (p.note) {
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(20)
    doc.text('Notes', MARGE, y)
    doc.setFont('helvetica', 'normal').setTextColor(...GRIS)
    doc.text(doc.splitTextToSize(p.note, 180), MARGE, y + 6)
  }

  piedDePage(doc)
  doc.save(`fiche-${p.ean || p.id}.pdf`)
}

/* ------------------------- Étiquettes de rayon ------------------------- */

/** Planche A4 de 3 x 8 étiquettes prix, a découper. */
export function etiquettesPdf(produits: Produit[], magasin: string): void {
  const doc = new jsPDF()
  const COLS = 3
  const RANGS = 8
  const L = (210 - MARGE * 2) / COLS
  const H = (297 - 22 - 10) / RANGS

  produits.forEach((p, i) => {
    const surPage = i % (COLS * RANGS)
    if (i > 0 && surPage === 0) doc.addPage()
    if (surPage === 0) {
      doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...GRIS)
      doc.text(`${magasin || 'Etiquettes'} — ${dateFr(jourDe())}`, MARGE, 12)
    }

    const x = MARGE + (surPage % COLS) * L
    const y = 22 + Math.floor(surPage / COLS) * H

    doc.setDrawColor(215, 220, 228).setLineWidth(0.2)
    doc.rect(x, y, L - 2, H - 2)

    doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(20)
    doc.text(doc.splitTextToSize(p.nom, L - 8).slice(0, 2), x + 4, y + 7)

    doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(...GRIS)
    doc.text([p.marque, p.contenance].filter(Boolean).join(' · ').slice(0, 30), x + 4, y + 16)

    doc.setFont('helvetica', 'bold').setFontSize(17).setTextColor(...ACCENT)
    doc.text(euro(p.prixVente), x + 4, y + 26)

    const png = codeBarresPng(p.ean, 1.4, 26)
    if (png) doc.addImage(png, 'PNG', x + 4, y + 28, L - 12, 11)
  })

  doc.save(`etiquettes-${jourDe()}.pdf`)
}

/* ------------------------- Registres HACCP ------------------------- */

export interface DonneesRegistre {
  magasin: string
  du: string
  au: string
  releves: Releve[]
  nomEquipement: (id: string) => string
  receptions: Reception[]
  lots: Lot[]
  nomProduit: (id: string) => string
  nettoyages: Nettoyage[]
  taches: Tache[]
}

export function registrePdf(d: DonneesRegistre): void {
  const doc = new jsPDF()
  const periode = `Période du ${dateFr(d.du)} au ${dateFr(d.au)}`
  const y = entete(doc, 'Registre HACCP', d.magasin, periode)

  const section = (titre: string, tete: string[], corps: unknown[][], premiere = false) => {
    const depart = premiere
      ? y + 8
      : (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable!.finalY + 14
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(20)
    doc.text(titre, MARGE, depart - 4)
    autoTable(doc, {
      ...styleTable,
      startY: depart,
      head: [tete],
      body: corps.length ? (corps as string[][]) : [[{ content: 'Aucun enregistrement sur la période', colSpan: tete.length, styles: { textColor: GRIS, halign: 'center' } } as never]],
    })
  }

  section('1. Relevés de température', ['Date', 'Équipement', 'Moment', 'Temp.', 'Conforme', 'Action corrective', 'Par'],
    d.releves.map((r) => [
      dateHeureFr(r.date), d.nomEquipement(r.equipementId), r.moment,
      `${r.temp} °C`, r.conforme ? 'Oui' : 'NON', r.actionCorrective || '—', r.operateur || '—',
    ]), true)

  section('2. Contrôles à réception', ['Date', 'Fournisseur', 'BL', 'Temp.', 'Emball.', 'DLC', 'Decision', 'Par'],
    d.receptions.map((r) => [
      dateHeureFr(r.date), r.fournisseur, r.bonLivraison || '—',
      r.tempProduit == null ? '—' : `${r.tempProduit} °C`,
      r.emballageOk ? 'OK' : 'NON', r.dlcOk ? 'OK' : 'NON',
      r.conforme ? 'Acceptée' : `Refusée : ${r.motif || 'non precise'}`, r.operateur || '—',
    ]))

  section('3. Suivi des dates limites et retraits', ['Produit', 'Lot', 'DLC', 'Qte', 'Statut', 'Retiré le', 'Par'],
    d.lots.map((l) => [
      d.nomProduit(l.produitId), l.numeroLot || '—', dateFr(l.dlc), String(l.quantite),
      l.statut === 'retire' ? 'Retiré de la vente' : l.statut === 'vendu' ? 'Vendu' : 'En stock',
      l.retireLe ? dateHeureFr(l.retireLe) : '—', l.operateur || '—',
    ]))

  const nomTache = (id: string) => d.taches.find((t) => t.id === id)?.nom ?? 'Tâche supprimée'
  section('4. Plan de nettoyage et de désinfection', ['Date', 'Tâche', 'Période', 'Commentaire', 'Par'],
    d.nettoyages.map((n) => [
      dateHeureFr(n.date), nomTache(n.tacheId), n.periode, n.commentaire || '—', n.operateur || '—',
    ]))

  const fin = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...GRIS)
  doc.text(
    doc.splitTextToSize(
      "Document généré automatiquement à partir des saisies horodatées de l'application. "
      + "Il constitue le support des autocontroles prévus par le Plan de Maîtrise Sanitaire.",
      182,
    ),
    MARGE, fin,
  )

  piedDePage(doc)
  doc.save(`registre-haccp-${d.du}_${d.au}.pdf`)
}
