/** Identifiant local : uuid v4, stable entre appareils une fois la synchro branchée. */
export type Id = string

export type Source = 'openfoodfacts' | 'manuel' | 'import'

export interface Produit {
  id: Id
  ean: string
  nom: string
  marque: string
  contenance: string
  rayon: string
  photoUrl: string
  /** Prix d'achat HT, en euros. */
  prixAchat: number | null
  /** Prix de vente TTC, en euros. */
  prixVente: number | null
  /** Taux de TVA en %, 5.5 par defaut pour l'alimentaire. */
  tva: number
  stock: number
  seuilAlerte: number | null
  fournisseur: string
  allergenes: string
  nutriscore: string
  source: Source
  note: string
  creeLe: string
  majLe: string
}

export type TypeEquipement = 'frigo' | 'congelateur' | 'vitrine' | 'reserve'

export interface Equipement {
  id: Id
  nom: string
  type: TypeEquipement
  tempMin: number
  tempMax: number
  actif: number
  ordre: number
}

export type Moment = 'matin' | 'soir'

export interface Releve {
  id: Id
  equipementId: Id
  /** Temperature en degres Celsius. */
  temp: number
  /** ISO 8601 complet, sert aussi de cle de tri. */
  date: string
  /** Cle jour AAAA-MM-JJ, pour savoir vite ce qui reste a faire aujourd'hui. */
  jour: string
  moment: Moment
  operateur: string
  conforme: number
  actionCorrective: string
}

export interface Reception {
  id: Id
  date: string
  jour: string
  fournisseur: string
  bonLivraison: string
  /** Temperature relevee a coeur ou sur le produit, en degres Celsius. */
  tempProduit: number | null
  emballageOk: number
  dlcOk: number
  conforme: number
  motif: string
  operateur: string
  photo: string
}

export type StatutLot = 'en_stock' | 'vendu' | 'retire'

export interface Lot {
  id: Id
  produitId: Id
  ean: string
  numeroLot: string
  /** Date limite, au format AAAA-MM-JJ. */
  dlc: string
  quantite: number
  statut: StatutLot
  operateur: string
  creeLe: string
  retireLe: string
}

export type Frequence = 'quotidien' | 'hebdomadaire' | 'mensuel'

export interface Tache {
  id: Id
  nom: string
  zone: string
  frequence: Frequence
  produitUtilise: string
  actif: number
  ordre: number
}

export interface Nettoyage {
  id: Id
  tacheId: Id
  date: string
  /** Cle de periode : le jour, la semaine ISO ou le mois selon la frequence. */
  periode: string
  operateur: string
  commentaire: string
}

export interface Operateur {
  id: Id
  nom: string
  actif: number
}

export interface Reglage {
  cle: string
  valeur: string
}
