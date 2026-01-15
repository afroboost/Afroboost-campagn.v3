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

### Architecture Vercel (15 Jan 2026)
1. ✅ **Structure modulaire initiée**:
   - `/frontend/src/config/index.js` - Configuration groupée
   - `/frontend/src/config/constants.js` - Constantes exportées
   - `/frontend/vercel.json` - Configuration routing Vercel
   - `/frontend/ARCHITECTURE.md` - Documentation structure

2. ⏳ **Prochaine étape**: Refactoriser App.js en composants séparés

---

## Technical Architecture

```
/app/
├── backend/
│   ├── server.py       # FastAPI avec MongoDB
│   ├── requirements.txt
│   └── tests/
│       ├── test_afroboost_api.py
│       └── test_campaigns_api.py
└── frontend/
    ├── src/
    │   ├── App.js      # Composant React principal (monolithique)
    │   └── App.css     # Styles néon
    └── public/
        ├── index.html  # PWA meta tags
        └── manifest.json
```

### Data Models (MongoDB)
- `courses`: id, name, weekday, time, locationName, mapsUrl, visible
- `offers`: id, name, price, thumbnail, description, visible
- `users`: id, name, email, whatsapp, createdAt
- `reservations`: id, reservationCode, userId, userName, userEmail, courseId, ...
- `discount_codes`: id, code, type, value, assignedEmail, courses, maxUses, used, active
- `concept`: id, description, heroImageUrl, logoUrl, faviconUrl
- `payment_links`: id, stripe, paypal, twint, coachWhatsapp
- `campaigns`: id, name, message, mediaUrl, mediaFormat, targetType, selectedContacts, channels, scheduledAt, status, results, createdAt

---

## Prioritized Backlog

### P0 - Completed ✅
- [x] Module Gestionnaire de Campagnes complet
- [x] Envoi WhatsApp avec aperçu média
- [x] Programmation multi-dates
- [x] Indicateurs d'erreur visuels

### P1 - En attente
- [ ] Migration vers vraie persistance MongoDB (actuellement données en mémoire perdues au redémarrage)
- [ ] Refactoring App.js en composants modulaires (fichier > 2000 lignes)

### P2 - Backlog
- [ ] Envoi Email via mailto: avec sujet personnalisé
- [ ] Envoi Instagram via ig.me
- [ ] Notifications email après réservation
- [ ] Dashboard analytics pour le coach

---

## Credentials
- **Coach Login**: coach@afroboost.com / afroboost123
- **Coach Access**: 3 clics rapides sur "© Afroboost 2026"

---

## Known Limitations
⚠️ **DONNÉES NON PERSISTANTES**: Le backend utilise actuellement des listes en mémoire. Toutes les données sont perdues au redémarrage du serveur. La migration vers MongoDB est prioritaire pour la production.
