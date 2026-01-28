# Afroboost - Document de Référence Produit (PRD)

## Mise à jour du 28 Janvier 2026 - Sécurisation IA et Campaign Prompt

### Nouvelles fonctionnalités :
- **Campaign Prompt PRIORITAIRE** : Nouveau champ `campaignPrompt` dans la config IA
  - Placé à la FIN du contexte avec encadrement "CONTEXTE PRIORITAIRE ET OBLIGATOIRE"
  - Écrase les règles par défaut si défini (ex: "Réponds en majuscules")
  - Configurable dans Dashboard > Conversations > Agent IA
  - data-testid: `campaign-prompt-input`

- **Restriction HORS-SUJET** : L'IA refuse les questions non liées aux produits/cours/offres
  - Réponse automatique: "Désolé, je suis uniquement programmé pour vous assister sur nos offres et formations. 🙏"
  - Exemples refusés: cuisine, politique, météo, conseils généraux

- **Protection des codes promo** : Les codes textuels ne sont JAMAIS transmis à l'IA
  - L'IA ne peut pas inventer ni révéler de codes promotionnels
  - Section "PROMOS SPÉCIALES" supprimée du contexte IA

### Fichiers modifiés :
- `/app/backend/server.py` : Modèle `AIConfig` + endpoints `/api/chat` et `/api/chat/ai-response`
- `/app/frontend/src/components/CoachDashboard.js` : Nouveau champ textarea pour `campaignPrompt`

---

## Mise à jour du 26 Janvier 2025 - Widget Chat Mobile

### Modifications apportées :
- **Affichage des noms** : Chaque message reçu affiche maintenant le nom de l'expéditeur AU-DESSUS de la bulle
- **Différenciation des types** :
  - Coach humain → Bulle violette (#8B5CF6), nom en jaune/or, badge "🏋️ Coach"
  - Assistant IA → Bulle gris foncé, nom en violet clair "🤖 Assistant"
  - Membres → Bulle gris foncé, nom en cyan
- **Alignement corrigé** : Messages envoyés à droite, messages reçus à gauche
- **Fichier modifié** : `/app/frontend/src/components/ChatWidget.js`

## Original Problem Statement
Application de réservation de casques audio pour des cours de fitness Afroboost. Design sombre néon avec fond noir pur (#000000) et accents rose/violet.

**Extension - Système de Lecteur Média Unifié** : Création de pages de destination vidéo épurées (`afroboosteur.com/v/[slug]`) avec miniatures personnalisables, bouton d'appel à l'action (CTA), et aperçus riches (OpenGraph) pour le partage sur les réseaux sociaux.

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
- [x] Login avec Google OAuth (contact.artboost@gmail.com)
- [x] Tableau de bord avec onglets multiples

### Système de Lecteur Média Unifié (V5 FINAL - 23 Jan 2026)
- [x] **Lecteur HTML5 natif** : iframe Google Drive sans marquage YouTube
- [x] **ZÉRO MARQUAGE** : Aucun logo YouTube, contrôles Google Drive
- [x] **Bouton Play rose #E91E63** : Design personnalisé au centre de la thumbnail
- [x] **Bouton CTA rose #E91E63** : Point focal centré sous la vidéo
- [x] **Responsive mobile** : Testé sur iPhone X (375x812)
- [x] **Template Email V5** : Anti-promotions avec texte brut AVANT le header violet

### Gestion des Campagnes (23 Jan 2026)
- [x] **Création de campagnes** : Nom, message, mediaUrl, contacts ciblés, canaux
- [x] **Modification de campagnes** : Bouton ✏️ pour éditer les campagnes draft/scheduled
- [x] **Lancement de campagnes** : Envoi via Resend (email) avec template V5
- [x] **Historique** : Tableau avec statuts (draft, scheduled, sending, completed)

---

## What's Been Implemented (24 Jan 2026)

### 🔥 Bug Fix: Chat IA - Vision Totale du Site
**Problème:** L'IA du ChatWidget était "aveugle" aux données dynamiques (produits, articles). Elle ne reconnaissait pas les produits existants comme "café congolais" lors des conversations.

**Cause Racine:** Le frontend utilise `/api/chat/ai-response` (pas `/api/chat`) quand l'utilisateur a une session active. Cette route avait un contexte DIFFÉRENT et incomplet:
- Requête MongoDB erronée: `{active: True}` au lieu de `{visible: {$ne: False}}`
- Pas de distinction produits (`isProduct: True`) vs services
- Contexte tronqué sans produits, cours, ni articles

**Correction:** 
- Route `/api/chat/ai-response` dans `/app/backend/server.py` (lignes 3192+)
- Contexte dynamique complet synchronisé avec `/api/chat`:
  - Produits (isProduct: True)
  - Services/Offres
  - Cours disponibles
  - Articles et actualités
  - Codes promo actifs
- Logs de diagnostic ajoutés pour traçabilité

**Validation:** Test E2E réussi - L'IA répond maintenant:
> "Salut TestUser ! 😊 Oui, nous avons du café congolais en vente. Il est disponible pour 10.0 CHF."

---

### 💳 Nouvelle Fonctionnalité: Lien de Paiement Twint Dynamique
**Objectif:** Permettre au coach de définir un lien Twint et faire en sorte que l'IA le propose automatiquement aux clients.

**Implémentation:**
1. **Backend (`/app/backend/server.py`):**
   - Champ `twintPaymentUrl` ajouté au modèle `AIConfig` (ligne 2130)
   - Injection du lien dans le contexte IA (routes `/api/chat` et `/api/chat/ai-response`)
   - Instruction conditionnelle: si lien vide → redirection vers coach

2. **Frontend (`/app/frontend/src/components/CoachDashboard.js`):**
   - Champ texte "💳 Lien de paiement Twint" dans la section Agent IA (ligne 5381)
   - data-testid: `twint-payment-url-input`
   - Warning affiché si non configuré

**Validation:** Test E2E réussi - Quand on demande "Je veux acheter le café, comment je paye ?":
> "Pour régler ton achat, clique sur ce lien Twint sécurisé: https://twint.ch/pay/afroboost-test-123 💳"

---

### 🗂️ CRM Avancé - Historique Conversations (24 Jan 2026)
**Objectif:** Transformer la section Conversations en un tableau de bord professionnel avec recherche et scroll performant.

**Backend (`/app/backend/server.py`):**
- Nouvel endpoint `GET /api/conversations` (lignes 2883-2993)
- Paramètres: `page`, `limit` (max 100), `query`, `include_deleted`
- Recherche dans: noms participants, emails, contenu des messages, titres
- Enrichissement: dernier message, infos participants, compteur de messages
- Retour: `conversations`, `total`, `page`, `pages`, `has_more`

**Frontend (`/app/frontend/src/components/CoachDashboard.js`):**
- États CRM: `conversationsPage`, `conversationsTotal`, `conversationsHasMore`, `enrichedConversations`
- `loadConversations()`: Charge les conversations avec pagination
- `loadMoreConversations()`: Infinite scroll (80% du scroll)
- `handleSearchChange()`: Recherche avec debounce 300ms
- `formatConversationDate()`: Badges (Aujourd'hui, Hier, date complète)
- `groupedConversations`: Groupement par date via useMemo

**UI:**
- Barre de recherche avec clear button et compteur de résultats
- Liste avec Infinite Scroll (maxHeight 450px)
- Badges de date sticky entre les groupes
- Messages avec timestamps et séparateurs de date

**Test report:** `/app/test_reports/iteration_37.json` - 100% passed

---

### Fonctionnalité "Modifier une Campagne" (23 Jan 2026)
1. ✅ **Bouton ✏️ (Modifier)** : Visible dans le tableau pour campagnes draft/scheduled
2. ✅ **Pré-remplissage du formulaire** : Nom, message, mediaUrl, contacts, canaux
3. ✅ **Titre dynamique** : "Nouvelle Campagne" → "✏️ Modifier la Campagne"
4. ✅ **Bouton de soumission dynamique** : "🚀 Créer" → "💾 Enregistrer les modifications"
5. ✅ **Bouton Annuler** : Réinitialise le formulaire et sort du mode édition
6. ✅ **API PUT /api/campaigns/{id}** : Met à jour les champs et renvoie la campagne modifiée

### Template Email V5 Anti-Promotions
1. ✅ **3 lignes de texte brut** AVANT le header violet
2. ✅ **Fond clair #f5f5f5** : Plus neutre pour Gmail
3. ✅ **Card compacte 480px** : Réduit de 20%
4. ✅ **Image 400px** : Taille optimisée
5. ✅ **Preheader invisible** : Pour l'aperçu Gmail

### Tests Automatisés - Iteration 34
- **Backend** : 15/15 tests passés (100%)
- **Fichier** : `/app/backend/tests/test_campaign_modification.py`

---

## Technical Architecture

```
/app/
├── backend/
│   ├── server.py       # FastAPI avec Media API, Campaigns API, Email Template V5
│   └── .env            # MONGO_URL, RESEND_API_KEY, FRONTEND_URL
└── frontend/
    ├── src/
    │   ├── App.js      # Point d'entrée, routage /v/{slug}
    │   ├── components/
    │   │   ├── CoachDashboard.js # Gestion campagnes avec édition
    │   │   └── MediaViewer.js    # Lecteur vidéo - Google Drive iframe
    │   └── services/
    └── .env            # REACT_APP_BACKEND_URL
```

### Key API Endpoints - Campaigns
- `GET /api/campaigns`: Liste toutes les campagnes
- `GET /api/campaigns/{id}`: Récupère une campagne
- `POST /api/campaigns`: Crée une nouvelle campagne (status: draft)
- `PUT /api/campaigns/{id}`: **NOUVEAU** - Modifie une campagne existante
- `DELETE /api/campaigns/{id}`: Supprime une campagne
- `POST /api/campaigns/{id}/launch`: Lance l'envoi

### Data Model - campaigns
```json
{
  "id": "uuid",
  "name": "string",
  "message": "string",
  "mediaUrl": "/v/{slug} ou URL directe",
  "mediaFormat": "16:9",
  "targetType": "all | selected",
  "selectedContacts": ["contact_id_1", "contact_id_2"],
  "channels": {"whatsapp": true, "email": true, "instagram": false},
  "status": "draft | scheduled | sending | completed",
  "scheduledAt": "ISO date ou null",
  "results": [...],
  "createdAt": "ISO date",
  "updatedAt": "ISO date"
}
```

---

## Prioritized Backlog

### P0 - Completed ✅
- [x] Lecteur Google Drive sans marquage YouTube
- [x] Template Email V5 Anti-Promotions
- [x] Fonctionnalité "Modifier une Campagne"
- [x] Tests automatisés iteration 34
- [x] **Scheduler de campagnes DAEMON** (24 Jan 2026) - RÉPARÉ ✅
- [x] **Configuration Twilio Production** (24 Jan 2026) - VERROUILLÉE ✅
- [x] **Chat IA - Vision Totale du Site** (24 Jan 2026) - RÉPARÉ ✅
  - Bug: La route `/api/chat/ai-response` n'injectait pas le contexte dynamique (produits, articles)
  - Correction: Synchronisation du contexte avec `/api/chat` (MongoDB: offers, courses, articles)
  - Test: L'IA reconnaît maintenant "café congolais" à "10 CHF" ✅
- [x] **Lien de Paiement Twint Dynamique** (24 Jan 2026) - NOUVEAU ✅
  - Le coach peut configurer un lien Twint dans Dashboard > Conversations > Agent IA > "Lien de paiement Twint"
  - L'IA propose automatiquement ce lien quand un client veut acheter
  - Si le lien est vide, l'IA redirige vers le coach
- [x] **CRM Avancé - Historique Conversations** (24 Jan 2026) - NOUVEAU ✅
  - Endpoint `GET /api/conversations` avec pagination (page, limit) et recherche (query)
  - Frontend avec Infinite Scroll (charge à 80% du scroll)
  - Barre de recherche avec debounce 300ms
  - Badges de date (Aujourd'hui, Hier, date complète)
  - Timestamps précis sur chaque message
  - Séparateurs de date dans l'historique des conversations
- [x] **Notifications Sonores et Visuelles** (24 Jan 2026) - STABILISÉ ✅
  - Backend: Champ `notified` sur messages, endpoints optimisés avec `include_ai` param
  - Frontend: Polling toutes les 10s avec cleanup `clearInterval` propre
  - **BOUTON DE TEST** visible avec logs de debug (NOTIF_DEBUG:)
  - **FALLBACK TOAST** si notifications browser bloquées
  - **Option "Notifier réponses IA"** pour suivre l'activité de l'IA
  - Permission persistée: polling auto si déjà autorisé au refresh
  - Protection contre erreurs son/notif (try/catch, pas de boucle)
  - Garde-fous: Vision IA (café 10 CHF) et Twint non impactés ✅

- [x] **Boutons de Suppression Restaurés** (24 Jan 2026) - RÉPARÉ ✅
  - Nouveau endpoint `DELETE /api/chat/links/{link_id}` pour supprimer les liens
  - Fonction `deleteChatLink()` avec confirmation "Êtes-vous sûr ?"
  - `deleteChatSession()` avec confirmation (suppression logique)
  - `deleteChatParticipant()` avec confirmation (suppression définitive)
  - Tous les boutons 🗑️ fonctionnels avec data-testid

- [x] **Optimisation UI Responsive** (24 Jan 2026) - NOUVEAU ✅
  - Scroll interne pour Offres (max-height: 500px)
  - Scroll interne pour Médias (max-height: 500px)
  - Scroll interne pour Codes Promo (max-height: 400px)
  - Recherche locale pour Offres (filtrage instantané)
  - Recherche locale pour Codes Promo (filtrage instantané)
  - Layout Campagnes responsive (flex-col sur mobile)
  - Boutons pleine largeur sur mobile

- [x] **Fix Permissions Notifications** (24 Jan 2026) - NOUVEAU ✅
  - Banner de demande de permission au premier accès à l'onglet Conversations
  - Fallback Toast interne si notifications browser bloquées
  - Service amélioré avec `getNotificationPermissionStatus()` et `fallbackNeeded`
  - Badge de statut (🔔 actives / 🔕 mode toast)

- [x] **Scroll et Filtrage Réservations** (25 Jan 2026) - NOUVEAU ✅
  - **Scroll interne** : Zone scrollable de 600px max pour desktop et mobile
  - **En-têtes fixes** : `sticky top-0` sur le thead du tableau desktop + `position: relative` sur conteneur
  - **Filtrage optimisé avec useMemo** : `filteredReservations` basé sur `[reservations, reservationsSearch]`
  - **Critères de recherche** : nom, email, WhatsApp, date, code de réservation, nom du cours
  - **Compteur de résultats** : `{filteredReservations.length} résultat(s)` sous la barre de recherche
  - **Message "Aucune réservation correspondante"** : Affiché quand filteredReservations est vide
  - Test report: `/app/test_reports/iteration_41.json` - 100% passed

- [x] **Scanner QR Réparé** (25 Jan 2026) - NOUVEAU ✅
  - CDN Html5Qrcode ajouté dans index.html (ligne 52)
  - Protection fallback si CDN non chargé → mode manuel automatique
  - Modal s'ouvre correctement sans erreur ReferenceError
  - Options caméra et saisie manuelle fonctionnelles
  - Test report: `/app/test_reports/iteration_40.json` - 100% passed

- [x] **Suppressions avec mise à jour UI instantanée** (25 Jan 2026) - VÉRIFIÉ ✅
  - **Logs DELETE_UI** : Tracent les transitions d'état (`Réservations filtrées: 2 -> 1`)
  - Réservations : `setReservations(prev => prev.filter(r => r.id !== id))`
  - Conversations : `setChatSessions`, `setEnrichedConversations`, `setChatLinks` tous mis à jour
  - Test report: `/app/test_reports/iteration_41.json` - 100% passed

### P1 - À faire
- [ ] **Gérer les articles dans le Dashboard** : Interface CRUD pour créer/modifier/supprimer des articles
- [ ] **Activation numéro WhatsApp Suisse (+41)** : En attente approbation Meta (config Twilio bloquée)
- [ ] **Refactoring CoachDashboard.js** : Extraire composants (>6000 lignes)
- [ ] **Export CSV contacts CRM** : Valider le flux de bout en bout

### P2 - Backlog
- [ ] Dashboard analytics pour le coach
- [ ] Support upload vidéo direct depuis le dashboard
- [ ] Manuel utilisateur

---

## Scheduler de Campagnes - INTÉGRÉ AU SERVEUR (24 Jan 2026)

### Architecture
Le scheduler est maintenant **intégré directement dans `server.py`** et démarre automatiquement avec le serveur FastAPI via un thread daemon. Plus besoin de lancement manuel !

### Fichiers
- `/app/backend/server.py` - Contient le scheduler intégré (lignes 4485+)
- `/var/log/supervisor/backend.err.log` - Logs détaillés du scheduler

### Fonctionnalités
- ✅ **DÉMARRAGE AUTOMATIQUE** : Thread lancé au startup du serveur FastAPI
- ✅ **MODE DAEMON** : Boucle `while True` avec `time.sleep(30)`
- ✅ **HEARTBEAT** : Log `[SYSTEM] Scheduler is alive` toutes les 60s
- ✅ **Comparaison UTC** : `datetime.now(timezone.utc)` pour toutes les dates
- ✅ **Isolation des canaux** : Email et WhatsApp dans des `try/except` séparés
- ✅ **Gestion multi-dates** : `scheduledDates[]` → `sentDates[]` → `status: completed`
- ✅ **Erreurs silencieuses** : L'échec d'un canal ne bloque pas les autres

### Vérification du Scheduler
```bash
# Vérifier les logs
tail -f /var/log/supervisor/backend.err.log | grep SCHEDULER

# Chercher le heartbeat
grep "Scheduler is alive" /var/log/supervisor/backend.out.log
```

### Comportement
1. **Au démarrage** : `[SYSTEM] ✅ Scheduler is ONLINE`
2. **Toutes les 30s** : Scan des campagnes `status: scheduled`
3. **Si date passée** : Traitement automatique (email/WhatsApp)
4. **Après traitement** : Mise à jour `sentDates`, `status`, `lastProcessedAt`

---

## Credentials & URLs de Test
- **Coach Access**: 3 clics rapides sur "© Afroboost 2026" → Login Google OAuth
- **Email autorisé**: contact.artboost@gmail.com
- **Test Media Slug**: test-final
- **URL de test**: https://coach-connect-95.preview.emergentagent.com/v/test-final
- **Vidéo Google Drive**: https://drive.google.com/file/d/1AkjHltEq-PAnw8OE-dR-lPPcpP44qvHv/view
