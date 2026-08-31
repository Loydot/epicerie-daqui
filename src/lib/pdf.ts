import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import JsBarcode from 'jsbarcode'
import type { Lot, Nettoyage, Produit, Reception, Releve, Tache } from '../db/types'
import { dateFr, dateHeureFr, euro, jourDe, marge, nombre } from './format'
import { nomSection } from './sections'
import { logoPourPdf, RAPPORT } from './logo'
import type { Commande, LigneCommande } from '../db/types'
import { motRemise, nomStatut, totalLignes } from './commandes'

const MARGE = 14

/** Hauteurs du logo, en millimètres. Les deux seuls nombres à toucher pour le redimensionner. */
const LOGO_ENTETE = 54
const LOGO_ETIQUETTE = 15
const GRIS: [number, number, number] = [92, 102, 117]
const ACCENT: [number, number, number] = [15, 111, 212]

/** En-tete commun a tous les documents : identifie l'etablissement pour un contrôle. */
function entete(doc: jsPDF, titre: string, magasin: string, sousTitre = '', logo?: string | null): number {
  doc.setFillColor(...ACCENT)
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 3, 'F')

  // Le logo pousse le texte vers la droite quand il est présent.
  let x = MARGE
  let bas = 0
  if (logo) {
    const h = LOGO_ENTETE
    doc.addImage(logo, 'JPEG', MARGE, 9, h * RAPPORT, h)
    x = MARGE + h * RAPPORT + 8
    bas = 9 + h + 8
  }

  doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(20, 24, 32)
  doc.text(titre, x, 20)

  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...GRIS)
  doc.text(magasin || 'Établissement', x, 27)
  if (sousTitre) doc.text(sousTitre, x, 33)

  doc.setFontSize(8)
  doc.text(
    `Édité le ${dateHeureFr(new Date().toISOString())}`,
    doc.internal.pageSize.getWidth() - MARGE, 20, { align: 'right' },
  )
  // Le contenu commence sous le plus bas des deux : le texte ou le logo.
  return Math.max(sousTitre ? 40 : 34, bas)
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

export async function ficheProduitPdf(p: Produit, magasin: string): Promise<void> {
  const doc = new jsPDF()
  const logo = await logoPourPdf()
  let y = entete(doc, p.nom || 'Fiche produit', magasin, [p.marque, p.contenance].filter(Boolean).join(' · '), logo)

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
      ['Rayon', nomSection(p.section)],
      ['Catégorie', p.rayon || '—'],
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
export async function etiquettesPdf(produits: Produit[], magasin: string): Promise<void> {
  const doc = new jsPDF()
  const logo = await logoPourPdf()
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

    // Le logo passe de 5 à 15 mm : il ne tient plus dans un coin, la mise en
    // page s'organise donc autour de lui. Tout reste dans les 31 mm utiles.
    const colonne = logo ? x + 4 + LOGO_ETIQUETTE * RAPPORT + 4 : x + 4
    if (logo) {
      doc.addImage(logo, 'JPEG', x + 4, y + 2.5, LOGO_ETIQUETTE * RAPPORT, LOGO_ETIQUETTE)
    }

    doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(20)
    doc.text(
      doc.splitTextToSize(p.nom, x + L - 6 - colonne).slice(0, 3),
      colonne, y + 6,
    )

    doc.setFont('helvetica', 'normal').setFontSize(6.5).setTextColor(...GRIS)
    doc.text(
      [p.marque, p.contenance].filter(Boolean).join(' · ').slice(0, 26),
      colonne, y + 16.5,
    )

    doc.setFont('helvetica', 'bold').setFontSize(15).setTextColor(...ACCENT)
    doc.text(euro(p.prixVente), x + 4, y + 25.5)

    const png = codeBarresPng(p.ean, 1.4, 26)
    if (png) doc.addImage(png, 'PNG', x + L / 2, y + 19.5, L / 2 - 6, 8)
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

export async function registrePdf(d: DonneesRegistre): Promise<void> {
  const doc = new jsPDF()
  const logo = await logoPourPdf()
  const periode = `Période du ${dateFr(d.du)} au ${dateFr(d.au)}`
  const y = entete(doc, 'Registre HACCP', d.magasin, periode, logo)

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

/* ------------------------- Bon de commande ------------------------- */

export interface DonneesBon {
  magasin: string
  client: { nom: string; telephone: string; adresse: string }
  commande: Commande
  lignes: LigneCommande[]
}

/**
 * Le bon que l'on garde au magasin et que l'on remet au client.
 *
 * Il porte les prix connus au moment de la prise de commande : si un tarif change
 * ensuite, le bon déjà imprimé reste cohérent avec ce qui a été annoncé au téléphone.
 */
export async function bonDeCommandePdf(d: DonneesBon): Promise<void> {
  const doc = new jsPDF()
  const logo = await logoPourPdf()
  const y = entete(
    doc, 'Bon de commande', d.magasin,
    `Commande du ${dateFr(d.commande.date.slice(0, 10))}`, logo,
  )

  const mots = motRemise(d.commande.mode)
  const livraison = d.commande.mode === 'livraison'

  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(20)
  doc.text(d.client.nom || 'Client', MARGE, y + 8)
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...GRIS)
  if (d.client.telephone) doc.text(d.client.telephone, MARGE, y + 14)

  // L'adresse ne figure que sur une livraison : sur un retrait elle n'a rien à faire là.
  let basGauche = y + 14
  if (livraison && d.client.adresse) {
    const lignesAdresse = doc.splitTextToSize(d.client.adresse, 90)
    doc.text(lignesAdresse, MARGE, y + 21)
    basGauche = y + 21 + (lignesAdresse.length - 1) * 5
  }

  const droite = doc.internal.pageSize.getWidth() - MARGE
  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...ACCENT)
  doc.text(livraison ? 'À LIVRER' : 'À RETIRER SUR PLACE', droite, y + 8, { align: 'right' })
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...GRIS)
  doc.text(`État : ${nomStatut(d.commande.statut, d.commande.mode)}`, droite, y + 14, { align: 'right' })
  if (d.commande.dateRetrait) {
    doc.text(`${mots.date} : ${dateFr(d.commande.dateRetrait)}`, droite, y + 20, { align: 'right' })
  }

  const total = totalLignes(d.lignes)
  autoTable(doc, {
    ...styleTable,
    startY: Math.max(basGauche, y + 20) + 10,
    head: [['Article', 'Qté', 'Prix unitaire', 'Total']],
    columnStyles: {
      1: { cellWidth: 18, halign: 'right' },
      2: { cellWidth: 30, halign: 'right' },
      3: { cellWidth: 30, halign: 'right' },
    },
    body: d.lignes.map((l) => [
      l.libelle,
      nombre(l.quantite),
      l.prixUnitaire == null ? 'à définir' : euro(l.prixUnitaire),
      l.prixUnitaire == null ? '—' : euro(l.quantite * l.prixUnitaire),
    ]),
    foot: [['Total', '', '', euro(total)]],
    footStyles: { fillColor: [238, 241, 245], textColor: 20, fontStyle: 'bold', halign: 'right' },
  })

  let fin = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12

  const sansPrix = d.lignes.filter((l) => l.prixUnitaire == null).length
  if (sansPrix > 0) {
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...GRIS)
    doc.text(
      `${sansPrix} article(s) sans prix : le total ci-dessus est incomplet.`,
      MARGE, fin,
    )
    fin += 8
  }

  if (d.commande.note) {
    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(20)
    doc.text('Note', MARGE, fin)
    doc.setFont('helvetica', 'normal').setTextColor(...GRIS)
    doc.text(doc.splitTextToSize(d.commande.note, 180), MARGE, fin + 6)
    fin += 18
  }

  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...GRIS)
  doc.text(
    'Commande prise par téléphone. Prix indicatifs, sous réserve de disponibilité.'
    + (livraison ? " Merci de vérifier l'adresse ci-dessus." : ''),
    MARGE, fin,
  )

  piedDePage(doc)
  doc.save(`bon-${livraison ? 'livraison' : 'commande'}-${(d.client.nom || 'client').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}-${jourDe()}.pdf`)
}
