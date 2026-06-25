# Documentation fonctionnelle — Thème Shopify Tediber

## 1. Présentation générale

Ce thème est basé sur **Dawn** (thème par défaut Shopify, v15.3.0), mais a été très largement enrichi pour répondre aux besoins métier de Tediber : vente de matelas/literie avec un fort volet conseil/comparatif, opérations marketing fréquentes, et plusieurs outils tiers branchés directement dans le thème.

On peut résumer la différence avec un Shopify "classique" ainsi : **le thème de base ne représente plus qu'une petite partie du site**. La majorité de l'expérience (comparateurs, bundles, panier enrichi, landing pages) est du développement spécifique ajouté par-dessus Dawn.

## 2. Organisation des dossiers (rappel rapide)

- `layout/` — squelette commun (header, footer, balises globales)
- `templates/` — une page par type de contenu, avec de nombreuses variantes pour les opérations marketing
- `sections/` — blocs assemblables depuis l'éditeur de thème (Dawn + ~64 sections "maison" préfixées `ax-`)
- `snippets/` — briques de code internes non éditables depuis l'éditeur
- `assets/` — CSS/JS/images
- `config/` — réglages globaux du thème
- `locales/` — traductions des textes du thème (pas le contenu éditorial)

## 3. Ce qui diffère d'un Shopify standard

### 3.1 Système de bundles produit maison

Shopify ne propose pas nativement de "packs" de produits vendus comme un seul article configurable. Le thème implémente son propre système :
- Sélection d'options de bundle (`product-bundle-picker`, `product-bundle-options`)
- Choix des produits inclus dans le pack (`product-bundle-included-picker`, `product-bundle-item-included`)
- Affichage du détail des produits inclus (`product-bundle-details-items`)
- Cartes de bundle dédiées dans les listings (`card-bundle-product`, `card-bundle-variant`, `card-bundle-special-config`)

C'est un développement métier complet, absent de Dawn.

### 3.2 Comparateurs produits / concurrents

Plusieurs familles de comparateurs ont été développées, pensées comme des outils d'aide à la décision pour le client :
- **Comparateur de matelas** (`ax-matelas-comparator` + ses snippets dédiés) — sélection et comparaison de plusieurs matelas dans une modale
- **Comparateur "versus"** (`ax-versus-comparator`, `ax-versus-hero`, `ax-versus-comparator-winner`, `ax-versus-anchor`) — utilisé pour les pages "Tediber vs Emma" par exemple, avec un système de tooltip et de menu flottant mobile (`versus-comparator-floating`, `versus-comparator-tooltip`, `versus-comparator-mobile-drop`)
- **Comparateur de caractéristiques** (`ax-comparison-chart`, `ax-comparative-keypoints`, `ax-products-comparator`)

Ce type de fonctionnalité n'existe pas du tout dans un thème Shopify standard.

### 3.3 Panier (cart drawer) très enrichi

Le panier latéral de Dawn est basique (liste d'articles + bouton de commande). Ici il a été étendu avec de nombreux modules métier :
- Barre de progression vers un palier de livraison gratuite ou offre (`cart-drawer-progress-bar`)
- Liste et application de codes promo directement dans le panier (`cart-drawer-discount-code`, `cart-drawer-discount-list`, `cart-drawer-discount-bundle`)
- Affichage du montant total économisé (`cart-drawer-total-savings`)
- Upsell dynamique dans le panier (propositions de produits complémentaires) (`cart-drawer-upsell-dynamic`)
- Réassurances (livraison, paiement sécurisé, etc.) (`cart-drawer-reassurances`)
- Envoi du panier par email (`cart-drawer-send-cart-to-email`) — fonctionnalité absente de Shopify de base
- Calcul de l'éco-participation (taxe environnementale française, via metafields produit) (`cart-drawer-eco-part`)

### 3.4 Fiche produit étendue

Au-delà de la fiche produit standard, on trouve :
- Barre collante d'achat (`product-sticky-bar`) qui suit le scroll
- Upsell sur la fiche produit (`product-upsell`, `product-upsell-options`, `product-variant-upsell-picker`)
- Score produit / notation (`product-scores`)
- Badges et bandeaux promotionnels sur la fiche (`product-badges`, `product-ribbon-badges`, `product-banner-pack`)
- Gestion spécifique des "produits volumineux" (livraison particulière, via un metaobject produit) (`produit-volumineux`)
- Onglets de description (`product-description-tabs`)
- Informations de livraison dynamiques (`product-delivery-info`)
- "Shop the look" pour proposer un ensemble (`ax-shop-the-look`)

### 3.5 Avis clients et réassurance

Les avis Shopify natifs sont remplacés/complétés par une intégration **Trustpilot** poussée à plusieurs niveaux :
- Avis boutique (`ax-trustpilot-shop`)
- Avis par produit (`ax-trustpilot-product`, `card-product-trustpilot`)
- Script de chargement dédié (`script-trustpilot`)

### 3.6 Localisation multi-pays / multi-langue avancée

Le sélecteur pays/langue standard de Dawn est remplacé par une version enrichie (`country-localization`, `language-localization`) qui filtre et trie les pays disponibles, gère les devises associées, etc. — utile si Tediber vend dans plusieurs pays avec des réglages différents par marché.

### 3.7 Outils marketing et tracking tiers branchés dans le thème

Contrairement à un thème Shopify standard où le tracking passe surtout par les apps installées depuis l'admin, ici plusieurs scripts sont **intégrés en dur dans le thème** :
- **Kameleoon** — outil d'A/B testing (le script bloque l'affichage de la page pendant son chargement pour éviter le "flash" de contenu non testé)
- **Microsoft Clarity** — analyse comportementale (heatmaps, sessions)
- **Debugbear** — monitoring de performance
- **Yuma** — chatbot client
- **Alma** — badge de paiement en plusieurs fois sur les fiches produit

### 3.8 Constructeurs de pages tiers (Pagetify et PageFly)

Deux outils de création de landing pages sont présents :
- **Pagetify** — pages générées avec leur propre CSS/JS par page (`pagetify-page-*.liquid`), et un template dédié (`pagetify-page.liquid`, `pagetify-template.liquid`)
- **PageFly** — un autre constructeur de pages (`pagefly-main-css.liquid`, `pagefly-main-js.liquid`)

Cela signifie qu'une partie du contenu du site (notamment les landing pages d'opérations marketing) **n'est pas géré dans l'éditeur de thème Shopify classique**, mais dans ces outils externes, qui injectent ensuite leur rendu dans le thème.

### 3.9 Volume inhabituel de templates pour les opérations marketing

Un site Shopify standard a typiquement un seul template par type de page (`product.json`, `collection.json`, `page.json`...). Ici, on trouve des dizaines de variantes :
- Des templates de collection par opération commerciale (`collection.co-black-friday.json`, `collection.french-days.json`, `collection.co-soldes-ete-vip.json`, etc.)
- Des templates de page dédiés aux avis par catégorie de produit (`page.avis-matelas.json`, `page.avis-couette-enfant.json`...)
- Des templates de landing page marketing (`page.lp-*.json`) pour chaque campagne (CRM, partenariats, comparatifs concurrents...)

Cette organisation reflète un fonctionnement où **chaque opération marketing crée un nouveau template** plutôt que de réutiliser/modifier un template existant, pour ne pas impacter les pages déjà publiées.

### 3.10 Mentions légales automatisées

Un snippet dédié (`legal-asterisk`) transforme automatiquement les astérisques `*` présents dans les textes en exposant, pour le renvoi vers des mentions légales (obligation française d'affichage des prix/promotions). Ce genre d'automatisation n'existe pas dans Dawn.

## 4. Synthèse des écarts par rapport à un Shopify "classique"

| Domaine | Shopify standard | Ce projet |
|---|---|---|
| Bundles produits | Non géré nativement | Système maison complet (sélection, affichage, panier) |
| Comparateurs | Inexistant | 3 familles de comparateurs (matelas, concurrents, caractéristiques) |
| Panier | Liste + checkout | Codes promo, upsell, éco-part, envoi par email, économies totales |
| Avis clients | App native Shopify ou aucune | Trustpilot intégré à plusieurs niveaux |
| A/B testing | Via app externe | Script Kameleoon injecté directement dans le thème |
| Landing pages | Éditeur de thème | Pagetify + PageFly (outils externes) |
| Templates | Peu de variantes | Dizaines de variantes par opération marketing |
| Mentions légales | Manuel | Automatisation des astérisques légaux |

## 5. Points de vigilance pour la suite

- Toute évolution du panier ou de la fiche produit doit composer avec les modules existants (upsell, eco-part, bundle) plutôt que les contourner, car ils sont interdépendants.
- Avant de créer un nouveau template marketing, vérifier si un template similaire existe déjà parmi les nombreuses variantes `page.*` / `collection.*`.
- Les pages Pagetify/PageFly ne sont pas modifiables dans le code du thème — toute modification de leur contenu passe par l'outil externe correspondant.
- Les scripts tiers (Kameleoon, Clarity, Debugbear, Yuma, Trustpilot) sont injectés en dur : un changement de prestataire nécessite une intervention dans le thème, pas seulement dans l'admin Shopify.
