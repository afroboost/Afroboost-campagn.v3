# Afroboost - Architecture Modulaire

## Structure du Projet (Compatible Vercel)

```
frontend/
├── public/
│   ├── index.html
│   ├── manifest.json
│   ├── sw.js
│   └── og-image.png
├── src/
│   ├── components/          # Composants réutilisables
│   │   ├── ui/              # UI primitives (Button, Input, Card, Modal)
│   │   ├── LanguageSelector.jsx
│   │   ├── OfferCard.jsx    # (à extraire de App.js)
│   │   ├── CoachLogin.jsx   # (à extraire de App.js)
│   │   └── QRScanner.jsx    # (à extraire de App.js)
│   ├── pages/               # Pages (futures routes)
│   │   ├── Home.jsx
│   │   ├── Shop.jsx         # /boutique
│   │   └── Profile.jsx      # /profil
│   ├── hooks/               # Hooks personnalisés
│   │   └── index.js
│   ├── utils/               # Utilitaires
│   │   └── i18n.js          # Traductions
│   ├── config/              # Configuration
│   │   └── index.js
│   ├── context/             # React Context (état global)
│   ├── App.js               # Composant principal
│   └── App.css              # Styles globaux
├── vercel.json              # Configuration Vercel
└── package.json
```

## Configuration Vercel

Le fichier `vercel.json` gère :
- **Rewrites** : Toutes les routes redirigent vers `/` (SPA)
- **Headers** : Sécurité (X-Frame-Options, X-XSS-Protection)

## Variables d'Environnement

```env
REACT_APP_BACKEND_URL=https://votre-api.vercel.app
```

## Développement

```bash
# Installation
yarn install

# Développement local
yarn start

# Build production
yarn build
```

## Déploiement Vercel

1. Connecter le repo GitHub à Vercel
2. Configurer les variables d'environnement
3. Vercel détecte automatiquement Create React App

## Contact Admin

**Email** : contact.artboost@gmail.com

## Standards de Code

- Composants fonctionnels React
- Hooks pour la logique
- CSS avec classes Tailwind + styles personnalisés
- Imports absolus recommandés
- TypeScript compatible (à migrer)
