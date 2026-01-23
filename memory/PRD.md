# Afroboost - Product Requirements Document

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

### Système de Lecteur Média Unifié (V3 - 23 Jan 2026)
- [x] **MediaViewer Mode Cinéma V3** : Player sans marquage YouTube initial
- [x] **Bouton Play rose #E91E63** : Design personnalisé au centre de la thumbnail
- [x] **Bouton CTA rose #E91E63** : Point focal sous la vidéo
- [x] **Aspect-ratio 16:9** : Lecteur vidéo sans bandes noires
- [x] **Support vidéos directes** : MP4/WebM via `<video>` HTML5 natif
- [x] **Affichage dynamique** : Titre (au-dessus), Description (pre-wrap), CTA (après)
- [x] **Template Email V3** : Ratio texte/image amélioré, salutation personnalisée

---

## What's Been Implemented (23 Jan 2026)

### MediaViewer V3 - Player Sans Marquage
1. ✅ **Bouton Play personnalisé** : SVG rose #E91E63 au centre de la thumbnail
2. ✅ **AUCUN marquage YouTube initial** : L'iframe YouTube ne s'affiche qu'après clic
3. ✅ **Support vidéos directes** : Détection automatique MP4/WebM → `<video>` natif
4. ✅ **Design Mode Cinéma** : Fond #0c0014, coins arrondis 12px, ombre rose
5. ✅ **Bouton CTA proéminent** : Rose #E91E63, uppercase, letter-spacing

### Template Email V3 - Délivrabilité Maximale
1. ✅ **Salutation personnalisée** : "Salut {prénom},"
2. ✅ **Texte AVANT image** : Améliore ratio texte/image
3. ✅ **Structure table HTML** : Compatibilité email maximale
4. ✅ **Bouton CTA #E91E63** : Cohérent avec la marque

### Tests Validés
- **Backend** : 10/10 tests passés (iteration 33)
- **Frontend** : Player V3 vérifié, aucun marquage YouTube visible
- **Email** : Template V3 envoyé avec succès

---

## Technical Architecture

```
/app/
├── backend/
│   ├── server.py       # FastAPI avec AI Webhook, MongoDB, Media API
│   └── .env            # MONGO_URL, RESEND_API_KEY, FRONTEND_URL
└── frontend/
    ├── src/
    │   ├── App.js      # Point d'entrée, routage /v/{slug}
    │   ├── components/
    │   │   ├── CoachDashboard.js # Monolithe ~6000 lignes
    │   │   └── MediaViewer.js    # Lecteur vidéo V3 Mode Cinéma
    │   └── services/
    └── .env            # REACT_APP_BACKEND_URL
```

### Key API Endpoints - Media
- `POST /api/media/create`: Crée un lien média
- `GET /api/media`: Liste tous les liens
- `GET /api/media/{slug}`: Récupère les détails + incrémente vues
- `PUT /api/media/{slug}`: Modifie title, description, cta_text, cta_link
- `DELETE /api/media/{slug}`: Supprime un lien
- `GET /api/share/{slug}`: Page HTML OpenGraph pour aperçus WhatsApp

### Data Model - media_links
```json
{
  "id": "uuid",
  "slug": "string",
  "video_url": "https://youtube.com/watch?v=xxx | https://example.com/video.mp4",
  "youtube_id": "xxx (si YouTube)",
  "title": "string",
  "description": "string",
  "thumbnail": "url",
  "cta_text": "RÉSERVER MA PLACE",
  "cta_link": "https://afroboosteur.com",
  "views": 0,
  "created_at": "ISO date"
}
```

---

## Prioritized Backlog

### P0 - Completed ✅
- [x] MediaViewer V3 sans marquage YouTube
- [x] Template Email V3 avec ratio texte/image
- [x] Tests automatisés

### P1 - À faire
- [ ] **Refactoring CoachDashboard.js** : Extraire composants (>6000 lignes)
- [ ] **Export CSV contacts CRM** : Valider le flux de bout en bout

### P2 - Backlog
- [ ] Dashboard analytics pour le coach
- [ ] Support upload vidéo direct (MP4)
- [ ] Manuel utilisateur

---

## Credentials
- **Coach Access**: 3 clics rapides sur "© Afroboost 2025" → Login Google OAuth
- **Email autorisé**: contact.artboost@gmail.com
- **Test Media Slug**: session-finale
- **URL de test**: https://mediahub-973.preview.emergentagent.com/v/session-finale

---

## Known Limitations
- **YouTube branding après clic** : Une fois la vidéo en lecture, le branding YouTube apparaît (limitation API YouTube). Solution: héberger des vidéos MP4 directement.
- **Emails Promotions** : Le template V3 améliore la délivrabilité mais ne garantit pas 100% l'arrivée en boîte principale.
