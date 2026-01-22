# Afroboost - Product Requirements Document

## Original Problem Statement
Application de réservation de casques audio pour des cours de fitness Afroboost. Design sombre néon avec fond noir pur (#000000) et accents rose/violet.

## User Personas
- **Utilisateurs**: Participants aux cours de fitness qui réservent des casques audio
- **Coach**: Administrateur qui gère les cours, offres, réservations, codes promo et campagnes marketing

## Core Requirements

### Système de Réservation
- [x] Sélection de cours et dates
- [x] Choix d'offres (Cours à l'unité, Carte 10 cours, Abonnement)
- [x] Formulaire d'information utilisateur (Nom, Email, WhatsApp)
- [x] Application de codes promo avec validation en temps réel
- [x] Liens de paiement (Stripe, PayPal, Twint)
- [x] Confirmation de réservation avec code unique

### Mode Coach Secret
- [x] Accès par 3 clics rapides sur le copyright
- [x] Login avec credentials (coach@afroboost.com / afroboost123)
- [x] Tableau de bord avec 7 onglets (Réservations, Concept, Cours, Offres, Paiements, Codes promo, Campagnes)

### Administration (Mode Coach)
- [x] **Réservations**: Tableau complet avec export CSV
- [x] **Concept & Visuel**: 
  - Description du concept (textarea)
  - URL Média 16:9 (YouTube/Vimeo/Image)
  - URL du Logo (Splash Screen & PWA)
  - URL du Favicon
- [x] **Cours**: CRUD complet avec jour, heure, lieu, lien Maps, toggle visibilité
- [x] **Offres**: 
  - Nom, Prix, URL miniature, Visible
  - Description pour icône "i" (max 150 caractères)
- [x] **Paiements**: Configuration liens Stripe/PayPal/Twint, WhatsApp Coach
- [x] **Codes Promo**: 
  - Création avec type (100%, %, CHF), valeur, bénéficiaire
  - Liste cours autorisés avec scroll
  - Bouton supprimer (poubelle rouge)
  - Import CSV
- [x] **📢 Campagnes Marketing** (NOUVEAU):
  - Création de campagnes multi-canaux (WhatsApp, Email, Instagram)
  - Programmation multi-dates (chaque date = ligne distincte)
  - Sélection de contacts ciblés
  - Aperçu visuel du média
  - Lancement et suivi des envois
  - Indicateurs d'erreur visuels (point rouge pour numéros invalides)

### Internationalisation (i18n)
- [x] FR, EN, DE
- [x] Changement instantané via icône globe

### Design
- [x] Fond noir pur (#000000)
- [x] Bordures néon rose/violet
- [x] Effets de lueur
- [x] Bouton paiement avec dégradé pulsant

---

## What's Been Implemented (Jan 2026)

### Module Gestionnaire de Campagnes (13 Jan 2026)
1. ✅ **Création de campagnes marketing**:
   - Formulaire complet: nom, message avec variables {prénom}, URL média, format (9:16/16:9)
   - Canaux d'envoi: WhatsApp, Email, Instagram
   - Ciblage: Tous les contacts ou sélection individuelle
   
2. ✅ **Programmation multi-dates**:
   - Option "Programmer (multi-dates)" avec ajout/suppression de créneaux
   - Chaque date crée une campagne distincte avec statut "Programmé"
   - Calendrier avec restriction aux dates futures
   
3. ✅ **Génération de liens WhatsApp optimisée**:
   - Format: `https://api.whatsapp.com/send?phone=41XXXXXXXXX&text=...`
   - Nettoyage automatique des numéros suisses (0765203363 → 41765203363)
   - URL du média à la fin du message (active l'aperçu WhatsApp)
   
4. ✅ **Indicateurs d'erreur visuels**:
   - Point rouge 🔴 pour numéros invalides ou emails manquants
   - Panel d'erreurs récentes en haut de l'historique
   - Message "⚠️ Certains contacts ont des informations manquantes"
   
5. ✅ **Historique des campagnes**:
   - Tableau avec colonnes: Campagne, Contacts, Canaux, Statut, Date, Actions
   - Statuts: Brouillon, Programmé, En cours, Envoyé
   - Détails d'envoi expandables avec progression

### Corrections techniques précédentes (13 Jan 2026)
1. ✅ **Lecteur vidéo étanche 16:9**
2. ✅ **Description du concept dynamique**
3. ✅ **Favicon & Logo dynamique**
4. ✅ **Codes promo robustes** (insensible à la casse, espaces, mise à jour temps réel)

### Tests
- Backend: 31/31 tests passés (pytest)
- Frontend: Toutes les fonctionnalités vérifiées
- Tests spécifiques campagnes: 8/8 passés

### Correction Bug DataCloneError PostHog + EmailJS/Twilio (20 Jan 2026)

#### Architecture chirurgicale - Séparation envoi technique / gestion d'état
Les fonctions d'envoi sont maintenant **au niveau module** (hors React) pour éviter tout conflit avec PostHog :

1. ✅ **`performEmailSend` (ligne 56) - Fonction autonome**:
   ```javascript
   const performEmailSend = async (destination, recipientName, subject, text) => {
     console.log('DEMANDE EMAILJS ENVOYÉE');
     const params = { to_email: destination, to_name: recipientName, subject, message: text };
     return await emailjs.send(SERVICE_ID, TEMPLATE_ID, params, PUBLIC_KEY);
   };
   ```

2. ✅ **`performWhatsAppSend` (ligne 97) - Fonction autonome avec simulation**:
   - Si Twilio non configuré: `alert("WhatsApp prêt pour : " + phoneNumber)`
   - Sinon: Appel direct à `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`

3. ✅ **Initialisation SDK au chargement du module (ligne 37)**:
   ```javascript
   try {
     emailjs.init(EMAILJS_PUBLIC_KEY);
   } catch (initError) { console.error('Erreur init:', initError); }
   ```

4. ✅ **Handlers avec isolation PostHog**:
   - `e.preventDefault()` et `e.stopPropagation()` EN PREMIER (avant toute logique)
   - try/catch imbriqués: un pour `setState`, un pour l'envoi, un pour l'UI
   - Exemple: `try { setTestEmailStatus('sending'); } catch (e) { console.warn('PostHog bloqué mais envoi maintenu'); }`

5. ✅ **Tests automatisés** (`/app/tests/test_autonomous_functions.py`):
   - 25/25 tests passés
   - Vérification que les fonctions sont AVANT le composant React
   - Vérification des try/catch imbriqués

### Corrections Bug Fixes (15 Jan 2026)
1. ✅ **Scanner QR amélioré**:
   - Test direct de la caméra avant initialisation html5-qrcode
   - Indicateur de chargement pendant l'initialisation
   - Messages d'erreur plus clairs avec bouton "Réessayer"
   - Fallback robuste vers saisie manuelle
   
2. ✅ **Icône "i" sur les offres**:
   - Cercle rose visible sur les offres avec descriptions
   - Panneau de description s'affiche au clic
   - Bouton de fermeture (×) pour revenir à l'image

3. ✅ **Badges de statut**:
   - "✅ Validé" avec fond vert
   - "⏳ En attente" avec fond jaune
   - Affichés dans le tableau des réservations

4. ✅ **Slider horizontal des offres - SWIPE FLUIDE (corrigé)**:
   - CSS optimisé avec `-webkit-overflow-scrolling: touch !important`
   - `touch-action: pan-x` pour swipe mobile
   - `scroll-snap-type: x mandatory` pour arrêt net sur chaque carte
   - Suppression des styles inline conflictuels
   - Effet LED néon rose (#d91cd2) sur l'offre sélectionnée
   - Badge "✓ Sélectionné" visible

5. ✅ **Affichage images des offres (corrigé)**:
   - Priorité: `offer.images[0] > offer.thumbnail > defaultImage`
   - Points de navigation discrets pour cartes multi-images
   - Carrousel avec navigation au clic sur les points
   - Zoom modal avec flèches de navigation
   - Synchronisation correcte après édition coach (`fetchData()` appelé au retour)

6. ✅ **Cartes non tronquées (corrigé)**:
   - `.offer-card.selected { height: auto !important; max-height: none !important; }`
   - Conteneur flexible qui s'adapte au contenu

7. ✅ **Rich Preview (Open Graph)**:
   - Meta tags og:title, og:description, og:image ajoutés
   - Image og-image.png générée (1.3MB)
   - Twitter Card meta tags ajoutés
   - Aperçu riche pour partage WhatsApp/Instagram

### Refactoring Modulaire Vercel P1 (15 Jan 2026)
1. ✅ **Composants extraits de App.js**:
   - `/components/OfferCard.js` - OfferCard + OfferCardSlider avec multi-images
   - `/components/QRScanner.js` - Modal scanner avec gestion propre caméra (stop/start)
   - `/components/AdminCampaigns.js` - Hooks + composants pour campagnes marketing
   - `/components/index.js` - Export centralisé de tous les composants

2. ✅ **CSS organisé par sections**:
   - Section "OFFERS SLIDER STYLES" - Swipe mobile iOS/Android
   - Section "QR SCANNER STYLES" - Conteneur visible
   - Section "OFFER CARD STYLES" - Multi-images et sélection
   - Section "COACH MODE ADMIN STYLES" - Tabs coach
   - Section "CAMPAIGNS STYLES" - Gestionnaire marketing

3. ✅ **Vérifications post-refactoring**:
   - Bouton "Voir les avis" : Fonctionnel ✓
   - Champ adresse conditionnel (produits) : Fonctionnel ✓
   - Scanner QR : Modal + boutons fonctionnels ✓
   - Swipe offres mobile : Fonctionnel ✓

### Fonctionnalités Avis Google (15 Jan 2026)
1. ✅ **Mode Coach - Champ Lien des avis Google**:
   - Onglet "Concept & Visuel" - nouveau champ `googleReviewsUrl`
   - Indicateur visuel "✓ Lien configuré" en vert
   - Lien "Tester le lien" pour prévisualisation
   - Persistance via API `/api/concept`

2. ✅ **Mode Client - Bouton "Voir les avis"**:
   - Positionné entre offres et formulaire
   - Design néon transparent avec bordure lumineuse rose/violet
   - Icône étoile + icône lien externe
   - Ouvre le lien Google dans un nouvel onglet
   - Masqué si aucun lien configuré

### Intégration EmailJS (15 Jan 2026)
1. ✅ **Service EmailJS créé**:
   - `/services/emailService.js` - Envoi automatisé avec @emailjs/browser
   - Fonctions: `sendEmail`, `sendBulkEmails`, `testEmailJSConfig`
   - Stockage config dans localStorage (pas de backend)

2. ✅ **Interface Admin EmailJS**:
   - Panneau de configuration avec 3 champs (Service ID, Template ID, Public Key)
   - Bouton "💾 Sauvegarder" + "🧪 Tester" avec email de test
   - Instructions pour créer un template EmailJS

### Intégration WhatsApp API Twilio (15 Jan 2026)
1. ✅ **Service WhatsApp créé**:
   - `/services/whatsappService.js` - Envoi automatisé via Twilio API
   - Fonctions: `sendWhatsAppMessage`, `sendBulkWhatsApp`, `testWhatsAppConfig`
   - Format E.164 automatique pour les numéros suisses (+41)
   - Support des médias (images/vidéos) via MediaUrl

2. ✅ **Interface Admin WhatsApp**:
   - Panneau de configuration avec 3 champs (Account SID, Auth Token, From Number)
   - Auth Token masqué pour sécurité
   - Bouton "💾 Sauvegarder" + "🧪 Tester" avec numéro de test
   - Instructions Sandbox Twilio détaillées

3. ✅ **Champ URL du média**:
   - Champ "📎 URL du média (image/vidéo)" dans le mode Envoi Direct
   - Aperçu miniature si URL valide
   - Transmis comme `media_url` dans les appels API

4. ✅ **Envoi groupé automatique**:
   - Bouton gradient "🚀 Envoyer Email + WhatsApp"
   - Barre de progression globale indiquant le canal en cours
   - Récapitulatif final avec stats par canal
   - Mode manuel WhatsApp conservé (←/Ouvrir/→)

### Agent IA WhatsApp (15 Jan 2026)
1. ✅ **Backend IA avec OpenAI via Emergent LLM Key**:
   - `/backend/server.py` - Endpoints `/api/ai-config`, `/api/ai-logs`, `/api/ai-test`, `/api/webhook/whatsapp`
   - Service `aiResponseService.js` côté frontend pour configuration
   - Utilise `emergentintegrations` pour l'intégration OpenAI
   - Session par numéro de téléphone pour contexte multi-tour

2. ✅ **Mémorisation du contexte**:
   - Recherche automatique du client par numéro dans les réservations
   - Personnalisation avec le prénom du client dans les réponses
   - Référence au dernier média envoyé (`lastMediaUrl`)

3. ✅ **Interface Admin IA**:
   - Panneau "🤖 Agent IA WhatsApp" avec toggle activation
   - Prompt système personnalisable (personnalité de l'IA)
   - Sélecteurs Provider (OpenAI, Anthropic, Google) et Modèle
   - URL Webhook Twilio affichée pour configuration
   - Zone de test IA avec réponse en temps réel

4. ✅ **Logs de l'IA**:
   - Affichage des dernières réponses (heure + prénom + extrait)
   - Bouton "🗑️ Effacer" pour nettoyer les logs
   - Stockage dans MongoDB (50 derniers logs)

### Intégration Stripe Checkout + TWINT (19 Jan 2026)
1. ✅ **Endpoint `/api/create-checkout-session`**:
   - Création de session Stripe Checkout avec `payment_method_types=['card', 'twint']`
   - Devise forcée à `currency='chf'` (obligatoire pour TWINT)
   - Fallback automatique vers `['card']` si TWINT n'est pas disponible sur le compte Stripe
   - Enregistrement des transactions dans la collection `payment_transactions`
   - URLs de retour dynamiques construites depuis l'origine frontend

2. ✅ **Endpoint `/api/checkout-status/{session_id}`**:
   - Vérification du statut de paiement Stripe
   - Mise à jour de la base de données avec le nouveau statut

3. ✅ **Endpoint `/api/webhook/stripe`**:
   - Réception des événements Stripe (checkout.session.completed, checkout.session.expired)
   - Mise à jour automatique du statut des transactions

4. ✅ **Frontend - Flux Stripe Checkout**:
   - Si `concept.paymentCreditCard` ou `concept.paymentTwint` activé → utilise Stripe Checkout API
   - Sinon → fallback vers liens de paiement externes (ancien comportement)
   - Gestion du retour de paiement via paramètres URL (`payment_success`, `session_id`)
   - Finalisation automatique de la réservation après paiement réussi

5. ✅ **Logos de paiement dans le footer**:
   - Logo TWINT si `concept.paymentTwint` activé
   - Logos Visa/Mastercard si `concept.paymentCreditCard` activé
   - Logo PayPal si `concept.paymentPaypal` activé

---

## Technical Architecture

```
/app/
├── backend/
│   ├── server.py       # FastAPI avec AI Webhook, MongoDB
│   ├── requirements.txt
│   └── tests/
│       ├── test_afroboost_api.py
│       └── test_campaigns_api.py
└── frontend/
    ├── src/
    │   ├── App.js      # Composant React principal (~4000 lignes)
    │   ├── App.css     # Styles néon organisés par sections
    │   ├── config/
    │   │   ├── index.js      # Configuration groupée
    │   │   └── constants.js  # Constantes exportées
    │   ├── services/
    │   │   ├── index.js            # Export centralisé services
    │   │   ├── emailService.js     # EmailJS automatisé
    │   │   ├── whatsappService.js  # WhatsApp Twilio API
    │   │   └── aiResponseService.js # IA WhatsApp config (NOUVEAU)
    │   ├── components/
    │   │   ├── index.js          # Export centralisé
    │   │   ├── OfferCard.js      # Composants offres + multi-images
    │   │   ├── QRScanner.js      # Scanner QR avec gestion caméra
    │   │   ├── AdminCampaigns.js # Hooks + composants campagnes
    │   │   ├── LanguageSelector.jsx
    │   │   └── ui/
    │   │       └── index.jsx     # Composants UI de base
    │   ├── hooks/
    │   │   └── index.js      # Hooks personnalisés
    │   └── utils/
    │       └── i18n.js       # Internationalisation
    ├── vercel.json           # Configuration déploiement Vercel
    ├── ARCHITECTURE.md       # Documentation structure
    └── public/
        ├── index.html  # PWA meta tags + Open Graph
        └── manifest.json
```

### Data Models (MongoDB)
- `courses`: id, name, weekday, time, locationName, mapsUrl, visible, playlist (List[str])
- `offers`: id, name, price, thumbnail, description, visible
- `users`: id, name, email, whatsapp, createdAt
- `reservations`: id, reservationCode, userId, userName, userEmail, courseId, selectedDates (List[str]), selectedDatesText, totalPrice, stripeSessionId, paymentStatus, ...
- `discount_codes`: id, code, type, value, assignedEmail, courses, maxUses, used, active
- `concept`: id, description, heroImageUrl, logoUrl, faviconUrl, paymentTwint, paymentPaypal, paymentCreditCard, ...
- `payment_links`: id, stripe, paypal, twint, coachWhatsapp
- `campaigns`: id, name, message, mediaUrl, mediaFormat, targetType, selectedContacts, channels, scheduledAt, status, results, createdAt
- `payment_transactions` **(NOUVEAU)**: id, session_id, amount, currency, product_name, customer_email, metadata, payment_status, payment_methods, created_at, updated_at

---

## Prioritized Backlog

### P0 - Completed ✅
- [x] Module Gestionnaire de Campagnes complet
- [x] Envoi WhatsApp avec aperçu média
- [x] Programmation multi-dates
- [x] Indicateurs d'erreur visuels
- [x] Swipe fluide des offres (mobile)
- [x] Affichage correct des images d'offres
- [x] Cartes non tronquées
- [x] Architecture config Vercel initiée
- [x] Bouton "Voir les avis Google" côté client
- [x] Champ "Lien des avis Google" dans Mode Coach
- [x] Gestionnaire de Campagnes opérationnel (Email BCC, WhatsApp nav, Instagram DM)
- [x] Intégration EmailJS automatisée avec barre de progression
- [x] Refactoring modulaire P1 (composants + services)
- [x] **Navigation Client Dynamique (15 Jan 2026)**:
  - Barre de filtres chips néon (🔥 Tout, 📅 Sessions, 🎁 Offres, 🛍️ Shop)
  - Barre de recherche textuelle filtrant offres par nom/description
  - Composant SearchBar.js modulaire avec NavigationBar et LandingSectionSelector
- [x] **Contrôle Admin Section d'atterrissage (15 Jan 2026)**:
  - Sélecteur "📍 Section d'atterrissage par défaut" dans Mode Coach > Concept & Visuel
  - Persistance MongoDB via champ defaultLandingSection dans modèle Concept
  - Scroll automatique vers la section configurée au chargement de l'app
- [x] **Navigation Épurée & Flux Mobile (15 Jan 2026)**:
  - **Design épuré** : Filtres sans fond, bordure néon rose uniquement sur l'élément sélectionné
  - **Logique de filtrage corrigée** : "Offres" = abonnements + sessions, "Shop" = produits physiques uniquement
  - **Recherche par titre** : Bordure rose, filtrage en temps réel par titre uniquement
  - **Fix scroll mobile** : overflow-y: auto sur html/body, -webkit-overflow-scrolling: touch
  - **Smooth scroll** : Navigation automatique vers la section lors du clic sur un filtre
  - **Indicateur de scroll** : Flèche animée après 3s sans scroll pour guider les nouveaux utilisateurs
- [x] **Vérification Médias & Optimisation Vidéo (15 Jan 2026)**:
  - **Validation URL côté Admin** : Badge "✓ Valide" ou "✗ Format inconnu" à côté du champ média
  - **Formats supportés** : YouTube, Vimeo, .mp4, .webm, .jpg, .jpeg, .png, .webp, .gif
  - **Fallback placeholder** : Image Afroboost par défaut si média ne charge pas (onError)
  - **Overlays réduits** : Bandes haut/bas réduites de 55/80px à 35/50px et plus transparentes (70% → 30%)
  - **Lisibilité texte** : text-shadow ajouté au titre et description pour contraste sur vidéo
- [x] **Réparation Médias, Logos & Persistence (15 Jan 2026)**:
  - **Lecteur vidéo amélioré** : parseMediaUrl supporte YouTube shorts, v/, embed formats + WebM, MOV, AVI
  - **Overlays supprimés** : Plus aucun overlay sombre sur la vidéo - 100% visible
  - **Hook Logo/Favicon** : Mise à jour dynamique du favicon avec priorité faviconUrl > logoUrl
  - **CDNs supportés** : ImgBB, Cloudinary, Imgur, Unsplash, Pexels reconnus
  - **Logs d'erreur améliorés** : Messages détaillés côté frontend et backend pour diagnostiquer les échecs
  - **Navigation vérifiée** : Filtres épurés, recherche rose, scroll mobile fluide fonctionnels
- [x] **Navigation Épurée & Contrôle d'Atterrissage (15 Jan 2026)**:
  - **Filtres masqués** : Boutons "Tout", "Sessions", "Offres", "Shop" cachés côté client
  - **Barre de recherche rose uniquement** : Seul élément de navigation visible, bordure rose
  - **Sélecteur admin "📍 Section d'atterrissage"** : Dans Concept & Visuel avec options Sessions/Offres/Shop
  - **Scroll automatique** : Au chargement, scroll fluide vers la section configurée dans MongoDB
  - **Recherche fonctionnelle** : Filtre en temps réel par titre des offres/produits
- [x] **Liens Externes, Paiements & Fix Sauvegarde (15 Jan 2026)**:
  - **🔗 Liens Externes** : 2 champs (titre + URL) dans Concept & Visuel, affichés en boutons en bas de page côté client
  - **💳 Modes de paiement** : Checkboxes Twint, PayPal, Carte de Crédit dans l'admin
  - **Icônes paiement** : Rectangle pied de page avec icônes des paiements cochés (🔵 Twint, 🅿️ PayPal, 💳 Carte)
  - **Sauvegarde fonctionnelle** : Backend mis à jour avec nouveaux champs dans modèle Concept
- [x] **Navigation Textuelle & Logos Paiement (15 Jan 2026)**:
  - **Footer minimaliste** : Navigation horizontale textuelle sans icônes (Lien1 | Lien2 | Installer | ©)
  - **Logos officiels** : Twint, PayPal, Visa, Mastercard en blanc (filtre invert) sans rectangle
  - **Toggles admin** : Interrupteurs ON/OFF pour activer/désactiver chaque logo de paiement
  - **Police fine** : Style minimaliste avec font-weight 300 et letter-spacing
- [x] **Widget IA avec Capture de Données (15 Jan 2026)**:
  - **Bouton flottant WhatsApp** : Icône verte en bas à droite (bottom: 80px) avec ombre
  - **Formulaire Lead Generation** : Prénom, WhatsApp, Email obligatoires avant chat
  - **Sauvegarde MongoDB** : Collection 'leads' avec id, firstName, whatsapp, email, createdAt, source
  - **Chat IA personnalisé** : "Enchanté [Prénom] ! Je suis l'assistant IA d'Afroboost..."
  - **Contexte enrichi** : L'IA utilise la description Afroboost et les cours disponibles
  - **API Endpoints** : POST /api/leads, GET /api/leads, POST /api/chat
- [x] **Amélioration UX Carrousel des Offres (17 Jan 2026)**:
  - **Auto-play** : Défilement automatique toutes les 3.5 secondes pour montrer la multiplicité des offres
  - **Indicateur "Auto"** : Badge en haut à droite avec point rose pulsant quand l'auto-play est actif
  - **Pause intelligente** : Auto-play se met en pause au survol de souris ou au toucher (reprend après 5s)
  - **Consigne visuelle** : Texte rose "👉 Sélectionnez une offre pour continuer" au-dessus du carrousel
  - **Points de pagination** : Indicateurs cliquables pour naviguer manuellement entre les offres
  - **Scroll automatique vers formulaire** : Après clic sur une offre, scroll fluide vers "Vos informations"
  - **Badge "✓ Sélectionné"** : Visible sur l'offre choisie avec effet glow rose
  - **Composant OffersSliderAutoPlay** : Nouveau composant dans App.js (lignes 946-1081)
- [x] **Amélioration Partage WhatsApp avec QR Code (17 Jan 2026)**:
  - **html2canvas** : Bibliothèque installée pour convertir le ticket en image PNG
  - **Bouton "Enregistrer mon ticket"** : Télécharge le ticket complet (QR + infos) en image haute qualité
  - **Bouton "Partager sur WhatsApp"** : Nouveau bouton vert côte à côte avec Enregistrer
  - **Texte de partage** : "Voici ma réservation Afroboost : https://afroboost.com"
  - **afroboost.ch → afroboost.com** : URL corrigée dans tout le projet
- [x] **Mise à jour Son, Visuels et PWA (17 Jan 2026)**:
  - **Bouton Mute/Unmute** : Ajouté sous la vidéo YouTube/Vimeo, permet d'activer le son manuellement
  - **Logo Twint corrigé** : Remplacé l'image cassée par un texte SVG "TWINT" blanc
  - **Manifest PWA dynamique** : Endpoint `/api/manifest.json` utilise le logo configuré par le coach
- [x] **Génération de Codes Promo en Série (17 Jan 2026)**:
  - **Mode série** : Checkbox "Génération en série" pour basculer entre mode unique et mode batch
  - **Préfixe personnalisé** : Champ "Préfixe du code" (ex: VIP → VIP-1, VIP-2, VIP-3...)
  - **Nombre de codes** : Champ "Nombre de codes" avec maximum 20 par série
  - **Paramètres partagés** : Type, valeur, expiration et cours autorisés appliqués à tous les codes de la série
  - **Message de succès** : Alert "✅ X codes créés avec succès !" après génération
  - **Rafraîchissement automatique** : Liste mise à jour immédiatement après création
  - **Gestion individuelle** : Chaque code reste modifiable/activable/supprimable individuellement
  - **Tests complets** : 12/12 tests backend + 10/10 fonctionnalités frontend vérifiées
- [x] **Export CSV des Codes Promo (17 Jan 2026)**:
  - **Bouton "📥 Exporter CSV"** : Ajouté à côté du bouton "Importer CSV" avec fond violet
  - **Format de fichier** : CSV avec colonnes (Code, Type, Valeur, Bénéficiaire, Utilisations Max, Utilisé, Date Expiration, Actif, Cours Autorisés)
  - **Encodage UTF-8 BOM** : Pour compatibilité Excel
  - **Nom automatique** : `codes_promo_YYYY-MM-DD.csv`
- [x] **Refactoring Majeur App.js (17 Jan 2026)**:
  - **Extraction CoachDashboard** : Composant de 3383 lignes extrait dans `/components/CoachDashboard.js`
  - **Réduction App.js** : De 6402 lignes à 3055 lignes (réduction de 52%)
  - **Imports mis à jour** : `import { CoachDashboard } from "./components/CoachDashboard"`
  - **Fonctionnalité préservée** : Tous les onglets et fonctions du Mode Coach fonctionnent
- [x] **Affiche Événement (Popup d'accueil) (17 Jan 2026)**:
  - **Popup modal** : S'affiche automatiquement à l'arrivée du visiteur (après splash screen)
  - **Support média** : Images (Unsplash, CDN) et vidéos (YouTube, Vimeo)
  - **Fermeture facile** : Bouton × visible en haut à droite
  - **SessionStorage** : Le popup ne réapparaît pas après fermeture (mémorisation session)
  - **Administration** : Section "🎉 Affiche Événement" dans Mode Coach → Concept & Visuel
  - **Toggle activation** : Activer/désactiver l'affiche avec un switch
  - **Aperçu en direct** : Prévisualisation de l'image ou vidéo dans l'admin
  - **Backend** : Champs `eventPosterEnabled` et `eventPosterMediaUrl` ajoutés au modèle Concept
- [x] **Correction Glow Offres (17 Jan 2026)**:
  - **Glow adouci** : Réduction de `0 0 30px/60px` à `0 0 10px rgba(217, 28, 210, 0.4)`
  - **CSS + inline** : Correction dans App.css et App.js (ligne 956)
  - **Margin-top** : Ajout pour éviter que le glow soit coupé en haut
  - **Padding-top slider** : Ajout `padding: 20px 20px 10px 20px` au conteneur `.offers-slider`
- [x] **Notifications Automatiques Coach (17 Jan 2026)**:
  - **Backend** : Champs `coachNotificationEmail` et `coachNotificationPhone` ajoutés au modèle PaymentLinks
  - **Endpoint** : `/api/notify-coach` pour formater les messages de notification
  - **Interface Admin** : Section "🔔 Notifications automatiques" dans Mode Coach → Paiements
  - **Intégration** : Fonction `notifyCoachAutomatic()` appelée après chaque réservation réussie
  - **Support** : Email via EmailJS + WhatsApp via API Twilio (si configurés)
  - **Message formaté** : Nom client, email, WhatsApp, offre, cours, date, montant, code réservation
- [x] **Fix WEEKDAYS_MAP (17 Jan 2026)**:
  - **Erreur corrigée** : `ReferenceError: WEEKDAYS_MAP is not defined` dans CoachDashboard.js
  - **Solution** : Ajout de la constante `WEEKDAYS_MAP` directement dans le fichier CoachDashboard.js
- [x] **Recherche Floue / Fuzzy Search (17 Jan 2026)**:
  - **Normalisation accents** : "seance" trouve "séance", "cafe" trouve "café"
  - **Synonymes intégrés** : session↔séance, abonnement↔abo↔forfait, cardio↔fitness
  - **Champ mots-clés** : Nouveau champ invisible dans les offres pour améliorer la recherche
  - **Recherche étendue** : Titre + description + mots-clés
- [x] **UI Cours avec Scroll et Suppression (17 Jan 2026)**:
  - **Scroll** : maxHeight 400px avec overflow-y auto et scrollbar personnalisée
  - **Bouton supprimer** : Icône poubelle rouge pour chaque cours avec confirmation
  - **Amélioration UX** : Interface plus propre avec padding ajusté
- [x] **Scroll Sessions Côté Client (17 Jan 2026)**:
  - **maxHeight 400px** : Appliqué à la liste des sessions sur la page d'accueil
  - **Custom scrollbar** : Barre de défilement violet cohérente avec le design
  - **Mobile-friendly** : Meilleure expérience sur petits écrans
- [x] **Séparation TOTALE Cours/Produits (17 Jan 2026)**:
  - **Découplage JSX** : Section "🛒 Boutique" rendue indépendamment des cours
  - **Variables séparées** : `filteredServices`, `filteredProducts`, `visibleCourses`
  - **Affichage indépendant** : Les produits s'affichent TOUJOURS même sans sélection de cours
  - **Bug résolu** : Masquer les cours n'impacte plus les produits
- [x] **Fonction Duplication Cours (17 Jan 2026)**:
  - **Bouton duplication** : Icône violet à côté du bouton archiver
  - **Copie automatique** : Crée un nouveau cours avec "(copie)" dans le nom
  - **Gain de temps** : Permet de créer rapidement des créneaux similaires (ex: mardi ET jeudi)
- [x] **Archivage des Cours (17 Jan 2026)**:
  - **Bouton archiver** : Icône 📁 orange (remplace la suppression définitive)
  - **Section "Cours archivés"** : Affiche les cours archivés avec compteur
  - **Bouton restaurer** : Permet de récupérer un cours archivé
  - **Backend** : Champ `archived: bool` ajouté au modèle Course + endpoint /archive
- [x] **UI Ultra-Minimaliste avec Navigation Onglets (17 Jan 2026)**:
  - **3 icônes de navigation** : Tout, Cours, Shop (style micro 26px, cercles fins)
  - **Design similaire au globe** : Icônes en traits fins (strokeWidth 1.5)
  - **État actif** : Bordure et fond rose (#D91CD2) sur l'icône sélectionnée
  - **Filtrage fonctionnel** : Cliquer sur "Shop" masque complètement les sessions
  - **Texte Shop** : Blanc pur (#ffffff) et police fine (fontWeight 300)
  - **Scrollbar sessions** : Rose (#D91CD2), 4px de largeur
  - **Padding glow** : 30px en haut pour éviter que l'effet glow soit coupé
- [x] **Sélecteur de Variantes Interactif (17 Jan 2026)**:
  - **Chips cliquables** : Tailles, couleurs présentées en boutons arrondis
  - **Style** : Bordure rose fine, fond rose sur sélection
  - **Validation obligatoire** : Le client DOIT sélectionner une variante avant l'ajout au panier
  - **Message d'erreur** : "Veuillez sélectionner: taille, couleur" si non sélectionné
  - **Récapitulatif** : Les variantes choisies apparaissent sur le ticket de confirmation
  - **Backend** : Champs `selectedVariants` et `variantsText` dans le modèle Reservation
- [x] **Personnalisation Identité Application (17 Jan 2026)**:
  - **Section Admin** : "🎨 Identité de l'application" dans Mode Coach → Concept & Visuel
  - **Nom de l'application** : Champ pour changer le titre principal ("Afroboost" → custom)
  - **URL du Logo** : Champ pour configurer le logo (Splash Screen & PWA)
  - **Persistance MongoDB** : Champ `appName` ajouté au modèle Concept
  - **Dynamique** : Le titre du site utilise `concept.appName` au lieu de la traduction
- [x] **Fix Régression Visibilité Offres (17 Jan 2026)**:
  - **Bug critique** : Les offres avec `visible=false` s'affichaient toujours
  - **Correction** : Changement de `visible !== false` en `visible === true` (égalité stricte)
  - **Impact** : Offres, produits et cours décochés dans l'admin sont maintenant correctement masqués
  - **Manifest PWA dynamique** : `/api/manifest.json` utilise `appName` et `logoUrl` du concept
  - **Tests** : 15/15 tests backend pytest + 11/11 tests frontend passés
- [x] **Sélection de Dates Multiples pour Réservations (18 Jan 2026)**:
  - **Logique toggle** : Clic ajoute une date, re-clic la retire (sélection multiple)
  - **Style sélection** : Bordure rose (#D91CD2) et coche (✔) sur chaque date sélectionnée
  - **Affichage résumé** : Section "📅 Dates sélectionnées (N)" avec badges des dates choisies
  - **Calcul prix** : Total = prix offre × nombre de dates (ex: 3 dates × 30 CHF = 90 CHF)
  - **Section offres** : Visible uniquement si au moins une date est sélectionnée
  - **Backend** : Modèles `Reservation` et `ReservationCreate` mis à jour avec `selectedDates: List[str]` et `selectedDatesText: str`
  - **UNE seule réservation** : Créée avec le tableau de toutes les dates sélectionnées
  - **Tests** : 8/8 tests backend pytest + 100% tests frontend passés
- [x] **Optimisation Performance & Pagination (18 Jan 2026)**:
  - **Pagination backend** : GET /api/reservations?page=1&limit=20 (20 dernières par défaut)
  - **Structure réponse** : `{data: [], pagination: {page, limit, total, pages}}`
  - **Projections MongoDB** : Ne récupère que les champs nécessaires à l'affichage
  - **Export CSV** : `all_data=true` récupère TOUTES les réservations
  - **UI pagination** : Affichage "Affichage X-Y sur Z réservations" + boutons Précédent/Suivant
  - **Tests** : 12/12 tests backend pytest passés
- [x] **Fix Mots-clés Offres (18 Jan 2026)**:
  - **Édition** : Champ `keywords` pré-rempli lors du clic sur "Modifier" une offre
  - **Recherche client** : Filtre par titre + description + mots-clés instantanément
  - **Tests** : Keywords persistence et search functionality vérifiés
- [x] **Système de Cache Frontend (18 Jan 2026)**:
  - **Cache mémoire** : TTL 5 minutes pour courses/offers, 10 min pour concept/paymentLinks
  - **Invalidation** : Cache invalidé automatiquement en sortant du Mode Coach
  - **Logs console** : `📦 Cache: ✓courses ✓offers ↓concept` (✓=cache hit, ↓=fetch)
  - **Navigation fluide** : Onglets Tout/Cours/Shop sans re-téléchargement
  - **Tests** : 14/14 tests backend pytest + 100% frontend passés
- [x] **Refactoring CoachLoginModal (18 Jan 2026)**:
  - **Extraction** : Composant extrait vers `/components/CoachLoginModal.js` (226 lignes)
  - **App.js réduit** : De 3552 à 3444 lignes (-108 lignes)
  - **Fonctionnalités** : Login, récupération mot de passe intactes
- [x] **Amélioration Assistant IA - Mémorisation & UI (18 Jan 2026)**:
  - **UI Scroll** : `max-height: 80vh` et `overflow-y: auto` sur le conteneur du chat
  - **Mémorisation client** : Données sauvegardées dans localStorage (`af_chat_client`)
  - **Client reconnu** : Badge ✓ rose sur le bouton WhatsApp + chat direct sans formulaire
  - **Message personnalisé** : "Bonjour [Prénom] ! 😊 Ravi de te revoir !"
  - **Header personnalisé** : Affiche "👋 [Prénom]" quand client reconnu
  - **Synchronisation contacts** : Création/mise à jour automatique dans Users via `syncContactToDatabase()`
  - **Changer d'identité** : Lien "Pas [Prénom] ? Changer d'identité" efface localStorage
  - **Backend** : Ajout endpoint `PUT /api/users/{id}` pour mise à jour des contacts
  - **Tests** : 11/11 tests backend pytest + 100% frontend passés
- [x] **Fondations Service Audio - Feature Flags & Abonnements (18 Jan 2026)**:
  - **Feature Flags** : Collection `feature_flags` avec `AUDIO_SERVICE_ENABLED: false` par défaut
  - **Coach Subscription** : Collection `coach_subscriptions` avec droits par service (`hasAudioService`, etc.)
  - **Vérification d'accès** : Endpoint `/api/verify-service-access/{service}` 
  - **Logique métier** : Accès = Feature Flag ON + Coach Subscription OK
  - **Frontend service** : `/services/serviceAccess.js` avec cache et helpers
  - **Collections MongoDB** : `feature_flags`, `coach_subscriptions`
  - **Interface inchangée** : Aucune modification visuelle du site
- [x] **Authentification Google OAuth pour Super Admin (18 Jan 2026)**:
  - **Remplacement complet** : L'authentification par mot de passe a été supprimée
  - **Bouton Google officiel** : "Se connecter avec Google" avec icône multicolore
  - **Restriction email** : ~~`coach@afroboost.com`~~ → **`contact.artboost@gmail.com`** (mis à jour)
  - **Message "Accès réservé"** : Si autre email tente de se connecter
  - **Endpoints backend** : `/api/auth/google/session`, `/api/auth/me`, `/api/auth/logout`
  - **Session sécurisée** : Cookie httpOnly avec expiration 7 jours
  - **Collections MongoDB** : `google_users`, `coach_sessions`
  - **Affichage utilisateur** : Avatar et email affichés dans le header du Dashboard
- [x] **Gestion Audio/Playlist pour les Cours (18 Jan 2026)**:
  - **Bouton 🎵** : "Gérer l'Audio" visible à côté de chaque cours (onglet "Cours")
  - **Modal playlist** : Ajouter/supprimer des URLs audio (MP3, streams, Soundcloud, Spotify)
  - **Modèle Course** : Champ `playlist: Optional[List[str]]` ajouté
  - **PUT partiel** : `/api/courses/{id}` supporte les mises à jour partielles
  - **Sauvegarde** : Playlist liée à l'ID du cours et persistée en MongoDB
  - **Tests** : 10/10 backend pytest passés
  - **Onglets inchangés** : Paiements et Réservations non modifiés

### Correction Bug DataCloneError PostHog + EmailJS/Twilio (20 Jan 2026)
1. ✅ **Fix DataCloneError PostHog**:
   - Configuration PostHog mise à jour dans `index.html` (lignes 198-209)
   - `capture_performance: false` - Empêche le clonage de PerformanceServerTiming
   - `disable_session_recording: true` - Désactive l'enregistrement de session
   - `autocapture: false` - Désactive la capture automatique des événements

2. ✅ **Isolation des handlers avec try/catch**:
   - `handleTestEmailJS` - `e.preventDefault()` + `e.stopPropagation()` + try/catch
   - `handleTestWhatsApp` - `e.preventDefault()` + `e.stopPropagation()` + try/catch
   - `handleSendWhatsAppCampaign` - `e.preventDefault()` + `e.stopPropagation()` + try/catch

3. ✅ **Payload EmailJS plat**:
   - `emailService.js` utilise un objet JSON plat avec `String()` conversion
   - IDs par défaut : `service_8mrmxim`, `template_3n1u86p`, `5LfgQSIEQoqq_XSqt`

4. ✅ **WhatsApp config async**:
   - `handleSaveWhatsAppConfig` converti en `async` pour gérer correctement la sauvegarde
   - Appel `await saveWhatsAppConfig(whatsAppConfig)` avant les tests

5. ✅ **data-testid ajoutés**:
   - `data-testid="test-email-btn"` et `data-testid="test-email-input"`
   - `data-testid="test-whatsapp-btn"`

6. ✅ **Tests automatisés**:
   - 14/14 tests passés (`/app/tests/test_dataclone_fix.py`)
   - Backend: 5/5 API tests (health, whatsapp-config GET/PUT, campaigns GET)
   - Frontend: 9/9 code implementation tests

### Système de Chat Amélioré - Backend (21 Jan 2026)
1. ✅ **Reconnaissance automatique des utilisateurs**:
   - Modèle `ChatParticipant` avec `name`, `email`, `whatsapp`, `source`, `link_token`
   - Endpoint `/api/chat/smart-entry` identifie les utilisateurs par nom/email/whatsapp
   - Message personnalisé "Ravi de te revoir, {prénom}!" pour les utilisateurs reconnus
   - Historique de chat restauré automatiquement pour les utilisateurs existants

2. ✅ **Enregistrement CRM automatique**:
   - Collection `chat_participants` pour stocker les contacts
   - Source par défaut "chat_afroboost", identifie la provenance via `link_{token}`
   - Endpoint `/api/chat/participants` pour lister/gérer les contacts
   - Mise à jour automatique de `last_seen_at` à chaque reconnexion

3. ✅ **Modes de conversation (IA/Humain/Communautaire)**:
   - Modèle `ChatSession` avec champs `mode` et `is_ai_active`
   - Mode "ai" : L'IA répond automatiquement
   - Mode "human" : Seul le coach répond (toggle via `/api/chat/sessions/{id}/toggle-ai`)
   - Mode "community" : Plusieurs participants humains (préparé pour futur)
   - Endpoint `/api/chat/coach-response` pour les réponses du coach

4. ✅ **Liens partageables uniques**:
   - Chaque session a un `link_token` unique (12 caractères)
   - Endpoint `/api/chat/generate-link` crée un nouveau lien avec titre personnalisé
   - Endpoint `/api/chat/sessions/by-token/{token}` pour récupérer une session via lien
   - Endpoint `/api/chat/links` liste tous les liens générés pour le coach
   - Les utilisateurs arrivant via un lien sont enregistrés avec `source: "link_{token}"`

5. ✅ **Suppression logique**:
   - Champ `is_deleted` sur `ChatSession` et `EnhancedChatMessage`
   - Endpoint `/api/chat/messages/{id}/delete` marque un message comme supprimé
   - Paramètre `include_deleted=true` pour récupérer les éléments supprimés
   - `deleted_at` timestamp pour traçabilité

6. ✅ **Tests API complets**:
   - 21/21 tests backend pytest (iteration_27)
   - Flux complet testé : génération lien → inscription utilisateur → reconnaissance → messages

### Système de Chat Amélioré - Frontend (21 Jan 2026)
1. ✅ **ChatWidget amélioré** (`/components/ChatWidget.js`):
   - Utilise `/api/chat/smart-entry` pour reconnaissance automatique
   - Stocke participant et session dans localStorage
   - Restaure l'historique pour les utilisateurs reconnus
   - Message personnalisé "Ravi de te revoir, {prénom}!"
   - Support des liens partageables via URL `/chat/{token}`

2. ✅ **Onglet Conversations dans CoachDashboard**:
   - Section "🔗 Générer un lien partageable" avec titre personnalisé
   - Liste des liens générés avec bouton copier (clipboard)
   - Liste des conversations actives avec source identifiée
   - Toggle visuel 🤖 IA Active / 👤 Mode Humain
   - Panel de messages avec input réponse coach
   - Section CRM avec tableau des contacts enregistrés

3. ✅ **Tests Playwright complets**:
   - Widget visible et cliquable
   - Formulaire de capture fonctionnel
   - Mode chat activé après soumission
   - Reconnaissance utilisateur testée

### Système de Chat - Finalisation (21 Jan 2026)
1. ✅ **Notifications sonores et visuelles**:
   - Service `notificationService.js` avec `playNotificationSound()` utilisant Web Audio API
   - Sons différenciés: 'message' (standard), 'coach' (double bip grave), 'user' (bip aigu)
   - Polling toutes les 3-5 secondes pour détecter les nouveaux messages en mode humain/communautaire
   - Notification sonore automatique quand coach/IA répond à l'utilisateur
   - Notification sonore pour le coach quand un utilisateur envoie un message

2. ✅ **Chat Communautaire (100% humain)**:
   - Création via `POST /api/chat/sessions` avec `mode: "community"` et `is_ai_active: false`
   - Bouton "👥 Créer" dans le dashboard pour créer un groupe communautaire
   - Support multi-participants via lien unique partageable
   - IA désactivée par défaut, seuls les humains peuvent répondre
   - Indicateur visuel "👥 Mode Communauté - Plusieurs participants"

3. ✅ **Liens cliquables (Rich Text)**:
   - Fonction `linkifyText()` dans `notificationService.js`
   - Convertit automatiquement les URLs en liens `<a href="..." target="_blank">`
   - Style CSS `.chat-link` avec couleur violet et underline
   - Fonctionne dans ChatWidget ET CoachDashboard
   - Les liens s'ouvrent dans un nouvel onglet

4. ✅ **Suppression de l'historique (Widget)**:
   - Menu burger "⋮" dans le header du ChatWidget
   - Option "🗑️ Supprimer l'historique" avec confirmation
   - Appelle `PUT /api/chat/messages/{id}/delete` pour chaque message (soft delete)
   - Option "🔄 Changer d'identité" pour réinitialiser le client

5. ✅ **Sélecteur de mode dans CoachDashboard**:
   - Dropdown avec 3 options: 🤖 IA, 👤 Humain, 👥 Communauté
   - Change le mode via `PUT /api/chat/sessions/{id}`
   - Indicateur visuel coloré selon le mode
   - Input de réponse visible uniquement en mode Humain/Communauté

6. ✅ **Tests automatisés complets**:
   - iteration_28: 17/17 backend tests (100%)
   - Tous les modes (ai/human/community) testés
   - Suppression et restauration de messages testées
   - Liens cliquables vérifiés

### Finalisation Globale - Phase Finale (21 Jan 2026)
1. ✅ **Emojis Personnalisés (Upload Coach)**:
   - Collection `custom_emojis` avec `id`, `name`, `image_data` (base64), `category`
   - Endpoint `POST /api/chat/emojis` - upload emoji avec validation base64
   - Endpoint `GET /api/chat/emojis` - liste tous les emojis actifs
   - Endpoint `DELETE /api/chat/emojis/{id}` - suppression emoji
   - Picker emoji dans l'input coach avec preview et upload
   - Tags `[emoji:id]` remplacés par `<img>` lors de l'envoi

2. ✅ **Discussions Privées (Chat Communautaire)**:
   - Endpoint `POST /api/chat/start-private` - crée session privée entre 2 participants
   - Vérifie si une session existe déjà entre les 2 personnes
   - Mode `human` automatiquement activé pour les discussions privées
   - Message de bienvenue système automatique
   - Dans le widget: clic sur le nom d'un participant → `startPrivateChat()`
   - Indicateur "💬 Discussion privée avec {nom}" dans le header

3. ✅ **Intelligence IA (Ventes)**:
   - Prompt enrichi avec catalogue produits/offres/cours
   - Récupération automatique des offres actives et cours disponibles
   - IA capable de proposer des liens de paiement et réservation
   - Réponses concises (max 3 phrases) et orientées conversion

4. ✅ **Synchronisation CRM & Codes Promo**:
   - `allContacts` combine Users + Reservations + Chat Participants
   - `addManualContact()` crée aussi dans `chat_participants` (source: "manual_promo")
   - Contacts CRM visibles et sélectionnables dans les codes promo
   - Traçabilité de la source dans toutes les vues

5. ✅ **Gestion Liens et Suppression**:
   - Boutons suppression 🗑️ sur liens, sessions et contacts
   - `DELETE /api/chat/participants/{id}` avec nettoyage sessions
   - Soft delete sessions avec `is_deleted: true`
   - Mise à jour instantanée UI après suppression

6. ✅ **Tests automatisés**:
   - iteration_30: 15/15 backend tests (100%)
   - Custom Emojis CRUD testé
   - Private Chat testé avec sessions existantes
   - Code review complet passé

### Notifications Push & Coach (21 Jan 2026)
1. ✅ **Web Push API (Notifications Navigateur)**:
   - Service Worker `/public/sw.js` pour recevoir et afficher les notifications
   - Service `pushNotificationService.js` pour gérer les souscriptions côté client
   - Endpoint `GET /api/push/vapid-key` - retourne la clé VAPID publique
   - Endpoint `POST /api/push/subscribe` - enregistre une souscription push
   - Endpoint `DELETE /api/push/subscribe/{id}` - désactive une souscription
   - Endpoint `POST /api/push/send` - envoie une notification push à un participant
   - Clés VAPID configurées dans backend/.env
   - Intégration avec `pywebpush` pour l'envoi serveur

2. ✅ **Email via Resend (PRODUCTION - 22 Jan 2026)**:
   - Clé API Resend configurée dans backend/.env
   - Domaine vérifié: `afroboosteur.com`
   - Adresse d'expédition: `notifications@afroboosteur.com`
   - **EmailJS supprimé** - Resend est le moteur unique d'envoi
   - Endpoint `/api/campaigns/send-email` pour les campagnes marketing
   - Fonction `send_backup_email()` pour backup notifications push
   - Template HTML stylisé avec branding Afroboost

3. ✅ **Notifications Coach (Mode Humain)**:
   - Fonction `notify_coach_new_message()` notifie le coach par email
   - Appelée automatiquement quand un message arrive en mode "human"
   - Flag `coach_notified: true` dans la réponse API
   - Email envoyé à l'adresse du coach depuis `coach_auth`

4. ✅ **Tests automatisés**:
   - iteration_31: 14/14 backend tests (100%)
   - VAPID key endpoint testé
   - Subscribe/Unsubscribe testés avec validation
   - Push send avec fallback email testé
   - Toggle AI mode testé
   - Coach notification en mode human testée

### Interface Coach Améliorée (21 Jan 2026)
1. ✅ **Bouton Test Notification Push**:
   - Bouton orange "🔔 Test Notif" dans l'en-tête Conversations
   - Demande automatique de permission si nécessaire
   - Enregistre le Service Worker et affiche une notification test
   - Messages d'erreur clairs si non supporté ou bloqué

2. ✅ **Export CSV des Contacts CRM**:
   - Bouton violet "📥 Exporter CSV" dans la section CRM
   - Colonnes: Nom, Email, WhatsApp, Date inscription, Source, Montant commandes
   - Format UTF-8 BOM pour compatibilité Excel
   - Nom de fichier automatique: `contacts_crm_YYYY-MM-DD.csv`

3. ✅ **Guide Utilisateur**:
   - Fichier `/public/guide-utilisateur.md` accessible en ligne
   - Instructions pour activer les notifications (iPhone/Android)
   - Guide pour télécharger les contacts CSV
   - Explication des modes IA vs Humain

### P1 - À faire
- [x] ~~**CRITICAL: Refactoring de App.js**~~ - ✅ COMPLÉTÉ - App.js réduit de 52%
- [x] ~~**Notifications email après réservation**~~ - ✅ COMPLÉTÉ
- [x] ~~**Recherche floue**~~ - ✅ COMPLÉTÉ
- [x] ~~**Duplication cours**~~ - ✅ COMPLÉTÉ
- [x] ~~**Séparation Cours/Produits**~~ - ✅ COMPLÉTÉ
- [x] ~~**Archivage cours**~~ - ✅ COMPLÉTÉ
- [x] ~~**Correction Bug DataCloneError**~~ - ✅ COMPLÉTÉ (20 Jan 2026)
- [x] ~~**Système de Chat Backend**~~ - ✅ COMPLÉTÉ (21 Jan 2026)
- [x] ~~**Frontend Chat Amélioré**~~ - ✅ COMPLÉTÉ (21 Jan 2026)
- [x] ~~**UX Mobile Chat Widget**~~ - ✅ COMPLÉTÉ (21 Jan 2026) - Widget 85vh mobile, 70vh tablet
- [x] ~~**Recherche Globale CRM**~~ - ✅ COMPLÉTÉ (21 Jan 2026)
- [x] ~~**Suppression Multi-Plateforme**~~ - ✅ COMPLÉTÉ (21 Jan 2026)
- [ ] **Migration CSS variables** : Refactoriser les styles inline (`style={{ color: '#D91CD2' }}`) pour utiliser les variables CSS `--primary-color` et `--glow-color`
- [ ] **Lecteur Audio Côté Client** : Implémenter le lecteur audio sur la page publique pour les cours ayant une playlist
- [ ] **Optimisation Backend MongoDB** - Appliquer pagination et projection sur les requêtes pour améliorer les performances en production.
- [ ] Continuer refactoring: Extraire CoachLoginModal dans composant séparé
- [ ] Tests automatisés pour les composants extraits

### UX & CRM Améliorations (21 Jan 2026)
1. ✅ **Widget Chat Responsive Mobile**:
   - Widget occupe 85vh sur mobile (< 640px) 
   - Widget occupe 70vh sur tablet (641px - 1024px)
   - Classes CSS `.chat-widget-window` et `.chat-widget-button` avec media queries
   - Interface fluide et lisible sur tous les appareils

2. ✅ **Recherche Globale Conversations**:
   - État `conversationSearch` avec input de recherche
   - Filtrage en temps réel des liens, sessions et contacts
   - Indicateur de résultats "X lien(s), Y conversation(s), Z contact(s)"
   - Bouton ✕ pour effacer la recherche

3. ✅ **Scroll Interne CRM**:
   - Table CRM avec `maxHeight: 350px` et `overflowY: auto`
   - Header sticky pour navigation facile
   - Colonnes responsives (certaines masquées sur mobile)
   - Statistiques CRM en bas (Total, Via liens, Via widget, Manuel)

4. ✅ **Suppression Multi-Plateforme**:
   - Endpoint `DELETE /api/chat/participants/{id}` avec nettoyage sessions
   - Fonction `deleteChatParticipant()` avec confirmation
   - Fonction `deleteChatSession()` (soft delete)
   - Boutons 🗑️ sur sessions et contacts
   - Mise à jour instantanée de l'UI après suppression

5. ✅ **Synchronisation CRM**:
   - `allContacts` combine Users + Reservations + Chat Participants
   - Source traçable (users, reservations, chat_crm, link_xxx)
   - Contacts du CRM disponibles dans toutes les vues

6. ✅ **Tests automatisés**:
   - iteration_29: 9/9 backend tests (100%)
   - Responsive mobile/tablet vérifié
   - Code review complet passé

### P2 - Backlog
- [ ] Créer pages dédiées: /boutique, /profil (routing Vercel)
- [ ] Envoi Email via mailto: avec sujet personnalisé
- [ ] Envoi Instagram via ig.me
- [ ] Dashboard analytics pour le coach
- [ ] Ajouter une vue "Leads" dans le Mode Coach pour visualiser les contacts capturés
- [ ] Export CSV des contacts CRM
- [ ] Manuel utilisateur pour le coach
- [ ] Configurer RESEND_API_KEY pour activer les vraies notifications email

---

## Data Models (MongoDB) - Mis à jour

### Collections Chat Amélioré (NOUVEAU)
- `chat_participants`: `{id, name, whatsapp, email, source, link_token, created_at, last_seen_at}`
- `chat_sessions`: `{id, participant_ids, mode, is_ai_active, is_deleted, link_token, title, notes, created_at, updated_at, deleted_at}`
- `chat_messages`: `{id, session_id, sender_id, sender_name, sender_type, content, mode, is_deleted, created_at, deleted_at}`
- `push_subscriptions` **(NOUVEAU)**: `{participant_id, subscription (endpoint, keys), active, created_at, updated_at}`
- `custom_emojis`: `{id, name, image_data (base64), category, active, created_at}`

---

## Credentials
- **Coach Login**: coach@afroboost.com / afroboost123
- **Coach Access**: 3 clics rapides sur "© Afroboost 2026"

---

## Known Limitations
~~⚠️ **DONNÉES NON PERSISTANTES**: Le backend utilise actuellement des listes en mémoire.~~ 
✅ **Résolu**: Toutes les données sont maintenant persistées dans MongoDB (cours, offres, réservations, configurations, leads).
