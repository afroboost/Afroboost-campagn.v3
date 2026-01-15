import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import "@/App.css";
import axios from "axios";
import { QRCodeSVG } from "qrcode.react";
import { Html5Qrcode } from "html5-qrcode";
import { 
  getEmailJSConfig, 
  saveEmailJSConfig, 
  isEmailJSConfigured, 
  sendBulkEmails,
  testEmailJSConfig 
} from "./services/emailService";
import {
  getWhatsAppConfig,
  saveWhatsAppConfig,
  isWhatsAppConfigured,
  sendBulkWhatsApp,
  testWhatsAppConfig
} from "./services/whatsappService";
import {
  setLastMediaUrl as setLastMediaUrlService
} from "./services/aiResponseService";
import { 
  NavigationBar, 
  LandingSectionSelector,
  ScrollIndicator,
  useScrollIndicator
} from "./components/SearchBar";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Configuration Admin - Vercel Compatible
const ADMIN_EMAIL = 'contact.artboost@gmail.com';
const APP_VERSION = '2.0.0';

// Translations
const translations = {
  fr: {
    appTitle: "Afroboost",
    conceptDefault: "Le concept Afroboost : cardio + danse afrobeat + casques audio immersifs. Un entraînement fun, énergétique et accessible à tous.",
    chooseSession: "Choisissez votre session",
    chooseOffer: "Choisissez votre offre",
    yourInfo: "Vos informations",
    fullName: "Nom complet",
    emailRequired: "Email (obligatoire)",
    whatsappRequired: "WhatsApp (obligatoire)",
    promoCode: "Code promo",
    total: "Total",
    alreadySubscribed: "Je suis déjà abonné",
    selectProfile: "Sélectionnez votre profil...",
    acceptTerms: "J'accepte les",
    termsLink: "conditions générales",
    termsTitle: "Conditions Générales",
    quantity: "Quantité",
    payAndReserve: "💳 Payer et réserver",
    reserveFree: "Réserver gratuitement",
    loading: "Chargement...",
    copyright: "© Afroboost 2026",
    coachLogin: "Connexion Coach",
    email: "Email",
    password: "Mot de passe",
    login: "Se connecter",
    forgotPassword: "Mot de passe oublié ?",
    cancel: "Annuler",
    coachMode: "Mode Coach",
    back: "← Retour",
    logout: "🚪 Déconnexion",
    reservations: "Réservations",
    conceptVisual: "Concept & Visuel",
    courses: "Cours",
    offers: "Offres",
    payments: "Paiements",
    promoCodes: "Codes promo",
    reservationsList: "Liste des réservations",
    downloadCSV: "📥 Télécharger CSV",
    code: "Code",
    name: "Nom",
    date: "Date",
    time: "Heure",
    offer: "Offre",
    qty: "Qté",
    noReservations: "Aucune réservation pour le moment",
    conceptDescription: "Description du concept",
    mediaUrl: "URL Média Accueil (YouTube, Vimeo, Image)",
    save: "Sauvegarder",
    courseName: "Nom du cours",
    location: "Lieu",
    mapsLink: "Lien Google Maps",
    weekday: "Jour",
    addCourse: "Ajouter un cours",
    offerName: "Nom de l'offre",
    price: "Prix (CHF)",
    visible: "Visible",
    thumbnail: "URL miniature",
    addOffer: "Ajouter une offre",
    stripeLink: "Lien Stripe",
    paypalLink: "Lien PayPal",
    twintLink: "Lien Twint",
    coachWhatsapp: "WhatsApp Coach",
    codePromo: "Code (ex: GRATUIT)",
    type: "Type",
    value: "Valeur",
    beneficiary: "Bénéficiaire",
    selectBeneficiary: "Sélectionner un client...",
    assignedEmail: "Email assigné",
    allowedCourses: "Cours autorisés",
    allCourses: "Tous les cours",
    maxUses: "Utilisations max",
    expiresAt: "Date d'expiration",
    importCSV: "Importer CSV",
    add: "Ajouter",
    noPromoCode: "Aucun code promo",
    active: "Actif",
    inactive: "Inactif",
    used: "Utilisé",
    paymentDone: "Paiement effectué ?",
    paymentConfirmText: "Si vous avez terminé le paiement, cliquez ci-dessous pour valider.",
    confirmPayment: "✅ Confirmer mon paiement",
    reservationConfirmed: "Réservation confirmée !",
    reservationCode: "Code",
    print: "🖨️ Imprimer",
    share: "📱 Partager",
    emailWhatsappRequired: "L'email et le numéro WhatsApp sont obligatoires.",
    invalidPromoCode: "Code promo invalide.",
    noPaymentConfigured: "Paiement requis – réservation impossible.",
    subscriberOnlyCode: "Seuls les abonnés peuvent utiliser ce code.",
    wrongCredentials: "Email ou mot de passe incorrect",
    discount: "Réduction",
    sunday: "Dimanche", monday: "Lundi", tuesday: "Mardi", wednesday: "Mercredi",
    thursday: "Jeudi", friday: "Vendredi", saturday: "Samedi",
    logoUrl: "URL du Logo (Splash Screen & PWA)",
    offerDescription: "Description (icône \"i\")",
    confirmDelete: "Supprimer ce code ?",
    delete: "Supprimer",
    termsText: "Texte des Conditions Générales",
    termsPlaceholder: "Entrez le texte de vos conditions générales de vente...",
    scanToValidate: "Scannez pour valider",
  },
  en: {
    appTitle: "Afroboost",
    conceptDefault: "The Afroboost concept: cardio + afrobeat dance + immersive audio headsets. A fun, energetic workout for everyone.",
    chooseSession: "Choose your session",
    chooseOffer: "Choose your offer",
    yourInfo: "Your information",
    fullName: "Full name",
    emailRequired: "Email (required)",
    whatsappRequired: "WhatsApp (required)",
    promoCode: "Promo code",
    total: "Total",
    alreadySubscribed: "I'm already subscribed",
    selectProfile: "Select your profile...",
    acceptTerms: "I accept the",
    termsLink: "terms and conditions",
    termsTitle: "Terms and Conditions",
    quantity: "Quantity",
    payAndReserve: "💳 Pay and reserve",
    reserveFree: "Reserve for free",
    loading: "Loading...",
    copyright: "© Afroboost 2026",
    coachLogin: "Coach Login",
    email: "Email",
    password: "Password",
    login: "Log in",
    forgotPassword: "Forgot password?",
    cancel: "Cancel",
    coachMode: "Coach Mode",
    back: "← Back",
    logout: "🚪 Logout",
    reservations: "Reservations",
    conceptVisual: "Concept & Visual",
    courses: "Courses",
    offers: "Offers",
    payments: "Payments",
    promoCodes: "Promo codes",
    reservationsList: "Reservations list",
    downloadCSV: "📥 Download CSV",
    code: "Code",
    name: "Name",
    date: "Date",
    time: "Time",
    offer: "Offer",
    qty: "Qty",
    noReservations: "No reservations yet",
    conceptDescription: "Concept description",
    mediaUrl: "Media URL (YouTube, Vimeo, Image)",
    save: "Save",
    courseName: "Course name",
    location: "Location",
    mapsLink: "Google Maps link",
    weekday: "Day",
    addCourse: "Add course",
    offerName: "Offer name",
    price: "Price (CHF)",
    visible: "Visible",
    thumbnail: "Thumbnail URL",
    addOffer: "Add offer",
    stripeLink: "Stripe link",
    paypalLink: "PayPal link",
    twintLink: "Twint link",
    coachWhatsapp: "Coach WhatsApp",
    codePromo: "Code (e.g. FREE)",
    type: "Type",
    value: "Value",
    beneficiary: "Beneficiary",
    selectBeneficiary: "Select a customer...",
    assignedEmail: "Assigned email",
    allowedCourses: "Allowed courses",
    allCourses: "All courses",
    maxUses: "Max uses",
    expiresAt: "Expiration date",
    importCSV: "Import CSV",
    add: "Add",
    noPromoCode: "No promo code",
    active: "Active",
    inactive: "Inactive",
    used: "Used",
    paymentDone: "Payment done?",
    paymentConfirmText: "If you completed the payment, click below to validate.",
    confirmPayment: "✅ Confirm my payment",
    reservationConfirmed: "Reservation confirmed!",
    reservationCode: "Code",
    print: "🖨️ Print",
    share: "📱 Share",
    emailWhatsappRequired: "Email and WhatsApp are required.",
    invalidPromoCode: "Invalid promo code.",
    noPaymentConfigured: "Payment required – reservation impossible.",
    subscriberOnlyCode: "Only subscribers can use this code.",
    wrongCredentials: "Wrong email or password",
    discount: "Discount",
    sunday: "Sunday", monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday",
    thursday: "Thursday", friday: "Friday", saturday: "Saturday",
    logoUrl: "Logo URL (Splash Screen & PWA)",
    offerDescription: "Description (\"i\" icon)",
    confirmDelete: "Delete this code?",
    delete: "Delete",
    termsText: "Terms and Conditions Text",
    termsPlaceholder: "Enter your terms and conditions text...",
    scanToValidate: "Scan to validate",
  },
  de: {
    appTitle: "Afroboost",
    conceptDefault: "Das Afroboost-Konzept: Cardio + Afrobeat-Tanz + immersive Audio-Kopfhörer. Ein spaßiges Training für alle.",
    chooseSession: "Wählen Sie Ihre Sitzung",
    chooseOffer: "Wählen Sie Ihr Angebot",
    yourInfo: "Ihre Informationen",
    fullName: "Vollständiger Name",
    emailRequired: "E-Mail (erforderlich)",
    whatsappRequired: "WhatsApp (erforderlich)",
    promoCode: "Promo-Code",
    total: "Gesamt",
    alreadySubscribed: "Ich bin bereits abonniert",
    selectProfile: "Wählen Sie Ihr Profil...",
    acceptTerms: "Ich akzeptiere die",
    termsLink: "Allgemeinen Geschäftsbedingungen",
    termsTitle: "Allgemeine Geschäftsbedingungen",
    quantity: "Menge",
    payAndReserve: "💳 Zahlen und reservieren",
    reserveFree: "Kostenlos reservieren",
    loading: "Laden...",
    copyright: "© Afroboost 2026",
    coachLogin: "Coach-Anmeldung",
    email: "E-Mail",
    password: "Passwort",
    login: "Anmelden",
    forgotPassword: "Passwort vergessen?",
    cancel: "Abbrechen",
    coachMode: "Coach-Modus",
    back: "← Zurück",
    logout: "🚪 Abmelden",
    reservations: "Reservierungen",
    conceptVisual: "Konzept & Visuell",
    courses: "Kurse",
    offers: "Angebote",
    payments: "Zahlungen",
    promoCodes: "Promo-Codes",
    reservationsList: "Reservierungsliste",
    downloadCSV: "📥 CSV herunterladen",
    code: "Code",
    name: "Name",
    date: "Datum",
    time: "Zeit",
    offer: "Angebot",
    qty: "Menge",
    noReservations: "Noch keine Reservierungen",
    conceptDescription: "Konzeptbeschreibung",
    mediaUrl: "Medien-URL (YouTube, Vimeo, Bild)",
    save: "Speichern",
    courseName: "Kursname",
    location: "Ort",
    mapsLink: "Google Maps Link",
    weekday: "Tag",
    addCourse: "Kurs hinzufügen",
    offerName: "Angebotsname",
    price: "Preis (CHF)",
    visible: "Sichtbar",
    thumbnail: "Miniatur-URL",
    addOffer: "Angebot hinzufügen",
    stripeLink: "Stripe-Link",
    paypalLink: "PayPal-Link",
    twintLink: "Twint-Link",
    coachWhatsapp: "Coach WhatsApp",
    codePromo: "Code (z.B. GRATIS)",
    type: "Typ",
    value: "Wert",
    beneficiary: "Begünstigter",
    selectBeneficiary: "Kunden auswählen...",
    assignedEmail: "Zugewiesene E-Mail",
    allowedCourses: "Erlaubte Kurse",
    allCourses: "Alle Kurse",
    maxUses: "Max. Nutzungen",
    expiresAt: "Ablaufdatum",
    importCSV: "CSV importieren",
    add: "Hinzufügen",
    noPromoCode: "Kein Promo-Code",
    active: "Aktiv",
    inactive: "Inaktiv",
    used: "Verwendet",
    paymentDone: "Zahlung abgeschlossen?",
    paymentConfirmText: "Wenn Sie die Zahlung abgeschlossen haben, klicken Sie unten.",
    confirmPayment: "✅ Zahlung bestätigen",
    reservationConfirmed: "Reservierung bestätigt!",
    reservationCode: "Code",
    print: "🖨️ Drucken",
    share: "📱 Teilen",
    emailWhatsappRequired: "E-Mail und WhatsApp sind erforderlich.",
    invalidPromoCode: "Ungültiger Promo-Code.",
    noPaymentConfigured: "Zahlung erforderlich.",
    subscriberOnlyCode: "Nur Abonnenten können diesen Code verwenden.",
    wrongCredentials: "Falsche E-Mail oder Passwort",
    discount: "Rabatt",
    sunday: "Sonntag", monday: "Montag", tuesday: "Dienstag", wednesday: "Mittwoch",
    thursday: "Donnerstag", friday: "Freitag", saturday: "Samstag",
    logoUrl: "Logo-URL (Splash Screen & PWA)",
    offerDescription: "Beschreibung (\"i\" Symbol)",
    confirmDelete: "Diesen Code löschen?",
    delete: "Löschen",
    termsText: "AGB-Text",
    termsPlaceholder: "Geben Sie Ihren AGB-Text ein...",
    scanToValidate: "Zum Validieren scannen",
  }
};

const WEEKDAYS_MAP = {
  fr: ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  de: ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"]
};

// Helper functions
function getNextOccurrences(weekday, count = 4) {
  const now = new Date();
  const results = [];
  const day = now.getDay();
  let diff = weekday - day;
  if (diff < 0) diff += 7;
  let current = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
  for (let i = 0; i < count; i++) {
    results.push(new Date(current));
    current.setDate(current.getDate() + 7);
  }
  return results;
}

function formatDate(d, time, lang) {
  const formatted = d.toLocaleDateString(lang === 'de' ? 'de-CH' : lang === 'en' ? 'en-GB' : 'fr-CH', {
    weekday: "short", day: "2-digit", month: "2-digit"
  });
  return `${formatted} • ${time}`;
}

// Parse media URL (YouTube, Vimeo, Image)
function parseMediaUrl(url) {
  if (!url || typeof url !== 'string') return null;
  
  const trimmedUrl = url.trim();
  if (!trimmedUrl) return null;
  
  // YouTube - Support multiple formats
  // youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID, youtube.com/v/ID
  const ytMatch = trimmedUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return { type: 'youtube', id: ytMatch[1] };
  
  // Vimeo - Support multiple formats
  const vimeoMatch = trimmedUrl.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeoMatch) return { type: 'vimeo', id: vimeoMatch[1] };
  
  // Video files - MP4, WebM, MOV, AVI
  const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.m4v', '.ogv'];
  const lowerUrl = trimmedUrl.toLowerCase();
  if (videoExtensions.some(ext => lowerUrl.includes(ext))) {
    return { type: 'video', url: trimmedUrl };
  }
  
  // Image - Accept all common formats and CDN URLs
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico'];
  const imageCDNs = ['imgbb.com', 'cloudinary.com', 'imgur.com', 'unsplash.com', 'pexels.com', 'i.ibb.co'];
  
  if (imageExtensions.some(ext => lowerUrl.includes(ext)) || imageCDNs.some(cdn => lowerUrl.includes(cdn))) {
    return { type: 'image', url: trimmedUrl };
  }
  
  // Default: treat as image (many CDNs don't have extensions in URLs)
  return { type: 'image', url: trimmedUrl };
}

// Globe Icon - Clean, no background
const GlobeIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
);

// Location Icon
const LocationIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
    <circle cx="12" cy="10" r="3"/>
  </svg>
);

// Folder Icon for CSV Import
const FolderIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
);

// Splash Screen - Pure Black with configurable logo and PWA fallback
const SplashScreen = ({ logoUrl }) => {
  const [imgError, setImgError] = useState(false);
  // Use PWA logo as fallback if no logoUrl or image fails to load
  const fallbackLogo = '/logo512.png';
  const showLogo = logoUrl && !imgError;
  const showFallback = !logoUrl || imgError;
  
  return (
    <div className="splash-screen" style={{ background: '#000000' }}>
      {showLogo && (
        <img 
          src={logoUrl} 
          alt="Afroboost" 
          className="splash-logo" 
          onError={() => setImgError(true)}
        />
      )}
      {showFallback && (
        <img 
          src={fallbackLogo} 
          alt="Afroboost" 
          className="splash-logo" 
          style={{ maxWidth: '150px', maxHeight: '150px' }}
          onError={(e) => { 
            // Ultimate fallback: show emoji if PWA logo also fails
            e.target.style.display = 'none';
            e.target.parentNode.querySelector('.splash-headset-fallback').style.display = 'block';
          }}
        />
      )}
      <div className="splash-headset-fallback" style={{ display: 'none', fontSize: '80px' }}>🎧</div>
      <div className="splash-text">Afroboost</div>
    </div>
  );
};

// Language Selector - Clean without background
const LanguageSelector = ({ lang, setLang }) => {
  const [open, setOpen] = useState(false);
  const languages = [{ code: 'fr', label: 'FR' }, { code: 'en', label: 'EN' }, { code: 'de', label: 'DE' }];

  return (
    <div className="lang-selector" onClick={() => setOpen(!open)} data-testid="lang-selector">
      <GlobeIcon />
      <span style={{ color: '#FFFFFF', fontWeight: '500', fontSize: '14px' }}>{lang.toUpperCase()}</span>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: '8px',
          background: 'rgba(0, 0, 0, 0.95)', border: '1px solid rgba(139, 92, 246, 0.4)',
          borderRadius: '8px', overflow: 'hidden', minWidth: '70px'
        }}>
          {languages.map(l => (
            <div key={l.code} onClick={(e) => { e.stopPropagation(); setLang(l.code); setOpen(false); }}
              style={{ padding: '10px 16px', color: '#FFFFFF', cursor: 'pointer', fontSize: '14px',
                background: lang === l.code ? 'rgba(139, 92, 246, 0.3)' : 'transparent' }}
              data-testid={`lang-${l.code}`}>{l.label}</div>
          ))}
        </div>
      )}
    </div>
  );
};

// Media Display Component (YouTube, Vimeo, Image, Video) - Clean display without dark overlays
const MediaDisplay = ({ url, className }) => {
  const [hasError, setHasError] = useState(false);
  const media = parseMediaUrl(url);
  
  // Placeholder Afroboost par défaut
  const placeholderUrl = "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&h=450&fit=crop";
  
  // Return null if no valid media URL
  if (!media || !url || url.trim() === '') return null;

  // 16:9 container wrapper - Clean without dark filters
  const containerStyle = {
    position: 'relative',
    width: '100%',
    paddingBottom: '56.25%', // 16:9 ratio
    overflow: 'hidden',
    borderRadius: '16px',
    border: '1px solid rgba(217, 28, 210, 0.3)',
    boxShadow: '0 0 30px rgba(217, 28, 210, 0.2)',
    background: '#0a0a0a'
  };

  const contentStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%'
  };

  // Transparent overlay to prevent clicks without hiding content
  const clickBlockerStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: 10,
    cursor: 'default',
    background: 'transparent',
    pointerEvents: 'auto'
  };

  // Afficher le placeholder si erreur de chargement
  if (hasError) {
    return (
      <div className={className} style={containerStyle} data-testid="media-container-placeholder">
        <img 
          src={placeholderUrl} 
          alt="Afroboost" 
          style={{ ...contentStyle, objectFit: 'cover' }}
        />
        <div style={{
          position: 'absolute',
          bottom: '10px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.7)',
          padding: '6px 12px',
          borderRadius: '8px',
          fontSize: '12px',
          color: 'rgba(255,255,255,0.8)'
        }}>
          ⚠️ Média non disponible
        </div>
      </div>
    );
  }

  if (media.type === 'youtube') {
    // YouTube embed - NO dark overlays, just click blocker
    return (
      <div className={className} style={containerStyle} data-testid="media-container-16-9">
        <iframe 
          src={`https://www.youtube.com/embed/${media.id}?autoplay=1&mute=1&loop=1&playlist=${media.id}&modestbranding=1&rel=0&showinfo=0&controls=0&disablekb=1&fs=0&iv_load_policy=3`}
          frameBorder="0" 
          allow="autoplay; encrypted-media" 
          style={contentStyle}
          title="YouTube video"
          onError={() => setHasError(true)}
        />
        {/* Only transparent click blocker - NO dark gradients */}
        <div style={clickBlockerStyle} onClick={(e) => e.preventDefault()} />
      </div>
    );
  }
  
  if (media.type === 'vimeo') {
    return (
      <div className={className} style={containerStyle} data-testid="media-container-16-9">
        <iframe 
          src={`https://player.vimeo.com/video/${media.id}?autoplay=1&muted=1&loop=1&background=1&title=0&byline=0&portrait=0`}
          frameBorder="0" 
          allow="autoplay" 
          style={contentStyle}
          title="Vimeo video"
          onError={() => setHasError(true)}
        />
        {/* Only transparent click blocker */}
        <div style={clickBlockerStyle} onClick={(e) => e.preventDefault()} />
      </div>
    );
  }
  
  if (media.type === 'video') {
    return (
      <div className={className} style={containerStyle} data-testid="media-container-16-9">
        <video 
          src={media.url} 
          autoPlay 
          loop 
          muted 
          playsInline 
          style={{ ...contentStyle, objectFit: 'cover' }}
          onError={() => setHasError(true)}
        />
      </div>
    );
  }
  
  // Image type
  return (
    <div className={className} style={containerStyle} data-testid="media-container-16-9">
      <img 
        src={media.url} 
        alt="Media" 
        style={{ ...contentStyle, objectFit: 'cover' }}
        onError={() => setHasError(true)}
      />
    </div>
  );
};

// Info Icon Component
const InfoIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="16" x2="12" y2="12"/>
    <line x1="12" y1="8" x2="12.01" y2="8"/>
  </svg>
);

// Close Icon Component
const CloseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

// Offer Card - Clean Design with Full Image + Info icon + Discrete dots navigation
const OfferCard = ({ offer, selected, onClick }) => {
  const [showDescription, setShowDescription] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const defaultImage = "https://picsum.photos/seed/default/400/200";
  
  // PRIORITÉ: offer.images[0] > offer.thumbnail > defaultImage
  const images = (offer.images && Array.isArray(offer.images) && offer.images.length > 0) 
    ? offer.images.filter(img => img && typeof img === 'string' && img.trim()) 
    : (offer.thumbnail && typeof offer.thumbnail === 'string' ? [offer.thumbnail] : [defaultImage]);
  
  const currentImage = images[currentImageIndex] || images[0] || defaultImage;
  const hasMultipleImages = images.length > 1;
  
  const toggleDescription = (e) => {
    e.stopPropagation();
    setShowDescription(!showDescription);
  };
  
  return (
    <div onClick={onClick} className={`offer-card rounded-xl overflow-hidden ${selected ? 'selected' : ''}`} data-testid={`offer-card-${offer.id}`}>
      <div style={{ position: 'relative', height: '140px' }}>
        {!showDescription ? (
          <>
            <img 
              src={currentImage} 
              alt={offer.name} 
              className="offer-card-image"
              onError={(e) => { e.target.src = defaultImage; }}
            />
            
            {/* Points discrets cliquables si plusieurs images */}
            {hasMultipleImages && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5" style={{ zIndex: 10 }}>
                {images.map((_, idx) => (
                  <div 
                    key={idx}
                    onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(idx); }}
                    className={`w-1.5 h-1.5 rounded-full cursor-pointer transition-all ${idx === currentImageIndex ? 'bg-pink-500 scale-125' : 'bg-white/40'}`}
                  />
                ))}
              </div>
            )}
            
            {/* Info Icon (i) - Only if description exists */}
            {offer.description && (
              <div 
                className="offer-info-btn"
                onClick={toggleDescription}
                data-testid={`offer-info-${offer.id}`}
                title="Voir la description"
              >
                <InfoIcon />
              </div>
            )}
          </>
        ) : (
          <div 
            className="offer-description-panel"
            data-testid={`offer-description-panel-${offer.id}`}
          >
            <p className="offer-description-text">{offer.description}</p>
            <button 
              className="offer-close-btn"
              onClick={toggleDescription}
              data-testid={`offer-close-${offer.id}`}
              title="Fermer"
            >
              <CloseIcon />
            </button>
          </div>
        )}
      </div>
      <div className="offer-card-content">
        <h3 className="font-semibold text-white text-sm">{offer.name}</h3>
        <span className="font-bold" style={{ color: '#d91cd2', fontSize: '18px' }}>CHF {offer.price}.-</span>
      </div>
    </div>
  );
};

// Offer Card for Horizontal Slider - With LED effect, Loupe, Info icon + Discrete dots
const OfferCardSlider = ({ offer, selected, onClick }) => {
  const [showDescription, setShowDescription] = useState(false);
  const [showZoom, setShowZoom] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const defaultImage = "https://picsum.photos/seed/default/400/300";
  
  // PRIORITÉ: offer.images[0] > offer.thumbnail > defaultImage
  const images = (offer.images && Array.isArray(offer.images) && offer.images.length > 0) 
    ? offer.images.filter(img => img && typeof img === 'string' && img.trim()) 
    : (offer.thumbnail && typeof offer.thumbnail === 'string' ? [offer.thumbnail] : [defaultImage]);
  
  const currentImage = images[currentImageIndex] || images[0] || defaultImage;
  const hasMultipleImages = images.length > 1;
  
  const toggleDescription = (e) => {
    e.stopPropagation();
    setShowDescription(!showDescription);
  };
  
  const toggleZoom = (e) => {
    e.stopPropagation();
    setShowZoom(!showZoom);
  };
  
  const prevImage = (e) => {
    e.stopPropagation();
    setCurrentImageIndex(prev => prev > 0 ? prev - 1 : images.length - 1);
  };
  
  const nextImage = (e) => {
    e.stopPropagation();
    setCurrentImageIndex(prev => prev < images.length - 1 ? prev + 1 : 0);
  };
  
  return (
    <>
      {/* Zoom Modal - flèches uniquement dans le zoom */}
      {showZoom && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={toggleZoom}
        >
          <div className="relative max-w-4xl max-h-[90vh] p-4" onClick={e => e.stopPropagation()}>
            <img 
              src={currentImage} 
              alt={offer.name} 
              className="max-w-full max-h-[80vh] object-contain rounded-xl"
              style={{ boxShadow: '0 0 40px rgba(217, 28, 210, 0.5)' }}
            />
            
            {/* Flèches UNIQUEMENT dans le zoom */}
            {hasMultipleImages && (
              <>
                <button 
                  onClick={prevImage}
                  className="absolute left-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-pink-600 text-xl"
                >
                  ‹
                </button>
                <button 
                  onClick={nextImage}
                  className="absolute right-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-pink-600 text-xl"
                >
                  ›
                </button>
              </>
            )}
            
            <button 
              className="absolute top-2 right-2 w-10 h-10 rounded-full bg-black/50 text-white text-2xl hover:bg-black/80 flex items-center justify-center"
              onClick={toggleZoom}
            >
              ×
            </button>
            <p className="text-center text-white mt-4 text-lg font-semibold">{offer.name}</p>
            
            {hasMultipleImages && (
              <p className="text-center text-pink-400 text-sm mt-2">{currentImageIndex + 1} / {images.length}</p>
            )}
          </div>
        </div>
      )}
      
      <div 
        className="flex-shrink-0 snap-start"
        style={{ width: '300px', minWidth: '300px', padding: '4px' }}
      >
        <div 
          onClick={onClick}
          className={`offer-card-slider rounded-xl overflow-visible cursor-pointer transition-all duration-300`}
          style={{
            boxShadow: selected 
              ? '0 0 0 3px #d91cd2, 0 0 30px #d91cd2, 0 0 60px rgba(217, 28, 210, 0.5)' 
              : '0 4px 20px rgba(0,0,0,0.4)',
            border: 'none',
            transform: selected ? 'scale(1.02)' : 'scale(1)',
            background: 'linear-gradient(180deg, rgba(20,10,30,0.98) 0%, rgba(5,0,15,0.99) 100%)',
            borderRadius: '16px',
            overflow: 'hidden'
          }}
          data-testid={`offer-card-${offer.id}`}
        >
          {/* Image Section - 250px HEIGHT */}
          <div style={{ position: 'relative', height: '250px', overflow: 'hidden' }}>
            {!showDescription ? (
              <>
                <img 
                  src={currentImage} 
                  alt={offer.name} 
                  className="w-full h-full"
                  style={{ objectFit: 'cover', objectPosition: 'center', height: '250px' }}
                  onError={(e) => { e.target.src = defaultImage; }}
                />
                
                {/* Points discrets cliquables - PAS de flèches */}
                {hasMultipleImages && (
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5" style={{ zIndex: 15 }}>
                    {images.map((_, idx) => (
                      <div 
                        key={idx} 
                        onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(idx); }}
                        className={`w-1.5 h-1.5 rounded-full cursor-pointer transition-all ${idx === currentImageIndex ? 'bg-pink-500 scale-150' : 'bg-white/40'}`}
                      />
                    ))}
                  </div>
                )}
                
                {/* Zoom Button (Loupe) - Top Left */}
                <div 
                  className="absolute top-3 left-3 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-all hover:scale-110"
                  style={{ 
                    background: 'rgba(0, 0, 0, 0.6)',
                    backdropFilter: 'blur(4px)'
                  }}
                  onClick={toggleZoom}
                  title="Agrandir l'image"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="M21 21l-4.35-4.35"/>
                    <path d="M11 8v6M8 11h6"/>
                  </svg>
                </div>
                
                {/* Info Icon "i" - Top Right */}
                {offer.description && (
                  <div 
                    className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center cursor-pointer transition-all hover:scale-110"
                    style={{ 
                      background: 'rgba(217, 28, 210, 0.85)',
                      boxShadow: '0 0 8px rgba(217, 28, 210, 0.5)'
                    }}
                    onClick={toggleDescription}
                    data-testid={`offer-info-${offer.id}`}
                    title="Voir la description"
                  >
                    <span className="text-white text-sm font-bold">i</span>
                  </div>
                )}
                
                {/* Selected indicator */}
                {selected && (
                  <div 
                    className="absolute bottom-3 left-3 px-3 py-1 rounded-full text-xs font-bold text-white flex items-center gap-1"
                    style={{ 
                      background: 'linear-gradient(135deg, #d91cd2 0%, #8b5cf6 100%)', 
                      boxShadow: '0 0 15px rgba(217, 28, 210, 0.7)' 
                    }}
                  >
                    <span>✓</span> Sélectionné
                  </div>
                )}
              </>
            ) : (
              /* Description Panel */
              <div 
                className="w-full h-full flex flex-col justify-center p-4"
                style={{ background: 'linear-gradient(180deg, rgba(139, 92, 246, 0.95) 0%, rgba(217, 28, 210, 0.9) 100%)' }}
              >
                <p className="text-white text-sm leading-relaxed">{offer.description}</p>
                <button 
                  className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center bg-white/20 hover:bg-white/30 transition-all text-white"
                  onClick={toggleDescription}
                  title="Fermer"
                >
                  ×
                </button>
              </div>
            )}
          </div>
          
          {/* Content Section */}
          <div className="p-4">
            <p className="font-semibold text-white mb-2" style={{ fontSize: '17px' }}>{offer.name}</p>
            <div className="flex items-baseline gap-2">
              <span 
                className="text-2xl font-bold" 
                style={{ 
                  color: '#d91cd2', 
                  textShadow: selected ? '0 0 15px rgba(217, 28, 210, 0.6)' : 'none' 
                }}
              >
                CHF {offer.price}.-
              </span>
              {offer.tva > 0 && (
                <span className="text-xs text-white opacity-50">TVA {offer.tva}%</span>
              )}
            </div>
            {offer.isProduct && offer.shippingCost > 0 && (
              <p className="text-xs text-white opacity-50 mt-1">+ CHF {offer.shippingCost} frais de port</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

// QR Scanner Modal with Camera Support - Enhanced Version
const QRScannerModal = ({ onClose, onValidate, scanResult, scanError, onManualValidation }) => {
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [manualMode, setManualMode] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState('unknown'); // unknown, granted, denied
  const [initializingCamera, setInitializingCamera] = useState(false);
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  // Check camera permissions - Enhanced with direct getUserMedia test
  const checkCameraPermission = async () => {
    try {
      // Check if we're on HTTPS (required for camera access)
      const isLocalhost = window.location.hostname === 'localhost' || 
                          window.location.hostname === '127.0.0.1' ||
                          window.location.hostname.includes('.local');
      const isSecure = window.location.protocol === 'https:' || isLocalhost;
      
      if (!isSecure) {
        setCameraError("Le scan caméra nécessite une connexion HTTPS sécurisée.");
        setManualMode(true);
        return false;
      }

      // Check if mediaDevices is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError("Votre navigateur ne supporte pas l'accès à la caméra.");
        setManualMode(true);
        return false;
      }

      // Try to get permission status via Permissions API first
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const result = await navigator.permissions.query({ name: 'camera' });
          setPermissionStatus(result.state);
          if (result.state === 'denied') {
            setCameraError("L'accès à la caméra a été refusé. Autorisez l'accès dans les paramètres de votre navigateur, puis réessayez.");
            return false;
          }
        } catch (e) {
          // Permission query not supported (e.g., Safari), continue anyway
          console.log("Permissions API not supported, continuing...");
        }
      }
      return true;
    } catch (err) {
      console.error("Permission check error:", err);
      return true; // Try anyway
    }
  };

  // Direct camera test before using html5-qrcode
  const testCameraAccess = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      // Successfully got access, stop the stream immediately
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (err) {
      console.error("Direct camera test failed:", err);
      return false;
    }
  };

  // Start camera scanning with enhanced error handling
  const startScanning = async () => {
    setCameraError(null);
    setInitializingCamera(true);
    
    // Check permissions first
    const canProceed = await checkCameraPermission();
    if (!canProceed) {
      setInitializingCamera(false);
      return;
    }

    // Direct camera access test
    const cameraWorks = await testCameraAccess();
    if (!cameraWorks) {
      setCameraError("Impossible d'accéder à la caméra. Vérifiez les permissions et réessayez.");
      setInitializingCamera(false);
      return;
    }

    setScanning(true);
    setInitializingCamera(false);
    
    try {
      // Wait for the DOM element to be ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const readerElement = document.getElementById("qr-reader");
      if (!readerElement) {
        throw new Error("Scanner container not found");
      }

      // IMPORTANT: Stop any previous session first using getState()
      if (html5QrCodeRef.current) {
        try {
          // getState(): 0 = NOT_STARTED, 1 = SCANNING, 2 = PAUSED
          if (html5QrCodeRef.current.getState && html5QrCodeRef.current.getState() !== 0) {
            await html5QrCodeRef.current.stop();
          }
          html5QrCodeRef.current = null;
        } catch (e) {
          console.log("Clearing previous session:", e);
          html5QrCodeRef.current = null;
        }
      }

      const html5QrCode = new Html5Qrcode("qr-reader");
      html5QrCodeRef.current = html5QrCode;
      
      // Get available cameras
      let cameras = [];
      try {
        cameras = await Html5Qrcode.getCameras();
      } catch (camErr) {
        console.error("Camera enumeration error:", camErr);
        // Fallback: try with facingMode constraint
        await html5QrCode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 200, height: 200 }, aspectRatio: 1.0 },
          handleQrCodeSuccess,
          () => {}
        );
        setPermissionStatus('granted');
        return;
      }
      
      if (!cameras || cameras.length === 0) {
        // Try facingMode fallback
        await html5QrCode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 200, height: 200 }, aspectRatio: 1.0 },
          handleQrCodeSuccess,
          () => {}
        );
        setPermissionStatus('granted');
        return;
      }
      
      // Prefer back camera on mobile (usually last in list)
      const backCamera = cameras.find(c => c.label?.toLowerCase().includes('back') || c.label?.toLowerCase().includes('arrière'));
      const cameraId = backCamera?.id || (cameras.length > 1 ? cameras[cameras.length - 1].id : cameras[0].id);
      
      await html5QrCode.start(
        cameraId,
        {
          fps: 10,
          qrbox: { width: 200, height: 200 },
          aspectRatio: 1.0
        },
        handleQrCodeSuccess,
        () => {} // Ignore scan errors (expected when no QR visible)
      );
      
      setPermissionStatus('granted');
    } catch (err) {
      console.error("Camera error:", err);
      handleCameraError(err);
      setScanning(false);
    }
  };

  // Handle QR code detection
  const handleQrCodeSuccess = (decodedText) => {
    // QR code detected - extract reservation code from URL
    let code = decodedText;
    if (decodedText.includes('/validate/')) {
      code = decodedText.split('/validate/').pop().toUpperCase();
    } else if (decodedText.includes('AFR-')) {
      // Extract AFR-XXXXXX pattern
      const match = decodedText.match(/AFR-[A-Z0-9]+/i);
      if (match) code = match[0].toUpperCase();
    }
    
    // Stop scanning and validate
    stopScanning();
    if (code) {
      onValidate(code);
    }
  };

  // Handle camera errors with user-friendly messages
  const handleCameraError = (err) => {
    const errString = err?.message || err?.toString() || '';
    let errorMessage = "Impossible d'accéder à la caméra.";
    
    if (errString.includes('Permission') || errString.includes('NotAllowed')) {
      errorMessage = "Permission caméra refusée. Autorisez l'accès dans les paramètres de votre navigateur, puis réessayez.";
      setPermissionStatus('denied');
    } else if (errString.includes('NotFound') || errString.includes('détectée') || errString.includes('No video')) {
      errorMessage = "Aucune caméra détectée sur cet appareil.";
    } else if (errString.includes('NotReadable') || errString.includes('already in use') || errString.includes('AbortError')) {
      errorMessage = "La caméra est déjà utilisée. Fermez les autres applications utilisant la caméra et réessayez.";
    } else if (errString.includes('OverconstrainedError')) {
      errorMessage = "Votre caméra ne supporte pas les paramètres requis. Essayez un autre appareil.";
    }
    
    setCameraError(errorMessage);
  };

  // Retry camera access
  const retryCamera = async () => {
    setCameraError(null);
    setManualMode(false);
    // Small delay before retry
    setTimeout(() => startScanning(), 300);
  };

  // Stop camera scanning
  const stopScanning = () => {
    if (html5QrCodeRef.current) {
      html5QrCodeRef.current.stop().catch(() => {});
      html5QrCodeRef.current = null;
    }
    setScanning(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, []);

  // Handle close
  const handleClose = () => {
    stopScanning();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content glass rounded-xl p-6 max-w-md w-full neon-border" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white">📷 Scanner un ticket</h3>
          <button onClick={handleClose} className="text-2xl text-white hover:text-purple-400">×</button>
        </div>
        
        {/* Success Result */}
        {scanResult?.success && (
          <div className="p-4 rounded-lg bg-green-600/30 border border-green-500 mb-4 animate-pulse">
            <div className="flex items-center gap-3">
              <span className="text-5xl">✅</span>
              <div>
                <p className="text-white font-bold text-xl">Ticket validé !</p>
                <p className="text-green-300 text-lg">{scanResult.reservation?.userName}</p>
                <p className="text-green-300 text-sm">{scanResult.reservation?.reservationCode}</p>
              </div>
            </div>
          </div>
        )}
        
        {/* Error */}
        {scanError && (
          <div className="p-4 rounded-lg bg-red-600/30 border border-red-500 mb-4">
            <p className="text-red-300">❌ {scanError}</p>
          </div>
        )}
        
        {/* Camera Error with Retry Button */}
        {cameraError && (
          <div className="p-4 rounded-lg bg-yellow-600/30 border border-yellow-500 mb-4">
            <p className="text-yellow-300 text-sm mb-3">⚠️ {cameraError}</p>
            <button 
              onClick={retryCamera}
              className="w-full py-2 rounded-lg bg-yellow-600 hover:bg-yellow-700 text-white text-sm flex items-center justify-center gap-2"
            >
              🔄 Réessayer l'accès caméra
            </button>
          </div>
        )}
        
        {/* Camera Scanner */}
        {!scanResult?.success && !manualMode && (
          <div className="mb-4">
            {/* Initializing Camera Indicator */}
            {initializingCamera && (
              <div className="flex flex-col items-center justify-center py-8 mb-4">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent mb-4"></div>
                <p className="text-white text-sm">Initialisation de la caméra...</p>
              </div>
            )}
            
            <div 
              id="qr-reader" 
              ref={scannerRef}
              className="rounded-lg overflow-hidden mb-4"
              style={{ 
                width: '300px', 
                height: scanning ? '300px' : '0px',
                minHeight: scanning ? '300px' : '0px',
                background: scanning ? '#000' : 'transparent',
                display: initializingCamera ? 'none' : 'block',
                margin: '0 auto'
              }}
            />
            
            {!scanning && !initializingCamera ? (
              <button 
                onClick={startScanning}
                className="w-full py-4 rounded-lg btn-primary flex items-center justify-center gap-2 text-lg"
                data-testid="start-camera-btn"
              >
                📷 Activer la caméra
              </button>
            ) : (
              <button 
                onClick={stopScanning}
                className="w-full py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white"
              >
                ⏹ Arrêter le scan
              </button>
            )}
            
            <button 
              onClick={() => { stopScanning(); setManualMode(true); }}
              className="w-full mt-3 py-2 rounded-lg glass text-white text-sm opacity-70 hover:opacity-100"
            >
              ⌨️ Saisie manuelle
            </button>
          </div>
        )}
        
        {/* Manual code input (fallback) */}
        {!scanResult?.success && manualMode && (
          <div>
            <form onSubmit={onManualValidation} className="space-y-4">
              <p className="text-white text-sm opacity-70">Entrez le code de réservation :</p>
              <input 
                type="text" 
                name="code"
                placeholder="AFR-XXXXXX"
                className="w-full px-4 py-3 rounded-lg neon-input uppercase text-center text-xl tracking-widest"
                autoFocus
                data-testid="manual-code-input"
              />
              <button type="submit" className="w-full py-3 rounded-lg btn-primary" data-testid="validate-code-btn">
                ✓ Valider le ticket
              </button>
            </form>
            <button 
              onClick={() => setManualMode(false)}
              className="w-full mt-3 py-2 rounded-lg glass text-white text-sm opacity-70 hover:opacity-100"
            >
              📷 Retour au scan caméra
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Coach Login Modal
const CoachLoginModal = ({ t, onLogin, onCancel }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  
  // Flux "Mot de passe oublié"
  const [forgotMode, setForgotMode] = useState(false); // Étape 1: Saisir email
  const [resetMode, setResetMode] = useState(false);   // Étape 2: Nouveau mot de passe
  const [forgotEmail, setForgotEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API}/coach-auth/login`, { email, password });
      if (response.data.success) onLogin();
      else setError(t('wrongCredentials'));
    } catch { setError(t('wrongCredentials')); }
  };

  // Étape 1: Vérifier l'email du coach
  const handleForgotSubmit = (e) => {
    e.preventDefault();
    setError("");
    
    // Récupérer coachAuth depuis localStorage
    const storedAuth = localStorage.getItem('coachAuth');
    if (storedAuth) {
      try {
        const coachAuth = JSON.parse(storedAuth);
        if (coachAuth.email && coachAuth.email.toLowerCase() === forgotEmail.toLowerCase().trim()) {
          // Email correspond - passer à l'étape 2
          setForgotMode(false);
          setResetMode(true);
          setError("");
        } else {
          setError("Cet e-mail ne correspond pas au compte Coach enregistré.");
        }
      } catch {
        setError("Erreur de vérification. Veuillez réessayer.");
      }
    } else {
      // Vérifier aussi l'email par défaut
      if (forgotEmail.toLowerCase().trim() === "coach@afroboost.com") {
        setForgotMode(false);
        setResetMode(true);
        setError("");
      } else {
        setError("Cet e-mail ne correspond pas au compte Coach enregistré.");
      }
    }
  };

  // Étape 2: Définir le nouveau mot de passe
  const handleResetSubmit = (e) => {
    e.preventDefault();
    setError("");

    // Validation
    if (newPassword.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    // Mettre à jour coachAuth dans localStorage
    const newCoachAuth = {
      email: forgotEmail.toLowerCase().trim(),
      password: newPassword
    };
    localStorage.setItem('coachAuth', JSON.stringify(newCoachAuth));

    // Succès
    setResetMode(false);
    setSuccessMessage("✅ Mot de passe mis à jour avec succès ! Vous pouvez maintenant vous connecter.");
    setNewPassword("");
    setConfirmPassword("");
    setForgotEmail("");
  };

  // Retour au login
  const backToLogin = () => {
    setForgotMode(false);
    setResetMode(false);
    setError("");
    setSuccessMessage("");
    setForgotEmail("");
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass rounded-xl p-8 max-w-md w-full neon-border">
        
        {/* MESSAGE DE SUCCÈS */}
        {successMessage && (
          <div className="mb-6 p-4 rounded-lg text-center" style={{ background: 'rgba(34, 197, 94, 0.2)', border: '1px solid #22c55e' }}>
            <p className="text-green-400 font-semibold">{successMessage}</p>
          </div>
        )}

        {/* ÉTAPE 1: SAISIR EMAIL POUR RÉCUPÉRATION */}
        {forgotMode && !resetMode && (
          <form onSubmit={handleForgotSubmit}>
            <h2 className="font-bold mb-2 text-center text-white" style={{ fontSize: '24px' }}>🔐 Récupération</h2>
            <p className="text-center text-white/60 text-sm mb-6">Entrez l'adresse e-mail du compte Coach</p>
            
            {error && <div className="mb-4 p-3 rounded-lg text-center" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}>{error}</div>}
            
            <div className="mb-6">
              <label className="block mb-2 text-white text-sm">E-mail du Coach</label>
              <input 
                type="email" 
                required 
                value={forgotEmail} 
                onChange={(e) => setForgotEmail(e.target.value)} 
                className="w-full px-4 py-3 rounded-lg neon-input" 
                placeholder="coach@afroboost.com"
                autoFocus
              />
            </div>
            
            <button type="submit" className="btn-primary w-full py-3 rounded-lg font-bold mb-3">
              Vérifier l'e-mail
            </button>
            <button type="button" onClick={backToLogin} className="w-full py-2 rounded-lg glass text-white">
              ← Retour à la connexion
            </button>
          </form>
        )}

        {/* ÉTAPE 2: NOUVEAU MOT DE PASSE */}
        {resetMode && !forgotMode && (
          <form onSubmit={handleResetSubmit}>
            <h2 className="font-bold mb-2 text-center text-white" style={{ fontSize: '24px' }}>🔑 Nouveau mot de passe</h2>
            <p className="text-center text-white/60 text-sm mb-6">Créez votre nouveau mot de passe sécurisé</p>
            
            {error && <div className="mb-4 p-3 rounded-lg text-center" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}>{error}</div>}
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block mb-2 text-white text-sm">Nouveau mot de passe</label>
                <input 
                  type="password" 
                  required 
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)} 
                  className="w-full px-4 py-3 rounded-lg neon-input" 
                  placeholder="••••••••"
                  minLength={6}
                  autoFocus
                />
                <p className="text-xs text-white/40 mt-1">Minimum 6 caractères</p>
              </div>
              <div>
                <label className="block mb-2 text-white text-sm">Confirmer le mot de passe</label>
                <input 
                  type="password" 
                  required 
                  value={confirmPassword} 
                  onChange={(e) => setConfirmPassword(e.target.value)} 
                  className="w-full px-4 py-3 rounded-lg neon-input" 
                  placeholder="••••••••"
                  minLength={6}
                />
              </div>
            </div>
            
            <button type="submit" className="btn-primary w-full py-3 rounded-lg font-bold mb-3">
              ✓ Enregistrer le nouveau mot de passe
            </button>
            <button type="button" onClick={backToLogin} className="w-full py-2 rounded-lg glass text-white">
              ← Annuler
            </button>
          </form>
        )}

        {/* FORMULAIRE DE CONNEXION PRINCIPAL */}
        {!forgotMode && !resetMode && (
          <form onSubmit={handleSubmit}>
            <h2 className="font-bold mb-6 text-center text-white" style={{ fontSize: '24px' }}>{t('coachLogin')}</h2>
            {error && <div className="mb-4 p-3 rounded-lg text-center" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}>{error}</div>}
            <div className="space-y-4 mb-6">
              <div>
                <label className="block mb-2 text-white text-sm">{t('email')}</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 rounded-lg neon-input" placeholder="coach@afroboost.com" data-testid="coach-login-email" />
              </div>
              <div>
                <label className="block mb-2 text-white text-sm">{t('password')}</label>
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 rounded-lg neon-input" placeholder="••••••••" data-testid="coach-login-password" />
              </div>
            </div>
            <button type="submit" className="btn-primary w-full py-3 rounded-lg font-bold mb-3" data-testid="coach-login-submit">{t('login')}</button>
            <button 
              type="button" 
              onClick={() => { setForgotMode(true); setError(""); setSuccessMessage(""); }}
              className="w-full text-center mb-4" 
              style={{ color: '#d91cd2', background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', fontSize: '14px' }}
            >
              {t('forgotPassword')}
            </button>
            <button type="button" onClick={onCancel} className="w-full py-2 rounded-lg glass text-white" data-testid="coach-login-cancel">{t('cancel')}</button>
          </form>
        )}
      </div>
    </div>
  );
};

// Coach Dashboard
const CoachDashboard = ({ t, lang, onBack, onLogout }) => {
  const [tab, setTab] = useState("reservations");
  const [reservations, setReservations] = useState([]);
  const [courses, setCourses] = useState([]);
  const [offers, setOffers] = useState([]);
  const [users, setUsers] = useState([]);
  const [paymentLinks, setPaymentLinks] = useState({ stripe: "", paypal: "", twint: "", coachWhatsapp: "" });
  const [concept, setConcept] = useState({ description: "", heroImageUrl: "", logoUrl: "", faviconUrl: "", termsText: "", googleReviewsUrl: "", defaultLandingSection: "sessions", externalLink1Title: "", externalLink1Url: "", externalLink2Title: "", externalLink2Url: "", paymentTwint: false, paymentPaypal: false, paymentCreditCard: false });
  const [discountCodes, setDiscountCodes] = useState([]);
  const [newCode, setNewCode] = useState({ code: "", type: "", value: "", assignedEmail: "", courses: [], maxUses: "", expiresAt: "" });
  const [newCourse, setNewCourse] = useState({ name: "", weekday: 0, time: "18:30", locationName: "", mapsUrl: "" });
  const [newOffer, setNewOffer] = useState({ 
    name: "", price: 0, visible: true, description: "",
    images: ["", "", "", "", ""], // 5 champs d'images
    category: "service", isProduct: false, variants: null, tva: 0, shippingCost: 0, stock: -1
  });
  const [editingOfferId, setEditingOfferId] = useState(null); // Pour mode édition
  const fileInputRef = useRef(null);
  
  // Scanner state
  const [showScanner, setShowScanner] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [res, crs, off, usr, lnk, cpt, cds] = await Promise.all([
          axios.get(`${API}/reservations`), axios.get(`${API}/courses`), axios.get(`${API}/offers`),
          axios.get(`${API}/users`), axios.get(`${API}/payment-links`), axios.get(`${API}/concept`), 
          axios.get(`${API}/discount-codes`)
        ]);
        setReservations(res.data); setCourses(crs.data); setOffers(off.data); setUsers(usr.data);
        setPaymentLinks(lnk.data); setConcept(cpt.data); setDiscountCodes(cds.data);
      } catch (err) { console.error("Error:", err); }
    };
    loadData();
  }, []);

  // Get unique customers for beneficiary dropdown
  const uniqueCustomers = Array.from(new Map(
    [...reservations.map(r => ({ name: r.userName, email: r.userEmail })), ...users.map(u => ({ name: u.name, email: u.email }))]
    .map(c => [c.email, c])
  ).values());

  const exportCSV = () => {
    const rows = [
      [t('code'), t('name'), t('email'), "WhatsApp", t('courses'), t('date'), t('time'), t('offer'), t('qty'), t('total')],
      ...reservations.map(r => {
        const dt = new Date(r.datetime);
        return [r.reservationCode || '', r.userName, r.userEmail, r.userWhatsapp || '', r.courseName, 
          dt.toLocaleDateString('fr-CH'), dt.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' }),
          r.offerName, r.quantity || 1, r.totalPrice || r.price];
      })
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; 
    a.download = `afroboost_reservations_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  // Validate reservation by code (for QR scanner)
  const validateReservation = async (code) => {
    try {
      const response = await axios.post(`${API}/reservations/${code}/validate`);
      if (response.data.success) {
        setScanResult({ success: true, reservation: response.data.reservation });
        // Update local state
        setReservations(reservations.map(r => 
          r.reservationCode === code ? { ...r, validated: true } : r
        ));
        // Auto-close after 3 seconds
        setTimeout(() => {
          setShowScanner(false);
          setScanResult(null);
        }, 3000);
      }
    } catch (err) {
      setScanError(err.response?.data?.detail || 'Code non trouvé');
      setTimeout(() => setScanError(null), 3000);
    }
  };

  // Manual code input for validation
  const handleManualValidation = (e) => {
    e.preventDefault();
    const code = e.target.code.value.trim().toUpperCase();
    if (code) {
      validateReservation(code);
      e.target.reset();
    }
  };

  const saveConcept = async () => { 
    try {
      console.log("Saving concept:", concept);
      const response = await axios.put(`${API}/concept`, concept); 
      console.log("Concept saved successfully:", response.data);
      alert("✅ Concept sauvegardé avec succès !");
    } catch (err) {
      console.error("Error saving concept:", err);
      console.error("Error details:", err.response?.data || err.message);
      const errorMessage = err.response?.data?.detail || err.message || "Erreur inconnue";
      alert(`❌ Erreur lors de la sauvegarde: ${errorMessage}`);
    }
  };
  const savePayments = async () => { await axios.put(`${API}/payment-links`, paymentLinks); alert("Saved!"); };

  const addCode = async (e) => {
    e.preventDefault();
    if (!newCode.type || !newCode.value) return;
    const response = await axios.post(`${API}/discount-codes`, {
      code: newCode.code || `CODE-${Date.now().toString().slice(-4)}`,
      type: newCode.type, value: parseFloat(newCode.value),
      assignedEmail: newCode.assignedEmail || null,
      courses: newCode.courses, maxUses: newCode.maxUses ? parseInt(newCode.maxUses) : null,
      expiresAt: newCode.expiresAt || null
    });
    setDiscountCodes([...discountCodes, response.data]);
    setNewCode({ code: "", type: "", value: "", assignedEmail: "", courses: [], maxUses: "", expiresAt: "" });
  };

  const toggleCode = async (code) => {
    await axios.put(`${API}/discount-codes/${code.id}`, { active: !code.active });
    setDiscountCodes(discountCodes.map(c => c.id === code.id ? { ...c, active: !c.active } : c));
  };

  // Delete discount code
  const deleteCode = async (codeId) => {
    if (window.confirm(t('confirmDelete') || 'Supprimer ce code ?')) {
      await axios.delete(`${API}/discount-codes/${codeId}`);
      setDiscountCodes(discountCodes.filter(c => c.id !== codeId));
    }
  };

  const handleImportCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const lines = text.split('\n').filter(line => line.trim());
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
          const [email, name, value, type, expiration] = parts;
          if (value && type) {
            const response = await axios.post(`${API}/discount-codes`, {
              code: name || `CODE-${Date.now() + i}`.slice(-6), type, value: parseFloat(value),
              assignedEmail: email || null, expiresAt: expiration || null, courses: [], maxUses: null
            });
            setDiscountCodes(prev => [...prev, response.data]);
          }
        }
      } catch (error) { console.error('Import error:', error); }
    };
    reader.readAsText(file); e.target.value = '';
  };

  const updateCourse = async (course) => { await axios.put(`${API}/courses/${course.id}`, course); };
  const addCourse = async (e) => {
    e.preventDefault();
    if (!newCourse.name) return;
    const response = await axios.post(`${API}/courses`, newCourse);
    setCourses([...courses, response.data]);
    setNewCourse({ name: "", weekday: 0, time: "18:30", locationName: "", mapsUrl: "" });
  };

  const updateOffer = async (offer) => { 
    try {
      await axios.put(`${API}/offers/${offer.id}`, offer); 
    } catch (err) {
      console.error("Erreur mise à jour offre:", err);
    }
  };

  // Supprimer une offre
  const deleteOffer = async (offerId) => {
    if (!window.confirm("Supprimer cette offre ?")) return;
    try {
      await axios.delete(`${API}/offers/${offerId}`);
      setOffers(prevOffers => prevOffers.filter(o => o.id !== offerId));
    } catch (err) {
      console.error("Erreur suppression offre:", err);
      alert("Erreur lors de la suppression");
    }
  };

  // Charger une offre dans le formulaire pour modification
  const startEditOffer = (offer) => {
    const images = offer.images || [];
    // Remplir les 5 champs avec les images existantes
    const paddedImages = [...images, "", "", "", "", ""].slice(0, 5);
    setNewOffer({
      name: offer.name || "",
      price: offer.price || 0,
      visible: offer.visible !== false,
      description: offer.description || "",
      images: paddedImages,
      category: offer.category || "service",
      isProduct: offer.isProduct || false,
      variants: offer.variants || null,
      tva: offer.tva || 0,
      shippingCost: offer.shippingCost || 0,
      stock: offer.stock ?? -1
    });
    setEditingOfferId(offer.id);
    // Scroll vers le formulaire
    document.getElementById('offer-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  // Annuler l'édition
  const cancelEditOffer = () => {
    setNewOffer({ 
      name: "", price: 0, visible: true, description: "",
      images: ["", "", "", "", ""],
      category: "service", isProduct: false, variants: null, tva: 0, shippingCost: 0, stock: -1
    });
    setEditingOfferId(null);
  };

  // Ajouter ou mettre à jour une offre
  const addOffer = async (e) => {
    e.preventDefault();
    if (!newOffer.name) return;
    try {
      // Filtrer les images non vides
      const filteredImages = newOffer.images.filter(url => url && url.trim());
      const offerData = {
        ...newOffer,
        images: filteredImages,
        thumbnail: filteredImages[0] || "" // Première image comme thumbnail
      };

      if (editingOfferId) {
        // Mode édition : mettre à jour
        await axios.put(`${API}/offers/${editingOfferId}`, offerData);
        setOffers(prevOffers => prevOffers.map(o => o.id === editingOfferId ? { ...o, ...offerData } : o));
        setEditingOfferId(null);
      } else {
        // Mode ajout : créer nouvelle offre
        const response = await axios.post(`${API}/offers`, offerData);
        setOffers(prevOffers => [...prevOffers, response.data]);
      }
      
      // Reset formulaire
      setNewOffer({ 
        name: "", price: 0, visible: true, description: "",
        images: ["", "", "", "", ""],
        category: "service", isProduct: false, variants: null, tva: 0, shippingCost: 0, stock: -1 
      });
    } catch (err) {
      console.error("Erreur offre:", err);
      alert("Erreur lors de l'opération");
    }
  };

  const toggleCourseSelection = (courseId) => {
    setNewCode(prev => ({
      ...prev, courses: prev.courses.includes(courseId) ? prev.courses.filter(id => id !== courseId) : [...prev.courses, courseId]
    }));
  };

  // === CAMPAIGNS STATE & FUNCTIONS ===
  const [campaigns, setCampaigns] = useState([]);
  const [newCampaign, setNewCampaign] = useState({
    name: "", message: "", mediaUrl: "", mediaFormat: "16:9",
    targetType: "all", selectedContacts: [],
    channels: { whatsapp: true, email: false, instagram: false },
    scheduleSlots: [] // Multi-date scheduling
  });
  const [selectedContactsForCampaign, setSelectedContactsForCampaign] = useState([]);
  const [contactSearchQuery, setContactSearchQuery] = useState("");
  const [campaignLogs, setCampaignLogs] = useState([]); // Error logs
  
  // === ENVOI DIRECT STATE ===
  const [directSendMode, setDirectSendMode] = useState(false);
  const [currentWhatsAppIndex, setCurrentWhatsAppIndex] = useState(0);
  const [instagramProfile, setInstagramProfile] = useState("afroboost"); // Profil Instagram par défaut
  const [messageCopied, setMessageCopied] = useState(false);

  // === EMAILJS STATE ===
  const [emailJSConfig, setEmailJSConfig] = useState(() => getEmailJSConfig());
  const [showEmailJSConfig, setShowEmailJSConfig] = useState(false);
  const [emailSendingProgress, setEmailSendingProgress] = useState(null); // {current, total, status, name}
  const [emailSendingResults, setEmailSendingResults] = useState(null); // {sent, failed, errors}
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [testEmailStatus, setTestEmailStatus] = useState(null); // 'sending', 'success', 'error'

  // === WHATSAPP API STATE ===
  const [whatsAppConfig, setWhatsAppConfig] = useState(() => getWhatsAppConfig());
  const [showWhatsAppConfig, setShowWhatsAppConfig] = useState(false);
  const [whatsAppSendingProgress, setWhatsAppSendingProgress] = useState(null);
  const [whatsAppSendingResults, setWhatsAppSendingResults] = useState(null);
  const [testWhatsAppNumber, setTestWhatsAppNumber] = useState('');
  const [testWhatsAppStatus, setTestWhatsAppStatus] = useState(null);

  // === ENVOI GROUPÉ STATE ===
  const [bulkSendingInProgress, setBulkSendingInProgress] = useState(false);
  const [bulkSendingProgress, setBulkSendingProgress] = useState(null); // {channel, current, total, name}
  const [bulkSendingResults, setBulkSendingResults] = useState(null); // {email: {sent, failed}, whatsapp: {sent, failed}}

  // === IA WHATSAPP STATE ===
  const [aiConfig, setAiConfig] = useState({ enabled: false, systemPrompt: '', model: 'gpt-4o-mini', provider: 'openai', lastMediaUrl: '' });
  const [showAIConfig, setShowAIConfig] = useState(false);
  const [aiLogs, setAiLogs] = useState([]);
  const [aiTestMessage, setAiTestMessage] = useState('');
  const [aiTestResponse, setAiTestResponse] = useState(null);
  const [aiTestLoading, setAiTestLoading] = useState(false);

  // Add schedule slot
  const addScheduleSlot = () => {
    const now = new Date();
    const defaultDate = now.toISOString().split('T')[0];
    const defaultTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    setNewCampaign(prev => ({
      ...prev,
      scheduleSlots: [...prev.scheduleSlots, { date: defaultDate, time: defaultTime }]
    }));
  };

  // Remove schedule slot
  const removeScheduleSlot = (index) => {
    setNewCampaign(prev => ({
      ...prev,
      scheduleSlots: prev.scheduleSlots.filter((_, i) => i !== index)
    }));
  };

  // Update schedule slot
  const updateScheduleSlot = (index, field, value) => {
    setNewCampaign(prev => ({
      ...prev,
      scheduleSlots: prev.scheduleSlots.map((slot, i) => i === index ? { ...slot, [field]: value } : slot)
    }));
  };

  // Add log entry
  const addCampaignLog = (campaignId, message, type = 'info') => {
    const logEntry = {
      id: Date.now(),
      campaignId,
      message,
      type, // 'info', 'success', 'error', 'warning'
      timestamp: new Date().toISOString()
    };
    setCampaignLogs(prev => [logEntry, ...prev].slice(0, 100)); // Keep last 100 logs
  };

  // Load campaigns
  useEffect(() => {
    const loadCampaigns = async () => {
      try {
        const res = await axios.get(`${API}/campaigns`);
        setCampaigns(res.data);
      } catch (err) { console.error("Error loading campaigns:", err); }
    };
    if (tab === "campaigns") {
      loadCampaigns();
      loadAIConfig();
      loadAILogs();
    }
  }, [tab]);

  // Get unique contacts from users and reservations
  const allContacts = useMemo(() => {
    const contactMap = new Map();
    users.forEach(u => contactMap.set(u.email, { id: u.id, name: u.name, email: u.email, phone: u.whatsapp || "" }));
    reservations.forEach(r => {
      if (r.userEmail && !contactMap.has(r.userEmail)) {
        contactMap.set(r.userEmail, { id: r.userId, name: r.userName, email: r.userEmail, phone: r.userWhatsapp || "" });
      }
    });
    return Array.from(contactMap.values());
  }, [users, reservations]);

  // Filter contacts by search
  const filteredContacts = useMemo(() => {
    if (!contactSearchQuery) return allContacts;
    const q = contactSearchQuery.toLowerCase();
    return allContacts.filter(c => 
      c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q)
    );
  }, [allContacts, contactSearchQuery]);

  // Toggle contact selection
  const toggleContactForCampaign = (contactId) => {
    setSelectedContactsForCampaign(prev => 
      prev.includes(contactId) ? prev.filter(id => id !== contactId) : [...prev, contactId]
    );
  };

  // Select/Deselect all contacts
  const toggleAllContacts = () => {
    if (selectedContactsForCampaign.length === allContacts.length) {
      setSelectedContactsForCampaign([]);
    } else {
      setSelectedContactsForCampaign(allContacts.map(c => c.id));
    }
  };

  // Create campaign (supports multiple schedule slots)
  const createCampaign = async (e) => {
    e.preventDefault();
    if (!newCampaign.name || !newCampaign.message) return;
    
    const scheduleSlots = newCampaign.scheduleSlots;
    const isImmediate = scheduleSlots.length === 0;
    
    try {
      if (isImmediate) {
        // Create single immediate campaign
        const campaignData = {
          name: newCampaign.name,
          message: newCampaign.message,
          mediaUrl: newCampaign.mediaUrl,
          mediaFormat: newCampaign.mediaFormat,
          targetType: newCampaign.targetType,
          selectedContacts: newCampaign.targetType === "selected" ? selectedContactsForCampaign : [],
          channels: newCampaign.channels,
          scheduledAt: null
        };
        const res = await axios.post(`${API}/campaigns`, campaignData);
        setCampaigns([res.data, ...campaigns]);
        addCampaignLog(res.data.id, `Campagne "${newCampaign.name}" créée (envoi immédiat)`, 'success');
      } else {
        // Create one campaign per schedule slot (multi-date)
        for (let i = 0; i < scheduleSlots.length; i++) {
          const slot = scheduleSlots[i];
          const scheduledAt = `${slot.date}T${slot.time}:00`;
          const campaignData = {
            name: scheduleSlots.length > 1 ? `${newCampaign.name} (${i + 1}/${scheduleSlots.length})` : newCampaign.name,
            message: newCampaign.message,
            mediaUrl: newCampaign.mediaUrl,
            mediaFormat: newCampaign.mediaFormat,
            targetType: newCampaign.targetType,
            selectedContacts: newCampaign.targetType === "selected" ? selectedContactsForCampaign : [],
            channels: newCampaign.channels,
            scheduledAt
          };
          const res = await axios.post(`${API}/campaigns`, campaignData);
          setCampaigns(prev => [res.data, ...prev]);
          addCampaignLog(res.data.id, `Campagne "${campaignData.name}" programmée pour ${new Date(scheduledAt).toLocaleString('fr-FR')}`, 'info');
        }
      }
      
      // Reset form
      setNewCampaign({ 
        name: "", message: "", mediaUrl: "", mediaFormat: "16:9", 
        targetType: "all", selectedContacts: [], 
        channels: { whatsapp: true, email: false, instagram: false }, 
        scheduleSlots: [] 
      });
      setSelectedContactsForCampaign([]);
      alert(`✅ ${isImmediate ? 'Campagne créée' : `${scheduleSlots.length} campagne(s) programmée(s)`} avec succès !`);
    } catch (err) { 
      console.error("Error creating campaign:", err);
      addCampaignLog('new', `Erreur création campagne: ${err.message}`, 'error');
    }
  };

  // Launch campaign (generate links)
  const launchCampaign = async (campaignId) => {
    try {
      addCampaignLog(campaignId, 'Lancement de la campagne...', 'info');
      const res = await axios.post(`${API}/campaigns/${campaignId}/launch`);
      setCampaigns(campaigns.map(c => c.id === campaignId ? res.data : c));
      addCampaignLog(campaignId, `Campagne lancée avec ${res.data.results?.length || 0} destinataire(s)`, 'success');
      alert("🚀 Campagne lancée ! Cliquez sur les contacts pour ouvrir les liens.");
    } catch (err) { 
      console.error("Error launching campaign:", err);
      addCampaignLog(campaignId, `Erreur lancement: ${err.message}`, 'error');
    }
  };

  // Delete campaign
  const deleteCampaign = async (campaignId) => {
    if (!window.confirm("Supprimer cette campagne ?")) return;
    try {
      await axios.delete(`${API}/campaigns/${campaignId}`);
      setCampaigns(campaigns.filter(c => c.id !== campaignId));
      addCampaignLog(campaignId, 'Campagne supprimée', 'info');
    } catch (err) { 
      console.error("Error deleting campaign:", err);
      addCampaignLog(campaignId, `Erreur suppression: ${err.message}`, 'error');
    }
  };

  // Format phone number for WhatsApp (ensure country code)
  const formatPhoneForWhatsApp = (phone) => {
    if (!phone) return '';
    
    // 1. Remove ALL non-numeric characters first (spaces, dashes, dots, parentheses)
    let cleaned = phone.replace(/[\s\-\.\(\)]/g, '');
    
    // 2. Handle + prefix separately
    const hasPlus = cleaned.startsWith('+');
    cleaned = cleaned.replace(/[^\d]/g, ''); // Keep only digits
    
    // 3. Detect and normalize Swiss numbers
    if (cleaned.startsWith('0041')) {
      // Format: 0041XXXXXXXXX -> 41XXXXXXXXX
      cleaned = cleaned.substring(2);
    } else if (cleaned.startsWith('41') && cleaned.length >= 11) {
      // Already has country code 41
      // Keep as is
    } else if (cleaned.startsWith('0') && (cleaned.length === 10 || cleaned.length === 9)) {
      // Swiss local format: 079XXXXXXX or 79XXXXXXX -> 4179XXXXXXX
      cleaned = '41' + cleaned.substring(1);
    } else if (!hasPlus && cleaned.length >= 9 && cleaned.length <= 10 && !cleaned.startsWith('41')) {
      // Assume Swiss number without country code
      cleaned = '41' + cleaned;
    }
    
    // 4. Final validation - must have at least 10 digits for international
    if (cleaned.length < 10) {
      return '';
    }
    
    return cleaned;
  };

  // Generate WhatsApp link with message and media URL at the end for link preview
  // NOTE: Do NOT call addCampaignLog here - this function is called during render!
  // Error handling is done visually in the JSX with red indicators
  const generateWhatsAppLink = (phone, message, mediaUrl, contactName) => {
    const firstName = contactName?.split(' ')[0] || contactName || 'ami(e)';
    const personalizedMessage = message
      .replace(/{prénom}/gi, firstName)
      .replace(/{prenom}/gi, firstName)
      .replace(/{nom}/gi, contactName || '');
    
    // CRITICAL: Add media URL at the very end WITHOUT any emoji/text before it
    // This allows WhatsApp to generate a link preview with thumbnail
    const fullMessage = mediaUrl 
      ? `${personalizedMessage}\n\n${mediaUrl}` 
      : personalizedMessage;
    
    const formattedPhone = formatPhoneForWhatsApp(phone);
    
    if (!formattedPhone) {
      // Don't call setState here (addCampaignLog) - it causes infinite re-render!
      // The error is handled visually in the JSX
      return null;
    }
    
    const encodedMessage = encodeURIComponent(fullMessage);
    // Use api.whatsapp.com/send which works better on mobile and desktop
    return `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodedMessage}`;
  };

  // Generate mailto link for email
  // NOTE: Do NOT call addCampaignLog here - this function is called during render!
  const generateEmailLink = (email, subject, message, mediaUrl, contactName) => {
    const firstName = contactName?.split(' ')[0] || contactName || 'ami(e)';
    const personalizedMessage = message
      .replace(/{prénom}/gi, firstName)
      .replace(/{prenom}/gi, firstName)
      .replace(/{nom}/gi, contactName || '');
    
    const fullMessage = mediaUrl 
      ? `${personalizedMessage}\n\n🔗 Voir le visuel: ${mediaUrl}` 
      : personalizedMessage;
    
    if (!email) {
      // Don't call setState here - it causes infinite re-render!
      return null;
    }
    
    return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(fullMessage)}`;
  };

  // Generate Instagram DM link
  const generateInstagramLink = (username) => {
    // Instagram doesn't have a direct DM API, open profile instead
    return `https://instagram.com/${username || 'afroboost'}`;
  };

  // === ENVOI DIRECT PAR CANAL ===
  
  // Obtenir les contacts pour l'envoi direct
  const getContactsForDirectSend = () => {
    if (newCampaign.targetType === "selected") {
      return allContacts.filter(c => selectedContactsForCampaign.includes(c.id));
    }
    return allContacts;
  };

  // Générer mailto: groupé avec BCC pour tous les emails
  const generateGroupedEmailLink = () => {
    const contacts = getContactsForDirectSend();
    const emails = contacts.map(c => c.email).filter(e => e && e.includes('@'));
    
    if (emails.length === 0) return null;
    
    const subject = newCampaign.name || "Afroboost - Message";
    const body = newCampaign.mediaUrl 
      ? `${newCampaign.message}\n\n🔗 Voir le visuel: ${newCampaign.mediaUrl}`
      : newCampaign.message;
    
    // Premier email en "to", reste en BCC pour confidentialité
    const firstEmail = emails[0];
    const bccEmails = emails.slice(1).join(',');
    
    return `mailto:${firstEmail}?${bccEmails ? `bcc=${bccEmails}&` : ''}subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  // Obtenir le contact WhatsApp actuel
  const getCurrentWhatsAppContact = () => {
    const contacts = getContactsForDirectSend().filter(c => c.phone);
    return contacts[currentWhatsAppIndex] || null;
  };

  // Passer au contact WhatsApp suivant
  const nextWhatsAppContact = () => {
    const contacts = getContactsForDirectSend().filter(c => c.phone);
    if (currentWhatsAppIndex < contacts.length - 1) {
      setCurrentWhatsAppIndex(currentWhatsAppIndex + 1);
    }
  };

  // Passer au contact WhatsApp précédent
  const prevWhatsAppContact = () => {
    if (currentWhatsAppIndex > 0) {
      setCurrentWhatsAppIndex(currentWhatsAppIndex - 1);
    }
  };

  // Copier le message pour Instagram
  const copyMessageForInstagram = async () => {
    const message = newCampaign.mediaUrl 
      ? `${newCampaign.message}\n\n🔗 ${newCampaign.mediaUrl}`
      : newCampaign.message;
    
    try {
      await navigator.clipboard.writeText(message);
      setMessageCopied(true);
      setTimeout(() => setMessageCopied(false), 3000);
    } catch (err) {
      // Fallback pour navigateurs plus anciens
      const textarea = document.createElement('textarea');
      textarea.value = message;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setMessageCopied(true);
      setTimeout(() => setMessageCopied(false), 3000);
    }
  };

  // === EMAILJS FUNCTIONS ===
  
  // Sauvegarder la configuration EmailJS
  const handleSaveEmailJSConfig = () => {
    const success = saveEmailJSConfig(emailJSConfig);
    if (success) {
      setShowEmailJSConfig(false);
      alert('✅ Configuration EmailJS sauvegardée !');
    } else {
      alert('❌ Erreur lors de la sauvegarde');
    }
  };

  // Tester la configuration EmailJS
  const handleTestEmailJS = async () => {
    if (!testEmailAddress || !testEmailAddress.includes('@')) {
      alert('Veuillez entrer une adresse email valide pour le test');
      return;
    }
    
    setTestEmailStatus('sending');
    const result = await testEmailJSConfig(testEmailAddress);
    
    if (result.success) {
      setTestEmailStatus('success');
      setTimeout(() => setTestEmailStatus(null), 5000);
    } else {
      setTestEmailStatus('error');
      alert(`❌ Erreur: ${result.error}`);
      setTimeout(() => setTestEmailStatus(null), 3000);
    }
  };

  // Envoyer la campagne email automatiquement
  const handleSendEmailCampaign = async () => {
    if (!isEmailJSConfigured()) {
      alert('⚠️ EmailJS non configuré. Cliquez sur "⚙️ Configurer EmailJS" pour ajouter vos clés.');
      return;
    }

    const contacts = getContactsForDirectSend();
    const emailContacts = contacts
      .filter(c => c.email && c.email.includes('@'))
      .map(c => ({ email: c.email, name: c.name }));

    if (emailContacts.length === 0) {
      alert('Aucun contact avec email valide');
      return;
    }

    if (!newCampaign.message.trim()) {
      alert('Veuillez saisir un message');
      return;
    }

    // Confirmation
    if (!window.confirm(`Envoyer ${emailContacts.length} email(s) automatiquement ?\n\nSujet: ${newCampaign.name || 'Afroboost - Message'}\n\nCette action est irréversible.`)) {
      return;
    }

    // Réinitialiser les résultats précédents
    setEmailSendingResults(null);
    setEmailSendingProgress({ current: 0, total: emailContacts.length, status: 'starting' });

    // Envoyer les emails
    const results = await sendBulkEmails(
      emailContacts,
      {
        name: newCampaign.name || 'Afroboost - Message',
        message: newCampaign.message,
        mediaUrl: newCampaign.mediaUrl
      },
      (current, total, status, name) => {
        setEmailSendingProgress({ current, total, status, name });
      }
    );

    // Afficher les résultats
    setEmailSendingResults(results);
    setEmailSendingProgress(null);
  };

  // === WHATSAPP API FUNCTIONS ===
  
  // Sauvegarder la configuration WhatsApp
  const handleSaveWhatsAppConfig = () => {
    const success = saveWhatsAppConfig(whatsAppConfig);
    if (success) {
      setShowWhatsAppConfig(false);
      alert('✅ Configuration WhatsApp API sauvegardée !');
    } else {
      alert('❌ Erreur lors de la sauvegarde');
    }
  };

  // Tester la configuration WhatsApp
  const handleTestWhatsApp = async () => {
    if (!testWhatsAppNumber) {
      alert('Veuillez entrer un numéro de téléphone pour le test');
      return;
    }
    
    setTestWhatsAppStatus('sending');
    const result = await testWhatsAppConfig(testWhatsAppNumber);
    
    if (result.success) {
      setTestWhatsAppStatus('success');
      setTimeout(() => setTestWhatsAppStatus(null), 5000);
    } else {
      setTestWhatsAppStatus('error');
      alert(`❌ Erreur: ${result.error}`);
      setTimeout(() => setTestWhatsAppStatus(null), 3000);
    }
  };

  // Envoyer la campagne WhatsApp automatiquement
  const handleSendWhatsAppCampaign = async () => {
    if (!isWhatsAppConfigured()) {
      alert('⚠️ WhatsApp API non configuré. Cliquez sur "⚙️ Config" pour ajouter vos clés Twilio.');
      return;
    }

    const contacts = getContactsForDirectSend();
    const phoneContacts = contacts
      .filter(c => c.phone)
      .map(c => ({ phone: c.phone, name: c.name }));

    if (phoneContacts.length === 0) {
      alert('Aucun contact avec numéro de téléphone');
      return;
    }

    if (!newCampaign.message.trim()) {
      alert('Veuillez saisir un message');
      return;
    }

    if (!window.confirm(`Envoyer ${phoneContacts.length} WhatsApp automatiquement ?\n\n⚠️ Cette action utilise votre quota Twilio et est irréversible.`)) {
      return;
    }

    setWhatsAppSendingResults(null);
    setWhatsAppSendingProgress({ current: 0, total: phoneContacts.length, status: 'starting' });

    const results = await sendBulkWhatsApp(
      phoneContacts,
      {
        message: newCampaign.message,
        mediaUrl: newCampaign.mediaUrl
      },
      (current, total, status, name) => {
        setWhatsAppSendingProgress({ current, total, status, name });
      }
    );

    setWhatsAppSendingResults(results);
    setWhatsAppSendingProgress(null);
  };

  // === ENVOI GROUPÉ (EMAIL + WHATSAPP) ===
  const handleBulkSendCampaign = async () => {
    const contacts = getContactsForDirectSend();
    const emailContacts = contacts
      .filter(c => c.email && c.email.includes('@'))
      .map(c => ({ email: c.email, name: c.name }));
    const phoneContacts = contacts
      .filter(c => c.phone)
      .map(c => ({ phone: c.phone, name: c.name }));

    const hasEmail = isEmailJSConfigured() && emailContacts.length > 0;
    const hasWhatsApp = isWhatsAppConfigured() && phoneContacts.length > 0;

    if (!hasEmail && !hasWhatsApp) {
      alert('⚠️ Aucun canal configuré ou aucun contact disponible.\n\nConfigurez EmailJS et/ou WhatsApp API.');
      return;
    }

    if (!newCampaign.message.trim()) {
      alert('Veuillez saisir un message');
      return;
    }

    const channels = [];
    if (hasEmail) channels.push(`${emailContacts.length} emails`);
    if (hasWhatsApp) channels.push(`${phoneContacts.length} WhatsApp`);

    if (!window.confirm(`Envoi automatique :\n• ${channels.join('\n• ')}\n\n⚠️ Cette action est irréversible.`)) {
      return;
    }

    setBulkSendingInProgress(true);
    setBulkSendingResults(null);
    
    const results = { email: null, whatsapp: null };

    // Envoyer les emails d'abord
    if (hasEmail) {
      setBulkSendingProgress({ channel: 'email', current: 0, total: emailContacts.length, name: '' });
      results.email = await sendBulkEmails(
        emailContacts,
        {
          name: newCampaign.name || 'Afroboost - Message',
          message: newCampaign.message,
          mediaUrl: newCampaign.mediaUrl
        },
        (current, total, status, name) => {
          setBulkSendingProgress({ channel: 'email', current, total, name });
        }
      );
    }

    // Puis les WhatsApp
    if (hasWhatsApp) {
      setBulkSendingProgress({ channel: 'whatsapp', current: 0, total: phoneContacts.length, name: '' });
      results.whatsapp = await sendBulkWhatsApp(
        phoneContacts,
        {
          message: newCampaign.message,
          mediaUrl: newCampaign.mediaUrl
        },
        (current, total, status, name) => {
          setBulkSendingProgress({ channel: 'whatsapp', current, total, name });
        }
      );
    }

    setBulkSendingProgress(null);
    setBulkSendingInProgress(false);
    setBulkSendingResults(results);
    
    // Mettre à jour le dernier média envoyé pour l'IA
    if (newCampaign.mediaUrl) {
      setLastMediaUrlService(newCampaign.mediaUrl);
      // Aussi mettre à jour côté backend
      axios.put(`${API}/ai-config`, { lastMediaUrl: newCampaign.mediaUrl }).catch(() => {});
    }
  };

  // === IA WHATSAPP FUNCTIONS ===
  
  // Charger la config IA depuis le backend
  const loadAIConfig = async () => {
    try {
      const res = await axios.get(`${API}/ai-config`);
      setAiConfig(res.data);
    } catch (err) {
      console.error("Error loading AI config:", err);
    }
  };

  // Charger les logs IA
  const loadAILogs = async () => {
    try {
      const res = await axios.get(`${API}/ai-logs`);
      setAiLogs(res.data || []);
    } catch (err) {
      console.error("Error loading AI logs:", err);
    }
  };

  // Sauvegarder la config IA
  const handleSaveAIConfig = async () => {
    try {
      await axios.put(`${API}/ai-config`, aiConfig);
      alert('✅ Configuration IA sauvegardée !');
    } catch (err) {
      alert('❌ Erreur lors de la sauvegarde');
    }
  };

  // Tester l'IA
  const handleTestAI = async () => {
    if (!aiTestMessage.trim()) {
      alert('Veuillez entrer un message de test');
      return;
    }
    
    setAiTestLoading(true);
    setAiTestResponse(null);
    
    try {
      const res = await axios.post(`${API}/ai-test`, {
        message: aiTestMessage,
        clientName: 'Test User'
      });
      setAiTestResponse(res.data);
    } catch (err) {
      setAiTestResponse({ success: false, error: err.response?.data?.detail || err.message });
    }
    
    setAiTestLoading(false);
  };

  // Effacer les logs IA
  const handleClearAILogs = async () => {
    if (!window.confirm('Effacer tous les logs IA ?')) return;
    try {
      await axios.delete(`${API}/ai-logs`);
      setAiLogs([]);
    } catch (err) {
      console.error("Error clearing AI logs:", err);
    }
  };

  // Stats des contacts pour envoi - calcul direct sans fonction
  const contactStats = useMemo(() => {
    const contacts = newCampaign.targetType === "selected" 
      ? allContacts.filter(c => selectedContactsForCampaign.includes(c.id))
      : allContacts;
    return {
      total: contacts.length,
      withEmail: contacts.filter(c => c.email && c.email.includes('@')).length,
      withPhone: contacts.filter(c => c.phone).length,
    };
  }, [allContacts, selectedContactsForCampaign, newCampaign.targetType]);

  // Mark result as sent
  const markResultSent = async (campaignId, contactId, channel) => {
    try {
      await axios.post(`${API}/campaigns/${campaignId}/mark-sent`, { contactId, channel });
      const res = await axios.get(`${API}/campaigns/${campaignId}`);
      setCampaigns(campaigns.map(c => c.id === campaignId ? res.data : c));
    } catch (err) { console.error("Error marking sent:", err); }
  };

  // Update shipping tracking for a reservation
  const updateTracking = async (reservationId, trackingNumber, shippingStatus) => {
    try {
      await axios.put(`${API}/reservations/${reservationId}/tracking`, { trackingNumber, shippingStatus });
      const res = await axios.get(`${API}/reservations`);
      setReservations(res.data);
    } catch (err) { console.error("Error updating tracking:", err); }
  };

  const tabs = [
    { id: "reservations", label: t('reservations') }, { id: "concept", label: t('conceptVisual') },
    { id: "courses", label: t('courses') }, { id: "offers", label: t('offers') },
    { id: "payments", label: t('payments') }, { id: "codes", label: t('promoCodes') },
    { id: "campaigns", label: "📢 Campagnes" }
  ];

  return (
    <div className="w-full min-h-screen p-6 section-gradient">
      {/* QR Scanner Modal with Camera Support */}
      {showScanner && (
        <QRScannerModal 
          onClose={() => { setShowScanner(false); setScanResult(null); setScanError(null); }}
          onValidate={validateReservation}
          scanResult={scanResult}
          scanError={scanError}
          onManualValidation={handleManualValidation}
        />
      )}

      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
          <h1 className="font-bold text-white" style={{ fontSize: '28px' }}>{t('coachMode')}</h1>
          <div className="flex gap-3">
            <button onClick={onBack} className="px-4 py-2 rounded-lg glass text-white text-sm" data-testid="coach-back">{t('back')}</button>
            <button onClick={onLogout} className="px-4 py-2 rounded-lg glass text-white text-sm" data-testid="coach-logout">{t('logout')}</button>
          </div>
        </div>

        <div className="flex gap-2 mb-6 flex-wrap">
          {tabs.map(tb => (
            <button key={tb.id} onClick={() => setTab(tb.id)} className={`coach-tab px-4 py-2 rounded-lg text-sm ${tab === tb.id ? 'active' : ''}`}
              style={{ color: 'white' }} data-testid={`coach-tab-${tb.id}`}>{tb.label}</button>
          ))}
        </div>

        {/* Reservations Tab */}
        {tab === "reservations" && (
          <div className="card-gradient rounded-xl p-6">
            <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
              <h2 className="font-semibold text-white" style={{ fontSize: '20px' }}>{t('reservationsList')}</h2>
              <div className="flex gap-2">
                <button onClick={() => setShowScanner(true)} className="btn-primary px-4 py-2 rounded-lg flex items-center gap-2" data-testid="scan-ticket-btn">
                  📷 Scanner un ticket
                </button>
                <button onClick={exportCSV} className="csv-btn" data-testid="export-csv">{t('downloadCSV')}</button>
              </div>
            </div>
            
            {/* Scrollable reservations table */}
            <div className="overflow-x-auto overflow-y-auto rounded-lg" style={{ maxHeight: '600px' }}>
              <table className="coach-table">
                <thead className="sticky top-0 bg-black z-10">
                  <tr>
                    <th className="bg-black">{t('code')}</th>
                    <th className="bg-black">{t('name')}</th>
                    <th className="bg-black">{t('email')}</th>
                    <th className="bg-black">WhatsApp</th>
                    <th className="bg-black">{t('courses')}</th>
                    <th className="bg-black">{t('date')}</th>
                    <th className="bg-black">{t('time')}</th>
                    <th className="bg-black">{t('offer')}</th>
                    <th className="bg-black">{t('qty')}</th>
                    <th className="bg-black">{t('total')}</th>
                    <th className="bg-black">Statut</th>
                    <th className="bg-black">📦 Expédition</th>
                  </tr>
                </thead>
                <tbody>
                  {reservations.map(r => {
                    const dt = new Date(r.datetime);
                    const isProduct = r.selectedVariants || r.trackingNumber || r.shippingStatus !== 'pending';
                    return (
                      <tr key={r.id} className={r.validated ? 'bg-green-900/20' : ''}>
                        <td style={{ fontWeight: 'bold', color: '#d91cd2' }}>{r.reservationCode || '-'}</td>
                        <td>{r.userName}</td><td>{r.userEmail}</td><td>{r.userWhatsapp || '-'}</td>
                        <td>{r.courseName}</td><td>{dt.toLocaleDateString('fr-CH')}</td>
                        <td>{dt.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}</td>
                        <td>
                          {r.offerName}
                          {r.selectedVariants && (
                            <span className="block text-xs opacity-50">
                              {r.selectedVariants.size && `Taille: ${r.selectedVariants.size}`}
                              {r.selectedVariants.color && ` | ${r.selectedVariants.color}`}
                            </span>
                          )}
                        </td>
                        <td>{r.quantity || 1}</td>
                        <td style={{ fontWeight: 'bold' }}>
                          CHF {r.totalPrice || r.price}
                          {r.tva > 0 && <span className="text-xs opacity-50 block">TVA {r.tva}%</span>}
                        </td>
                        <td>
                          {r.validated ? (
                            <span className="px-2 py-1 rounded text-xs bg-green-600 text-white">✅ Validé</span>
                          ) : (
                            <span className="px-2 py-1 rounded text-xs bg-yellow-600 text-white">⏳ En attente</span>
                          )}
                        </td>
                        {/* Shipping column for products */}
                        <td>
                          {isProduct ? (
                            <div className="flex flex-col gap-1">
                              <input 
                                type="text" 
                                placeholder="N° suivi" 
                                defaultValue={r.trackingNumber || ''}
                                onBlur={(e) => updateTracking(r.id, e.target.value, r.shippingStatus || 'pending')}
                                className="px-2 py-1 rounded text-xs neon-input w-24"
                              />
                              <select 
                                defaultValue={r.shippingStatus || 'pending'}
                                onChange={(e) => updateTracking(r.id, r.trackingNumber, e.target.value)}
                                className="px-2 py-1 rounded text-xs neon-input"
                              >
                                <option value="pending">📦 En attente</option>
                                <option value="shipped">🚚 Expédié</option>
                                <option value="delivered">✅ Livré</option>
                              </select>
                            </div>
                          ) : (
                            <span className="text-xs opacity-30">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {reservations.length === 0 && <tr><td colSpan="12" className="text-center py-8" style={{ opacity: 0.5 }}>{t('noReservations')}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Concept Tab */}
        {tab === "concept" && (
          <div className="card-gradient rounded-xl p-6">
            <h2 className="font-semibold text-white mb-6" style={{ fontSize: '20px' }}>{t('conceptVisual')}</h2>
            <div className="space-y-4">
              <div>
                <label className="block mb-2 text-white text-sm">{t('conceptDescription')}</label>
                <textarea value={concept.description} onChange={(e) => setConcept({ ...concept, description: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg neon-input" rows={4} data-testid="concept-description" 
                  placeholder="Décrivez le concept Afroboost..." />
              </div>
              <div>
                <label className="block mb-2 text-white text-sm">{t('mediaUrl')}</label>
                <div className="relative">
                  <input type="url" value={concept.heroImageUrl} onChange={(e) => setConcept({ ...concept, heroImageUrl: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg neon-input pr-24" placeholder="https://youtube.com/watch?v=... ou image URL" data-testid="concept-media-url" />
                  {/* Badge de validation d'URL */}
                  {concept.heroImageUrl && concept.heroImageUrl.trim() !== '' && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs px-2 py-1 rounded" style={{
                      background: (() => {
                        const url = concept.heroImageUrl.toLowerCase();
                        const isValid = url.includes('youtube.com') || url.includes('youtu.be') || 
                                        url.includes('vimeo.com') || 
                                        url.endsWith('.mp4') || url.endsWith('.webm') ||
                                        url.endsWith('.jpg') || url.endsWith('.jpeg') || 
                                        url.endsWith('.png') || url.endsWith('.webp') || url.endsWith('.gif') ||
                                        url.includes('unsplash.com') || url.includes('pexels.com');
                        return isValid ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)';
                      })(),
                      color: (() => {
                        const url = concept.heroImageUrl.toLowerCase();
                        const isValid = url.includes('youtube.com') || url.includes('youtu.be') || 
                                        url.includes('vimeo.com') || 
                                        url.endsWith('.mp4') || url.endsWith('.webm') ||
                                        url.endsWith('.jpg') || url.endsWith('.jpeg') || 
                                        url.endsWith('.png') || url.endsWith('.webp') || url.endsWith('.gif') ||
                                        url.includes('unsplash.com') || url.includes('pexels.com');
                        return isValid ? '#22c55e' : '#ef4444';
                      })()
                    }}>
                      {(() => {
                        const url = concept.heroImageUrl.toLowerCase();
                        const isValid = url.includes('youtube.com') || url.includes('youtu.be') || 
                                        url.includes('vimeo.com') || 
                                        url.endsWith('.mp4') || url.endsWith('.webm') ||
                                        url.endsWith('.jpg') || url.endsWith('.jpeg') || 
                                        url.endsWith('.png') || url.endsWith('.webp') || url.endsWith('.gif') ||
                                        url.includes('unsplash.com') || url.includes('pexels.com');
                        return isValid ? '✓ Valide' : '✗ Format inconnu';
                      })()}
                    </span>
                  )}
                </div>
                <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Formats acceptés: YouTube, Vimeo, .mp4, .jpg, .png, .webp</p>
              </div>
              {concept.heroImageUrl && (
                <div className="mt-4">
                  <p className="text-white text-sm mb-2" style={{ opacity: 0.7 }}>Aperçu média (16:9):</p>
                  <MediaDisplay url={concept.heroImageUrl} className="rounded-lg overflow-hidden" />
                </div>
              )}
              {/* Logo URL for Splash Screen & PWA */}
              <div>
                <label className="block mb-2 text-white text-sm">{t('logoUrl') || 'URL du Logo (Splash Screen & PWA)'}</label>
                <input type="url" value={concept.logoUrl || ''} onChange={(e) => setConcept({ ...concept, logoUrl: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg neon-input" placeholder="https://... (logo PNG/SVG)" data-testid="concept-logo-url" />
                <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Ce logo apparaît sur le Splash Screen et comme icône PWA</p>
              </div>
              {concept.logoUrl && (
                <div className="mt-2">
                  <p className="text-white text-sm mb-2" style={{ opacity: 0.7 }}>Aperçu logo:</p>
                  <div className="flex justify-center p-4 rounded-lg" style={{ background: '#000' }}>
                    <img src={concept.logoUrl} alt="Logo" style={{ maxHeight: '80px', maxWidth: '200px' }} />
                  </div>
                </div>
              )}
              {/* Favicon URL - Icône de l'onglet navigateur */}
              <div>
                <label className="block mb-2 text-white text-sm">URL du Favicon (icône onglet navigateur)</label>
                <input type="url" value={concept.faviconUrl || ''} onChange={(e) => setConcept({ ...concept, faviconUrl: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg neon-input" placeholder="https://... (favicon .ico/.png)" data-testid="concept-favicon-url" />
                <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Cette icône apparaît dans l'onglet du navigateur</p>
              </div>
              {concept.faviconUrl && (
                <div className="mt-2">
                  <p className="text-white text-sm mb-2" style={{ opacity: 0.7 }}>Aperçu favicon:</p>
                  <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: '#1a1a2e' }}>
                    <img src={concept.faviconUrl} alt="Favicon" style={{ width: '32px', height: '32px' }} onError={(e) => { e.target.style.display = 'none'; }} />
                    <span className="text-white text-sm opacity-70">Afroboost</span>
                  </div>
                </div>
              )}

              {/* CGV - Conditions Générales de Vente */}
              <div className="mt-6 pt-6 border-t border-purple-500/30">
                <label className="block mb-2 text-white text-sm">{t('termsText') || 'Texte des Conditions Générales'}</label>
                <textarea 
                  value={concept.termsText || ''} 
                  onChange={(e) => setConcept({ ...concept, termsText: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg neon-input" 
                  rows={8}
                  placeholder={t('termsPlaceholder') || 'Entrez le texte de vos conditions générales de vente...'}
                  data-testid="concept-terms-text"
                />
                <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Ce texte s'affichera dans la fenêtre modale "Conditions générales" accessible depuis le formulaire de réservation.
                </p>
              </div>

              {/* Lien Avis Google */}
              <div className="mt-6 pt-6 border-t border-purple-500/30">
                <label className="block mb-2 text-white text-sm">⭐ Lien des avis Google</label>
                <input 
                  type="url" 
                  value={concept.googleReviewsUrl || ''} 
                  onChange={(e) => setConcept({ ...concept, googleReviewsUrl: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg neon-input" 
                  placeholder="https://g.page/r/..."
                  data-testid="concept-google-reviews-url"
                />
                <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Ce lien s'affichera comme bouton "Voir les avis" côté client, entre les offres et le formulaire.
                </p>
                {concept.googleReviewsUrl && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-green-400 text-xs">✓ Lien configuré</span>
                    <a 
                      href={concept.googleReviewsUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-xs text-pink-400 hover:text-pink-300 underline"
                    >
                      Tester le lien
                    </a>
                  </div>
                )}
              </div>

              {/* Section d'atterrissage par défaut */}
              <div className="mt-6 pt-6 border-t border-purple-500/30">
                <LandingSectionSelector 
                  value={concept.defaultLandingSection || 'sessions'}
                  onChange={(value) => setConcept({ ...concept, defaultLandingSection: value })}
                />
              </div>

              {/* Liens Externes */}
              <div className="mt-6 pt-6 border-t border-purple-500/30">
                <h3 className="text-white text-sm font-semibold mb-4">🔗 Liens Externes (affichés en bas de page)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block mb-1 text-white text-xs opacity-70">Titre du lien 1</label>
                    <input 
                      type="text" 
                      value={concept.externalLink1Title || ''} 
                      onChange={(e) => setConcept({ ...concept, externalLink1Title: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg neon-input text-sm" 
                      placeholder="Ex: Instagram"
                      data-testid="external-link1-title"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 text-white text-xs opacity-70">URL du lien 1</label>
                    <input 
                      type="url" 
                      value={concept.externalLink1Url || ''} 
                      onChange={(e) => setConcept({ ...concept, externalLink1Url: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg neon-input text-sm" 
                      placeholder="https://..."
                      data-testid="external-link1-url"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-1 text-white text-xs opacity-70">Titre du lien 2</label>
                    <input 
                      type="text" 
                      value={concept.externalLink2Title || ''} 
                      onChange={(e) => setConcept({ ...concept, externalLink2Title: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg neon-input text-sm" 
                      placeholder="Ex: Facebook"
                      data-testid="external-link2-title"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 text-white text-xs opacity-70">URL du lien 2</label>
                    <input 
                      type="url" 
                      value={concept.externalLink2Url || ''} 
                      onChange={(e) => setConcept({ ...concept, externalLink2Url: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg neon-input text-sm" 
                      placeholder="https://..."
                      data-testid="external-link2-url"
                    />
                  </div>
                </div>
              </div>

              {/* Modes de paiement acceptés */}
              <div className="mt-6 pt-6 border-t border-purple-500/30">
                <h3 className="text-white text-sm font-semibold mb-4">💳 Modes de paiement acceptés</h3>
                <p className="text-xs mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Les icônes des paiements cochés s'afficheront dans le pied de page côté client.
                </p>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={concept.paymentTwint || false}
                      onChange={(e) => setConcept({ ...concept, paymentTwint: e.target.checked })}
                      className="w-5 h-5 rounded accent-pink-500"
                      data-testid="payment-twint"
                    />
                    <span className="text-white text-sm">Twint</span>
                    <span style={{ fontSize: '20px' }}>🔵</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={concept.paymentPaypal || false}
                      onChange={(e) => setConcept({ ...concept, paymentPaypal: e.target.checked })}
                      className="w-5 h-5 rounded accent-pink-500"
                      data-testid="payment-paypal"
                    />
                    <span className="text-white text-sm">PayPal</span>
                    <span style={{ fontSize: '20px' }}>🅿️</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={concept.paymentCreditCard || false}
                      onChange={(e) => setConcept({ ...concept, paymentCreditCard: e.target.checked })}
                      className="w-5 h-5 rounded accent-pink-500"
                      data-testid="payment-creditcard"
                    />
                    <span className="text-white text-sm">Carte de Crédit</span>
                    <span style={{ fontSize: '20px' }}>💳</span>
                  </label>
                </div>
              </div>

              <button onClick={saveConcept} className="btn-primary px-6 py-3 rounded-lg mt-6" data-testid="save-concept">{t('save')}</button>
            </div>
          </div>
        )}

        {/* Courses Tab */}
        {tab === "courses" && (
          <div className="card-gradient rounded-xl p-6">
            <h2 className="font-semibold text-white mb-6" style={{ fontSize: '20px' }}>{t('courses')}</h2>
            {courses.map((course, idx) => (
              <div key={course.id} className="glass rounded-lg p-4 mb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-1 text-white text-xs opacity-70">{t('courseName')}</label>
                    <input type="text" value={course.name} onChange={(e) => { const n = [...courses]; n[idx].name = e.target.value; setCourses(n); }}
                      onBlur={() => updateCourse(course)} className="w-full px-3 py-2 rounded-lg neon-input text-sm" />
                  </div>
                  <div>
                    <label className="block mb-1 text-white text-xs opacity-70">{t('location')}</label>
                    <input type="text" value={course.locationName} onChange={(e) => { const n = [...courses]; n[idx].locationName = e.target.value; setCourses(n); }}
                      onBlur={() => updateCourse(course)} className="w-full px-3 py-2 rounded-lg neon-input text-sm" />
                  </div>
                  <div>
                    <label className="block mb-1 text-white text-xs opacity-70">{t('weekday')}</label>
                    <select value={course.weekday} onChange={(e) => { const n = [...courses]; n[idx].weekday = parseInt(e.target.value); setCourses(n); updateCourse({ ...course, weekday: parseInt(e.target.value) }); }}
                      className="w-full px-3 py-2 rounded-lg neon-input text-sm">
                      {WEEKDAYS_MAP[lang].map((d, i) => <option key={i} value={i}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block mb-1 text-white text-xs opacity-70">{t('time')}</label>
                    <input type="time" value={course.time} onChange={(e) => { const n = [...courses]; n[idx].time = e.target.value; setCourses(n); }}
                      onBlur={() => updateCourse(course)} className="w-full px-3 py-2 rounded-lg neon-input text-sm" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block mb-1 text-white text-xs opacity-70">{t('mapsLink')}</label>
                    <input type="url" value={course.mapsUrl || ''} onChange={(e) => { const n = [...courses]; n[idx].mapsUrl = e.target.value; setCourses(n); }}
                      onBlur={() => updateCourse(course)} className="w-full px-3 py-2 rounded-lg neon-input text-sm" placeholder="https://maps.google.com/..." />
                  </div>
                  {/* Toggle visibilité du cours */}
                  <div className="flex items-center gap-3 mt-2">
                    <label className="text-white text-xs opacity-70">{t('visible')}</label>
                    <div className={`switch ${course.visible !== false ? 'active' : ''}`} 
                      onClick={() => { 
                        const n = [...courses]; 
                        n[idx].visible = course.visible === false ? true : false; 
                        setCourses(n); 
                        updateCourse({ ...course, visible: n[idx].visible }); 
                      }} 
                      data-testid={`course-visible-${course.id}`}
                    />
                    <span className="text-white text-xs opacity-50">
                      {course.visible !== false ? '👁️ Visible' : '🚫 Masqué'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            <form onSubmit={addCourse} className="glass rounded-lg p-4 mt-4">
              <h3 className="text-white mb-4 font-semibold text-sm">{t('addCourse')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="text" placeholder={t('courseName')} value={newCourse.name} onChange={e => setNewCourse({ ...newCourse, name: e.target.value })} className="px-3 py-2 rounded-lg neon-input text-sm" required />
                <input type="text" placeholder={t('location')} value={newCourse.locationName} onChange={e => setNewCourse({ ...newCourse, locationName: e.target.value })} className="px-3 py-2 rounded-lg neon-input text-sm" />
                <select value={newCourse.weekday} onChange={e => setNewCourse({ ...newCourse, weekday: parseInt(e.target.value) })} className="px-3 py-2 rounded-lg neon-input text-sm">
                  {WEEKDAYS_MAP[lang].map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
                <input type="time" value={newCourse.time} onChange={e => setNewCourse({ ...newCourse, time: e.target.value })} className="px-3 py-2 rounded-lg neon-input text-sm" />
              </div>
              <button type="submit" className="btn-primary px-4 py-2 rounded-lg mt-4 text-sm">{t('add')}</button>
            </form>
          </div>
        )}

        {/* Offers Tab */}
        {tab === "offers" && (
          <div className="card-gradient rounded-xl p-6">
            <h2 className="font-semibold text-white mb-6" style={{ fontSize: '20px' }}>{t('offers')}</h2>
            {offers.map((offer, idx) => (
              <div key={offer.id} className="glass rounded-lg p-4 mb-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    {offer.images?.[0] || offer.thumbnail ? (
                      <img src={offer.images?.[0] || offer.thumbnail} alt="" className="w-12 h-12 rounded-lg object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-purple-900/30 flex items-center justify-center text-2xl">🎧</div>
                    )}
                    <div>
                      <h4 className="text-white font-semibold">{offer.name}</h4>
                      <p className="text-purple-400 text-sm">{offer.price} CHF • {offer.images?.length || 0} images</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => startEditOffer(offer)}
                      className="px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs"
                      data-testid={`edit-offer-${offer.id}`}
                    >
                      ✏️ Modifier
                    </button>
                    <button 
                      onClick={() => deleteOffer(offer.id)}
                      className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs"
                      data-testid={`delete-offer-${offer.id}`}
                    >
                      🗑️ Supprimer
                    </button>
                    <div className="flex items-center gap-2 ml-2">
                      <span className="text-xs text-white opacity-60">{t('visible')}</span>
                      <div className={`switch ${offer.visible ? 'active' : ''}`} onClick={() => { const n = [...offers]; n[idx].visible = !offer.visible; setOffers(n); updateOffer({ ...offer, visible: !offer.visible }); }} />
                    </div>
                  </div>
                </div>
                {offer.description && (
                  <p className="text-white/60 text-xs mt-2 italic">"{offer.description}"</p>
                )}
              </div>
            ))}
            
            {/* Formulaire Ajout/Modification */}
            <form id="offer-form" onSubmit={addOffer} className="glass rounded-lg p-4 mt-4 border-2 border-purple-500/50">
              <h3 className="text-white mb-4 font-semibold text-sm flex items-center gap-2">
                {editingOfferId ? '✏️ Modifier l\'offre' : '➕ Ajouter une offre'}
                {editingOfferId && (
                  <button type="button" onClick={cancelEditOffer} className="ml-auto text-xs text-red-400 hover:text-red-300">
                    ✕ Annuler
                  </button>
                )}
              </h3>
              
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-white opacity-60 mb-1 block">Nom de l'offre *</label>
                  <input type="text" placeholder="Ex: Cours à l'unité" value={newOffer.name} onChange={e => setNewOffer({ ...newOffer, name: e.target.value })} className="w-full px-3 py-2 rounded-lg neon-input text-sm" required />
                </div>
                <div>
                  <label className="text-xs text-white opacity-60 mb-1 block">Prix (CHF)</label>
                  <input type="number" placeholder="30" value={newOffer.price} onChange={e => setNewOffer({ ...newOffer, price: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg neon-input text-sm" />
                </div>
              </div>
              
              {/* 5 Champs d'images */}
              <div className="mt-4">
                <label className="text-xs text-white opacity-60 mb-2 block">📷 Images (max 5 URLs)</label>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                  {[0, 1, 2, 3, 4].map(i => (
                    <input 
                      key={i}
                      type="url" 
                      placeholder={`Image ${i + 1}`}
                      value={newOffer.images?.[i] || ''} 
                      onChange={e => {
                        const newImages = [...(newOffer.images || ["", "", "", "", ""])];
                        newImages[i] = e.target.value;
                        setNewOffer({ ...newOffer, images: newImages });
                      }}
                      className="w-full px-3 py-2 rounded-lg neon-input text-xs"
                    />
                  ))}
                </div>
              </div>
              
              {/* Description */}
              <div className="mt-4">
                <label className="text-xs text-white opacity-60 mb-1 block">Description (icône "i")</label>
                <textarea 
                  value={newOffer.description || ''} 
                  onChange={e => setNewOffer({ ...newOffer, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg neon-input text-sm" 
                  rows={2}
                  maxLength={150}
                  placeholder="Description visible au clic sur l'icône i (max 150 car.)"
                />
                <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{(newOffer.description || '').length}/150</p>
              </div>
              
              {/* Category & Type */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                <select 
                  value={newOffer.category} 
                  onChange={e => setNewOffer({ ...newOffer, category: e.target.value })}
                  className="px-3 py-2 rounded-lg neon-input text-sm"
                >
                  <option value="service">🎧 Service / Cours</option>
                  <option value="tshirt">👕 T-shirt</option>
                  <option value="shoes">👟 Chaussures</option>
                  <option value="supplement">💊 Complément</option>
                  <option value="accessory">🎒 Accessoire</option>
                </select>
                <label className="flex items-center gap-2 text-white text-sm">
                  <input 
                    type="checkbox" 
                    checked={newOffer.isProduct} 
                    onChange={e => setNewOffer({ ...newOffer, isProduct: e.target.checked })} 
                  />
                  Produit physique (expédition)
                </label>
                <label className="flex items-center gap-2 text-white text-sm">
                  <input 
                    type="checkbox" 
                    checked={newOffer.visible} 
                    onChange={e => setNewOffer({ ...newOffer, visible: e.target.checked })} 
                  />
                  Visible
                </label>
              </div>
              
              {/* E-Commerce Fields (shown when isProduct) */}
              {newOffer.isProduct && (
                <div className="mt-3 p-3 rounded-lg border border-purple-500/30">
                  <p className="text-xs text-purple-400 mb-3">📦 Paramètres produit</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="text-xs text-white opacity-60">TVA (%)</label>
                      <input type="number" placeholder="7.7" value={newOffer.tva || ''} onChange={e => setNewOffer({ ...newOffer, tva: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg neon-input text-sm" step="0.1" />
                    </div>
                    <div>
                      <label className="text-xs text-white opacity-60">Frais port (CHF)</label>
                      <input type="number" placeholder="9.90" value={newOffer.shippingCost || ''} onChange={e => setNewOffer({ ...newOffer, shippingCost: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg neon-input text-sm" step="0.1" />
                    </div>
                    <div>
                      <label className="text-xs text-white opacity-60">Stock (-1=illimité)</label>
                      <input type="number" placeholder="-1" value={newOffer.stock} onChange={e => setNewOffer({ ...newOffer, stock: parseInt(e.target.value) || -1 })} className="w-full px-3 py-2 rounded-lg neon-input text-sm" />
                    </div>
                  </div>
                  
                  {/* Variants */}
                  <div className="mt-3">
                    <label className="text-xs text-white opacity-60">Variantes (séparées par virgule)</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
                      <input 
                        type="text" 
                        placeholder="Tailles: S, M, L, XL"
                        onChange={e => setNewOffer({ 
                          ...newOffer, 
                          variants: { ...newOffer.variants, sizes: e.target.value.split(',').map(s => s.trim()).filter(s => s) }
                        })}
                        className="px-3 py-2 rounded-lg neon-input text-sm"
                      />
                      <input 
                        type="text" 
                        placeholder="Couleurs: Noir, Blanc, Rose"
                        onChange={e => setNewOffer({ 
                          ...newOffer, 
                          variants: { ...newOffer.variants, colors: e.target.value.split(',').map(s => s.trim()).filter(s => s) }
                        })}
                        className="px-3 py-2 rounded-lg neon-input text-sm"
                      />
                      <input 
                        type="text" 
                        placeholder="Poids: 0.5kg, 1kg"
                        onChange={e => setNewOffer({ 
                          ...newOffer, 
                          variants: { ...newOffer.variants, weights: e.target.value.split(',').map(s => s.trim()).filter(s => s) }
                        })}
                        className="px-3 py-2 rounded-lg neon-input text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}
              
              <button type="submit" className="btn-primary px-6 py-3 rounded-lg mt-4 text-sm w-full">
                {editingOfferId ? '💾 Enregistrer les modifications' : '➕ Ajouter l\'offre'}
              </button>
            </form>
          </div>
        )}

        {/* Payments Tab */}
        {tab === "payments" && (
          <div className="card-gradient rounded-xl p-6">
            <h2 className="font-semibold text-white mb-6" style={{ fontSize: '20px' }}>{t('payments')}</h2>
            <div className="space-y-4">
              <div><label className="block mb-2 text-white text-sm">{t('stripeLink')}</label>
                <input type="url" value={paymentLinks.stripe} onChange={e => setPaymentLinks({ ...paymentLinks, stripe: e.target.value })} className="w-full px-4 py-3 rounded-lg neon-input" placeholder="https://buy.stripe.com/..." /></div>
              <div><label className="block mb-2 text-white text-sm">{t('paypalLink')}</label>
                <input type="url" value={paymentLinks.paypal} onChange={e => setPaymentLinks({ ...paymentLinks, paypal: e.target.value })} className="w-full px-4 py-3 rounded-lg neon-input" placeholder="https://paypal.me/..." /></div>
              <div><label className="block mb-2 text-white text-sm">{t('twintLink')}</label>
                <input type="url" value={paymentLinks.twint} onChange={e => setPaymentLinks({ ...paymentLinks, twint: e.target.value })} className="w-full px-4 py-3 rounded-lg neon-input" placeholder="https://..." /></div>
              <div><label className="block mb-2 text-white text-sm">{t('coachWhatsapp')}</label>
                <input type="tel" value={paymentLinks.coachWhatsapp} onChange={e => setPaymentLinks({ ...paymentLinks, coachWhatsapp: e.target.value })} className="w-full px-4 py-3 rounded-lg neon-input" placeholder="+41791234567" /></div>
              <button onClick={savePayments} className="btn-primary px-6 py-3 rounded-lg">{t('save')}</button>
            </div>
          </div>
        )}

        {/* Promo Codes Tab with Beneficiary Dropdown */}
        {tab === "codes" && (
          <div className="card-gradient rounded-xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-semibold text-white" style={{ fontSize: '20px' }}>{t('promoCodes')}</h2>
              <div>
                <input type="file" accept=".csv" ref={fileInputRef} onChange={handleImportCSV} style={{ display: 'none' }} />
                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 rounded-lg glass text-white text-sm" data-testid="import-csv-btn">
                  <FolderIcon /> {t('importCSV')}
                </button>
              </div>
            </div>
            
            <form onSubmit={addCode} className="mb-6 p-4 rounded-lg glass">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <input type="text" placeholder={t('codePromo')} value={newCode.code} onChange={e => setNewCode({ ...newCode, code: e.target.value })}
                  className="px-3 py-2 rounded-lg neon-input text-sm" data-testid="new-code-name" />
                <select value={newCode.type} onChange={e => setNewCode({ ...newCode, type: e.target.value })} className="px-3 py-2 rounded-lg neon-input text-sm" data-testid="new-code-type">
                  <option value="">{t('type')}</option>
                  <option value="100%">100% (Gratuit)</option>
                  <option value="%">%</option>
                  <option value="CHF">CHF</option>
                </select>
                <input type="number" placeholder={t('value')} value={newCode.value} onChange={e => setNewCode({ ...newCode, value: e.target.value })}
                  className="px-3 py-2 rounded-lg neon-input text-sm" data-testid="new-code-value" />
                {/* Beneficiary Dropdown */}
                <select value={newCode.assignedEmail} onChange={e => setNewCode({ ...newCode, assignedEmail: e.target.value })}
                  className="px-3 py-2 rounded-lg neon-input text-sm" data-testid="new-code-beneficiary">
                  <option value="">{t('selectBeneficiary')}</option>
                  {uniqueCustomers.map((c, i) => (
                    <option key={i} value={c.email}>{c.name} - {c.email}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <input type="number" placeholder={t('maxUses')} value={newCode.maxUses} onChange={e => setNewCode({ ...newCode, maxUses: e.target.value })}
                  className="px-3 py-2 rounded-lg neon-input text-sm" />
                <input type="date" value={newCode.expiresAt} onChange={e => setNewCode({ ...newCode, expiresAt: e.target.value })}
                  className="px-3 py-2 rounded-lg neon-input text-sm" />
                <div>
                  <label className="block text-white text-xs mb-1 opacity-70">{t('allowedCourses')}</label>
                  {/* Scrollable courses list */}
                  <div className="courses-scroll-container" style={{ maxHeight: '120px', overflowY: 'auto', padding: '4px' }} data-testid="courses-scroll-container">
                    <div className="flex flex-wrap gap-2">
                      {courses.map(c => (
                        <button key={c.id} type="button" onClick={() => toggleCourseSelection(c.id)}
                          className={`px-2 py-1 rounded text-xs transition-all ${newCode.courses.includes(c.id) ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                          style={{ color: 'white' }} data-testid={`course-select-${c.id}`}>{c.name.split(' – ')[0]}</button>
                      ))}
                      {courses.length === 0 && <span className="text-white text-xs opacity-50">{t('allCourses')}</span>}
                    </div>
                  </div>
                </div>
              </div>
              <button type="submit" className="btn-primary px-6 py-2 rounded-lg text-sm" data-testid="add-code">{t('add')}</button>
            </form>

            <div className="space-y-2">
              {discountCodes.map(code => (
                <div key={code.id} className="p-4 rounded-lg flex justify-between items-center flex-wrap gap-3 glass">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-white font-bold">{code.code}</span>
                      <span className="px-2 py-0.5 rounded text-xs" style={{ background: 'rgba(139, 92, 246, 0.3)', color: '#d8b4fe' }}>
                        {code.type === '100%' ? '100%' : `${code.value}${code.type}`}
                      </span>
                    </div>
                    <div className="text-white text-xs opacity-50">
                      {code.assignedEmail && <span className="mr-3">📧 {code.assignedEmail}</span>}
                      {code.maxUses && <span className="mr-3">🔢 Max: {code.maxUses}</span>}
                      {code.expiresAt && <span className="mr-3">📅 {new Date(code.expiresAt).toLocaleDateString()}</span>}
                      <span>✓ {t('used')}: {code.used || 0}x</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleCode(code)} className={`px-4 py-2 rounded-lg text-xs font-medium ${code.active ? 'bg-green-600' : 'bg-gray-600'}`} style={{ color: 'white' }}>
                      {code.active ? `✅ ${t('active')}` : `❌ ${t('inactive')}`}
                    </button>
                    {/* Delete button - red trash icon */}
                    <button 
                      onClick={() => deleteCode(code.id)} 
                      className="delete-code-btn px-3 py-2 rounded-lg text-xs font-medium"
                      style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.4)' }}
                      data-testid={`delete-code-${code.id}`}
                      title={t('delete') || 'Supprimer'}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
              {discountCodes.length === 0 && <p className="text-center py-8 text-white opacity-50">{t('noPromoCode')}</p>}
            </div>
          </div>
        )}

        {/* === CAMPAIGNS TAB === */}
        {tab === "campaigns" && (
          <div className="card-gradient rounded-xl p-6">
            <h2 className="font-semibold text-white mb-6" style={{ fontSize: '20px' }}>📢 Gestionnaire de Campagnes</h2>
            
            {/* === COMPTEUR DE CLIENTS CIBLÉS === */}
            <div className="mb-6 p-4 rounded-xl glass border border-purple-500/30">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-white font-semibold text-lg">
                    👥 Nombre de clients ciblés : <span className="text-pink-400">{contactStats.total}</span>
                  </h3>
                  <p className="text-sm text-white/60 mt-1">
                    📧 {contactStats.withEmail} avec email • 📱 {contactStats.withPhone} avec WhatsApp
                  </p>
                </div>
                <div className="flex gap-2">
                  <button 
                    type="button"
                    onClick={() => setDirectSendMode(!directSendMode)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${directSendMode ? 'bg-pink-600 text-white' : 'glass text-white border border-purple-500/30'}`}
                  >
                    {directSendMode ? '✓ Mode Envoi Direct' : '🚀 Envoi Direct'}
                  </button>
                </div>
              </div>
            </div>

            {/* === MODE ENVOI DIRECT === */}
            {directSendMode && (
              <div className="mb-8 p-5 rounded-xl glass border-2 border-pink-500/50">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  🚀 Envoi Direct par Canal
                  <span className="text-xs text-pink-400 font-normal">(Utilisez le message ci-dessous)</span>
                </h3>

                {/* Message pour envoi direct */}
                <div className="mb-4">
                  <label className="block mb-2 text-white text-sm">Message à envoyer</label>
                  <textarea 
                    value={newCampaign.message} 
                    onChange={e => setNewCampaign({...newCampaign, message: e.target.value})}
                    className="w-full px-4 py-3 rounded-lg neon-input" 
                    rows={3}
                    placeholder="Votre message... (utilisez {prénom} pour personnaliser)"
                  />
                </div>

                {/* Champ URL média/miniature */}
                <div className="mb-4">
                  <label className="block mb-2 text-white text-sm">📎 URL du média (image/vidéo)</label>
                  <input 
                    type="url"
                    value={newCampaign.mediaUrl} 
                    onChange={e => setNewCampaign({...newCampaign, mediaUrl: e.target.value})}
                    className="w-full px-4 py-3 rounded-lg neon-input" 
                    placeholder="https://example.com/image.jpg (optionnel)"
                  />
                  {newCampaign.mediaUrl && (
                    <div className="mt-2 flex items-center gap-3">
                      <span className="text-xs text-green-400">✓ Média attaché</span>
                      <img 
                        src={newCampaign.mediaUrl} 
                        alt="Aperçu" 
                        className="w-12 h-12 rounded object-cover border border-purple-500/30"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    </div>
                  )}
                </div>

                {/* === BARRE DE PROGRESSION GROUPÉE === */}
                {bulkSendingProgress && (
                  <div className="mb-4 p-4 rounded-xl bg-gradient-to-r from-blue-900/30 to-green-900/30 border border-purple-500/30">
                    <div className="flex justify-between text-sm text-white mb-2">
                      <span className="font-semibold">
                        {bulkSendingProgress.channel === 'email' ? '📧 Envoi Emails...' : '📱 Envoi WhatsApp...'}
                      </span>
                      <span>{bulkSendingProgress.current}/{bulkSendingProgress.total}</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-3">
                      <div 
                        className={`h-3 rounded-full transition-all duration-300 ${
                          bulkSendingProgress.channel === 'email' ? 'bg-blue-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${(bulkSendingProgress.current / bulkSendingProgress.total) * 100}%` }}
                      />
                    </div>
                    {bulkSendingProgress.name && (
                      <p className="text-xs text-white/70 mt-1 truncate">→ {bulkSendingProgress.name}</p>
                    )}
                  </div>
                )}

                {/* === RÉSULTATS ENVOI GROUPÉ === */}
                {bulkSendingResults && !bulkSendingProgress && (
                  <div className="mb-4 p-4 rounded-xl bg-black/30 border border-green-500/30">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-white font-semibold">📊 Récapitulatif d'envoi</h4>
                      <button 
                        type="button"
                        onClick={() => setBulkSendingResults(null)}
                        className="text-white/60 hover:text-white"
                      >×</button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {bulkSendingResults.email && (
                        <div className="p-2 rounded bg-blue-900/30">
                          <span className="text-blue-400">📧 Emails:</span>
                          <span className="text-white ml-2">{bulkSendingResults.email.sent} ✅</span>
                          {bulkSendingResults.email.failed > 0 && (
                            <span className="text-red-400 ml-1">{bulkSendingResults.email.failed} ❌</span>
                          )}
                        </div>
                      )}
                      {bulkSendingResults.whatsapp && (
                        <div className="p-2 rounded bg-green-900/30">
                          <span className="text-green-400">📱 WhatsApp:</span>
                          <span className="text-white ml-2">{bulkSendingResults.whatsapp.sent} ✅</span>
                          {bulkSendingResults.whatsapp.failed > 0 && (
                            <span className="text-red-400 ml-1">{bulkSendingResults.whatsapp.failed} ❌</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* === BOUTON ENVOI GROUPÉ === */}
                <div className="mb-4">
                  <button 
                    type="button"
                    onClick={handleBulkSendCampaign}
                    disabled={bulkSendingInProgress || (!isEmailJSConfigured() && !isWhatsAppConfigured())}
                    className="w-full py-4 rounded-xl font-bold text-white text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: 'linear-gradient(135deg, #3b82f6 0%, #22c55e 50%, #d91cd2 100%)',
                      boxShadow: bulkSendingInProgress ? 'none' : '0 0 20px rgba(217, 28, 210, 0.4)'
                    }}
                  >
                    {bulkSendingInProgress ? '⏳ Envoi en cours...' : '🚀 Envoyer Email + WhatsApp'}
                  </button>
                  <p className="text-xs text-white/50 text-center mt-2">
                    Envoie automatiquement sur tous les canaux configurés
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  {/* === EMAIL AUTOMATIQUE (EmailJS) === */}
                  <div className="p-4 rounded-xl bg-blue-900/20 border border-blue-500/30">
                    <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                      📧 Email
                      <button 
                        type="button"
                        onClick={() => setShowEmailJSConfig(!showEmailJSConfig)}
                        className="ml-auto text-xs text-blue-400 hover:text-blue-300"
                      >
                        ⚙️ Config
                      </button>
                    </h4>
                    
                    {/* Barre de progression */}
                    {emailSendingProgress && (
                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-white/80 mb-1">
                          <span>Envoi en cours...</span>
                          <span>{emailSendingProgress.current}/{emailSendingProgress.total}</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div 
                            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${(emailSendingProgress.current / emailSendingProgress.total) * 100}%` }}
                          />
                        </div>
                        {emailSendingProgress.name && (
                          <p className="text-xs text-blue-300 mt-1 truncate">→ {emailSendingProgress.name}</p>
                        )}
                      </div>
                    )}
                    
                    {/* Résultats d'envoi */}
                    {emailSendingResults && !emailSendingProgress && (
                      <div className="mb-3 p-2 rounded-lg bg-black/30">
                        <p className="text-sm font-semibold text-white">
                          ✅ {emailSendingResults.sent} envoyé(s)
                          {emailSendingResults.failed > 0 && (
                            <span className="text-red-400 ml-2">❌ {emailSendingResults.failed} échec(s)</span>
                          )}
                        </p>
                        <button 
                          type="button"
                          onClick={() => setEmailSendingResults(null)}
                          className="text-xs text-blue-400 mt-1"
                        >
                          Fermer
                        </button>
                      </div>
                    )}
                    
                    <p className="text-xs text-white/60 mb-3">
                      {contactStats.withEmail} destinataire(s)
                      {isEmailJSConfigured() ? (
                        <span className="text-green-400 ml-1">✓ Configuré</span>
                      ) : (
                        <span className="text-yellow-400 ml-1">⚠️ Non configuré</span>
                      )}
                    </p>
                    
                    {contactStats.withEmail > 0 ? (
                      <div className="space-y-2">
                        <button 
                          type="button"
                          onClick={handleSendEmailCampaign}
                          disabled={emailSendingProgress !== null || !isEmailJSConfigured()}
                          className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-center font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {emailSendingProgress ? '⏳ Envoi...' : '🚀 Envoyer automatiquement'}
                        </button>
                        <a 
                          href={generateGroupedEmailLink()}
                          className="block w-full py-2 rounded-lg glass text-white text-center text-xs opacity-70 hover:opacity-100"
                        >
                          📧 Ouvrir client email (BCC)
                        </a>
                      </div>
                    ) : (
                      <button disabled className="w-full py-3 rounded-lg bg-gray-600/50 text-gray-400 cursor-not-allowed">
                        Aucun email
                      </button>
                    )}
                  </div>

                  {/* === WHATSAPP AUTOMATIQUE (Twilio) === */}
                  <div className="p-4 rounded-xl bg-green-900/20 border border-green-500/30">
                    <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                      📱 WhatsApp
                      <button 
                        type="button"
                        onClick={() => setShowWhatsAppConfig(!showWhatsAppConfig)}
                        className="ml-auto text-xs text-green-400 hover:text-green-300"
                      >
                        ⚙️ Config
                      </button>
                    </h4>
                    
                    {/* Barre de progression WhatsApp */}
                    {whatsAppSendingProgress && (
                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-white/80 mb-1">
                          <span>Envoi en cours...</span>
                          <span>{whatsAppSendingProgress.current}/{whatsAppSendingProgress.total}</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div 
                            className="bg-green-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${(whatsAppSendingProgress.current / whatsAppSendingProgress.total) * 100}%` }}
                          />
                        </div>
                        {whatsAppSendingProgress.name && (
                          <p className="text-xs text-green-300 mt-1 truncate">→ {whatsAppSendingProgress.name}</p>
                        )}
                      </div>
                    )}
                    
                    {/* Résultats WhatsApp */}
                    {whatsAppSendingResults && !whatsAppSendingProgress && (
                      <div className="mb-3 p-2 rounded-lg bg-black/30">
                        <p className="text-sm font-semibold text-white">
                          ✅ {whatsAppSendingResults.sent} envoyé(s)
                          {whatsAppSendingResults.failed > 0 && (
                            <span className="text-red-400 ml-2">❌ {whatsAppSendingResults.failed} échec(s)</span>
                          )}
                        </p>
                        <button 
                          type="button"
                          onClick={() => setWhatsAppSendingResults(null)}
                          className="text-xs text-green-400 mt-1"
                        >
                          Fermer
                        </button>
                      </div>
                    )}
                    
                    <p className="text-xs text-white/60 mb-3">
                      {contactStats.withPhone} destinataire(s)
                      {isWhatsAppConfigured() ? (
                        <span className="text-green-400 ml-1">✓ Twilio</span>
                      ) : (
                        <span className="text-yellow-400 ml-1">⚠️ Non configuré</span>
                      )}
                    </p>
                    
                    {contactStats.withPhone > 0 ? (
                      <div className="space-y-2">
                        <button 
                          type="button"
                          onClick={handleSendWhatsAppCampaign}
                          disabled={whatsAppSendingProgress !== null || !isWhatsAppConfigured()}
                          className="w-full py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-center font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          {whatsAppSendingProgress ? '⏳ Envoi...' : '🚀 Auto (Twilio)'}
                        </button>
                        
                        {/* Mode manuel conservé */}
                        <div className="border-t border-green-500/20 pt-2 mt-2">
                          <p className="text-xs text-white/40 mb-1">Mode manuel:</p>
                          <p className="text-xs text-white/60 mb-1">
                            {currentWhatsAppIndex + 1}/{contactStats.withPhone}
                            {getCurrentWhatsAppContact() && (
                              <span className="text-green-300 ml-1">→ {getCurrentWhatsAppContact()?.name}</span>
                            )}
                          </p>
                          <div className="flex gap-1">
                            <button 
                              type="button"
                              onClick={prevWhatsAppContact}
                              disabled={currentWhatsAppIndex === 0}
                              className="flex-1 py-1 rounded glass text-white text-xs disabled:opacity-30"
                            >
                              ←
                            </button>
                            <a 
                              href={getCurrentWhatsAppContact() ? generateWhatsAppLink(
                                getCurrentWhatsAppContact()?.phone,
                                newCampaign.message,
                                newCampaign.mediaUrl,
                                getCurrentWhatsAppContact()?.name
                              ) : '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-2 py-1 px-2 rounded bg-green-700 text-white text-xs text-center"
                            >
                              Ouvrir
                            </a>
                            <button 
                              type="button"
                              onClick={nextWhatsAppContact}
                              disabled={currentWhatsAppIndex >= contactStats.withPhone - 1}
                              className="flex-1 py-1 rounded glass text-white text-xs disabled:opacity-30"
                            >
                              →
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button disabled className="w-full py-3 rounded-lg bg-gray-600/50 text-gray-400 cursor-not-allowed">
                        Aucun numéro
                      </button>
                    )}
                  </div>

                  {/* === INSTAGRAM DM === */}
                  <div className="p-4 rounded-xl bg-purple-900/20 border border-purple-500/30">
                    <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                      📸 Instagram DM
                    </h4>
                    <div className="mb-3">
                      <label className="text-xs text-white/60 block mb-1">Profil Instagram</label>
                      <input 
                        type="text" 
                        value={instagramProfile}
                        onChange={e => setInstagramProfile(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg neon-input text-sm"
                        placeholder="username"
                      />
                    </div>
                    <button 
                      type="button"
                      onClick={copyMessageForInstagram}
                      className={`w-full py-2 rounded-lg ${messageCopied ? 'bg-green-600' : 'bg-purple-600 hover:bg-purple-700'} text-white text-sm font-medium mb-2 transition-all`}
                    >
                      {messageCopied ? '✓ Copié !' : '📋 Copier le message'}
                    </button>
                    <a 
                      href={`https://instagram.com/${instagramProfile}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full py-2 rounded-lg glass text-white text-center text-sm hover:bg-purple-500/20 transition-all"
                    >
                      📸 Ouvrir Instagram
                    </a>
                  </div>

                </div>
              </div>
            )}

            {/* === PANNEAU DE CONFIGURATION EMAILJS === */}
            {showEmailJSConfig && (
              <div className="mb-8 p-5 rounded-xl glass border-2 border-blue-500/50">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-white font-semibold flex items-center gap-2">
                    ⚙️ Configuration EmailJS
                  </h3>
                  <button 
                    type="button"
                    onClick={() => setShowEmailJSConfig(false)}
                    className="text-white/60 hover:text-white"
                  >
                    ×
                  </button>
                </div>
                
                <p className="text-xs text-white/60 mb-4">
                  Créez un compte gratuit sur <a href="https://www.emailjs.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">emailjs.com</a>, 
                  puis ajoutez vos clés ci-dessous. Ces informations sont stockées localement et ne quittent jamais votre navigateur.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block mb-1 text-white text-xs">Service ID</label>
                    <input 
                      type="text" 
                      value={emailJSConfig.serviceId}
                      onChange={e => setEmailJSConfig({...emailJSConfig, serviceId: e.target.value})}
                      className="w-full px-3 py-2 rounded-lg neon-input text-sm"
                      placeholder="service_xxxxxxx"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 text-white text-xs">Template ID</label>
                    <input 
                      type="text" 
                      value={emailJSConfig.templateId}
                      onChange={e => setEmailJSConfig({...emailJSConfig, templateId: e.target.value})}
                      className="w-full px-3 py-2 rounded-lg neon-input text-sm"
                      placeholder="template_xxxxxxx"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 text-white text-xs">Public Key</label>
                    <input 
                      type="text" 
                      value={emailJSConfig.publicKey}
                      onChange={e => setEmailJSConfig({...emailJSConfig, publicKey: e.target.value})}
                      className="w-full px-3 py-2 rounded-lg neon-input text-sm"
                      placeholder="xxxxxxxxxxxxxxx"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 items-center">
                  <button 
                    type="button"
                    onClick={handleSaveEmailJSConfig}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
                  >
                    💾 Sauvegarder
                  </button>
                  
                  {/* Test EmailJS */}
                  <div className="flex items-center gap-2 flex-1">
                    <input 
                      type="email"
                      value={testEmailAddress}
                      onChange={e => setTestEmailAddress(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg neon-input text-sm"
                      placeholder="Email de test..."
                    />
                    <button 
                      type="button"
                      onClick={handleTestEmailJS}
                      disabled={testEmailStatus === 'sending' || !emailJSConfig.serviceId}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        testEmailStatus === 'success' ? 'bg-green-600' :
                        testEmailStatus === 'error' ? 'bg-red-600' :
                        testEmailStatus === 'sending' ? 'bg-yellow-600' :
                        'bg-purple-600 hover:bg-purple-700'
                      } text-white disabled:opacity-50`}
                    >
                      {testEmailStatus === 'sending' ? '⏳...' :
                       testEmailStatus === 'success' ? '✅ Envoyé!' :
                       testEmailStatus === 'error' ? '❌ Erreur' :
                       '🧪 Tester'}
                    </button>
                  </div>
                </div>

                <div className="mt-4 p-3 rounded-lg bg-blue-900/20 border border-blue-500/20">
                  <p className="text-xs text-white/70">
                    <strong>📋 Template EmailJS requis :</strong><br/>
                    Variables à inclure dans votre template : 
                    <code className="text-blue-400 mx-1">{'{{to_email}}'}</code>
                    <code className="text-blue-400 mx-1">{'{{to_name}}'}</code>
                    <code className="text-blue-400 mx-1">{'{{subject}}'}</code>
                    <code className="text-blue-400 mx-1">{'{{message}}'}</code>
                    <code className="text-blue-400 mx-1">{'{{from_name}}'}</code>
                  </p>
                </div>
              </div>
            )}

            {/* === PANNEAU DE CONFIGURATION WHATSAPP API === */}
            {showWhatsAppConfig && (
              <div className="mb-8 p-5 rounded-xl glass border-2 border-green-500/50">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-white font-semibold flex items-center gap-2">
                    ⚙️ Configuration WhatsApp API (Twilio)
                  </h3>
                  <button 
                    type="button"
                    onClick={() => setShowWhatsAppConfig(false)}
                    className="text-white/60 hover:text-white"
                  >
                    ×
                  </button>
                </div>
                
                <p className="text-xs text-white/60 mb-4">
                  Créez un compte sur <a href="https://www.twilio.com" target="_blank" rel="noopener noreferrer" className="text-green-400 underline">twilio.com</a>, 
                  activez WhatsApp Sandbox, puis ajoutez vos clés ci-dessous. 
                  <a href="https://www.twilio.com/docs/whatsapp/sandbox" target="_blank" rel="noopener noreferrer" className="text-green-400 underline ml-1">Guide Sandbox</a>
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block mb-1 text-white text-xs">Account SID</label>
                    <input 
                      type="text" 
                      value={whatsAppConfig.accountSid}
                      onChange={e => setWhatsAppConfig({...whatsAppConfig, accountSid: e.target.value})}
                      className="w-full px-3 py-2 rounded-lg neon-input text-sm"
                      placeholder="ACxxxxxxxxxxxxxxx"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 text-white text-xs">Auth Token</label>
                    <input 
                      type="password" 
                      value={whatsAppConfig.authToken}
                      onChange={e => setWhatsAppConfig({...whatsAppConfig, authToken: e.target.value})}
                      className="w-full px-3 py-2 rounded-lg neon-input text-sm"
                      placeholder="••••••••••••••••"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 text-white text-xs">From Number (Sandbox)</label>
                    <input 
                      type="text" 
                      value={whatsAppConfig.fromNumber}
                      onChange={e => setWhatsAppConfig({...whatsAppConfig, fromNumber: e.target.value})}
                      className="w-full px-3 py-2 rounded-lg neon-input text-sm"
                      placeholder="+14155238886"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 items-center">
                  <button 
                    type="button"
                    onClick={handleSaveWhatsAppConfig}
                    className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium"
                  >
                    💾 Sauvegarder
                  </button>
                  
                  {/* Test WhatsApp */}
                  <div className="flex items-center gap-2 flex-1">
                    <input 
                      type="tel"
                      value={testWhatsAppNumber}
                      onChange={e => setTestWhatsAppNumber(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg neon-input text-sm"
                      placeholder="+41791234567"
                    />
                    <button 
                      type="button"
                      onClick={handleTestWhatsApp}
                      disabled={testWhatsAppStatus === 'sending' || !whatsAppConfig.accountSid}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        testWhatsAppStatus === 'success' ? 'bg-green-600' :
                        testWhatsAppStatus === 'error' ? 'bg-red-600' :
                        testWhatsAppStatus === 'sending' ? 'bg-yellow-600' :
                        'bg-purple-600 hover:bg-purple-700'
                      } text-white disabled:opacity-50`}
                    >
                      {testWhatsAppStatus === 'sending' ? '⏳...' :
                       testWhatsAppStatus === 'success' ? '✅ Envoyé!' :
                       testWhatsAppStatus === 'error' ? '❌ Erreur' :
                       '🧪 Tester'}
                    </button>
                  </div>
                </div>

                <div className="mt-4 p-3 rounded-lg bg-green-900/20 border border-green-500/20">
                  <p className="text-xs text-white/70">
                    <strong>📋 Configuration Sandbox Twilio :</strong><br/>
                    1. Allez sur <code className="text-green-400">console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn</code><br/>
                    2. Envoyez "join &lt;code&gt;" au numéro sandbox depuis votre WhatsApp<br/>
                    3. Utilisez le numéro sandbox comme "From Number": <code className="text-green-400">+14155238886</code>
                  </p>
                </div>
              </div>
            )}

            {/* === PANNEAU AGENT IA WHATSAPP === */}
            <div className="mb-8 p-5 rounded-xl glass border-2 border-purple-500/50">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  🤖 Agent IA WhatsApp
                  <span className={`text-xs px-2 py-0.5 rounded-full ${aiConfig.enabled ? 'bg-green-600' : 'bg-gray-600'}`}>
                    {aiConfig.enabled ? '✓ Actif' : 'Inactif'}
                  </span>
                </h3>
                <button 
                  type="button"
                  onClick={() => setShowAIConfig(!showAIConfig)}
                  className="text-xs text-purple-400 hover:text-purple-300"
                >
                  {showAIConfig ? '▲ Réduire' : '▼ Configurer'}
                </button>
              </div>

              {/* Logs rapides - toujours visible */}
              {aiLogs.length > 0 && (
                <div className="mb-4 p-3 rounded-lg bg-black/30 border border-purple-500/20">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-white/60">📝 Dernières réponses IA</span>
                    <button 
                      type="button"
                      onClick={handleClearAILogs}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      🗑️ Effacer
                    </button>
                  </div>
                  <div className="space-y-1 max-h-24 overflow-y-auto">
                    {aiLogs.slice(0, 3).map((log, idx) => (
                      <div key={idx} className="text-xs flex items-center gap-2">
                        <span className="text-purple-400">
                          {new Date(log.timestamp).toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'})}
                        </span>
                        <span className="text-white/80">{log.clientName || log.fromPhone}</span>
                        <span className="text-green-400 truncate flex-1">→ {log.aiResponse?.slice(0, 50)}...</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {showAIConfig && (
                <div className="space-y-4">
                  <p className="text-xs text-white/60 mb-4">
                    L'Agent IA répond automatiquement aux messages WhatsApp entrants via le webhook Twilio.
                    Il utilise le contexte des réservations pour personnaliser les réponses.
                  </p>

                  {/* Toggle Enabled */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-purple-900/20 border border-purple-500/30">
                    <div>
                      <span className="text-white font-medium">Activer l'Agent IA</span>
                      <p className="text-xs text-white/50">Répond automatiquement aux messages WhatsApp</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={aiConfig.enabled}
                        onChange={e => setAiConfig({...aiConfig, enabled: e.target.checked})}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>

                  {/* System Prompt */}
                  <div>
                    <label className="block mb-2 text-white text-sm">🎯 Prompt Système (Personnalité de l'IA)</label>
                    <textarea 
                      value={aiConfig.systemPrompt}
                      onChange={e => setAiConfig({...aiConfig, systemPrompt: e.target.value})}
                      className="w-full px-4 py-3 rounded-lg neon-input text-sm"
                      rows={6}
                      placeholder="Décrivez la personnalité et le rôle de l'IA..."
                    />
                  </div>

                  {/* Model Selection */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block mb-1 text-white text-xs">Provider</label>
                      <select 
                        value={aiConfig.provider}
                        onChange={e => setAiConfig({...aiConfig, provider: e.target.value})}
                        className="w-full px-3 py-2 rounded-lg neon-input text-sm"
                      >
                        <option value="openai">OpenAI</option>
                        <option value="anthropic">Anthropic</option>
                        <option value="google">Google</option>
                      </select>
                    </div>
                    <div>
                      <label className="block mb-1 text-white text-xs">Modèle</label>
                      <select 
                        value={aiConfig.model}
                        onChange={e => setAiConfig({...aiConfig, model: e.target.value})}
                        className="w-full px-3 py-2 rounded-lg neon-input text-sm"
                      >
                        <option value="gpt-4o-mini">GPT-4o Mini (rapide)</option>
                        <option value="gpt-4o">GPT-4o (puissant)</option>
                        <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>
                        <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                      </select>
                    </div>
                  </div>

                  {/* Webhook URL */}
                  <div className="p-3 rounded-lg bg-blue-900/20 border border-blue-500/20">
                    <p className="text-xs text-white/70">
                      <strong>🔗 Webhook Twilio :</strong><br/>
                      Configurez cette URL dans votre console Twilio → Messaging → WhatsApp Sandbox → "When a message comes in":<br/>
                      <code className="text-blue-400 block mt-1 bg-black/30 px-2 py-1 rounded">
                        {API}/webhook/whatsapp
                      </code>
                    </p>
                  </div>

                  {/* Test Area */}
                  <div className="p-3 rounded-lg bg-purple-900/20 border border-purple-500/20">
                    <p className="text-xs text-white/70 mb-2"><strong>🧪 Tester l'IA</strong></p>
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        value={aiTestMessage}
                        onChange={e => setAiTestMessage(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-lg neon-input text-sm"
                        placeholder="Ex: Quels sont les horaires des cours ?"
                      />
                      <button 
                        type="button"
                        onClick={handleTestAI}
                        disabled={aiTestLoading}
                        className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm disabled:opacity-50"
                      >
                        {aiTestLoading ? '⏳' : '🤖 Tester'}
                      </button>
                    </div>
                    {aiTestResponse && (
                      <div className={`mt-2 p-2 rounded text-sm ${aiTestResponse.success ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'}`}>
                        {aiTestResponse.success ? (
                          <>
                            <p className="font-medium">Réponse IA ({aiTestResponse.responseTime?.toFixed(2)}s):</p>
                            <p className="text-white/90 mt-1">{aiTestResponse.response}</p>
                          </>
                        ) : (
                          <p>❌ Erreur: {aiTestResponse.error}</p>
                        )}
                      </div>
                    )}
                  </div>

                  <button 
                    type="button"
                    onClick={handleSaveAIConfig}
                    className="w-full py-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium"
                  >
                    💾 Sauvegarder la configuration IA
                  </button>
                </div>
              )}
            </div>

            {/* New Campaign Form */}
            <form onSubmit={createCampaign} className="mb-8 p-5 rounded-xl glass">
              <h3 className="text-white font-semibold mb-4">Nouvelle Campagne</h3>
              
              {/* Campaign Name */}
              <div className="mb-4">
                <label className="block mb-2 text-white text-sm">Nom de la campagne</label>
                <input type="text" required value={newCampaign.name} onChange={e => setNewCampaign({...newCampaign, name: e.target.value})}
                  className="w-full px-4 py-3 rounded-lg neon-input" placeholder="Ex: Promo Noël 2024" />
              </div>
              
              {/* Target Selection */}
              <div className="mb-4">
                <label className="block mb-2 text-white text-sm">Contacts ciblés</label>
                <div className="flex gap-4 mb-3">
                  <label className="flex items-center gap-2 text-white text-sm cursor-pointer">
                    <input type="radio" name="targetType" checked={newCampaign.targetType === "all"} 
                      onChange={() => setNewCampaign({...newCampaign, targetType: "all"})} />
                    Tous les contacts ({allContacts.length})
                  </label>
                  <label className="flex items-center gap-2 text-white text-sm cursor-pointer">
                    <input type="radio" name="targetType" checked={newCampaign.targetType === "selected"} 
                      onChange={() => setNewCampaign({...newCampaign, targetType: "selected"})} />
                    Sélection individuelle
                  </label>
                </div>
                
                {/* Contact Selection List */}
                {newCampaign.targetType === "selected" && (
                  <div className="border border-purple-500/30 rounded-lg p-3" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <input type="text" placeholder="🔍 Rechercher..." value={contactSearchQuery}
                        onChange={e => setContactSearchQuery(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-lg neon-input text-sm" />
                      <button type="button" onClick={toggleAllContacts} className="px-3 py-2 rounded-lg glass text-white text-xs">
                        {selectedContactsForCampaign.length === allContacts.length ? 'Désélectionner tout' : 'Tout sélectionner'}
                      </button>
                    </div>
                    <div className="space-y-1">
                      {filteredContacts.map(contact => (
                        <label key={contact.id} className="flex items-center gap-2 text-white text-sm cursor-pointer hover:bg-purple-500/10 p-1 rounded">
                          <input type="checkbox" checked={selectedContactsForCampaign.includes(contact.id)}
                            onChange={() => toggleContactForCampaign(contact.id)} />
                          <span className="truncate">{contact.name}</span>
                          <span className="text-xs opacity-50 truncate">({contact.email})</span>
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-purple-400 mt-2">{selectedContactsForCampaign.length} contact(s) sélectionné(s)</p>
                  </div>
                )}
              </div>
              
              {/* Message */}
              <div className="mb-4">
                <label className="block mb-2 text-white text-sm">Message</label>
                <textarea required value={newCampaign.message} onChange={e => setNewCampaign({...newCampaign, message: e.target.value})}
                  className="w-full px-4 py-3 rounded-lg neon-input" rows={4}
                  placeholder="Salut {prénom} ! 🎉&#10;&#10;Profite de notre offre spéciale..." />
                <p className="text-xs text-purple-400 mt-1">Variables disponibles: {'{prénom}'} - sera remplacé par le nom du contact</p>
              </div>
              
              {/* Media */}
              <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block mb-2 text-white text-sm">URL du visuel (image/vidéo)</label>
                  <input type="url" value={newCampaign.mediaUrl} onChange={e => setNewCampaign({...newCampaign, mediaUrl: e.target.value})}
                    className="w-full px-4 py-3 rounded-lg neon-input" placeholder="https://..." />
                </div>
                <div>
                  <label className="block mb-2 text-white text-sm">Format</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-white text-sm cursor-pointer">
                      <input type="radio" name="mediaFormat" checked={newCampaign.mediaFormat === "9:16"}
                        onChange={() => setNewCampaign({...newCampaign, mediaFormat: "9:16"})} />
                      9:16 (Stories)
                    </label>
                    <label className="flex items-center gap-2 text-white text-sm cursor-pointer">
                      <input type="radio" name="mediaFormat" checked={newCampaign.mediaFormat === "16:9"}
                        onChange={() => setNewCampaign({...newCampaign, mediaFormat: "16:9"})} />
                      16:9 (Post)
                    </label>
                  </div>
                </div>
              </div>
              
              {/* Media Preview */}
              {newCampaign.mediaUrl && (
                <div className="mb-4">
                  <p className="text-white text-sm mb-2">Aperçu ({newCampaign.mediaFormat}):</p>
                  <div className="flex justify-center">
                    <div style={{ 
                      width: newCampaign.mediaFormat === "9:16" ? '150px' : '280px',
                      height: newCampaign.mediaFormat === "9:16" ? '267px' : '158px',
                      background: '#000', borderRadius: '8px', overflow: 'hidden',
                      border: '1px solid rgba(139, 92, 246, 0.3)'
                    }}>
                      <img src={newCampaign.mediaUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        onError={(e) => { e.target.style.display = 'none'; }} />
                    </div>
                  </div>
                </div>
              )}
              
              {/* Channels */}
              <div className="mb-4">
                <label className="block mb-2 text-white text-sm">Canaux d'envoi</label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-white text-sm cursor-pointer">
                    <input type="checkbox" checked={newCampaign.channels.whatsapp}
                      onChange={e => setNewCampaign({...newCampaign, channels: {...newCampaign.channels, whatsapp: e.target.checked}})} />
                    📱 WhatsApp
                  </label>
                  <label className="flex items-center gap-2 text-white text-sm cursor-pointer">
                    <input type="checkbox" checked={newCampaign.channels.email}
                      onChange={e => setNewCampaign({...newCampaign, channels: {...newCampaign.channels, email: e.target.checked}})} />
                    📧 Email
                  </label>
                  <label className="flex items-center gap-2 text-white text-sm cursor-pointer">
                    <input type="checkbox" checked={newCampaign.channels.instagram}
                      onChange={e => setNewCampaign({...newCampaign, channels: {...newCampaign.channels, instagram: e.target.checked}})} />
                    📸 Instagram
                  </label>
                </div>
              </div>
              
              {/* Scheduling - Multi-date support */}
              <div className="mb-4">
                <label className="block mb-2 text-white text-sm">Programmation</label>
                <div className="flex flex-wrap gap-4 items-center mb-3">
                  <label className="flex items-center gap-2 text-white text-sm cursor-pointer">
                    <input type="radio" name="schedule" checked={newCampaign.scheduleSlots.length === 0}
                      onChange={() => setNewCampaign({...newCampaign, scheduleSlots: []})} />
                    Envoyer maintenant
                  </label>
                  <label className="flex items-center gap-2 text-white text-sm cursor-pointer">
                    <input type="radio" name="schedule" checked={newCampaign.scheduleSlots.length > 0}
                      onChange={addScheduleSlot} />
                    Programmer (multi-dates)
                  </label>
                </div>
                
                {/* Multi-date slots */}
                {newCampaign.scheduleSlots.length > 0 && (
                  <div className="border border-purple-500/30 rounded-lg p-3 space-y-2">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-purple-400">{newCampaign.scheduleSlots.length} date(s) programmée(s)</span>
                      <button type="button" onClick={addScheduleSlot} 
                        className="px-3 py-1 rounded text-xs bg-purple-600 hover:bg-purple-700 text-white">
                        + Ajouter une date
                      </button>
                    </div>
                    {newCampaign.scheduleSlots.map((slot, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-black/30">
                        <span className="text-white text-xs w-6">#{idx + 1}</span>
                        <input type="date" value={slot.date} 
                          onChange={e => updateScheduleSlot(idx, 'date', e.target.value)}
                          className="px-3 py-2 rounded-lg neon-input text-sm flex-1" 
                          min={new Date().toISOString().split('T')[0]} />
                        <input type="time" value={slot.time}
                          onChange={e => updateScheduleSlot(idx, 'time', e.target.value)}
                          className="px-3 py-2 rounded-lg neon-input text-sm" />
                        <button type="button" onClick={() => removeScheduleSlot(idx)}
                          className="px-2 py-2 rounded text-xs bg-red-600/30 hover:bg-red-600/50 text-red-400"
                          title="Supprimer cette date">
                          ✕
                        </button>
                      </div>
                    ))}
                    <p className="text-xs text-purple-400 mt-2">
                      📅 Chaque date créera une ligne distincte avec le statut "Programmé"
                    </p>
                  </div>
                )}
              </div>
              
              <button type="submit" className="btn-primary px-6 py-3 rounded-lg w-full md:w-auto">
                🚀 Créer la campagne
              </button>
            </form>
            
            {/* Campaign History */}
            <div>
              <h3 className="text-white font-semibold mb-4">Historique des campagnes</h3>
              
              {/* Error Logs Panel - Shows if there are errors */}
              {campaignLogs.filter(l => l.type === 'error').length > 0 && (
                <div className="mb-4 p-3 rounded-lg bg-red-600/20 border border-red-500/30">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
                    <span className="text-red-400 font-semibold text-sm">Erreurs récentes</span>
                  </div>
                  <div className="space-y-1 max-h-[100px] overflow-y-auto">
                    {campaignLogs.filter(l => l.type === 'error').slice(0, 5).map(log => (
                      <p key={log.id} className="text-xs text-red-300">{log.message}</p>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Scrollable campaign history table with fixed max height */}
              <div className="overflow-x-auto overflow-y-auto rounded-lg border border-purple-500/20" 
                   style={{ maxHeight: '400px', WebkitOverflowScrolling: 'touch' }}>
                <table className="w-full min-w-[700px]">
                  <thead className="sticky top-0 bg-black z-10">
                    <tr className="text-left text-white text-sm opacity-70 border-b border-purple-500/30">
                      <th className="pb-3 pt-2 pr-4 bg-black">Campagne</th>
                      <th className="pb-3 pt-2 pr-4 bg-black">Contacts</th>
                      <th className="pb-3 pt-2 pr-4 bg-black">Canaux</th>
                      <th className="pb-3 pt-2 pr-4 bg-black">Statut</th>
                      <th className="pb-3 pt-2 pr-4 bg-black">Date programmée</th>
                      <th className="pb-3 pt-2 bg-black">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map(campaign => {
                      // Count failed results for this campaign
                      const failedCount = campaign.results?.filter(r => r.status === 'failed').length || 0;
                      const hasErrors = failedCount > 0 || campaignLogs.some(l => l.campaignId === campaign.id && l.type === 'error');
                      
                      return (
                        <tr key={campaign.id} className="border-b border-purple-500/20 text-white text-sm">
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              {hasErrors && (
                                <span className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0" title="Erreur détectée"></span>
                              )}
                              <span className="font-medium">{campaign.name}</span>
                            </div>
                          </td>
                          <td className="py-3 pr-4">
                            {campaign.targetType === "all" ? `Tous (${campaign.results?.length || 0})` : campaign.selectedContacts?.length || 0}
                          </td>
                          <td className="py-3 pr-4">
                            {campaign.channels?.whatsapp && <span className="mr-1">📱</span>}
                            {campaign.channels?.email && <span className="mr-1">📧</span>}
                            {campaign.channels?.instagram && <span>📸</span>}
                          </td>
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-1">
                              {campaign.status === 'draft' && <span className="px-2 py-1 rounded text-xs bg-gray-600">📝 Brouillon</span>}
                              {campaign.status === 'scheduled' && <span className="px-2 py-1 rounded text-xs bg-yellow-600">📅 Programmé</span>}
                              {campaign.status === 'sending' && <span className="px-2 py-1 rounded text-xs bg-blue-600">🔄 En cours</span>}
                              {campaign.status === 'completed' && !hasErrors && <span className="px-2 py-1 rounded text-xs bg-green-600">✅ Envoyé</span>}
                              {campaign.status === 'completed' && hasErrors && (
                                <span className="px-2 py-1 rounded text-xs bg-orange-600" title={`${failedCount} échec(s)`}>
                                  ⚠️ Partiel ({failedCount})
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-xs opacity-70">
                            {campaign.scheduledAt ? new Date(campaign.scheduledAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Immédiat'}
                          </td>
                          <td className="py-3">
                            <div className="flex gap-2">
                              {(campaign.status === 'draft' || campaign.status === 'scheduled') && (
                                <button onClick={() => launchCampaign(campaign.id)} className="px-3 py-1 rounded text-xs bg-purple-600 hover:bg-purple-700">
                                  🚀 Lancer
                                </button>
                              )}
                              {campaign.status === 'sending' && (
                                <button onClick={() => setTab(`campaign-${campaign.id}`)} className="px-3 py-1 rounded text-xs bg-blue-600 hover:bg-blue-700">
                                  👁️ Voir
                                </button>
                              )}
                              <button onClick={() => deleteCampaign(campaign.id)} className="px-3 py-1 rounded text-xs bg-red-600/30 hover:bg-red-600/50 text-red-400">
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {campaigns.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-white opacity-50">
                          Aucune campagne créée pour le moment
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Expanded Campaign Details (when sending) */}
              {campaigns.filter(c => c.status === 'sending').map(campaign => {
                // Helper to check if WhatsApp link is valid
                const getWhatsAppLinkOrError = (result) => {
                  if (result.channel !== 'whatsapp') return { link: null, error: false };
                  const link = generateWhatsAppLink(result.contactPhone, campaign.message, campaign.mediaUrl, result.contactName);
                  return { link, error: !link };
                };
                
                return (
                  <div key={`detail-${campaign.id}`} className="mt-6 p-4 rounded-xl glass">
                    <h4 className="text-white font-semibold mb-3">🔄 {campaign.name} - En cours d'envoi</h4>
                    <p className="text-white text-sm mb-3 opacity-70">Cliquez sur un contact pour ouvrir le lien et marquer comme envoyé</p>
                    
                    <div className="space-y-2" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                      {campaign.results?.map((result, idx) => {
                        const whatsappResult = result.channel === 'whatsapp' ? getWhatsAppLinkOrError(result) : { link: null, error: false };
                        const hasError = (result.channel === 'whatsapp' && whatsappResult.error) || 
                                        (result.channel === 'email' && !result.contactEmail) ||
                                        result.status === 'failed';
                        
                        return (
                          <div key={idx} className={`flex items-center justify-between gap-2 p-2 rounded-lg ${hasError ? 'bg-red-900/30 border border-red-500/30' : 'bg-black/30'}`}>
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              {hasError && <span className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0"></span>}
                              <span className="text-white text-sm truncate">{result.contactName}</span>
                              <span className="text-xs opacity-50">
                                {result.channel === 'whatsapp' && '📱'}
                                {result.channel === 'email' && '📧'}
                                {result.channel === 'instagram' && '📸'}
                              </span>
                              {result.channel === 'whatsapp' && (
                                <span className="text-xs opacity-40 truncate">({result.contactPhone || 'Pas de numéro'})</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {result.status === 'pending' && !hasError && (
                                <a 
                                  href={result.channel === 'whatsapp' 
                                    ? whatsappResult.link
                                    : result.channel === 'email'
                                    ? generateEmailLink(result.contactEmail, campaign.name, campaign.message, campaign.mediaUrl, result.contactName)
                                    : `https://instagram.com`}
                                  target="_blank" rel="noopener noreferrer"
                                  onClick={() => markResultSent(campaign.id, result.contactId, result.channel)}
                                  className="px-3 py-1 rounded text-xs bg-purple-600 hover:bg-purple-700 text-white"
                                >
                                  Envoyer
                                </a>
                              )}
                              {result.status === 'pending' && hasError && (
                                <span className="px-2 py-1 rounded text-xs bg-red-600/30 text-red-400">
                                  {result.channel === 'whatsapp' ? '❌ N° invalide' : '❌ Email manquant'}
                                </span>
                              )}
                              {result.status === 'sent' && (
                                <span className="px-2 py-1 rounded text-xs bg-green-600/30 text-green-400">✅ Envoyé</span>
                              )}
                              {result.status === 'failed' && (
                                <span className="px-2 py-1 rounded text-xs bg-red-600/30 text-red-400">❌ Échec</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    <div className="mt-3 flex justify-between text-xs">
                      <span className="text-purple-400">
                        Progression: {campaign.results?.filter(r => r.status === 'sent').length || 0} / {campaign.results?.length || 0} envoyé(s)
                      </span>
                      {campaign.results?.some(r => r.status === 'pending' && (
                        (r.channel === 'whatsapp' && !formatPhoneForWhatsApp(r.contactPhone)) ||
                        (r.channel === 'email' && !r.contactEmail)
                      )) && (
                        <span className="text-red-400">
                          ⚠️ Certains contacts ont des informations manquantes
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Success Overlay
const SuccessOverlay = ({ t, data, onClose }) => {
  const handlePrint = () => window.print();
  const handleShare = () => {
    const msg = `🎧 ${t('reservationConfirmed')}\n\n👤 ${t('name')}: ${data.userName}\n📧 ${t('email')}: ${data.userEmail}\n💰 ${t('offer')}: ${data.offerName}\n💵 ${t('total')}: CHF ${data.totalPrice}\n📅 ${t('courses')}: ${data.courseName}\n🎫 ${t('code')}: ${data.reservationCode}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // QR Code contains the validation URL for coach scanning
  const validationUrl = `${window.location.origin}/validate/${data.reservationCode}`;

  return (
    <div className="success-overlay">
      <div className="success-message glass rounded-xl p-6 max-w-md w-full text-center neon-border relative print-proof">
        <button onClick={onClose} className="absolute top-3 right-4 text-2xl text-white" data-testid="close-success">×</button>
        <div style={{ fontSize: '48px' }}>🎧</div>
        <p className="font-bold text-white my-2" style={{ fontSize: '20px' }}>{t('reservationConfirmed')}</p>
        
        {/* QR Code for coach validation - contains validation URL */}
        <div className="my-4 p-4 rounded-lg bg-white flex flex-col items-center">
          <QRCodeSVG 
            value={validationUrl} 
            size={150} 
            level="H"
            includeMargin={true}
            bgColor="#ffffff"
            fgColor="#000000"
          />
          <p className="text-xs text-gray-600 mt-2">{t('scanToValidate') || 'Scannez pour valider'}</p>
        </div>
        
        <div className="my-3 p-3 rounded-lg bg-white/10 border-2 border-dashed" style={{ borderColor: '#d91cd2' }}>
          <p className="text-xs text-white opacity-60">{t('reservationCode')}:</p>
          <p className="text-2xl font-bold tracking-widest text-white" data-testid="reservation-code">{data.reservationCode}</p>
        </div>
        <div className="text-sm text-left space-y-1 mb-6 text-white opacity-80">
          <p><strong>{t('name')}:</strong> {data.userName}</p>
          <p><strong>{t('courses')}:</strong> {data.courseName}</p>
          <p><strong>{t('total')}:</strong> CHF {data.totalPrice}{data.quantity > 1 ? ` (x${data.quantity})` : ''}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="flex-1 p-2 glass rounded-lg text-white text-sm">{t('print')}</button>
          <button onClick={handleShare} className="flex-1 p-2 glass rounded-lg text-white text-sm">{t('share')}</button>
        </div>
      </div>
    </div>
  );
};

// Confirm Payment Overlay
const ConfirmPaymentOverlay = ({ t, onConfirm, onCancel }) => (
  <div className="modal-overlay">
    <div className="modal-content glass rounded-xl p-6 max-w-md w-full text-center neon-border">
      <div style={{ fontSize: '48px' }}>💳</div>
      <p className="font-bold text-white my-4" style={{ fontSize: '20px' }}>{t('paymentDone')}</p>
      <p className="mb-6 text-white opacity-80 text-sm">{t('paymentConfirmText')}</p>
      <button onClick={onConfirm} className="w-full btn-primary py-3 rounded-lg font-bold mb-3">{t('confirmPayment')}</button>
      <button onClick={onCancel} className="w-full py-2 glass rounded-lg text-white opacity-60">{t('cancel')}</button>
    </div>
  </div>
);

// Main App
function App() {
  const [lang, setLang] = useState(localStorage.getItem("af_lang") || "fr");
  const [showSplash, setShowSplash] = useState(true);
  const [showCoachLogin, setShowCoachLogin] = useState(false);
  const [coachMode, setCoachMode] = useState(false);
  const [validationCode, setValidationCode] = useState(null); // For /validate/:code URL

  const [courses, setCourses] = useState([]);
  const [offers, setOffers] = useState([]);
  const [users, setUsers] = useState([]);
  const [paymentLinks, setPaymentLinks] = useState({ stripe: "", paypal: "", twint: "", coachWhatsapp: "" });
  const [concept, setConcept] = useState({ description: "", heroImageUrl: "", logoUrl: "", faviconUrl: "", termsText: "", googleReviewsUrl: "", defaultLandingSection: "sessions", externalLink1Title: "", externalLink1Url: "", externalLink2Title: "", externalLink2Url: "", paymentTwint: false, paymentPaypal: false, paymentCreditCard: false });
  const [discountCodes, setDiscountCodes] = useState([]);

  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  const [quantity, setQuantity] = useState(1); // Quantité pour achats multiples
  const [showTermsModal, setShowTermsModal] = useState(false); // Modal CGV

  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userWhatsapp, setUserWhatsapp] = useState("");
  const [shippingAddress, setShippingAddress] = useState(""); // Adresse de livraison pour produits physiques
  const [discountCode, setDiscountCode] = useState("");
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [promoMessage, setPromoMessage] = useState({ type: '', text: '' }); // New: dedicated promo message

  const [showSuccess, setShowSuccess] = useState(false);
  const [showConfirmPayment, setShowConfirmPayment] = useState(false);
  const [validationMessage, setValidationMessage] = useState("");
  const [pendingReservation, setPendingReservation] = useState(null);
  const [lastReservation, setLastReservation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState(null);

  // Navigation et filtrage
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Indicateur de scroll pour les nouveaux utilisateurs
  const showScrollIndicator = useScrollIndicator();

  // Check for /validate/:code URL on mount
  useEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith('/validate/')) {
      const code = path.replace('/validate/', '').toUpperCase();
      if (code) {
        setValidationCode(code);
        setShowCoachLogin(true);
      }
    }
  }, []);

  const [clickCount, setClickCount] = useState(0);
  const [lastClickTime, setLastClickTime] = useState(0);

  // PWA Install Prompt State
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  const t = useCallback((key) => translations[lang][key] || key, [lang]);

  useEffect(() => { localStorage.setItem("af_lang", lang); }, [lang]);

  // PWA Install Prompt - Capture beforeinstallprompt event
  useEffect(() => {
    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(iOS);

    const handleBeforeInstallPrompt = (e) => {
      // Prevent Chrome 67+ from automatically showing the prompt
      e.preventDefault();
      // Store the event for later use
      setInstallPrompt(e);
      // Check if user hasn't dismissed the banner before
      const dismissed = localStorage.getItem('af_pwa_dismissed');
      if (!dismissed) {
        setShowInstallBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if already installed (standalone mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         window.navigator.standalone === true;
    
    if (isStandalone) {
      setShowInstallBanner(false);
    } else if (iOS) {
      // Show banner for iOS with manual instructions
      const dismissed = localStorage.getItem('af_pwa_dismissed');
      if (!dismissed) {
        setShowInstallBanner(true);
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Handle PWA install button click
  const handleInstallClick = async () => {
    if (isIOS) {
      // For iOS, show instructions (can't auto-prompt)
      alert('Pour installer Afroboost sur iOS:\n\n1. Appuyez sur le bouton Partager (📤)\n2. Sélectionnez "Sur l\'écran d\'accueil"\n3. Appuyez sur "Ajouter"');
      return;
    }
    
    if (!installPrompt) return;
    
    // Show the install prompt
    installPrompt.prompt();
    
    // Wait for user response
    const { outcome } = await installPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('PWA installed');
    }
    
    // Clear the prompt
    setInstallPrompt(null);
    setShowInstallBanner(false);
  };

  // Dismiss install banner
  const dismissInstallBanner = () => {
    setShowInstallBanner(false);
    localStorage.setItem('af_pwa_dismissed', 'true');
  };

  // MÉMORISATION CLIENT: Load saved client info from localStorage on mount
  useEffect(() => {
    const savedClient = localStorage.getItem("af_client_info");
    if (savedClient) {
      try {
        const client = JSON.parse(savedClient);
        // Pre-fill if data exists
        if (client.name) setUserName(client.name);
        if (client.email) setUserEmail(client.email);
        if (client.whatsapp) setUserWhatsapp(client.whatsapp);
      } catch (e) { console.error("Error loading client info:", e); }
    }
  }, []);

  // MÉMORISATION CLIENT: Auto-fill when email matches saved client
  const handleEmailChange = (email) => {
    setUserEmail(email);
    // Check if email matches a saved client
    const savedClient = localStorage.getItem("af_client_info");
    if (savedClient && email.length > 3) {
      try {
        const client = JSON.parse(savedClient);
        if (client.email && client.email.toLowerCase() === email.toLowerCase()) {
          // Auto-fill name and whatsapp
          if (client.name && !userName) setUserName(client.name);
          if (client.whatsapp && !userWhatsapp) setUserWhatsapp(client.whatsapp);
        }
      } catch (e) { /* ignore */ }
    }
  };

  // MÉMORISATION CLIENT: Save client info after successful reservation
  const saveClientInfo = (name, email, whatsapp) => {
    localStorage.setItem("af_client_info", JSON.stringify({ name, email, whatsapp }));
  };

  // Fonction pour charger les données
  const fetchData = useCallback(async () => {
    try {
      const [crs, off, usr, lnk, cpt, cds] = await Promise.all([
        axios.get(`${API}/courses`), axios.get(`${API}/offers`), axios.get(`${API}/users`),
        axios.get(`${API}/payment-links`), axios.get(`${API}/concept`), axios.get(`${API}/discount-codes`)
      ]);
      setCourses(crs.data); setOffers(off.data); setUsers(usr.data);
      setPaymentLinks(lnk.data); setConcept(cpt.data); setDiscountCodes(cds.data);
    } catch (err) { console.error("Error:", err); }
  }, []);

  // Charger les données au démarrage
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Recharger les données quand on sort du Mode Coach
  useEffect(() => {
    if (!coachMode) {
      fetchData();
    }
  }, [coachMode, fetchData]);

  // Update favicon dynamically when logoUrl changes (fallback if no faviconUrl)
  useEffect(() => {
    // Only use logoUrl as favicon if no faviconUrl is set
    if (concept.logoUrl && concept.logoUrl.trim() !== '' && (!concept.faviconUrl || concept.faviconUrl.trim() === '')) {
      // Update favicon
      let link = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = concept.logoUrl;
      
      // Update apple-touch-icon
      let appleLink = document.querySelector("link[rel='apple-touch-icon']");
      if (!appleLink) {
        appleLink = document.createElement('link');
        appleLink.rel = 'apple-touch-icon';
        document.head.appendChild(appleLink);
      }
      appleLink.href = concept.logoUrl;
    }
  }, [concept.logoUrl, concept.faviconUrl]);

  // Update favicon dynamically when faviconUrl changes (priority over logoUrl)
  useEffect(() => {
    if (concept.faviconUrl && concept.faviconUrl.trim() !== '') {
      // Update favicon immediately - faviconUrl has priority
      let link = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = concept.faviconUrl;
      console.log("Favicon updated to:", concept.faviconUrl);
    }
  }, [concept.faviconUrl]);

  // Scroll vers la section par défaut au chargement (si configuré par le coach)
  useEffect(() => {
    // Ne pas scroller si en mode coach ou pendant le splash
    if (coachMode || showSplash) return;
    
    // Attendre que les données soient chargées et le splash terminé
    if (concept.defaultLandingSection && concept.defaultLandingSection !== 'all' && concept.defaultLandingSection !== 'sessions') {
      // Délai plus long pour s'assurer que tout est prêt
      const timer = setTimeout(() => {
        let sectionId = null;
        if (concept.defaultLandingSection === 'offers' || concept.defaultLandingSection === 'shop') {
          sectionId = 'offers-section';
        }
        
        if (sectionId) {
          const element = document.getElementById(sectionId);
          if (element) {
            console.log(`Auto-scrolling to: ${sectionId}`);
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
        
        // Mettre à jour le filtre actif
        setActiveFilter(concept.defaultLandingSection);
      }, 800); // Délai augmenté pour attendre le splash
      return () => clearTimeout(timer);
    }
  }, [concept.defaultLandingSection, coachMode, showSplash]);

  useEffect(() => { const timer = setTimeout(() => setShowSplash(false), 1500); return () => clearTimeout(timer); }, []);

  // LOGIQUE CODE PROMO: Validation en temps réel - Case Insensitive avec trim
  useEffect(() => {
    const validateCode = async () => {
      // Normalize input: trim spaces
      const normalizedCode = discountCode?.trim() || '';
      
      // Reset if no code entered
      if (!normalizedCode) { 
        setAppliedDiscount(null); 
        setPromoMessage({ type: '', text: '' });
        return; 
      }
      
      // Need to select a course first
      if (!selectedCourse) { 
        setAppliedDiscount(null);
        setPromoMessage({ type: 'warning', text: '⚠️ Sélectionnez d\'abord un cours' });
        return; 
      }
      
      try {
        // Send normalized code to backend (backend will also normalize)
        const res = await axios.post(`${API}/discount-codes/validate`, { 
          code: normalizedCode,
          email: userEmail?.trim() || '', 
          courseId: selectedCourse.id 
        });
        
        if (res.data.valid) { 
          const code = res.data.code;
          setAppliedDiscount(code);
          
          // Calculate the actual discount amount for display
          let discountAmount = 0;
          let discountText = '';
          
          if (code.type === '100%' || (code.type === '%' && parseFloat(code.value) >= 100)) {
            discountAmount = selectedOffer ? selectedOffer.price : 0;
            discountText = `Code validé : -${discountAmount.toFixed(2)} CHF (GRATUIT)`;
          } else if (code.type === '%') {
            discountAmount = selectedOffer ? (selectedOffer.price * parseFloat(code.value) / 100) : 0;
            discountText = `Code validé : -${discountAmount.toFixed(2)} CHF (-${code.value}%)`;
          } else if (code.type === 'CHF') {
            discountAmount = parseFloat(code.value);
            discountText = `Code validé : -${discountAmount.toFixed(2)} CHF`;
          }
          
          setPromoMessage({ type: 'success', text: `✅ ${discountText}` });
        } else { 
          setAppliedDiscount(null);
          // Display specific error message from backend
          const errorMsg = res.data.message || 'Code inconnu ou non applicable à ce cours';
          setPromoMessage({ type: 'error', text: `❌ ${errorMsg}` });
        }
      } catch (err) { 
        console.error("Promo validation error:", err);
        setAppliedDiscount(null); 
        setPromoMessage({ type: 'error', text: '❌ Code inconnu ou non applicable à ce cours' });
      }
    };
    
    // Debounce to avoid too many API calls
    const debounce = setTimeout(validateCode, 400);
    return () => clearTimeout(debounce);
  }, [discountCode, selectedCourse, selectedOffer, userEmail]);

  // Secret coach access: 3 rapid clicks
  const handleCopyrightClick = () => {
    const now = Date.now();
    if (now - lastClickTime < 500) {
      const newCount = clickCount + 1;
      setClickCount(newCount);
      if (newCount >= 3) { setShowCoachLogin(true); setClickCount(0); }
    } else { setClickCount(1); }
    setLastClickTime(now);
  };

  const isDiscountFree = (code) => code && (code.type === "100%" || (code.type === "%" && parseFloat(code.value) >= 100));

  const calculateTotal = () => {
    if (!selectedOffer) return 0;
    let total = selectedOffer.price * quantity; // Multiplier par la quantité
    if (appliedDiscount) {
      if (appliedDiscount.type === "100%" || (appliedDiscount.type === "%" && parseFloat(appliedDiscount.value) >= 100)) total = 0;
      else if (appliedDiscount.type === "%") total = total * (1 - parseFloat(appliedDiscount.value) / 100);
      else if (appliedDiscount.type === "CHF") total = Math.max(0, total - parseFloat(appliedDiscount.value));
    }
    return total.toFixed(2);
  };

  const resetForm = () => {
    setPendingReservation(null); setSelectedCourse(null); setSelectedDate(null);
    setSelectedOffer(null); setSelectedSession(null); setUserName(""); 
    setUserEmail(""); setUserWhatsapp(""); setDiscountCode(""); 
    setHasAcceptedTerms(false); setAppliedDiscount(null); setPromoMessage({ type: '', text: '' });
    setQuantity(1); // Reset quantité
  };

  // Reset form but keep client info (for repeat purchases)
  const resetFormKeepClient = () => {
    setPendingReservation(null); setSelectedCourse(null); setSelectedDate(null);
    setSelectedOffer(null); setSelectedSession(null); setDiscountCode(""); 
    setHasAcceptedTerms(false); setAppliedDiscount(null); setPromoMessage({ type: '', text: '' });
    setQuantity(1); setShippingAddress(""); // Reset quantité et adresse
    // Keep userName, userEmail, userWhatsapp for convenience
  };

  const sendWhatsAppNotification = (reservation, isCoach) => {
    const phone = isCoach ? paymentLinks.coachWhatsapp : reservation.userWhatsapp;
    if (!phone?.trim()) return;
    const dateStr = new Date(reservation.datetime).toLocaleDateString('fr-CH');
    const msg = `🎧 ${isCoach ? 'Nouvelle réservation' : 'Confirmation'} Afroboost\n\n👤 ${reservation.userName}\n📧 ${reservation.userEmail}\n💰 ${reservation.offerName} - CHF ${reservation.totalPrice}\n📅 ${reservation.courseName} - ${dateStr}\n🎫 ${reservation.reservationCode}`;
    window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCourse || !selectedDate || !selectedOffer || !hasAcceptedTerms) return;

    // Direct validation - private fields only
    if (!userEmail?.trim() || !userWhatsapp?.trim()) {
      setValidationMessage(t('emailWhatsappRequired'));
      setTimeout(() => setValidationMessage(""), 4000);
      return;
    }

    const [h, m] = selectedCourse.time.split(':');
    const dt = new Date(selectedDate);
    dt.setHours(parseInt(h), parseInt(m), 0, 0);

    const totalPrice = parseFloat(calculateTotal());

    const reservation = {
      userId: `user-${Date.now()}`,
      userName: userName,
      userEmail: userEmail, 
      userWhatsapp: userWhatsapp,
      shippingAddress: selectedOffer?.isProduct ? shippingAddress : null, // Adresse si produit physique
      courseId: selectedCourse.id, 
      courseName: selectedCourse.name,
      courseTime: selectedCourse.time, 
      datetime: dt.toISOString(),
      offerId: selectedOffer.id, 
      offerName: selectedOffer.name,
      price: selectedOffer.price, 
      quantity: quantity, // Quantité sélectionnée
      totalPrice,
      discountCode: appliedDiscount?.code || null,
      discountType: appliedDiscount?.type || null,
      discountValue: appliedDiscount?.value || null,
      appliedDiscount,
      isProduct: selectedOffer?.isProduct || false
    };

    // DYNAMISME DU BOUTON: Si total = 0 (100% gratuit), réservation directe sans paiement
    if (totalPrice === 0) {
      setLoading(true);
      try {
        // Create user
        try { await axios.post(`${API}/users`, { name: userName, email: userEmail, whatsapp: userWhatsapp }); }
        catch (err) { console.error("User creation error:", err); }
        
        // Create reservation directly (no payment needed)
        const res = await axios.post(`${API}/reservations`, reservation);
        
        // Mark discount code as used
        if (appliedDiscount) {
          await axios.post(`${API}/discount-codes/${appliedDiscount.id}/use`);
        }
        
        // MÉMORISATION CLIENT: Save client info for next visit
        saveClientInfo(userName, userEmail, userWhatsapp);
        
        setLastReservation(res.data);
        sendWhatsAppNotification(res.data, true);
        sendWhatsAppNotification(res.data, false);
        setShowSuccess(true);
        resetFormKeepClient();
      } catch (err) { console.error(err); }
      setLoading(false);
      return;
    }

    // PAID RESERVATION: Check if payment is configured
    if (!paymentLinks.stripe?.trim() && !paymentLinks.paypal?.trim() && !paymentLinks.twint?.trim()) {
      setValidationMessage(t('noPaymentConfigured'));
      setTimeout(() => setValidationMessage(""), 4000);
      return;
    }

    setPendingReservation(reservation);
    
    // Create user
    try { await axios.post(`${API}/users`, { name: userName, email: userEmail, whatsapp: userWhatsapp }); }
    catch (err) { console.error("User creation error:", err); }

    // Open payment link
    if (paymentLinks.twint?.trim()) window.open(paymentLinks.twint, '_blank');
    else if (paymentLinks.stripe?.trim()) window.open(paymentLinks.stripe, '_blank');
    else if (paymentLinks.paypal?.trim()) window.open(paymentLinks.paypal, '_blank');

    setTimeout(() => setShowConfirmPayment(true), 800);
  };

  const confirmPayment = async () => {
    if (!pendingReservation) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API}/reservations`, pendingReservation);
      if (pendingReservation.appliedDiscount) await axios.post(`${API}/discount-codes/${pendingReservation.appliedDiscount.id}/use`);
      
      // MÉMORISATION CLIENT: Save client info after successful payment
      saveClientInfo(pendingReservation.userName, pendingReservation.userEmail, pendingReservation.userWhatsapp);
      
      setLastReservation(res.data);
      sendWhatsAppNotification(res.data, true);
      sendWhatsAppNotification(res.data, false);
      setShowSuccess(true);
      setShowConfirmPayment(false);
      resetFormKeepClient();
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const renderDates = (course) => {
    const dates = getNextOccurrences(course.weekday);
    return (
      <div className="grid grid-cols-2 gap-2 mt-3">
        {dates.map((date, idx) => {
          const sessionId = `${course.id}-${date.getTime()}`;
          const isSelected = selectedSession === sessionId;
          return (
            <button key={idx} type="button"
              onClick={() => { setSelectedCourse(course); setSelectedDate(date); setSelectedSession(sessionId); }}
              className={`session-btn px-3 py-2 rounded-lg text-sm font-medium ${isSelected ? 'selected' : ''}`}
              style={{ color: 'white' }} data-testid={`date-btn-${course.id}-${idx}`}>
              {formatDate(date, course.time, lang)} {isSelected && '✔'}
            </button>
          );
        })}
      </div>
    );
  };

  if (showSplash) return <SplashScreen logoUrl={concept.logoUrl} />;
  if (showCoachLogin) return <CoachLoginModal t={t} onLogin={() => { setCoachMode(true); setShowCoachLogin(false); }} onCancel={() => setShowCoachLogin(false)} />;
  if (coachMode) return <CoachDashboard t={t} lang={lang} onBack={() => setCoachMode(false)} onLogout={() => setCoachMode(false)} />;

  // Filtrer les offres et cours selon visibilité, filtre actif et recherche
  const baseOffers = offers.filter(o => o.visible !== false);
  const baseCourses = courses.filter(c => c.visible !== false);
  
  // Appliquer le filtre de catégorie
  // OFFRES = abonnements + sessions cardio (tous les non-produits)
  // SHOP = uniquement produits physiques
  let visibleOffers = baseOffers.filter(offer => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'sessions') return !offer.isProduct;
    if (activeFilter === 'offers') return !offer.isProduct; // Tous les non-produits (abonnements + sessions)
    if (activeFilter === 'shop') return offer.isProduct === true; // Uniquement produits physiques
    return true;
  });
  
  // Appliquer le filtre de recherche textuelle - TITRE UNIQUEMENT
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase().trim();
    visibleOffers = visibleOffers.filter(offer => 
      (offer.name?.toLowerCase() || '').includes(query)
    );
  }
  
  // Filtrer les cours selon le filtre et la recherche
  let visibleCourses = baseCourses;
  if (activeFilter === 'shop') {
    visibleCourses = []; // Masquer les cours uniquement sur Shop
  } else if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase().trim();
    visibleCourses = baseCourses.filter(course => 
      (course.name?.toLowerCase() || '').includes(query)
    );
  }
  
  const totalPrice = calculateTotal();

  return (
    <div className="w-full min-h-screen p-6 relative section-gradient" style={{ fontFamily: 'system-ui, sans-serif' }}>
      <LanguageSelector lang={lang} setLang={setLang} />

      {/* PWA Install Banner */}
      {showInstallBanner && (
        <div 
          className="fixed top-0 left-0 right-0 z-50 px-4 py-3"
          style={{ 
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.95) 0%, rgba(217, 28, 210, 0.95) 100%)',
            boxShadow: '0 4px 20px rgba(217, 28, 210, 0.4)'
          }}
          data-testid="pwa-install-banner"
        >
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{isIOS ? '📤' : '📲'}</span>
              <div>
                <p className="text-white font-semibold text-sm">Installer Afroboost</p>
                <p className="text-white text-xs opacity-80">
                  {isIOS ? 'Appuyez sur Partager puis "Sur l\'écran d\'accueil"' : 'Accès rapide depuis votre écran d\'accueil'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={handleInstallClick}
                className="px-4 py-2 rounded-full text-sm font-semibold"
                style={{ background: '#000', color: '#fff' }}
                data-testid="pwa-install-btn"
              >
                {isIOS ? 'Comment ?' : 'Installer'}
              </button>
              <button 
                onClick={dismissInstallBanner}
                className="p-2 text-white opacity-70 hover:opacity-100"
                data-testid="pwa-dismiss-btn"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfirmPayment && <ConfirmPaymentOverlay t={t} onConfirm={confirmPayment} onCancel={() => { setShowConfirmPayment(false); setPendingReservation(null); }} />}
      {showSuccess && lastReservation && <SuccessOverlay t={t} data={lastReservation} onClose={() => setShowSuccess(false)} />}

      <div className="max-w-4xl mx-auto pt-12">
        <div className="text-center mb-8">
          <h1 className="font-bold mb-2 text-white" style={{ 
            fontSize: '44px', 
            textShadow: '0 2px 4px rgba(0,0,0,0.8), 0 0 30px rgba(217, 28, 210, 0.4)' 
          }} data-testid="app-title">{t('appTitle')}</h1>
          <p className="max-w-2xl mx-auto text-white" style={{ 
            fontSize: '15px', 
            textShadow: '0 1px 3px rgba(0,0,0,0.9), 0 0 10px rgba(0,0,0,0.5)',
            lineHeight: '1.6'
          }}>{concept.description || t('conceptDefault')}</p>
        </div>

        {/* Hero Media - YouTube, Vimeo, Image, Video - Only show if URL is valid */}
        {concept.heroImageUrl && concept.heroImageUrl.trim() !== '' && (
          <MediaDisplay url={concept.heroImageUrl} className="hero-media-container mb-8" />
        )}

        {/* Barre de Recherche uniquement (filtres masqués) */}
        <NavigationBar 
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          showSearch={true}
          showFilters={false}
        />

        {/* Message si aucun résultat */}
        {visibleOffers.length === 0 && visibleCourses.length === 0 && searchQuery.trim() && (
          <div className="text-center py-8 mb-8 rounded-xl" style={{ background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
            <p className="text-white opacity-70">🔍 Aucun résultat pour "{searchQuery}"</p>
            <button 
              onClick={() => { setSearchQuery(''); setActiveFilter('all'); }}
              className="mt-3 px-4 py-2 rounded-lg text-sm"
              style={{ background: 'rgba(217, 28, 210, 0.3)', color: '#fff' }}
            >
              Réinitialiser les filtres
            </button>
          </div>
        )}

        {/* Section Sessions */}
        <div id="sessions-section" className="mb-8">
          {visibleCourses.length > 0 && (
            <>
              <h2 className="font-semibold mb-4 text-white" style={{ fontSize: '18px' }}>{t('chooseSession')}</h2>
              <div className="space-y-4">
                {visibleCourses.map(course => (
                  <div key={course.id} className={`course-card rounded-xl p-5 ${selectedCourse?.id === course.id ? 'selected' : ''}`} data-testid={`course-card-${course.id}`}>
                    <h3 className="font-semibold text-white">{course.name}</h3>
                    <div className="flex items-center gap-2 text-xs text-white opacity-60 mb-1">
                      <LocationIcon />
                      <span>{course.locationName}</span>
                      {course.mapsUrl && (
                        <a href={course.mapsUrl} target="_blank" rel="noopener noreferrer" className="ml-2 flex items-center gap-1" style={{ color: '#8b5cf6' }}
                          onClick={(e) => e.stopPropagation()}>
                          <LocationIcon /> Maps
                        </a>
                      )}
                    </div>
                    {renderDates(course)}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {selectedCourse && selectedDate && (
          <div id="offers-section" className="mb-8">
            <h2 className="font-semibold mb-4 text-white" style={{ fontSize: '18px' }}>{t('chooseOffer')}</h2>
            
            {/* Horizontal Slider for Offers with LED effect - SWIPE FLUIDE */}
            <div 
              className="offers-slider"
              data-testid="offers-slider"
            >
              {visibleOffers.map(offer => (
                <OfferCardSlider 
                  key={offer.id} 
                  offer={offer} 
                  selected={selectedOffer?.id === offer.id} 
                  onClick={() => setSelectedOffer(offer)} 
                />
              ))}
            </div>
            
            {/* Slider navigation hint */}
            {visibleOffers.length > 1 && (
              <p className="text-xs text-center mt-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                ← Faites défiler pour voir plus d'offres →
              </p>
            )}
          </div>
        )}

        {/* Bouton Voir les avis Google - affiché si configuré par le coach */}
        {selectedOffer && concept.googleReviewsUrl && (
          <div className="mb-6 flex justify-center">
            <a 
              href={concept.googleReviewsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full transition-all duration-300 hover:scale-105"
              style={{
                background: 'transparent',
                border: '2px solid rgba(217, 28, 210, 0.7)',
                boxShadow: '0 0 15px rgba(217, 28, 210, 0.4), inset 0 0 10px rgba(139, 92, 246, 0.1)',
                color: '#fff'
              }}
              data-testid="google-reviews-btn"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              <span className="font-medium">Voir les avis</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </a>
          </div>
        )}

        {selectedOffer && (
          <form onSubmit={handleSubmit}>
            <div className="form-section rounded-xl p-6 mb-6">
              <h2 className="font-semibold mb-4 text-white" style={{ fontSize: '18px' }}>{t('yourInfo')}</h2>
              <div className="space-y-4">
                {/* Private input fields with auto-fill support */}
                <input type="text" required placeholder={t('fullName')} value={userName} onChange={e => setUserName(e.target.value)} className="w-full p-3 rounded-lg neon-input" data-testid="user-name-input" autoComplete="name" />
                <input type="email" required placeholder={t('emailRequired')} value={userEmail} onChange={e => handleEmailChange(e.target.value)} className="w-full p-3 rounded-lg neon-input" data-testid="user-email-input" autoComplete="email" />
                <input type="tel" required placeholder={t('whatsappRequired')} value={userWhatsapp} onChange={e => setUserWhatsapp(e.target.value)} className="w-full p-3 rounded-lg neon-input" data-testid="user-whatsapp-input" autoComplete="tel" />
                
                {/* Champ Adresse - Affiché uniquement pour les produits physiques */}
                {(selectedOffer?.isProduct || selectedOffer?.isPhysicalProduct) && (
                  <div className="border border-purple-500/30 rounded-lg p-3 bg-purple-900/20">
                    <p className="text-xs text-purple-400 mb-2">📦 Produit physique - Adresse de livraison requise</p>
                    <input 
                      type="text" 
                      required 
                      placeholder="Adresse complète (rue, numéro, code postal, ville)" 
                      value={shippingAddress} 
                      onChange={e => setShippingAddress(e.target.value)} 
                      className="w-full p-3 rounded-lg neon-input" 
                      data-testid="shipping-address-input" 
                      autoComplete="street-address" 
                    />
                  </div>
                )}
                
                {/* Promo code input - Accept any case (minuscules/majuscules) */}
                <div>
                  <input type="text" placeholder={t('promoCode')} value={discountCode} onChange={e => setDiscountCode(e.target.value)}
                    className={`w-full p-3 rounded-lg ${appliedDiscount ? 'valid-code' : 'neon-input'}`} data-testid="discount-code-input" autoComplete="off" />
                  
                  {/* FEEDBACK VISUEL: Message clair sous le champ code promo */}
                  {promoMessage.text && (
                    <p className={`mt-2 text-sm font-medium ${promoMessage.type === 'success' ? 'text-green-400' : promoMessage.type === 'error' ? 'text-red-400' : 'text-yellow-400'}`} data-testid="promo-message">
                      {promoMessage.text}
                    </p>
                  )}
                </div>
                
                {/* Other validation messages */}
                {validationMessage && (
                  <p className="text-red-400 text-sm font-medium" data-testid="validation-message">{validationMessage}</p>
                )}
                
                {/* Price summary with quantity selector and discount */}
                <div className="p-4 rounded-lg card-gradient">
                  {selectedOffer && (
                    <>
                      <div className="flex justify-between items-center text-white text-sm mb-2">
                        <span>{selectedOffer.name}</span>
                        <span>CHF {selectedOffer.price.toFixed(2)}</span>
                      </div>
                      
                      {/* Quantity selector */}
                      <div className="flex justify-between items-center text-white text-sm mb-2">
                        <span>{t('quantity') || 'Quantité'}:</span>
                        <div className="flex items-center gap-2">
                          <button 
                            type="button"
                            onClick={() => setQuantity(Math.max(1, quantity - 1))}
                            className="w-8 h-8 rounded-full bg-purple-600 hover:bg-purple-700 text-white font-bold"
                            data-testid="quantity-minus"
                          >-</button>
                          <span className="w-8 text-center font-bold" data-testid="quantity-value">{quantity}</span>
                          <button 
                            type="button"
                            onClick={() => setQuantity(quantity + 1)}
                            className="w-8 h-8 rounded-full bg-purple-600 hover:bg-purple-700 text-white font-bold"
                            data-testid="quantity-plus"
                          >+</button>
                        </div>
                      </div>
                      
                      {quantity > 1 && (
                        <div className="flex justify-between text-white text-xs opacity-60 mb-1">
                          <span>Sous-total ({quantity} x CHF {selectedOffer.price.toFixed(2)})</span>
                          <span>CHF {(selectedOffer.price * quantity).toFixed(2)}</span>
                        </div>
                      )}
                      
                      {appliedDiscount && (
                        <div className="flex justify-between text-green-400 text-sm mb-1">
                          <span>Réduction ({appliedDiscount.code})</span>
                          <span>
                            {appliedDiscount.type === '100%' ? '-100%' : 
                             appliedDiscount.type === '%' ? `-${appliedDiscount.value}%` : 
                             `-${appliedDiscount.value} CHF`}
                          </span>
                        </div>
                      )}
                      <hr className="border-gray-600 my-2" />
                    </>
                  )}
                  <p className="font-bold text-white text-lg flex justify-between" data-testid="total-price">
                    <span>{t('total')}:</span>
                    <span style={{ color: parseFloat(totalPrice) === 0 ? '#4ade80' : '#d91cd2' }}>
                      CHF {totalPrice}
                      {parseFloat(totalPrice) === 0 && <span className="ml-2 text-sm">(GRATUIT)</span>}
                    </span>
                  </p>
                </div>
                
                {/* CGV checkbox with clickable link */}
                <label className="flex items-start gap-2 cursor-pointer text-xs text-white opacity-70">
                  <input type="checkbox" required checked={hasAcceptedTerms} onChange={e => setHasAcceptedTerms(e.target.checked)} data-testid="terms-checkbox" />
                  <span>
                    {t('acceptTerms')}{' '}
                    <button 
                      type="button"
                      onClick={(e) => { e.preventDefault(); setShowTermsModal(true); }}
                      className="underline hover:text-purple-400"
                      style={{ color: '#d91cd2' }}
                      data-testid="terms-link"
                    >
                      {t('termsLink') || 'conditions générales'}
                    </button>
                    {' '}et confirme ma réservation.
                  </span>
                </label>
              </div>
            </div>
            
            {/* DYNAMISME DU BOUTON: Change selon le montant total */}
            <button type="submit" disabled={!hasAcceptedTerms || loading} 
              className={`w-full py-4 rounded-xl font-bold uppercase tracking-wide ${parseFloat(totalPrice) === 0 ? 'btn-free' : 'btn-primary'}`} 
              data-testid="submit-reservation-btn">
              {loading ? t('loading') : parseFloat(totalPrice) === 0 ? '🎁 Réserver gratuitement' : t('payAndReserve')}
            </button>
          </form>
        )}

        {/* CGV Modal */}
        {showTermsModal && (
          <div className="modal-overlay" onClick={() => setShowTermsModal(false)}>
            <div className="modal-content glass rounded-xl p-6 max-w-lg w-full neon-border" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white">{t('termsTitle') || 'Conditions Générales'}</h3>
                <button onClick={() => setShowTermsModal(false)} className="text-2xl text-white hover:text-purple-400">×</button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto text-white text-sm opacity-80 whitespace-pre-wrap">
                {concept.termsText || 'Les conditions générales ne sont pas encore définies. Veuillez contacter l\'administrateur.'}
              </div>
              <button 
                onClick={() => setShowTermsModal(false)} 
                className="mt-4 w-full py-3 rounded-lg btn-primary"
              >
                Fermer
              </button>
            </div>
          </div>
        )}

        {/* Footer minimaliste avec navigation textuelle et logos paiement */}
        <footer className="mt-12 mb-8 text-center">
          
          {/* Logos de paiement - Sans rectangle, juste les logos */}
          {(concept.paymentTwint || concept.paymentPaypal || concept.paymentCreditCard) && (
            <div className="flex justify-center items-center gap-6 mb-6" data-testid="payment-logos-footer">
              {concept.paymentTwint && (
                <img 
                  src="https://upload.wikimedia.org/wikipedia/commons/8/83/Twint_Logo.svg" 
                  alt="Twint" 
                  style={{ height: '24px', filter: 'brightness(0) invert(1)', opacity: 0.7 }}
                  title="Twint"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              )}
              {concept.paymentPaypal && (
                <img 
                  src="https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg" 
                  alt="PayPal" 
                  style={{ height: '22px', filter: 'brightness(0) invert(1)', opacity: 0.7 }}
                  title="PayPal"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              )}
              {concept.paymentCreditCard && (
                <div className="flex items-center gap-2">
                  <img 
                    src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg" 
                    alt="Visa" 
                    style={{ height: '18px', filter: 'brightness(0) invert(1)', opacity: 0.7 }}
                    title="Visa"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                  <img 
                    src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" 
                    alt="Mastercard" 
                    style={{ height: '20px', filter: 'brightness(0) invert(1)', opacity: 0.7 }}
                    title="Mastercard"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                </div>
              )}
            </div>
          )}
          
          {/* Navigation textuelle horizontale - Police fine, sans icônes */}
          <div 
            className="flex justify-center items-center flex-wrap gap-x-2 gap-y-1"
            style={{ 
              fontFamily: "'Inter', -apple-system, sans-serif",
              fontWeight: 300,
              fontSize: '12px',
              letterSpacing: '0.5px'
            }}
          >
            {concept.externalLink1Url && concept.externalLink1Title && (
              <>
                <a 
                  href={concept.externalLink1Url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white hover:text-pink-400 transition-colors"
                  style={{ opacity: 0.6 }}
                  data-testid="external-link-1"
                >
                  {concept.externalLink1Title}
                </a>
                <span className="text-white" style={{ opacity: 0.3 }}>|</span>
              </>
            )}
            {concept.externalLink2Url && concept.externalLink2Title && (
              <>
                <a 
                  href={concept.externalLink2Url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white hover:text-pink-400 transition-colors"
                  style={{ opacity: 0.6 }}
                  data-testid="external-link-2"
                >
                  {concept.externalLink2Title}
                </a>
                <span className="text-white" style={{ opacity: 0.3 }}>|</span>
              </>
            )}
            {(installPrompt || isIOS) && !window.matchMedia('(display-mode: standalone)').matches && (
              <>
                <button 
                  onClick={handleInstallClick}
                  className="text-white hover:text-pink-400 transition-colors"
                  style={{ opacity: 0.6, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 'inherit', fontSize: 'inherit', letterSpacing: 'inherit' }}
                  data-testid="footer-install-link"
                >
                  Installer Afroboost
                </button>
                <span className="text-white" style={{ opacity: 0.3 }}>|</span>
              </>
            )}
            <span 
              onClick={handleCopyrightClick} 
              className="copyright-secret text-white cursor-pointer" 
              style={{ opacity: 0.4 }}
              data-testid="copyright-secret"
            >
              {t('copyright')}
            </span>
          </div>
        </footer>
        
        {/* Indicateur de scroll pour les nouveaux utilisateurs */}
        <ScrollIndicator show={showScrollIndicator && !coachMode && !showSplash} />
      </div>
    </div>
  );
}

export default App;
