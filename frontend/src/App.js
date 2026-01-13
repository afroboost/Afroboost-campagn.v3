import { useState, useEffect, useCallback, useRef } from "react";
import "@/App.css";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

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
    acceptTerms: "J'accepte les conditions et confirme ma réservation.",
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
    acceptTerms: "I accept the terms and confirm my reservation.",
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
    acceptTerms: "Ich akzeptiere die Bedingungen.",
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
  if (!url) return null;
  
  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return { type: 'youtube', id: ytMatch[1] };
  
  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeoMatch) return { type: 'vimeo', id: vimeoMatch[1] };
  
  // MP4 Video
  if (url.toLowerCase().endsWith('.mp4')) return { type: 'video', url };
  
  // Image
  return { type: 'image', url };
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

// Splash Screen - Pure Black with configurable logo
const SplashScreen = ({ logoUrl }) => (
  <div className="splash-screen" style={{ background: '#000000' }}>
    {logoUrl ? (
      <img src={logoUrl} alt="Afroboost" className="splash-logo" />
    ) : (
      <div className="splash-headset">🎧</div>
    )}
    <div className="splash-text">Afroboost</div>
  </div>
);

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

// Media Display Component (YouTube, Vimeo, Image, Video) - Strict 16:9 ratio with click protection
const MediaDisplay = ({ url, className }) => {
  const media = parseMediaUrl(url);
  // Return null if no valid media URL
  if (!media || !url || url.trim() === '') return null;

  // 16:9 container wrapper
  const containerStyle = {
    position: 'relative',
    width: '100%',
    paddingBottom: '56.25%', // 16:9 ratio
    overflow: 'hidden',
    borderRadius: '16px',
    border: '1px solid rgba(217, 28, 210, 0.3)',
    boxShadow: '0 0 30px rgba(217, 28, 210, 0.2)',
    background: '#000'
  };

  const contentStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%'
  };

  // Full overlay to prevent all interactions with video controls and links
  const fullOverlayStyle = {
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

  // Top bar overlay to completely hide YouTube title/logo
  const topBarOverlayStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '80px',
    zIndex: 15,
    background: 'linear-gradient(180deg, #000000 0%, #000000 50%, rgba(0,0,0,0.8) 80%, transparent 100%)',
    pointerEvents: 'auto'
  };

  // Bottom bar overlay to completely hide YouTube logo watermark
  const bottomBarOverlayStyle = {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: '100%',
    height: '70px',
    zIndex: 15,
    background: 'linear-gradient(0deg, #000000 0%, #000000 50%, rgba(0,0,0,0.8) 80%, transparent 100%)',
    pointerEvents: 'auto'
  };

  if (media.type === 'youtube') {
    // YouTube params: modestbranding=1, rel=0, showinfo=0 to hide external links
    return (
      <div className={className} style={containerStyle} data-testid="media-container-16-9">
        <iframe 
          src={`https://www.youtube.com/embed/${media.id}?autoplay=1&mute=1&loop=1&playlist=${media.id}&modestbranding=1&rel=0&showinfo=0&controls=0&disablekb=1&fs=0&iv_load_policy=3`}
          frameBorder="0" 
          allow="autoplay; encrypted-media" 
          style={contentStyle}
          title="YouTube video"
        />
        {/* Top gradient overlay to hide title/logo */}
        <div style={topBarOverlayStyle} onClick={(e) => e.preventDefault()} />
        {/* Bottom gradient overlay to hide YouTube watermark */}
        <div style={bottomBarOverlayStyle} onClick={(e) => e.preventDefault()} />
        {/* Full overlay to block all clicks */}
        <div style={fullOverlayStyle} onClick={(e) => e.preventDefault()} />
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
        />
        {/* Overlays to block clicks */}
        <div style={topBarOverlayStyle} onClick={(e) => e.preventDefault()} />
        <div style={bottomBarOverlayStyle} onClick={(e) => e.preventDefault()} />
        <div style={fullOverlayStyle} onClick={(e) => e.preventDefault()} />
      </div>
    );
  }
  
  if (media.type === 'video') {
    return (
      <div className={className} style={containerStyle} data-testid="media-container-16-9">
        <video src={media.url} autoPlay loop muted playsInline style={{ ...contentStyle, objectFit: 'cover' }} />
      </div>
    );
  }
  
  // Image type
  return (
    <div className={className} style={containerStyle} data-testid="media-container-16-9">
      <img src={media.url} alt="Media" style={{ ...contentStyle, objectFit: 'cover' }} />
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

// Offer Card - Clean Design with Full Image + Info displayed inside card
const OfferCard = ({ offer, selected, onClick }) => {
  const [showDescription, setShowDescription] = useState(false);
  const defaultImage = "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400&h=200&fit=crop";
  
  const toggleDescription = (e) => {
    e.stopPropagation();
    setShowDescription(!showDescription);
  };
  
  return (
    <div onClick={onClick} className={`offer-card rounded-xl overflow-hidden ${selected ? 'selected' : ''}`} data-testid={`offer-card-${offer.id}`}>
      <div style={{ position: 'relative', height: '140px' }}>
        {/* Image or Description based on state */}
        {!showDescription ? (
          <>
            <img 
              src={offer.thumbnail || defaultImage} 
              alt={offer.name} 
              className="offer-card-image"
              onError={(e) => { e.target.src = defaultImage; }}
            />
            {/* Info Icon - Only show if description exists */}
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
          /* Description Panel - replaces image */
          <div 
            className="offer-description-panel"
            data-testid={`offer-description-panel-${offer.id}`}
          >
            <p className="offer-description-text">{offer.description}</p>
            {/* Close button */}
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

// Coach Login Modal
const CoachLoginModal = ({ t, onLogin, onCancel }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API}/coach-auth/login`, { email, password });
      if (response.data.success) onLogin();
      else setError(t('wrongCredentials'));
    } catch { setError(t('wrongCredentials')); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass rounded-xl p-8 max-w-md w-full neon-border">
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
          <button type="button" onClick={() => window.location.href = `mailto:contact.artboost@gmail.com?subject=${encodeURIComponent("🔐 Afroboost — Réinitialisation Coach")}`}
            className="w-full text-center mb-4" style={{ color: '#d91cd2', background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', fontSize: '14px' }}>{t('forgotPassword')}</button>
          <button type="button" onClick={onCancel} className="w-full py-2 rounded-lg glass text-white" data-testid="coach-login-cancel">{t('cancel')}</button>
        </form>
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
  const [concept, setConcept] = useState({ description: "", heroImageUrl: "", logoUrl: "" });
  const [discountCodes, setDiscountCodes] = useState([]);
  const [newCode, setNewCode] = useState({ code: "", type: "", value: "", assignedEmail: "", courses: [], maxUses: "", expiresAt: "" });
  const [newCourse, setNewCourse] = useState({ name: "", weekday: 0, time: "18:30", locationName: "", mapsUrl: "" });
  const [newOffer, setNewOffer] = useState({ name: "", price: 0, visible: true, thumbnail: "", description: "" });
  const fileInputRef = useRef(null);

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

  const saveConcept = async () => { 
    try {
      await axios.put(`${API}/concept`, concept); 
      alert("✅ Concept sauvegardé avec succès !");
    } catch (err) {
      console.error("Error saving concept:", err);
      alert("❌ Erreur lors de la sauvegarde");
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

  const updateOffer = async (offer) => { await axios.put(`${API}/offers/${offer.id}`, offer); };
  const addOffer = async (e) => {
    e.preventDefault();
    if (!newOffer.name) return;
    const response = await axios.post(`${API}/offers`, newOffer);
    setOffers([...offers, response.data]);
    setNewOffer({ name: "", price: 0, visible: true, thumbnail: "", description: "" });
  };

  const toggleCourseSelection = (courseId) => {
    setNewCode(prev => ({
      ...prev, courses: prev.courses.includes(courseId) ? prev.courses.filter(id => id !== courseId) : [...prev.courses, courseId]
    }));
  };

  const tabs = [
    { id: "reservations", label: t('reservations') }, { id: "concept", label: t('conceptVisual') },
    { id: "courses", label: t('courses') }, { id: "offers", label: t('offers') },
    { id: "payments", label: t('payments') }, { id: "codes", label: t('promoCodes') }
  ];

  return (
    <div className="w-full min-h-screen p-6 section-gradient">
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
              <button onClick={exportCSV} className="csv-btn" data-testid="export-csv">{t('downloadCSV')}</button>
            </div>
            <div className="overflow-x-auto">
              <table className="coach-table">
                <thead><tr>
                  <th>{t('code')}</th><th>{t('name')}</th><th>{t('email')}</th><th>WhatsApp</th>
                  <th>{t('courses')}</th><th>{t('date')}</th><th>{t('time')}</th>
                  <th>{t('offer')}</th><th>{t('qty')}</th><th>{t('total')}</th>
                </tr></thead>
                <tbody>
                  {reservations.map(r => {
                    const dt = new Date(r.datetime);
                    return (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 'bold', color: '#d91cd2' }}>{r.reservationCode || '-'}</td>
                        <td>{r.userName}</td><td>{r.userEmail}</td><td>{r.userWhatsapp || '-'}</td>
                        <td>{r.courseName}</td><td>{dt.toLocaleDateString('fr-CH')}</td>
                        <td>{dt.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}</td>
                        <td>{r.offerName}</td><td>{r.quantity || 1}</td>
                        <td style={{ fontWeight: 'bold' }}>CHF {r.totalPrice || r.price}</td>
                      </tr>
                    );
                  })}
                  {reservations.length === 0 && <tr><td colSpan="10" className="text-center py-8" style={{ opacity: 0.5 }}>{t('noReservations')}</td></tr>}
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
                <input type="url" value={concept.heroImageUrl} onChange={(e) => setConcept({ ...concept, heroImageUrl: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg neon-input" placeholder="https://youtube.com/watch?v=... ou image URL" data-testid="concept-media-url" />
                <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Supporte: YouTube, Vimeo, .mp4, images</p>
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
              <button onClick={saveConcept} className="btn-primary px-6 py-3 rounded-lg" data-testid="save-concept">{t('save')}</button>
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
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div>
                    <label className="block mb-1 text-white text-xs opacity-70">{t('offerName')}</label>
                    <input type="text" value={offer.name} onChange={(e) => { const n = [...offers]; n[idx].name = e.target.value; setOffers(n); }}
                      onBlur={() => updateOffer(offer)} className="w-full px-3 py-2 rounded-lg neon-input text-sm" />
                  </div>
                  <div>
                    <label className="block mb-1 text-white text-xs opacity-70">{t('price')}</label>
                    <input type="number" value={offer.price} onChange={(e) => { const n = [...offers]; n[idx].price = parseFloat(e.target.value); setOffers(n); }}
                      onBlur={() => updateOffer(offer)} className="w-full px-3 py-2 rounded-lg neon-input text-sm" />
                  </div>
                  <div>
                    <label className="block mb-1 text-white text-xs opacity-70">{t('thumbnail')}</label>
                    <input type="url" value={offer.thumbnail || ''} onChange={(e) => { const n = [...offers]; n[idx].thumbnail = e.target.value; setOffers(n); }}
                      onBlur={() => updateOffer(offer)} className="w-full px-3 py-2 rounded-lg neon-input text-sm" placeholder="https://..." />
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-white text-xs opacity-70">{t('visible')}</label>
                    <div className={`switch ${offer.visible ? 'active' : ''}`} onClick={() => { const n = [...offers]; n[idx].visible = !offer.visible; setOffers(n); updateOffer({ ...offer, visible: !offer.visible }); }} />
                  </div>
                </div>
                {/* Description field for info tooltip */}
                <div className="mt-3">
                  <label className="block mb-1 text-white text-xs opacity-70">{t('offerDescription') || 'Description (icône "i")'}</label>
                  <textarea 
                    value={offer.description || ''} 
                    onChange={(e) => { const n = [...offers]; n[idx].description = e.target.value; setOffers(n); }}
                    onBlur={() => updateOffer(offer)} 
                    className="w-full px-3 py-2 rounded-lg neon-input text-sm" 
                    rows={2}
                    maxLength={150}
                    placeholder="Description visible au clic sur l'icône i (max 150 car.)"
                    data-testid={`offer-description-${offer.id}`}
                  />
                  <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{(offer.description || '').length}/150 caractères</p>
                </div>
              </div>
            ))}
            <form onSubmit={addOffer} className="glass rounded-lg p-4 mt-4">
              <h3 className="text-white mb-4 font-semibold text-sm">{t('addOffer')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input type="text" placeholder={t('offerName')} value={newOffer.name} onChange={e => setNewOffer({ ...newOffer, name: e.target.value })} className="px-3 py-2 rounded-lg neon-input text-sm" required />
                <input type="number" placeholder={t('price')} value={newOffer.price} onChange={e => setNewOffer({ ...newOffer, price: parseFloat(e.target.value) })} className="px-3 py-2 rounded-lg neon-input text-sm" />
                <input type="url" placeholder={t('thumbnail')} value={newOffer.thumbnail || ''} onChange={e => setNewOffer({ ...newOffer, thumbnail: e.target.value })} className="px-3 py-2 rounded-lg neon-input text-sm" />
              </div>
              <div className="mt-3">
                <textarea 
                  placeholder="Description (max 150 car.)" 
                  value={newOffer.description || ''} 
                  onChange={e => setNewOffer({ ...newOffer, description: e.target.value })} 
                  className="w-full px-3 py-2 rounded-lg neon-input text-sm" 
                  rows={2}
                  maxLength={150}
                />
              </div>
              <button type="submit" className="btn-primary px-4 py-2 rounded-lg mt-4 text-sm">{t('add')}</button>
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

  return (
    <div className="success-overlay">
      <div className="success-message glass rounded-xl p-6 max-w-md w-full text-center neon-border relative print-proof">
        <button onClick={onClose} className="absolute top-3 right-4 text-2xl text-white" data-testid="close-success">×</button>
        <div style={{ fontSize: '48px' }}>🎧</div>
        <p className="font-bold text-white my-2" style={{ fontSize: '20px' }}>{t('reservationConfirmed')}</p>
        <div className="my-4 p-4 rounded-lg bg-white/10 border-2 border-dashed" style={{ borderColor: '#d91cd2' }}>
          <p className="text-xs text-white opacity-60">{t('reservationCode')}:</p>
          <p className="text-2xl font-bold tracking-widest text-white" data-testid="reservation-code">{data.reservationCode}</p>
        </div>
        <div className="text-sm text-left space-y-1 mb-6 text-white opacity-80">
          <p><strong>{t('name')}:</strong> {data.userName}</p>
          <p><strong>{t('courses')}:</strong> {data.courseName}</p>
          <p><strong>{t('total')}:</strong> CHF {data.totalPrice}</p>
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

  const [courses, setCourses] = useState([]);
  const [offers, setOffers] = useState([]);
  const [users, setUsers] = useState([]);
  const [paymentLinks, setPaymentLinks] = useState({ stripe: "", paypal: "", twint: "", coachWhatsapp: "" });
  const [concept, setConcept] = useState({ description: "", heroImageUrl: "", logoUrl: "" });
  const [discountCodes, setDiscountCodes] = useState([]);

  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);

  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userWhatsapp, setUserWhatsapp] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [isExistingUser, setIsExistingUser] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");

  const [showSuccess, setShowSuccess] = useState(false);
  const [showConfirmPayment, setShowConfirmPayment] = useState(false);
  const [validationMessage, setValidationMessage] = useState("");
  const [pendingReservation, setPendingReservation] = useState(null);
  const [lastReservation, setLastReservation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState(null);

  const [clickCount, setClickCount] = useState(0);
  const [lastClickTime, setLastClickTime] = useState(0);

  const t = useCallback((key) => translations[lang][key] || key, [lang]);

  useEffect(() => { localStorage.setItem("af_lang", lang); }, [lang]);

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

  // Update favicon dynamically when logoUrl changes
  useEffect(() => {
    if (concept.logoUrl && concept.logoUrl.trim() !== '') {
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
  }, [concept.logoUrl]);

  useEffect(() => { const timer = setTimeout(() => setShowSplash(false), 1500); return () => clearTimeout(timer); }, []);

  // Validate discount code in real-time with proper error messages
  useEffect(() => {
    const validateCode = async () => {
      // Reset if no code entered
      if (!discountCode || discountCode.trim() === '') { 
        setAppliedDiscount(null); 
        setValidationMessage(""); 
        return; 
      }
      
      // Need to select a course first
      if (!selectedCourse) { 
        setAppliedDiscount(null);
        setValidationMessage("⚠️ Veuillez d'abord sélectionner un cours");
        return; 
      }
      
      try {
        const res = await axios.post(`${API}/discount-codes/validate`, { 
          code: discountCode.trim(), 
          email: userEmail || '', 
          courseId: selectedCourse.id 
        });
        
        if (res.data.valid) { 
          setAppliedDiscount(res.data.code); 
          setValidationMessage(""); // Clear error on success
        } else { 
          setAppliedDiscount(null); 
          // Display specific error message from backend
          setValidationMessage(`❌ ${res.data.message || t('invalidPromoCode')}`);
        }
      } catch (err) { 
        setAppliedDiscount(null); 
        setValidationMessage(`❌ ${t('invalidPromoCode')}`);
      }
    };
    
    const debounce = setTimeout(validateCode, 500);
    return () => clearTimeout(debounce);
  }, [discountCode, selectedCourse, userEmail, t]);

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
    let total = selectedOffer.price;
    if (appliedDiscount) {
      if (appliedDiscount.type === "100%" || (appliedDiscount.type === "%" && parseFloat(appliedDiscount.value) >= 100)) total = 0;
      else if (appliedDiscount.type === "%") total = total * (1 - parseFloat(appliedDiscount.value) / 100);
      else if (appliedDiscount.type === "CHF") total = Math.max(0, total - parseFloat(appliedDiscount.value));
    }
    return total.toFixed(2);
  };

  const resetForm = () => {
    setPendingReservation(null); setSelectedCourse(null); setSelectedDate(null);
    setSelectedOffer(null); setSelectedSession(null); setIsExistingUser(false);
    setSelectedUserId(""); setUserName(""); setUserEmail(""); setUserWhatsapp("");
    setDiscountCode(""); setHasAcceptedTerms(false); setAppliedDiscount(null);
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
      courseId: selectedCourse.id, 
      courseName: selectedCourse.name,
      courseTime: selectedCourse.time, 
      datetime: dt.toISOString(),
      offerId: selectedOffer.id, 
      offerName: selectedOffer.name,
      price: selectedOffer.price, 
      quantity: 1, 
      totalPrice,
      discountCode: appliedDiscount?.code || null,
      discountType: appliedDiscount?.type || null,
      discountValue: appliedDiscount?.value || null,
      appliedDiscount
    };

    // Free reservation with 100% discount
    if (appliedDiscount && isDiscountFree(appliedDiscount)) {
      setLoading(true);
      try {
        // Create user if needed
        try { await axios.post(`${API}/users`, { name: userName, email: userEmail, whatsapp: userWhatsapp }); }
        catch (err) { console.error("User creation error:", err); }
        
        const res = await axios.post(`${API}/reservations`, reservation);
        await axios.post(`${API}/discount-codes/${appliedDiscount.id}/use`);
        setLastReservation(res.data);
        sendWhatsAppNotification(res.data, true);
        sendWhatsAppNotification(res.data, false);
        setShowSuccess(true);
        resetForm();
      } catch (err) { console.error(err); }
      setLoading(false);
      return;
    }

    // Check if payment is configured
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
      setLastReservation(res.data);
      sendWhatsAppNotification(res.data, true);
      sendWhatsAppNotification(res.data, false);
      setShowSuccess(true);
      setShowConfirmPayment(false);
      resetForm();
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

  const visibleOffers = offers.filter(o => o.visible !== false);
  const uniqueUsers = Array.from(new Map(users.map(u => [u.email, u])).values());
  const totalPrice = calculateTotal();
  const isFree = parseFloat(totalPrice) === 0 && appliedDiscount;

  return (
    <div className="w-full min-h-screen p-6 relative section-gradient" style={{ fontFamily: 'system-ui, sans-serif' }}>
      <LanguageSelector lang={lang} setLang={setLang} />

      {showConfirmPayment && <ConfirmPaymentOverlay t={t} onConfirm={confirmPayment} onCancel={() => { setShowConfirmPayment(false); setPendingReservation(null); }} />}
      {showSuccess && lastReservation && <SuccessOverlay t={t} data={lastReservation} onClose={() => setShowSuccess(false)} />}

      <div className="max-w-4xl mx-auto pt-12">
        <div className="text-center mb-8">
          <h1 className="font-bold mb-2 text-white" style={{ fontSize: '44px', textShadow: '0 0 30px rgba(217, 28, 210, 0.4)' }} data-testid="app-title">{t('appTitle')}</h1>
          <p className="concept-glow max-w-2xl mx-auto text-white opacity-80" style={{ fontSize: '15px' }}>{concept.description || t('conceptDefault')}</p>
        </div>

        {/* Hero Media - YouTube, Vimeo, Image, Video - Only show if URL is valid */}
        {concept.heroImageUrl && concept.heroImageUrl.trim() !== '' && (
          <MediaDisplay url={concept.heroImageUrl} className="hero-media-container mb-8" />
        )}

        <div className="mb-8">
          <h2 className="font-semibold mb-4 text-white" style={{ fontSize: '18px' }}>{t('chooseSession')}</h2>
          <div className="space-y-4">
            {courses.map(course => (
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
        </div>

        {selectedCourse && selectedDate && (
          <div className="mb-8">
            <h2 className="font-semibold mb-4 text-white" style={{ fontSize: '18px' }}>{t('chooseOffer')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {visibleOffers.map(offer => (
                <OfferCard key={offer.id} offer={offer} selected={selectedOffer?.id === offer.id} onClick={() => setSelectedOffer(offer)} />
              ))}
            </div>
          </div>
        )}

        {selectedOffer && (
          <form onSubmit={handleSubmit}>
            <div className="form-section rounded-xl p-6 mb-6">
              <h2 className="font-semibold mb-4 text-white" style={{ fontSize: '18px' }}>{t('yourInfo')}</h2>
              <div className="space-y-4">
                {/* Private input fields - no email list exposed */}
                <input type="text" required placeholder={t('fullName')} value={userName} onChange={e => setUserName(e.target.value)} className="w-full p-3 rounded-lg neon-input" data-testid="user-name-input" autoComplete="name" />
                <input type="email" required placeholder={t('emailRequired')} value={userEmail} onChange={e => setUserEmail(e.target.value)} className="w-full p-3 rounded-lg neon-input" data-testid="user-email-input" autoComplete="email" />
                <input type="tel" required placeholder={t('whatsappRequired')} value={userWhatsapp} onChange={e => setUserWhatsapp(e.target.value)} className="w-full p-3 rounded-lg neon-input" data-testid="user-whatsapp-input" autoComplete="tel" />
                
                {/* Promo code input */}
                <div>
                  <input type="text" placeholder={t('promoCode')} value={discountCode} onChange={e => setDiscountCode(e.target.value)}
                    className={`w-full p-3 rounded-lg ${appliedDiscount ? 'valid-code' : 'neon-input'}`} data-testid="discount-code-input" autoComplete="off" />
                </div>
                
                {/* Validation message - error in red, success handled in discount display */}
                {validationMessage && !appliedDiscount && (
                  <p className="text-red-400 text-sm font-medium" data-testid="validation-message">{validationMessage}</p>
                )}
                
                {/* Price summary with discount */}
                <div className="p-4 rounded-lg card-gradient">
                  {appliedDiscount && (
                    <p className="text-green-400 text-sm mb-2 font-medium" data-testid="discount-applied">
                      ✅ Code appliqué ! {t('discount')}: {appliedDiscount.type === 'CHF' ? `-${appliedDiscount.value} CHF` : appliedDiscount.type === '100%' ? '100% (Gratuit)' : `-${appliedDiscount.value}%`}
                    </p>
                  )}
                  <p className="font-bold text-white text-lg" data-testid="total-price">
                    {t('total')}: <span style={{ color: appliedDiscount ? '#4ade80' : '#d91cd2' }}>CHF {totalPrice}</span>
                  </p>
                </div>
                
                <label className="flex items-start gap-2 cursor-pointer text-xs text-white opacity-70">
                  <input type="checkbox" required checked={hasAcceptedTerms} onChange={e => setHasAcceptedTerms(e.target.checked)} data-testid="terms-checkbox" />
                  <span>{t('acceptTerms')}</span>
                </label>
              </div>
            </div>
            <button type="submit" disabled={!hasAcceptedTerms || loading} className="btn-primary w-full py-4 rounded-xl font-bold uppercase tracking-wide" data-testid="submit-reservation-btn">
              {loading ? t('loading') : isFree ? t('reserveFree') : t('payAndReserve')}
            </button>
          </form>
        )}

        <footer className="mt-12 mb-8 text-center" style={{ opacity: 0.3 }}>
          <span onClick={handleCopyrightClick} className="copyright-secret text-white text-xs" data-testid="copyright-secret">{t('copyright')}</span>
        </footer>
      </div>
    </div>
  );
}

export default App;
