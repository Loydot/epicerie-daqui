/** Identifiant local : uuid v4, le même sur tous les appareils. */
export type Id = string

/**
 * Champs communs à tout ce qui se synchronise. Ils sont optionnels côté types
 * parce que les crochets de la base les renseignent à l'écriture : aucune page
 * n'a à y penser, et un oubli ne peut donc pas empêcher une donnée de partir.
 */
export interface Synchronisable {
  /** Dernière modification, ISO 8601. */
  majLe?: string
  /** 1 tant que la ligne n'a pas été envoyée au serveur. */
  aSynchroniser?: number
}

/** Trace d'un effacement, pour qu'il se propage aux autres appareils. */
export interface Suppression {
  id: Id
  table: string
  le: string
}

export type Source = 'openfoodfacts' | 'manuel' | 'import'

/** Rayon du magasin. « negatif » et « positif » = froid négatif / positif. */
export type Section = 'negatif' | 'positif' | 'menager' | 'epicerie' | 'nonclasse'

export interface Produit extends Synchronisable {
  id: Id
  ean: string
  nom: string
  marque: string
  contenance: string
  /** Catégorie descriptive venue d'Open Food Facts, ex. « Pâtes à tartiner ». */
  rayon: string
  /** Rayon du magasin, qui structure l'inventaire et les étiquettes. */
  section: Section
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
  /**
   * 1 quand le produit a ete scanne sans reseau : seul le code-barres est connu.
   * La fiche sera completee automatiquement au retour de la connexion.
   */
  aEnrichir: number
  note: string
  creeLe: string
  majLe: string
}

export type TypeEquipement = 'frigo' | 'congelateur' | 'vitrine' | 'reserve'

export interface Equipement extends Synchronisable {
  id: Id
  nom: string
  type: TypeEquipement
  tempMin: number
  tempMax: number
  actif: number
  ordre: number
}

export type Moment = 'matin' | 'soir'

export interface Releve extends Synchronisable {
  id: Id
  equipementId: Id
  /** Température en degres Celsius. */
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

export interface Reception extends Synchronisable {
  id: Id
  date: string
  jour: string
  fournisseur: string
  bonLivraison: string
  /** Température relevée a coeur ou sur le produit, en degres Celsius. */
  tempProduit: number | null
  emballageOk: number
  dlcOk: number
  conforme: number
  motif: string
  operateur: string
  photo: string
}

export type StatutLot = 'en_stock' | 'vendu' | 'retire'

export interface Lot extends Synchronisable {
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

export interface Tache extends Synchronisable {
  id: Id
  nom: string
  zone: string
  frequence: Frequence
  produitUtilise: string
  actif: number
  ordre: number
}

export interface Nettoyage extends Synchronisable {
  id: Id
  tacheId: Id
  date: string
  /** Cle de période : le jour, la semaine ISO ou le mois selon la frequence. */
  periode: string
  operateur: string
  commentaire: string
}

export interface Operateur extends Synchronisable {
  id: Id
  nom: string
  actif: number
}

/* ------------------------------ commandes clients ------------------------------ */

export interface Client extends Synchronisable {
  id: Id
  nom: string
  telephone: string
  /** Adresse de livraison habituelle, saisie une fois et reprise ensuite. */
  adresse: string
  note: string
  creeLe: string
}

/** Le client passe la prendre, ou on la lui porte. */
export type ModeRemise = 'retrait' | 'livraison'

/**
 * Cycle de vie d'une commande prise au téléphone.
 * Le stock n'est débité qu'au passage en « retiree » : c'est le moment où la
 * marchandise sort réellement du magasin.
 */
export type StatutCommande = 'a_commander' | 'commandee' | 'arrivee' | 'retiree' | 'annulee'

export interface Commande extends Synchronisable {
  id: Id
  clientId: Id
  /** Prise de commande, ISO 8601. */
  date: string
  mode: ModeRemise
  /** Retrait ou livraison souhaité, AAAA-MM-JJ. Vide si rien n'a été précisé. */
  dateRetrait: string
  /** Adresse pour cette commande. Vide : on prend celle de la fiche client. */
  adresseLivraison: string
  statut: StatutCommande
  note: string
  operateur: string
  /** Horodatage de la remise au client, qui a déclenché la sortie de stock. */
  retireLe: string
}

export interface LigneCommande extends Synchronisable {
  id: Id
  commandeId: Id
  /** Vide pour un article hors catalogue, saisi à la volée au téléphone. */
  produitId: Id
  libelle: string
  quantite: number
  /** Prix de vente au moment de la commande, figé pour que le bon reste juste. */
  prixUnitaire: number | null
}

export interface Reglage extends Synchronisable {
  cle: string
  valeur: string
}
