# Épicerie — Scan & HACCP

Application web installable (PWA) pour une épicerie : inventaire par code-barres,
prix et marges, et les quatre registres HACCP d'autocontrôle.

Même URL sur le téléphone (scan en rayon) et sur le PC (saisie au clavier, impression).

## Ce qu'elle fait

| Module | Rôle |
| --- | --- |
| Scanner | Lit l'EAN, récupère nom / marque / photo sur Open Food Facts, saisie du prix et de la quantité |
| Catalogue | Recherche, tri, valeur du stock, export CSV pour Excel |
| Fiche produit | Prix d'achat, prix de vente, marge calculée, lots, PDF, étiquette de rayon |
| Températures | Relevés matin / soir par équipement, alerte hors zone, action corrective obligatoire |
| Réceptions | Contrôle de chaque livraison : température, emballages, DLC, acceptation ou refus motivé |
| Dates limites | Suivi des lots, alerte à J-3, traçabilité des retraits de la vente |
| Plan de nettoyage | Tâches quotidiennes, hebdomadaires, mensuelles, cochées et horodatées |
| Registres | Un PDF unique sur la période choisie, à présenter en cas de contrôle |

## Démarrer en développement

```bash
npm install
```

```bash
npm run dev
```

L'application est sur http://localhost:5173.

## Points techniques

- **Stockage local** : IndexedDB via Dexie (`src/db/`). Tout fonctionne hors-ligne ;
  la synchronisation Supabase viendra par-dessus, sans changer le modèle de données.
- **Scan** : `BarcodeDetector` natif quand le navigateur le fournit (Android), sinon
  ZXing chargé à la demande. Le paquet ZXing n'est donc jamais téléchargé sur Android.
- **PDF** : jsPDF, également chargé à la demande — il pèse à lui seul plus que le reste
  de l'application.
- **Routage** : `HashRouter`, pour que le build fonctionne tel quel sur GitHub Pages
  sans configuration serveur.

## La caméra exige HTTPS

Les navigateurs n'ouvrent la caméra que sur une origine sûre : `localhost` ou HTTPS.
Ouvrir `http://192.168.x.x:5173` depuis un téléphone affichera donc l'application,
mais **le scan ne démarrera pas** — seule la saisie manuelle fonctionnera.

Pour tester sur un vrai téléphone, il faut mettre l'application en ligne (GitHub Pages
fournit HTTPS gratuitement). C'est l'étape suivante du projet.

## Construire

```bash
npm run build
```

Le résultat est dans `dist/`, prêt à être publié tel quel.
