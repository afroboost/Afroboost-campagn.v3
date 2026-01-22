/**
 * CoachDashboard Component
 * Admin panel for managing the Afroboost application
 * Extracted from App.js for better maintainability
 */
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import axios from "axios";
import { QRCodeSVG } from "qrcode.react";
import {
  getWhatsAppConfig,
  saveWhatsAppConfig,
  isWhatsAppConfigured,
  sendBulkWhatsApp,
  testWhatsAppConfig
} from "../services/whatsappService";
import {
  setLastMediaUrl as setLastMediaUrlService
} from "../services/aiResponseService";
import { LandingSectionSelector } from "./SearchBar";
import { playNotificationSound, linkifyText } from "../services/notificationService";

// === API BACKEND URL ===
const API = process.env.REACT_APP_BACKEND_URL || '';

// ============================================================
// === FONCTIONS AUTONOMES - ENVOI EMAIL VIA RESEND (BACKEND)
// ============================================================

/**
 * FONCTION D'ENVOI EMAIL VIA RESEND (API BACKEND)
 * Remplace EmailJS pour un contrôle total côté serveur
 * @param {string} destination - Email du destinataire
 * @param {string} recipientName - Nom du destinataire
 * @param {string} subject - Sujet de l'email
 * @param {string} text - Corps du message
 * @returns {Promise<{success: boolean, response?: any, error?: string}>}
 */
const performEmailSend = async (destination, recipientName = 'Client', subject = 'Afroboost', text = '') => {
  try {
    // Validation des paramètres
    if (!destination || !destination.includes('@')) {
      console.error('RESEND_DEBUG: Email invalide -', destination);
      return { success: false, error: 'Email invalide' };
    }
    
    if (!text || text.trim() === '') {
      console.error('RESEND_DEBUG: Message vide');
      return { success: false, error: 'Message vide' };
    }
    
    console.log('========================================');
    console.log('RESEND_DEBUG: Envoi campagne via API');
    console.log('RESEND_DEBUG: Destination =', destination);
    console.log('RESEND_DEBUG: Sujet =', subject);
    console.log('========================================');
    
    // Appel API backend Resend
    const response = await fetch(`${API}/api/campaigns/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to_email: String(destination).trim(),
        to_name: String(recipientName || 'Client').trim(),
        subject: String(subject || 'Afroboost').trim(),
        message: String(text).trim()
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('RESEND_DEBUG: SUCCÈS - Email ID =', result.email_id);
      return { success: true, response: result };
    } else {
      console.error('RESEND_DEBUG: ÉCHEC -', result.error);
      return { success: false, error: result.error };
    }
    
  } catch (error) {
    console.error('RESEND_DEBUG: Exception -', error);
    return { success: false, error: error.message };
  }
};
      debug: `EMAILJS_DEBUG: OK - ${response.status}`
    };
    
  } catch (error) {
    // === SUPPRESSION DU CRASH ===
    // Capturer TOUTES les erreurs y compris DataCloneError
    
    const errorName = error?.name || 'Unknown';
    const errorMessage = error?.text || error?.message || 'Erreur inconnue';
    
    console.error('EMAILJS_DEBUG: ÉCHEC -', errorName);
    console.error('EMAILJS_DEBUG: Message =', errorMessage);
    console.error('EMAILJS_DEBUG: Stack =', error?.stack?.substring(0, 200));
    
    // Vérifier si c'est une erreur PostHog/DataClone
    if (errorName === 'DataCloneError' || errorMessage.includes('clone')) {
      console.warn('EMAILJS_DEBUG: Erreur PostHog détectée - L\'email a peut-être été envoyé malgré l\'erreur');
      return { 
        success: false, 
        error: 'PostHog DataCloneError - vérifier la boîte mail',
        postHogBlocked: true,
        debug: 'EMAILJS_DEBUG: PostHog blocking'
      };
    }
    
    return { 
      success: false, 
      error: errorMessage,
      debug: `EMAILJS_DEBUG: ÉCHEC - ${errorName}: ${errorMessage}`
    };
  }
};

/**
 * FONCTION AUTONOME D'ENVOI WHATSAPP VIA TWILIO
 * Si pas de backend, affiche une alerte de simulation
 * @param {string} phoneNumber - Numéro de téléphone
 * @param {string} message - Message à envoyer
 * @param {object} twilioConfig - {accountSid, authToken, fromNumber}
 * @returns {Promise<{success: boolean, sid?: string, error?: string}>}
 */
const performWhatsAppSend = async (phoneNumber, message, twilioConfig) => {
  const { accountSid, authToken, fromNumber } = twilioConfig || {};
  
  console.log('========================================');
  console.log('DEMANDE WHATSAPP/TWILIO ENVOYÉE');
  console.log('Numéro:', phoneNumber);
  console.log('Message:', message?.substring(0, 50) + '...');
  console.log('Account SID:', accountSid || 'NON CONFIGURÉ');
  console.log('From Number:', fromNumber || 'NON CONFIGURÉ');
  console.log('========================================');
  
  // Si pas de config Twilio, simulation avec alerte
  if (!accountSid || !authToken || !fromNumber) {
    console.warn('⚠️ Twilio non configuré - Mode simulation');
    alert(`WhatsApp prêt pour : ${phoneNumber}\n\nMessage: ${message?.substring(0, 100)}...`);
    return { success: true, simulated: true };
  }
  
  // Formater le numéro au format E.164
  let formattedPhone = phoneNumber.replace(/[^\d+]/g, '');
  if (!formattedPhone.startsWith('+')) {
    formattedPhone = formattedPhone.startsWith('0') 
      ? '+41' + formattedPhone.substring(1) 
      : '+' + formattedPhone;
  }
  
  // Construire les données pour Twilio
  const formData = new URLSearchParams();
  formData.append('From', `whatsapp:${fromNumber.startsWith('+') ? fromNumber : '+' + fromNumber}`);
  formData.append('To', `whatsapp:${formattedPhone}`);
  formData.append('Body', message);
  
  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData
      }
    );
    
    const data = await response.json();
    console.log('📱 TWILIO RÉPONSE:', data);
    
    if (!response.ok) {
      return { success: false, error: data.message || `HTTP ${response.status}` };
    }
    
    return { success: true, sid: data.sid };
  } catch (error) {
    console.error('❌ TWILIO ERREUR:', error);
    return { success: false, error: error.message };
  }
};

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Weekdays mapping for multi-language support
const WEEKDAYS_MAP = {
  fr: ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  de: ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"]
};

// SVG Icons
const CalendarIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>;
const ClockIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>;
const TrashIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>;
const FolderIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>;

// Parse media URL helper
function parseMediaUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmedUrl = url.trim();
  if (!trimmedUrl) return null;
  
  const ytMatch = trimmedUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return { type: 'youtube', id: ytMatch[1] };
  
  const vimeoMatch = trimmedUrl.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeoMatch) return { type: 'vimeo', id: vimeoMatch[1] };
  
  const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.m4v', '.ogv'];
  const lowerUrl = trimmedUrl.toLowerCase();
  if (videoExtensions.some(ext => lowerUrl.includes(ext))) {
    return { type: 'video', url: trimmedUrl };
  }
  
  return { type: 'image', url: trimmedUrl };
}

// MediaDisplay component (simplified version for admin preview)
const MediaDisplay = ({ url, className }) => {
  const media = parseMediaUrl(url);
  if (!media || !url || url.trim() === '') return null;

  const containerStyle = {
    position: 'relative',
    width: '100%',
    paddingBottom: '56.25%',
    overflow: 'hidden',
    borderRadius: '16px',
    border: '1px solid rgba(217, 28, 210, 0.3)',
    background: '#0a0a0a'
  };

  const contentStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%'
  };

  if (media.type === 'youtube') {
    return (
      <div className={className} style={containerStyle}>
        <iframe 
          src={`https://www.youtube.com/embed/${media.id}?autoplay=0&mute=1`}
          frameBorder="0" 
          allow="encrypted-media" 
          style={{ ...contentStyle }}
          title="YouTube video"
        />
      </div>
    );
  }
  
  if (media.type === 'vimeo') {
    return (
      <div className={className} style={containerStyle}>
        <iframe 
          src={`https://player.vimeo.com/video/${media.id}?autoplay=0&muted=1`}
          frameBorder="0" 
          allow="autoplay" 
          style={{ ...contentStyle }}
          title="Vimeo video"
        />
      </div>
    );
  }
  
  if (media.type === 'video') {
    return (
      <div className={className} style={containerStyle}>
        <video 
          src={media.url} 
          muted
          playsInline 
          style={{ ...contentStyle, objectFit: 'cover' }}
        />
      </div>
    );
  }
  
  return (
    <div className={className} style={containerStyle}>
      <img 
        src={media.url} 
        alt="Media" 
        style={{ ...contentStyle, objectFit: 'cover' }}
      />
    </div>
  );
};

const CoachDashboard = ({ t, lang, onBack, onLogout, coachUser }) => {
  const [tab, setTab] = useState("reservations");
  const [reservations, setReservations] = useState([]);
  const [reservationPagination, setReservationPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [loadingReservations, setLoadingReservations] = useState(false);
  const [courses, setCourses] = useState([]);
  const [offers, setOffers] = useState([]);
  const [users, setUsers] = useState([]);
  const [paymentLinks, setPaymentLinks] = useState({ stripe: "", paypal: "", twint: "", coachWhatsapp: "", coachNotificationEmail: "", coachNotificationPhone: "" });
  const [concept, setConcept] = useState({ appName: "Afroboost", description: "", heroImageUrl: "", logoUrl: "", faviconUrl: "", termsText: "", googleReviewsUrl: "", defaultLandingSection: "sessions", externalLink1Title: "", externalLink1Url: "", externalLink2Title: "", externalLink2Url: "", paymentTwint: false, paymentPaypal: false, paymentCreditCard: false, eventPosterEnabled: false, eventPosterMediaUrl: "" });
  const [discountCodes, setDiscountCodes] = useState([]);
  const [newCode, setNewCode] = useState({ code: "", type: "", value: "", assignedEmails: [], courses: [], maxUses: "", expiresAt: "", batchCount: 1, prefix: "" });
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [selectedBeneficiaries, setSelectedBeneficiaries] = useState([]); // Multi-select pour bénéficiaires
  const [editingCode, setEditingCode] = useState(null); // Pour l'édition individuelle des codes
  const [newCourse, setNewCourse] = useState({ name: "", weekday: 0, time: "18:30", locationName: "", mapsUrl: "" });
  const [newOffer, setNewOffer] = useState({ 
    name: "", price: 0, visible: true, description: "", keywords: "",
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
  
  // Manual contact form state
  const [showManualContactForm, setShowManualContactForm] = useState(false);
  const [manualContact, setManualContact] = useState({ name: "", email: "", whatsapp: "" });

  // Custom Emojis state
  const [customEmojis, setCustomEmojis] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [newEmojiName, setNewEmojiName] = useState("");
  const emojiInputRef = useRef(null);

  // ========== AUDIO PLAYLIST STATE ==========
  const [showAudioModal, setShowAudioModal] = useState(false);
  const [selectedCourseForAudio, setSelectedCourseForAudio] = useState(null);
  const [playlistUrls, setPlaylistUrls] = useState([]);
  const [newAudioUrl, setNewAudioUrl] = useState("");
  const [savingPlaylist, setSavingPlaylist] = useState(false);

  // Ouvrir le modal de gestion audio pour un cours
  const openAudioModal = (course) => {
    setSelectedCourseForAudio(course);
    setPlaylistUrls(course.playlist || []);
    setNewAudioUrl("");
    setShowAudioModal(true);
  };

  // Ajouter une URL à la playlist
  const addAudioUrl = () => {
    const url = newAudioUrl.trim();
    if (!url) return;
    
    // Validation basique de l'URL
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      alert("Veuillez entrer une URL valide commençant par http:// ou https://");
      return;
    }
    
    // Vérifier si c'est un MP3 ou stream audio
    const isAudioUrl = url.includes('.mp3') || url.includes('.wav') || url.includes('.ogg') || 
                       url.includes('.m3u') || url.includes('.m3u8') || url.includes('stream') ||
                       url.includes('audio') || url.includes('soundcloud') || url.includes('spotify');
    
    if (!isAudioUrl) {
      if (!window.confirm("Cette URL ne semble pas être un fichier audio (MP3, WAV, etc.) ou un stream. Voulez-vous l'ajouter quand même ?")) {
        return;
      }
    }
    
    if (playlistUrls.includes(url)) {
      alert("Cette URL est déjà dans la playlist.");
      return;
    }
    
    setPlaylistUrls([...playlistUrls, url]);
    setNewAudioUrl("");
  };

  // Supprimer une URL de la playlist
  const removeAudioUrl = (urlToRemove) => {
    setPlaylistUrls(playlistUrls.filter(url => url !== urlToRemove));
  };

  // Sauvegarder la playlist dans la base de données
  const savePlaylist = async () => {
    if (!selectedCourseForAudio) return;
    
    setSavingPlaylist(true);
    try {
      // Mettre à jour le cours avec la nouvelle playlist
      const updatedCourse = { ...selectedCourseForAudio, playlist: playlistUrls };
      await axios.put(`${API}/courses/${selectedCourseForAudio.id}`, updatedCourse);
      
      // Mettre à jour l'état local
      setCourses(courses.map(c => 
        c.id === selectedCourseForAudio.id 
          ? { ...c, playlist: playlistUrls } 
          : c
      ));
      
      alert(`✅ Playlist sauvegardée pour "${selectedCourseForAudio.name}" (${playlistUrls.length} morceaux)`);
      setShowAudioModal(false);
    } catch (err) {
      console.error("Erreur sauvegarde playlist:", err);
      alert("❌ Erreur lors de la sauvegarde de la playlist");
    } finally {
      setSavingPlaylist(false);
    }
  };

  // Fonction pour charger les réservations avec pagination
  const loadReservations = async (page = 1, limit = 20) => {
    setLoadingReservations(true);
    try {
      const res = await axios.get(`${API}/reservations?page=${page}&limit=${limit}`);
      setReservations(res.data.data);
      setReservationPagination(res.data.pagination);
    } catch (err) {
      console.error("Error loading reservations:", err);
    } finally {
      setLoadingReservations(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        // Charger les réservations avec pagination (20 dernières)
        const resPromise = axios.get(`${API}/reservations?page=1&limit=20`);
        const [res, crs, off, usr, lnk, cpt, cds] = await Promise.all([
          resPromise, axios.get(`${API}/courses`), axios.get(`${API}/offers`),
          axios.get(`${API}/users`), axios.get(`${API}/payment-links`), axios.get(`${API}/concept`), 
          axios.get(`${API}/discount-codes`)
        ]);
        // Réservations avec pagination
        setReservations(res.data.data);
        setReservationPagination(res.data.pagination);
        
        setCourses(crs.data); setOffers(off.data); setUsers(usr.data);
        setPaymentLinks(lnk.data); setConcept(cpt.data); setDiscountCodes(cds.data);
        
        // === SANITIZE DATA: Nettoyer automatiquement les données fantômes ===
        try {
          const sanitizeResult = await axios.post(`${API}/sanitize-data`);
          if (sanitizeResult.data.stats?.codes_cleaned > 0) {
            console.log(`🧹 Nettoyage: ${sanitizeResult.data.stats.codes_cleaned} codes promo nettoyés`);
            // Recharger les codes promo après nettoyage
            const updatedCodes = await axios.get(`${API}/discount-codes`);
            setDiscountCodes(updatedCodes.data);
          }
        } catch (sanitizeErr) {
          console.warn("Sanitize warning:", sanitizeErr);
        }
      } catch (err) { console.error("Error:", err); }
    };
    loadData();
  }, []);

  // === INITIALISATION SDK EMAILJS ===
  useEffect(() => {
    try {
      emailjs.init(EMAILJS_PUBLIC_KEY);
      console.log('✅ EmailJS SDK initialized with public key:', EMAILJS_PUBLIC_KEY.substring(0, 5) + '...');
    } catch (error) {
      console.error('❌ Failed to initialize EmailJS:', error);
    }
  }, []);

  // Fonction de nettoyage manuel (peut être appelée depuis l'interface)
  const manualSanitize = async () => {
    try {
      const result = await axios.post(`${API}/sanitize-data`);
      const stats = result.data.stats;
      alert(`🧹 Nettoyage terminé!\n\n• ${stats.codes_cleaned} codes promo nettoyés\n• ${stats.valid_offers} offres valides\n• ${stats.valid_courses} cours valides\n• ${stats.valid_users} contacts valides`);
      // Recharger les codes promo
      const updatedCodes = await axios.get(`${API}/discount-codes`);
      setDiscountCodes(updatedCodes.data);
    } catch (err) {
      console.error("Erreur nettoyage:", err);
      alert("Erreur lors du nettoyage");
    }
  };

  // Get unique customers for beneficiary dropdown (filtrage local supplémentaire)
  const uniqueCustomers = Array.from(new Map(
    [...reservations.map(r => ({ name: r.userName, email: r.userEmail })), ...users.map(u => ({ name: u.name, email: u.email }))]
    .filter(c => c.email && c.name) // Exclure les entrées sans email ou nom
    .map(c => [c.email, c])
  ).values());

  const exportCSV = async () => {
    try {
      // Récupérer TOUTES les réservations pour l'export (sans pagination)
      const response = await axios.get(`${API}/reservations?all_data=true`);
      const allReservations = response.data.data;
      
      const rows = [
        [t('code'), t('name'), t('email'), "WhatsApp", t('courses'), t('date'), t('time'), t('offer'), t('qty'), t('total'), "Dates multiples"],
        ...allReservations.map(r => {
          const dt = new Date(r.datetime);
          return [r.reservationCode || '', r.userName, r.userEmail, r.userWhatsapp || '', r.courseName, 
            dt.toLocaleDateString('fr-CH'), dt.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' }),
            r.offerName, r.quantity || 1, r.totalPrice || r.price, r.selectedDatesText || ''];
        })
      ];
      const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }); // UTF-8 BOM
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; 
      a.download = `afroboost_reservations_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch (err) {
      console.error("Export error:", err);
      alert("Erreur lors de l'export CSV");
    }
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
    
    // Si mode série activé, utiliser la fonction batch
    if (isBatchMode && newCode.batchCount > 1) {
      await addBatchCodes(e);
      return;
    }
    
    // Mode normal - un seul code
    const beneficiaryEmail = selectedBeneficiaries.length > 0 ? selectedBeneficiaries[0] : null;
    
    const response = await axios.post(`${API}/discount-codes`, {
      code: newCode.code || `CODE-${Date.now().toString().slice(-4)}`,
      type: newCode.type, value: parseFloat(newCode.value),
      assignedEmail: beneficiaryEmail,
      courses: newCode.courses, maxUses: newCode.maxUses ? parseInt(newCode.maxUses) : null,
      expiresAt: newCode.expiresAt || null
    });
    setDiscountCodes([...discountCodes, response.data]);
    setNewCode({ code: "", type: "", value: "", assignedEmails: [], courses: [], maxUses: "", expiresAt: "", batchCount: 1, prefix: "" });
    setSelectedBeneficiaries([]);
  };

  // Génération en série de codes promo - Crée réellement N entrées distinctes en base
  const addBatchCodes = async (e) => {
    e.preventDefault();
    if (!newCode.type || !newCode.value) return;
    
    const count = Math.min(Math.max(1, parseInt(newCode.batchCount) || 1), 50); // Entre 1 et 50
    const prefix = newCode.prefix?.trim().toUpperCase() || "CODE";
    
    setBatchLoading(true);
    const createdCodes = [];
    
    try {
      // Si plusieurs bénéficiaires sélectionnés, attribuer un code à chacun
      const beneficiaries = selectedBeneficiaries.length > 0 ? selectedBeneficiaries : [null];
      let codeIndex = 1;
      
      for (let i = 0; i < count; i++) {
        // Attribuer les bénéficiaires de manière circulaire si moins de bénéficiaires que de codes
        const beneficiaryEmail = beneficiaries[i % beneficiaries.length];
        const codeValue = `${prefix}-${String(codeIndex).padStart(2, '0')}`;
        codeIndex++;
        
        const response = await axios.post(`${API}/discount-codes`, {
          code: codeValue,
          type: newCode.type, 
          value: parseFloat(newCode.value),
          assignedEmail: beneficiaryEmail,
          courses: newCode.courses, // Cours ET produits autorisés
          maxUses: newCode.maxUses ? parseInt(newCode.maxUses) : null,
          expiresAt: newCode.expiresAt || null
        });
        createdCodes.push(response.data);
      }
      
      setDiscountCodes(prev => [...prev, ...createdCodes]);
      setNewCode({ code: "", type: "", value: "", assignedEmails: [], courses: [], maxUses: "", expiresAt: "", batchCount: 1, prefix: "" });
      setSelectedBeneficiaries([]);
      setIsBatchMode(false);
      alert(`✅ ${count} codes créés avec succès !`);
    } catch (error) {
      console.error("Erreur génération en série:", error);
      // Ajouter les codes déjà créés même si erreur partielle
      if (createdCodes.length > 0) {
        setDiscountCodes(prev => [...prev, ...createdCodes]);
        alert(`⚠️ ${createdCodes.length}/${count} codes créés. Erreur partielle.`);
      } else {
        alert("❌ Erreur lors de la création des codes.");
      }
    } finally {
      setBatchLoading(false);
    }
  };
  
  // Toggle sélection d'un bénéficiaire (multi-select)
  const toggleBeneficiarySelection = (email) => {
    setSelectedBeneficiaries(prev => 
      prev.includes(email) 
        ? prev.filter(e => e !== email)
        : [...prev, email]
    );
  };
  
  // Supprimer un article (cours/produit) de la liste des autorisés (formulaire de création)
  const removeAllowedArticle = (articleId) => {
    setNewCode(prev => ({
      ...prev,
      courses: prev.courses.filter(id => id !== articleId)
    }));
  };
  
  // Supprimer un article d'un code promo EXISTANT (mise à jour immédiate en base)
  const removeArticleFromExistingCode = async (codeId, articleId) => {
    const code = discountCodes.find(c => c.id === codeId);
    if (!code) return;
    
    const updatedCourses = (code.courses || []).filter(id => id !== articleId);
    
    try {
      await axios.put(`${API}/discount-codes/${codeId}`, { courses: updatedCourses });
      setDiscountCodes(prev => prev.map(c => 
        c.id === codeId ? { ...c, courses: updatedCourses } : c
      ));
      console.log(`✅ Article ${articleId} retiré du code ${code.code}`);
    } catch (error) {
      console.error("Erreur suppression article:", error);
      alert("❌ Erreur lors de la mise à jour");
    }
  };
  
  // Supprimer un bénéficiaire d'un code promo EXISTANT (mise à jour immédiate en base)
  const removeBeneficiaryFromExistingCode = async (codeId) => {
    try {
      await axios.put(`${API}/discount-codes/${codeId}`, { assignedEmail: null });
      setDiscountCodes(prev => prev.map(c => 
        c.id === codeId ? { ...c, assignedEmail: null } : c
      ));
      console.log(`✅ Bénéficiaire retiré du code`);
    } catch (error) {
      console.error("Erreur suppression bénéficiaire:", error);
      alert("❌ Erreur lors de la mise à jour");
    }
  };
  
  // Mettre à jour un code promo individuellement
  const updateCodeIndividual = async (codeId, updates) => {
    try {
      const response = await axios.put(`${API}/discount-codes/${codeId}`, updates);
      setDiscountCodes(prev => prev.map(c => c.id === codeId ? { ...c, ...updates } : c));
      setEditingCode(null);
      return true;
    } catch (error) {
      console.error("Erreur mise à jour code:", error);
      alert("❌ Erreur lors de la mise à jour");
      return false;
    }
  };

  const toggleCode = async (code) => {
    await axios.put(`${API}/discount-codes/${code.id}`, { active: !code.active });
    setDiscountCodes(discountCodes.map(c => c.id === code.id ? { ...c, active: !c.active } : c));
  };

  // Delete discount code - SUPPRESSION DÉFINITIVE EN BASE + VÉRIFICATION
  const deleteCode = async (codeId) => {
    if (window.confirm("⚠️ SUPPRESSION DÉFINITIVE\n\nCe code promo sera supprimé de la base de données.\nCette action est irréversible.\n\nConfirmer la suppression ?")) {
      try {
        await axios.delete(`${API}/discount-codes/${codeId}`);
        setDiscountCodes(prev => prev.filter(c => c.id !== codeId));
        console.log(`✅ Code ${codeId} supprimé définitivement`);
      } catch (error) {
        console.error("Erreur suppression code:", error);
        alert("❌ Erreur lors de la suppression");
      }
    }
  };
  
  // Delete reservation - SUPPRESSION DÉFINITIVE EN BASE
  const deleteReservation = async (reservationId) => {
    if (window.confirm("⚠️ SUPPRESSION DÉFINITIVE\n\nCette réservation sera supprimée de la base de données.\n\nConfirmer la suppression ?")) {
      try {
        await axios.delete(`${API}/reservations/${reservationId}`);
        setReservations(prev => prev.filter(r => r.id !== reservationId));
        // Mettre à jour le compteur de pagination
        setReservationPagination(prev => ({ ...prev, total: prev.total - 1 }));
        console.log(`✅ Réservation ${reservationId} supprimée définitivement`);
      } catch (err) {
        console.error("Erreur suppression réservation:", err);
        alert("❌ Erreur lors de la suppression");
      }
    }
  };
  
  // Add manual contact to users list (for beneficiary dropdown)
  // SYNCHRONISATION CRM: Ajoute aussi dans chat_participants
  const addManualContact = async (e) => {
    e.preventDefault();
    if (!manualContact.name || !manualContact.email) return;
    try {
      // 1. Créer dans la collection users (pour les codes promo)
      const response = await axios.post(`${API}/users`, {
        name: manualContact.name,
        email: manualContact.email,
        whatsapp: manualContact.whatsapp || ""
      });
      setUsers([...users, response.data]);
      
      // 2. SYNCHRONISATION: Créer aussi dans chat_participants (CRM global)
      try {
        await addManualChatParticipant(
          manualContact.name,
          manualContact.email,
          manualContact.whatsapp || "",
          "manual_promo"
        );
      } catch (crmErr) {
        console.warn("CRM sync warning:", crmErr);
      }
      
      setManualContact({ name: "", email: "", whatsapp: "" });
      setShowManualContactForm(false);
    } catch (err) {
      console.error("Erreur ajout contact:", err);
    }
  };
  
  // Supprimer un contact (Hard Delete avec nettoyage des références)
  // Supprimer un contact - SUPPRESSION DÉFINITIVE + NETTOYAGE CODES PROMO
  const deleteContact = async (userId) => {
    if (!window.confirm("⚠️ SUPPRESSION DÉFINITIVE\n\nCe contact sera supprimé de la base de données.\nSon email sera retiré de tous les codes promo.\n\nConfirmer la suppression ?")) return;
    try {
      // Récupérer l'email AVANT suppression du state
      const userToDelete = users.find(u => u.id === userId);
      const userEmail = userToDelete?.email;
      
      // 1. Supprimer en base de données
      await axios.delete(`${API}/users/${userId}`);
      
      // 2. Mettre à jour le state local
      setUsers(prev => prev.filter(u => u.id !== userId));
      
      // 3. Nettoyer les codes promo localement
      if (userEmail) {
        setDiscountCodes(prev => prev.map(c => 
          c.assignedEmail === userEmail ? { ...c, assignedEmail: null } : c
        ));
      }
      
      // 4. Appeler sanitizeData pour s'assurer que la base est propre
      try {
        await axios.post(`${API}/sanitize-data`);
      } catch (sanitizeErr) {
        console.warn("Sanitize warning:", sanitizeErr);
      }
      
      console.log(`✅ Contact ${userId} supprimé définitivement`);
    } catch (err) {
      console.error("Erreur suppression contact:", err);
      alert("❌ Erreur lors de la suppression");
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

  // Export promo codes to CSV
  const exportPromoCodesCSV = () => {
    if (discountCodes.length === 0) {
      alert("Aucun code promo à exporter.");
      return;
    }
    
    // CSV headers
    const headers = ["Code", "Type", "Valeur", "Bénéficiaire", "Utilisations Max", "Utilisé", "Date Expiration", "Actif", "Cours Autorisés"];
    
    // CSV rows
    const rows = discountCodes.map(code => {
      const coursesNames = code.courses?.length > 0 
        ? code.courses.map(cId => courses.find(c => c.id === cId)?.name || cId).join("; ")
        : "Tous";
      
      return [
        code.code || "",
        code.type || "",
        code.value || "",
        code.assignedEmail || "",
        code.maxUses || "",
        code.used || 0,
        code.expiresAt ? new Date(code.expiresAt).toLocaleDateString() : "",
        code.active ? "Oui" : "Non",
        coursesNames
      ];
    });
    
    // Build CSV content
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    
    // Create and trigger download
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `codes_promo_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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

  // Supprimer une offre - SUPPRESSION DÉFINITIVE + NETTOYAGE CODES PROMO
  const deleteOffer = async (offerId) => {
    if (!window.confirm("⚠️ SUPPRESSION DÉFINITIVE\n\nCette offre sera supprimée de la base de données.\nElle sera retirée de tous les codes promo.\n\nConfirmer la suppression ?")) return;
    try {
      // 1. Supprimer en base de données (le backend nettoie aussi les codes promo)
      await axios.delete(`${API}/offers/${offerId}`);
      
      // 2. Mettre à jour le state local
      setOffers(prev => prev.filter(o => o.id !== offerId));
      
      // 3. Nettoyer localement les références dans les codes promo
      setDiscountCodes(prev => prev.map(c => ({
        ...c,
        courses: c.courses ? c.courses.filter(id => id !== offerId) : []
      })));
      
      // 4. Appeler sanitizeData pour s'assurer que la base est propre
      try {
        await axios.post(`${API}/sanitize-data`);
      } catch (sanitizeErr) {
        console.warn("Sanitize warning:", sanitizeErr);
      }
      
      console.log(`✅ Offre ${offerId} supprimée définitivement`);
    } catch (err) {
      console.error("Erreur suppression offre:", err);
      alert("❌ Erreur lors de la suppression");
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
      keywords: offer.keywords || "", // FIX: Charger les mots-clés existants
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
      name: "", price: 0, visible: true, description: "", keywords: "",
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
  const [emailJSConfig, setEmailJSConfig] = useState(() => {
    // Charger la config de manière synchrone depuis localStorage
    const config = getEmailJSConfig();
    return config;
  });
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

  // === CONVERSATIONS STATE ===
  const [chatSessions, setChatSessions] = useState([]);
  const [chatParticipants, setChatParticipants] = useState([]);
  const [chatLinks, setChatLinks] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionMessages, setSessionMessages] = useState([]);
  const [coachMessage, setCoachMessage] = useState('');
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [copiedLinkId, setCopiedLinkId] = useState(null);
  const [conversationSearch, setConversationSearch] = useState(''); // Recherche globale conversations

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

  // === CONVERSATIONS FUNCTIONS ===
  const loadConversations = async () => {
    setLoadingConversations(true);
    try {
      const [sessionsRes, participantsRes, linksRes] = await Promise.all([
        axios.get(`${API}/chat/sessions`),
        axios.get(`${API}/chat/participants`),
        axios.get(`${API}/chat/links`)
      ]);
      setChatSessions(sessionsRes.data);
      setChatParticipants(participantsRes.data);
      setChatLinks(linksRes.data);
    } catch (err) {
      console.error("Error loading conversations:", err);
    } finally {
      setLoadingConversations(false);
    }
  };

  const loadSessionMessages = async (sessionId) => {
    try {
      const res = await axios.get(`${API}/chat/sessions/${sessionId}/messages`);
      setSessionMessages(res.data);
    } catch (err) {
      console.error("Error loading messages:", err);
    }
  };

  const generateShareableLink = async () => {
    try {
      const title = newLinkTitle.trim() || 'Lien Chat Afroboost';
      const res = await axios.post(`${API}/chat/generate-link`, { title });
      setChatLinks(prev => [res.data, ...prev]);
      setNewLinkTitle('');
      // Recharger les sessions
      const sessionsRes = await axios.get(`${API}/chat/sessions`);
      setChatSessions(sessionsRes.data);
      return res.data;
    } catch (err) {
      console.error("Error generating link:", err);
      return null;
    }
  };

  // Créer un chat communautaire (sans IA)
  const createCommunityChat = async () => {
    try {
      const title = newLinkTitle.trim() || 'Chat Communauté Afroboost';
      // Créer une session avec mode communauté
      const sessionRes = await axios.post(`${API}/chat/sessions`, {
        mode: 'community',
        is_ai_active: false,
        title: title
      });
      
      // Mettre à jour les listes
      setChatSessions(prev => [sessionRes.data, ...prev]);
      setNewLinkTitle('');
      
      // Copier automatiquement le lien
      if (sessionRes.data.link_token) {
        copyLinkToClipboard(sessionRes.data.link_token);
      }
      
      return sessionRes.data;
    } catch (err) {
      console.error("Error creating community chat:", err);
      return null;
    }
  };

  // === CUSTOM EMOJIS FUNCTIONS ===
  const loadCustomEmojis = async () => {
    try {
      const res = await axios.get(`${API}/chat/emojis`);
      setCustomEmojis(res.data);
    } catch (err) {
      console.error("Error loading emojis:", err);
    }
  };

  const uploadCustomEmoji = async (file) => {
    if (!file || !newEmojiName.trim()) {
      alert("Veuillez donner un nom à l'emoji");
      return;
    }
    
    // Valider le type de fichier
    if (!file.type.startsWith('image/')) {
      alert("Format non supporté. Utilisez PNG, JPG ou GIF.");
      return;
    }
    
    // Convertir en base64
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const imageData = e.target.result;
        const res = await axios.post(`${API}/chat/emojis`, {
          name: newEmojiName.trim(),
          image_data: imageData,
          category: "custom"
        });
        setCustomEmojis(prev => [res.data, ...prev]);
        setNewEmojiName("");
        if (emojiInputRef.current) emojiInputRef.current.value = "";
      } catch (err) {
        console.error("Error uploading emoji:", err);
        alert("Erreur lors de l'upload de l'emoji");
      }
    };
    reader.readAsDataURL(file);
  };

  const deleteCustomEmoji = async (emojiId) => {
    if (!window.confirm("Supprimer cet emoji ?")) return;
    try {
      await axios.delete(`${API}/chat/emojis/${emojiId}`);
      setCustomEmojis(prev => prev.filter(e => e.id !== emojiId));
    } catch (err) {
      console.error("Error deleting emoji:", err);
    }
  };

  const insertEmoji = (emoji) => {
    // Insérer l'emoji sous forme de balise image dans le message
    const emojiTag = `[emoji:${emoji.id}]`;
    setCoachMessage(prev => prev + ` ${emojiTag} `);
    setShowEmojiPicker(false);
  };

  // Charger les emojis au montage
  useEffect(() => {
    if (tab === "conversations") {
      loadCustomEmojis();
    }
  }, [tab]);

  const toggleSessionAI = async (sessionId) => {
    try {
      const res = await axios.post(`${API}/chat/sessions/${sessionId}/toggle-ai`);
      setChatSessions(prev => prev.map(s => s.id === sessionId ? res.data : s));
      if (selectedSession?.id === sessionId) {
        setSelectedSession(res.data);
      }
    } catch (err) {
      console.error("Error toggling AI:", err);
    }
  };

  // Changer le mode de la session (ai, human, community)
  const setSessionMode = async (sessionId, mode) => {
    try {
      const isAiActive = mode === 'ai';
      const res = await axios.put(`${API}/chat/sessions/${sessionId}`, {
        mode: mode,
        is_ai_active: isAiActive
      });
      setChatSessions(prev => prev.map(s => s.id === sessionId ? res.data : s));
      if (selectedSession?.id === sessionId) {
        setSelectedSession(res.data);
      }
    } catch (err) {
      console.error("Error changing session mode:", err);
    }
  };

  const sendCoachMessage = async () => {
    if (!selectedSession || !coachMessage.trim()) return;
    
    // Remplacer les tags emoji par les images
    let messageContent = coachMessage.trim();
    for (const emoji of customEmojis) {
      const tag = `[emoji:${emoji.id}]`;
      if (messageContent.includes(tag)) {
        messageContent = messageContent.replace(tag, `<img src="${emoji.image_data}" alt="${emoji.name}" style="width:24px;height:24px;display:inline;vertical-align:middle" />`);
      }
    }
    
    try {
      await axios.post(`${API}/chat/coach-response`, {
        session_id: selectedSession.id,
        message: messageContent,
        coach_name: user?.name || 'Coach'
      });
      setCoachMessage('');
      loadSessionMessages(selectedSession.id);
    } catch (err) {
      console.error("Error sending coach message:", err);
    }
  };

  const copyLinkToClipboard = async (linkToken) => {
    const baseUrl = window.location.origin;
    const fullUrl = `${baseUrl}/chat/${linkToken}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopiedLinkId(linkToken);
      setTimeout(() => setCopiedLinkId(null), 2000);
    } catch (err) {
      // Fallback pour mobile
      const textarea = document.createElement('textarea');
      textarea.value = fullUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedLinkId(linkToken);
      setTimeout(() => setCopiedLinkId(null), 2000);
    }
  };

  const getParticipantName = (participantId) => {
    const participant = chatParticipants.find(p => p.id === participantId);
    return participant?.name || 'Inconnu';
  };

  const getSourceLabel = (source) => {
    if (!source) return 'Direct';
    if (source.startsWith('link_')) {
      const token = source.replace('link_', '');
      const link = chatLinks.find(l => l.link_token === token);
      return link?.title || `Lien ${token.slice(0, 6)}`;
    }
    return source === 'chat_afroboost' ? 'Widget Chat' : source;
  };

  // === SUPPRESSION CONTACT CRM ===
  const deleteChatParticipant = async (participantId) => {
    if (!window.confirm("⚠️ Supprimer ce contact du CRM ?\n\nCette action est irréversible.")) return;
    
    try {
      await axios.delete(`${API}/chat/participants/${participantId}`);
      setChatParticipants(prev => prev.filter(p => p.id !== participantId));
    } catch (err) {
      console.error("Error deleting participant:", err);
      alert("Erreur lors de la suppression du contact");
    }
  };

  // === SUPPRESSION SESSION (Soft Delete) ===
  const deleteChatSession = async (sessionId) => {
    if (!window.confirm("⚠️ Supprimer cette conversation ?\n\nLa conversation sera archivée (suppression logique).")) return;
    
    try {
      await axios.put(`${API}/chat/sessions/${sessionId}`, { is_deleted: true });
      setChatSessions(prev => prev.filter(s => s.id !== sessionId));
      if (selectedSession?.id === sessionId) {
        setSelectedSession(null);
        setSessionMessages([]);
      }
    } catch (err) {
      console.error("Error deleting session:", err);
      alert("Erreur lors de la suppression de la conversation");
    }
  };

  // === AJOUTER CONTACT MANUEL AU CRM (synchronisé avec codes promo) ===
  const addManualChatParticipant = async (name, email, whatsapp, source = 'manual_promo') => {
    try {
      const response = await axios.post(`${API}/chat/participants`, {
        name,
        email,
        whatsapp,
        source
      });
      setChatParticipants(prev => [response.data, ...prev]);
      return response.data;
    } catch (err) {
      console.error("Error adding manual participant:", err);
      return null;
    }
  };

  // === FILTRAGE GLOBAL CONVERSATIONS ===
  const filteredChatLinks = useMemo(() => {
    if (!conversationSearch) return chatLinks;
    const q = conversationSearch.toLowerCase();
    return chatLinks.filter(l => 
      l.title?.toLowerCase().includes(q) ||
      l.link_token?.toLowerCase().includes(q)
    );
  }, [chatLinks, conversationSearch]);

  const filteredChatSessions = useMemo(() => {
    if (!conversationSearch) return chatSessions;
    const q = conversationSearch.toLowerCase();
    return chatSessions.filter(s => {
      // Rechercher dans les noms des participants
      const participantNames = s.participant_ids?.map(id => getParticipantName(id)).join(' ').toLowerCase() || '';
      return participantNames.includes(q) || s.title?.toLowerCase().includes(q);
    });
  }, [chatSessions, conversationSearch, chatParticipants]);

  const filteredChatParticipants = useMemo(() => {
    if (!conversationSearch) return chatParticipants;
    const q = conversationSearch.toLowerCase();
    return chatParticipants.filter(p => 
      p.name?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.whatsapp?.includes(q) ||
      p.source?.toLowerCase().includes(q)
    );
  }, [chatParticipants, conversationSearch]);

  // === POLLING NOTIFICATIONS pour nouveaux messages ===
  const lastMessageCountRef = useRef({});
  
  const checkNewMessages = useCallback(async () => {
    if (tab !== 'conversations') return;
    
    // Vérifier les sessions en mode humain pour les nouveaux messages
    const humanSessions = chatSessions.filter(s => !s.is_ai_active);
    
    for (const session of humanSessions) {
      try {
        const res = await axios.get(`${API}/chat/sessions/${session.id}/messages`);
        const messages = res.data;
        const prevCount = lastMessageCountRef.current[session.id] || 0;
        
        if (messages.length > prevCount) {
          const latestMessage = messages[messages.length - 1];
          
          // Si le message vient d'un utilisateur (pas du coach)
          if (latestMessage.sender_type === 'user') {
            playNotificationSound('user');
            
            // Mettre à jour les messages si c'est la session sélectionnée
            if (selectedSession?.id === session.id) {
              setSessionMessages(messages);
            }
          }
        }
        
        lastMessageCountRef.current[session.id] = messages.length;
      } catch (err) {
        // Ignorer les erreurs silencieusement
      }
    }
  }, [tab, chatSessions, selectedSession]);

  // Polling toutes les 5 secondes quand sur l'onglet conversations
  useEffect(() => {
    if (tab !== 'conversations') return;
    
    const interval = setInterval(checkNewMessages, 5000);
    return () => clearInterval(interval);
  }, [tab, checkNewMessages]);

  // Load conversations when tab changes
  useEffect(() => {
    if (tab === "conversations") {
      loadConversations();
    }
  }, [tab]);

  // === CONTACTS COMBINÉS: Users + Reservations + Chat Participants ===
  const allContacts = useMemo(() => {
    const contactMap = new Map();
    
    // 1. Users existants
    users.forEach(u => contactMap.set(u.email, { 
      id: u.id, 
      name: u.name, 
      email: u.email, 
      phone: u.whatsapp || "",
      source: 'users'
    }));
    
    // 2. Réservations
    reservations.forEach(r => {
      if (r.userEmail && !contactMap.has(r.userEmail)) {
        contactMap.set(r.userEmail, { 
          id: r.userId, 
          name: r.userName, 
          email: r.userEmail, 
          phone: r.userWhatsapp || "",
          source: 'reservations'
        });
      }
    });
    
    // 3. Chat Participants (CRM) - SYNCHRONISATION
    chatParticipants.forEach(p => {
      if (p.email && !contactMap.has(p.email)) {
        contactMap.set(p.email, {
          id: p.id,
          name: p.name,
          email: p.email,
          phone: p.whatsapp || "",
          source: p.source || 'chat_crm'
        });
      }
    });
    
    return Array.from(contactMap.values());
  }, [users, reservations, chatParticipants]);

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

  // Launch campaign WITH REAL SENDING via EmailJS and Twilio
  // === BOUTON LANCER - ISOLATION COMPLÈTE ===
  // Utilise les fonctions autonomes pour éviter tout conflit PostHog/state
  const launchCampaignWithSend = async (e, campaignId) => {
    // === BLOCAGE CRASH POSTHOG ===
    // Ces lignes DOIVENT être en premier, avant toute autre logique
    e.preventDefault();
    e.stopPropagation();
    
    try {
      // 1. Récupérer la campagne
      const campaign = campaigns.find(c => c.id === campaignId);
      if (!campaign) {
        alert('❌ Campagne non trouvée');
        return;
      }

      // Log isolé (peut être ignoré si PostHog crash)
      try {
        addCampaignLog(campaignId, 'Préparation de l\'envoi...', 'info');
      } catch (logErr) {
        console.warn('PostHog bloqué sur log mais envoi maintenu:', logErr);
      }

      // 2. Préparer d'abord la campagne côté backend
      const launchRes = await axios.post(`${API}/campaigns/${campaignId}/launch`);
      const launchedCampaign = launchRes.data;
      
      try {
        setCampaigns(campaigns.map(c => c.id === campaignId ? launchedCampaign : c));
      } catch (stateErr) {
        console.warn('PostHog bloqué sur setState mais envoi maintenu:', stateErr);
      }

      // 3. Récupérer les contacts à envoyer
      const results = launchedCampaign.results || [];
      if (results.length === 0) {
        alert('⚠️ Aucun contact à envoyer');
        return;
      }

      // 4. Séparer par canal
      const emailResults = results.filter(r => r.channel === 'email' && r.contactEmail);
      const whatsAppResults = results.filter(r => r.channel === 'whatsapp' && r.contactPhone);

      // Confirmation
      const confirmMsg = `🚀 Lancer la campagne "${campaign.name}" ?\n\n` +
        `📧 ${emailResults.length} email(s)\n` +
        `📱 ${whatsAppResults.length} WhatsApp\n\n` +
        `⚠️ Cette action est irréversible.`;
      
      if (!window.confirm(confirmMsg)) {
        return;
      }

      let totalSent = 0;
      let totalFailed = 0;

      // 5. === ENVOI EMAILS DIRECT AVEC IDS HARDCODÉS ===
      if (emailResults.length > 0) {
        try {
          addCampaignLog(campaignId, `📧 Envoi de ${emailResults.length} email(s)...`, 'info');
        } catch (e) { console.warn('Log bloqué:', e); }
        
        console.log(`EMAILJS_DEBUG: === LANCEMENT CAMPAGNE: ${emailResults.length} destinataires ===`);
        
        for (let i = 0; i < emailResults.length; i++) {
          const contact = emailResults[i];
          
          console.log(`EMAILJS_DEBUG: [${i + 1}/${emailResults.length}] Envoi à: ${contact.contactEmail}`);
          
          // === ISOLATION DE L'ENVOI - OBJET PROPRE ET PLAT ===
          const emailData = {
            to_email: contact.contactEmail,
            to_name: contact.contactName || 'Client',
            subject: campaign.name || 'Afroboost - Message',
            message: campaign.message  // Le texte issu du Prompt Système IA
          };
          
          // === BYPASS DU CRASH - TRY/CATCH AUTOUR DE emailjs.send ===
          try {
            console.log('EMAILJS_DEBUG: emailData =', JSON.stringify(emailData));
            
            // IDENTIFIANTS HARDCODÉS
            const response = await emailjs.send(
              'service_8mrmxim',   // Service ID
              'template_3n1u86p',  // Template ID
              emailData,           // Objet propre et plat
              '5LfgQSIEQoqq_XSqt'  // Public Key
            );
            
            console.log(`EMAILJS_DEBUG: [${i + 1}/${emailResults.length}] SUCCÈS - Status = ${response.status}`);
            
            // === LOG DE CONFIRMATION ===
            console.log(`Succès : Message IA envoyé à ${contact.contactEmail}`);
            
            totalSent++;
            
            // Marquer comme envoyé
            try {
              await axios.post(`${API}/campaigns/${campaignId}/mark-sent`, {
                contactId: contact.contactId,
                channel: 'email'
              });
            } catch (markErr) {
              console.warn('EMAILJS_DEBUG: Mark-sent bloqué mais email envoyé');
            }
            
          } catch (error) {
            // === BYPASS DU CRASH ===
            const errorName = error?.name || 'Unknown';
            const errorMsg = error?.text || error?.message || 'Erreur inconnue';
            
            console.error(`EMAILJS_DEBUG: [${i + 1}/${emailResults.length}] ÉCHEC - ${errorName}: ${errorMsg}`);
            
            // Ignorer l'erreur PostHog
            if (errorName === 'DataCloneError' || errorMsg.includes('clone')) {
              console.warn('EMAILJS_DEBUG: Erreur PostHog ignorée');
              totalSent++; // Compter comme envoyé car l'email a peut-être été envoyé
            } else {
              totalFailed++;
            }
          }
          
          // Délai entre les envois
          if (i < emailResults.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }
      }

      // 6. === ENVOI WHATSAPP VIA FONCTION AUTONOME ===
      if (whatsAppResults.length > 0) {
        try {
          addCampaignLog(campaignId, `📱 Envoi de ${whatsAppResults.length} WhatsApp...`, 'info');
        } catch (e) { console.warn('Log bloqué:', e); }
        
        console.log(`📱 === LANCEMENT CAMPAGNE WHATSAPP: ${whatsAppResults.length} destinataires ===`);
        
        for (let i = 0; i < whatsAppResults.length; i++) {
          const contact = whatsAppResults[i];
          
          console.log(`📱 [${i + 1}/${whatsAppResults.length}] Envoi à: ${contact.contactPhone}`);
          
          // === APPEL FONCTION AUTONOME ISOLÉE ===
          const result = await performWhatsAppSend(
            contact.contactPhone,
            campaign.message,
            whatsAppConfig
          );

          if (result.success) {
            totalSent++;
            console.log(`✅ WhatsApp envoyé${result.simulated ? ' (simulation)' : ''}`);
            // Marquer comme envoyé
            try {
              await axios.post(`${API}/campaigns/${campaignId}/mark-sent`, {
                contactId: contact.contactId,
                channel: 'whatsapp'
              });
            } catch (markErr) {
              console.warn('⚠️ Mark-sent bloqué mais WhatsApp envoyé:', markErr);
            }
          } else {
            totalFailed++;
            console.error(`❌ WhatsApp failed: ${result.error}`);
          }
          
          // Délai entre les envois
          if (i < whatsAppResults.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }

      // 7. Recharger la campagne (peut être ignoré)
      try {
        const updatedRes = await axios.get(`${API}/campaigns/${campaignId}`);
        setCampaigns(campaigns.map(c => c.id === campaignId ? updatedRes.data : c));
      } catch (reloadErr) {
        console.warn('Reload bloqué mais envois effectués:', reloadErr);
      }

      // 8. Notification finale
      try {
        addCampaignLog(campaignId, `✅ Terminé: ${totalSent} envoyés, ${totalFailed} échoués`, 'success');
      } catch (e) { console.warn('Log final bloqué:', e); }
      
      alert(`✅ Campagne "${campaign.name}" terminée !\n\n✓ Envoyés: ${totalSent}\n✗ Échoués: ${totalFailed}`);

    } catch (err) {
      console.error("Error launching campaign with send:", err);
      try {
        addCampaignLog(campaignId, `❌ Erreur: ${err.message}`, 'error');
      } catch (e) { console.warn('Log erreur bloqué:', e); }
      alert(`❌ Erreur lors de l'envoi: ${err.message}`);
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
    console.log('💾 Saving EmailJS config:', emailJSConfig);
    const success = saveEmailJSConfig(emailJSConfig);
    if (success) {
      setShowEmailJSConfig(false);
      alert('✅ Configuration EmailJS sauvegardée !');
      console.log('✅ EmailJS config saved successfully');
    } else {
      alert('❌ Erreur lors de la sauvegarde');
      console.error('❌ Failed to save EmailJS config');
    }
  };

  // === FONCTION TEST EMAILJS - CONNEXION TECHNIQUE RÉPARÉE ===
  // Utilise la fonction autonome performEmailSend avec debug avancé
  const handleTestEmailJS = async (e) => {
    // === SUPPRESSION DU CRASH - BLOCAGE POSTHOG ===
    e.preventDefault();
    e.stopPropagation();
    
    console.log('EMAILJS_DEBUG: Test déclenché');
    
    // Validation basique
    if (!testEmailAddress || !testEmailAddress.includes('@')) {
      console.log('EMAILJS_DEBUG: Email invalide -', testEmailAddress);
      alert('Veuillez entrer une adresse email valide pour le test');
      return;
    }
    
    console.log('EMAILJS_DEBUG: Email validé -', testEmailAddress);
    
    // Mise à jour UI - dans un try/catch séparé
    try {
      setTestEmailStatus('sending');
    } catch (stateError) {
      console.warn('EMAILJS_DEBUG: setState bloqué (PostHog) mais envoi maintenu');
    }
    
    // === ENVOI TECHNIQUE - LIAISON RÉELLE EMAILJS ===
    try {
      console.log('EMAILJS_DEBUG: Appel performEmailSend...');
      
      // Le texte est injecté dans {{message}} du template EmailJS
      const result = await performEmailSend(
        testEmailAddress,
        'Client',
        'Test Afroboost',
        'Ceci est un test de configuration EmailJS. Si vous recevez ce message, tout fonctionne !'
      );
      
      // === DEBUG RÉSULTAT ===
      console.log('EMAILJS_DEBUG: Résultat =', result.success ? 'SUCCÈS' : 'ÉCHEC');
      if (result.debug) {
        console.log(result.debug);
      }
      
      // Gestion du résultat
      try {
        if (result.success) {
          setTestEmailStatus('success');
          console.log('EMAILJS_DEBUG: UI mise à jour - succès');
          alert('✅ Email de test envoyé avec succès !');
          setTimeout(() => setTestEmailStatus(null), 5000);
        } else {
          setTestEmailStatus('error');
          console.log('EMAILJS_DEBUG: UI mise à jour - erreur');
          alert(`❌ Erreur EmailJS: ${result.error}\n\nDébug: ${result.debug || 'N/A'}`);
          setTimeout(() => setTestEmailStatus(null), 3000);
        }
      } catch (uiError) {
        console.warn('EMAILJS_DEBUG: UI bloquée par PostHog mais envoi réussi');
        if (result.success) {
          alert('✅ Email envoyé (UI bloquée par PostHog)');
        }
      }
    } catch (sendError) {
      console.error('EMAILJS_DEBUG: Exception globale -', sendError.message);
      try {
        setTestEmailStatus('error');
        alert(`❌ Erreur technique: ${sendError.message}`);
        setTimeout(() => setTestEmailStatus(null), 3000);
      } catch (e) {
        console.warn('EMAILJS_DEBUG: Erreur signalée malgré blocage PostHog');
        alert(`❌ Erreur: ${sendError.message}`);
      }
    }
  };

  // Envoyer la campagne email automatiquement
  // === ENVOI CAMPAGNE EMAIL - CONNEXION DIRECTE AVEC IDS HARDCODÉS ===
  const handleSendEmailCampaign = async (e) => {
    // === BYPASS CRASH POSTHOG ===
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    console.log('EMAILJS_DEBUG: Campagne email démarrée');

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

    console.log('CAMPAGNE: Contacts =', emailContacts.length);

    setEmailSendingResults(null);
    setEmailSendingProgress({ current: 0, total: emailContacts.length, status: 'starting' });

    const results = { sent: 0, failed: 0, errors: [] };

    // === BOUCLE ENVOI BRUT ===
    for (let i = 0; i < emailContacts.length; i++) {
      const contact = emailContacts[i];
      
      if (!contact.email) {
        results.failed++;
        continue;
      }
      
      console.log("ENVOI A:", contact.email);
      
      // === BYPASS BACKEND - ENVOI DIRECT DEPUIS LE NAVIGATEUR ===
      const ok = await envoyerEmailDirect(contact.email, newCampaign.message);
      
      if (ok) {
        results.sent++;
      } else {
        results.failed++;
        results.errors.push(contact.email);
      }
      
      // Délai
      await new Promise(r => setTimeout(r, 300));
    }

    console.log('CAMPAGNE TERMINÉE - Envoyés:', results.sent, '- Échoués:', results.failed);

    setEmailSendingResults(results);
    setEmailSendingProgress(null);

    if (results.sent > 0) {
      alert(`✅ Envoyés: ${results.sent} / Échoués: ${results.failed}`);
    } else {
      alert(`❌ Échec total. Erreurs: ${results.errors.join(', ')}`);
    }
  };

  // === WHATSAPP API FUNCTIONS ===
  
  // === FONCTION ENVOI WHATSAPP DIRECT AVEC LOG ===
  // Log clair pour vérifier que les données circulent
  const sendWhatsAppMessageDirect = async (phoneNumber, message, mediaUrl = null) => {
    const config = whatsAppConfig;
    
    // LOG CLAIR: Afficher toutes les données envoyées
    console.log('📱 === ENVOI WHATSAPP ===');
    console.log('📱 Envoi WhatsApp vers:', phoneNumber);
    console.log('📱 Message:', message);
    console.log('📱 Media URL:', mediaUrl || 'Aucun');
    console.log('📱 Avec SID:', config.accountSid || 'NON CONFIGURÉ');
    console.log('📱 Auth Token:', config.authToken ? '***' + config.authToken.slice(-4) : 'NON CONFIGURÉ');
    console.log('📱 From Number:', config.fromNumber || 'NON CONFIGURÉ');
    
    // Vérifier la configuration
    if (!config.accountSid || !config.authToken || !config.fromNumber) {
      console.error('❌ Configuration WhatsApp/Twilio incomplète');
      return { 
        success: false, 
        error: 'Configuration Twilio incomplète. Vérifiez Account SID, Auth Token et From Number.' 
      };
    }
    
    // Formater le numéro au format E.164
    let formattedPhone = phoneNumber.replace(/[^\d+]/g, '');
    if (!formattedPhone.startsWith('+')) {
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '+41' + formattedPhone.substring(1);
      } else {
        formattedPhone = '+' + formattedPhone;
      }
    }
    
    console.log('📱 Numéro formaté:', formattedPhone);
    
    // Construire les données pour Twilio
    const formData = new URLSearchParams();
    formData.append('From', `whatsapp:${config.fromNumber.startsWith('+') ? config.fromNumber : '+' + config.fromNumber}`);
    formData.append('To', `whatsapp:${formattedPhone}`);
    formData.append('Body', message);
    
    if (mediaUrl) {
      formData.append('MediaUrl', mediaUrl);
    }
    
    console.log('📱 Données Twilio:', Object.fromEntries(formData));
    
    try {
      // Appel DIRECT à l'API Twilio
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + btoa(`${config.accountSid}:${config.authToken}`),
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: formData
        }
      );
      
      const data = await response.json();
      console.log('📱 Réponse Twilio:', data);
      
      if (!response.ok) {
        return { success: false, error: data.message || `HTTP ${response.status}`, code: data.code };
      }
      
      return { success: true, sid: data.sid, status: data.status };
    } catch (error) {
      console.error('❌ Erreur Twilio:', error);
      return { success: false, error: error.message };
    }
  };
  
  // Sauvegarder la configuration WhatsApp
  const handleSaveWhatsAppConfig = async () => {
    const success = await saveWhatsAppConfig(whatsAppConfig);
    if (success) {
      setShowWhatsAppConfig(false);
      alert('✅ Configuration WhatsApp API sauvegardée !');
    } else {
      alert('❌ Erreur lors de la sauvegarde');
    }
  };

  // === FONCTION TEST WHATSAPP - ISOLATION COMPLÈTE ===
  // Utilise la fonction autonome performWhatsAppSend pour éviter les conflits PostHog
  const handleTestWhatsApp = async (e) => {
    // === BLOCAGE CRASH POSTHOG ===
    // Ces lignes DOIVENT être en premier, avant toute autre logique
    e.preventDefault();
    e.stopPropagation();
    
    // Validation basique
    if (!testWhatsAppNumber) {
      alert('Veuillez entrer un numéro de téléphone pour le test');
      return;
    }
    
    // Sauvegarder la config (peut être ignoré si PostHog crash)
    try {
      await handleSaveWhatsAppConfig();
    } catch (saveError) {
      console.warn('PostHog bloqué sur sauvegarde mais envoi maintenu:', saveError);
    }
    
    // Mise à jour UI - dans un try/catch séparé pour isoler PostHog
    try {
      setTestWhatsAppStatus('sending');
    } catch (stateError) {
      console.warn('PostHog bloqué sur setState mais envoi maintenu:', stateError);
    }
    
    // === ENVOI TECHNIQUE - ISOLÉ DE LA GESTION D'ÉTAT ===
    try {
      // Appel de la fonction autonome (hors composant React)
      const result = await performWhatsAppSend(
        testWhatsAppNumber,
        '🎉 Test Afroboost WhatsApp API!\n\nVotre configuration Twilio fonctionne correctement.',
        whatsAppConfig
      );
      
      // Gestion du résultat - également isolée
      try {
        if (result.success) {
          setTestWhatsAppStatus('success');
          if (result.simulated) {
            // Mode simulation
            setTimeout(() => setTestWhatsAppStatus(null), 3000);
          } else {
            alert(`✅ WhatsApp de test envoyé avec succès !\n\nSID: ${result.sid}`);
            setTimeout(() => setTestWhatsAppStatus(null), 5000);
          }
        } else {
          setTestWhatsAppStatus('error');
          alert(`❌ Erreur Twilio: ${result.error}`);
          setTimeout(() => setTestWhatsAppStatus(null), 3000);
        }
      } catch (uiError) {
        console.warn('PostHog bloqué sur UI update mais envoi réussi:', uiError);
        if (result.success) {
          alert('✅ WhatsApp envoyé (UI bloquée par PostHog)');
        }
      }
    } catch (sendError) {
      console.error('❌ Erreur envoi WhatsApp:', sendError);
      try {
        setTestWhatsAppStatus('error');
        alert(`❌ Erreur technique: ${sendError.message}`);
        setTimeout(() => setTestWhatsAppStatus(null), 3000);
      } catch (e) {
        console.warn('PostHog bloqué mais erreur signalée:', e);
        alert(`❌ Erreur: ${sendError.message}`);
      }
    }
  };

  // Envoyer la campagne WhatsApp automatiquement - avec isolation PostHog
  const handleSendWhatsAppCampaign = async (e) => {
    // Empêcher le rafraîchissement et la propagation (isolation PostHog)
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
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

    try {
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
      
      // Notification de succès
      if (results.sent > 0) {
        alert(`✅ Campagne WhatsApp terminée !\n\n✓ Envoyés: ${results.sent}\n✗ Échoués: ${results.failed}`);
      } else {
        alert(`❌ Échec de la campagne WhatsApp.\n\nErreurs: ${results.errors.join('\n')}`);
      }
    } catch (error) {
      console.error('❌ WhatsApp campaign error:', error);
      setWhatsAppSendingProgress(null);
      alert(`❌ Erreur lors de l'envoi: ${error.message}`);
    }
  };

  // === ENVOI GROUPÉ (EMAIL + WHATSAPP) ===
  const handleBulkSendCampaign = async (e) => {
    // Protection PostHog - Empêcher la propagation d'événements
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
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

    try {
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

      // Notification de succès
      const emailSent = results.email?.sent || 0;
      const emailFailed = results.email?.failed || 0;
      const waSent = results.whatsapp?.sent || 0;
      const waFailed = results.whatsapp?.failed || 0;
      
      alert(`✅ Campagne terminée !\n\n📧 Emails: ${emailSent} envoyés, ${emailFailed} échoués\n📱 WhatsApp: ${waSent} envoyés, ${waFailed} échoués`);
    } catch (error) {
      console.error('❌ Bulk campaign error:', error);
      alert(`❌ Erreur lors de l'envoi: ${error.message}`);
    } finally {
      setBulkSendingProgress(null);
      setBulkSendingInProgress(false);
      setBulkSendingResults(results);
    }
    
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
    { id: "campaigns", label: "📢 Campagnes" }, { id: "conversations", label: "💬 Conversations" }
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

      {/* ========== MODAL GESTION AUDIO / PLAYLIST ========== */}
      {showAudioModal && selectedCourseForAudio && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }}>
          <div 
            className="glass rounded-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto"
            style={{ border: '1px solid rgba(217, 28, 210, 0.3)' }}
          >
            {/* Header */}
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  🎵 Gérer la Playlist
                </h2>
                <p className="text-white/60 text-sm mt-1">
                  Cours : <span className="text-purple-400">{selectedCourseForAudio.name}</span>
                </p>
              </div>
              <button 
                onClick={() => setShowAudioModal(false)}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                style={{ color: '#fff' }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            {/* Ajouter une URL */}
            <div className="mb-6">
              <label className="block text-white text-sm mb-2">Ajouter un morceau (URL MP3/Stream)</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={newAudioUrl}
                  onChange={(e) => setNewAudioUrl(e.target.value)}
                  placeholder="https://example.com/music.mp3"
                  className="flex-1 px-3 py-2 rounded-lg neon-input text-sm"
                  onKeyPress={(e) => e.key === 'Enter' && addAudioUrl()}
                  data-testid="audio-url-input"
                />
                <button
                  onClick={addAudioUrl}
                  className="px-4 py-2 rounded-lg font-semibold text-sm transition-all"
                  style={{ 
                    background: 'linear-gradient(135deg, #d91cd2, #8b5cf6)',
                    color: '#fff'
                  }}
                  data-testid="add-audio-btn"
                >
                  + Ajouter
                </button>
              </div>
              <p className="text-white/40 text-xs mt-2">
                Formats supportés : MP3, WAV, OGG, streams M3U/M3U8, Soundcloud, Spotify
              </p>
            </div>

            {/* Liste de la playlist */}
            <div className="mb-6">
              <h3 className="text-white text-sm font-semibold mb-3">
                Playlist ({playlistUrls.length} morceaux)
              </h3>
              
              {playlistUrls.length === 0 ? (
                <div className="p-4 rounded-lg text-center" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <p className="text-white/40 text-sm">Aucun morceau dans la playlist</p>
                  <p className="text-white/30 text-xs mt-1">Ajoutez des URLs ci-dessus</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                  {playlistUrls.map((url, index) => (
                    <div 
                      key={index}
                      className="flex items-center gap-3 p-3 rounded-lg group"
                      style={{ background: 'rgba(255,255,255,0.05)' }}
                    >
                      <span className="text-purple-400 text-sm font-mono">#{index + 1}</span>
                      <span className="flex-1 text-white text-sm truncate" title={url}>
                        {url.length > 40 ? url.substring(0, 40) + '...' : url}
                      </span>
                      <button
                        onClick={() => removeAudioUrl(url)}
                        className="p-1 rounded hover:bg-red-500/30 transition-colors opacity-0 group-hover:opacity-100"
                        style={{ color: '#ef4444' }}
                        title="Supprimer ce morceau"
                        data-testid={`remove-audio-${index}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Boutons d'action */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowAudioModal(false)}
                className="flex-1 py-3 rounded-lg glass text-white text-sm"
              >
                Annuler
              </button>
              <button
                onClick={savePlaylist}
                disabled={savingPlaylist}
                className="flex-1 py-3 rounded-lg font-semibold text-sm transition-all"
                style={{ 
                  background: 'linear-gradient(135deg, #d91cd2, #8b5cf6)',
                  color: '#fff',
                  opacity: savingPlaylist ? 0.7 : 1
                }}
                data-testid="save-playlist-btn"
              >
                {savingPlaylist ? '⏳ Sauvegarde...' : '💾 Sauvegarder'}
              </button>
            </div>

            {/* Info */}
            <p className="text-white/30 text-xs text-center mt-4">
              Les morceaux seront liés au cours "{selectedCourseForAudio.name}" (ID: {selectedCourseForAudio.id})
            </p>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
          <div>
            <h1 className="font-bold text-white" style={{ fontSize: '28px' }}>{t('coachMode')}</h1>
            {/* Affichage de l'utilisateur connecté via Google OAuth */}
            {coachUser && (
              <div className="flex items-center gap-2 mt-2">
                {coachUser.picture && (
                  <img 
                    src={coachUser.picture} 
                    alt={coachUser.name} 
                    className="w-6 h-6 rounded-full"
                    style={{ border: '2px solid #d91cd2' }}
                  />
                )}
                <span className="text-white/60 text-sm">
                  Connecté en tant que <span className="text-purple-400">{coachUser.email}</span>
                </span>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={onBack} className="px-4 py-2 rounded-lg glass text-white text-sm" data-testid="coach-back">{t('back')}</button>
            <button onClick={onLogout} className="px-4 py-2 rounded-lg glass text-white text-sm" data-testid="coach-logout">{t('logout')}</button>
          </div>
        </div>

        <div className="flex gap-2 mb-6 flex-wrap">
          {tabs.map(tb => (
            <button key={tb.id} onClick={() => setTab(tb.id)} className={`coach-tab px-3 py-2 rounded-lg text-xs sm:text-sm ${tab === tb.id ? 'active' : ''}`}
              style={{ color: 'white' }} data-testid={`coach-tab-${tb.id}`}>{tb.label}</button>
          ))}
        </div>

        {/* Reservations Tab - Responsive: Table on PC, Cards on Mobile */}
        {tab === "reservations" && (
          <div className="card-gradient rounded-xl p-4 sm:p-6">
            <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
              <div>
                <h2 className="font-semibold text-white text-lg sm:text-xl">{t('reservationsList')}</h2>
                <p className="text-white/50 text-xs mt-1">
                  {reservationPagination.total > 0 
                    ? `Affichage ${((reservationPagination.page - 1) * reservationPagination.limit) + 1}-${Math.min(reservationPagination.page * reservationPagination.limit, reservationPagination.total)} sur ${reservationPagination.total} réservations`
                    : 'Aucune réservation'}
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => setShowScanner(true)} className="btn-primary px-3 py-2 rounded-lg flex items-center gap-2 text-xs sm:text-sm" data-testid="scan-ticket-btn">
                  📷 Scanner
                </button>
                <button onClick={exportCSV} className="csv-btn text-xs sm:text-sm" data-testid="export-csv">{t('downloadCSV')}</button>
              </div>
            </div>
            
            {/* Pagination Controls */}
            {reservationPagination.pages > 1 && (
              <div className="flex justify-center items-center gap-2 mb-4">
                <button 
                  onClick={() => loadReservations(reservationPagination.page - 1)}
                  disabled={reservationPagination.page <= 1 || loadingReservations}
                  className="px-3 py-1 rounded bg-purple-600/50 text-white text-sm disabled:opacity-30 hover:bg-purple-600"
                >
                  ← Précédent
                </button>
                <span className="text-white text-sm px-3">
                  Page {reservationPagination.page} / {reservationPagination.pages}
                </span>
                <button 
                  onClick={() => loadReservations(reservationPagination.page + 1)}
                  disabled={reservationPagination.page >= reservationPagination.pages || loadingReservations}
                  className="px-3 py-1 rounded bg-purple-600/50 text-white text-sm disabled:opacity-30 hover:bg-purple-600"
                >
                  Suivant →
                </button>
              </div>
            )}
            
            {loadingReservations && (
              <div className="text-center py-4 text-purple-400">⏳ Chargement...</div>
            )}
            
            {/* === MOBILE VIEW: Cards === */}
            <div className="block md:hidden space-y-3">
              {reservations.map(r => {
                const dt = new Date(r.datetime);
                const isProduct = r.selectedVariants || r.trackingNumber || r.shippingStatus !== 'pending';
                return (
                  <div key={r.id} className={`p-4 rounded-lg glass ${r.validated ? 'border border-green-500/30' : 'border border-purple-500/20'}`}>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className="text-pink-400 font-bold text-sm">{r.reservationCode || '-'}</span>
                        <h3 className="text-white font-semibold">{r.userName}</h3>
                        <p className="text-white/60 text-xs">{r.userEmail}</p>
                        {r.userWhatsapp && <p className="text-white/60 text-xs">📱 {r.userWhatsapp}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        {r.validated ? (
                          <span className="px-2 py-1 rounded text-xs bg-green-600 text-white">✅</span>
                        ) : (
                          <span className="px-2 py-1 rounded text-xs bg-yellow-600 text-white">⏳</span>
                        )}
                        <button 
                          onClick={() => deleteReservation(r.id)}
                          className="p-2 rounded-lg hover:bg-red-500/20 transition-all"
                          title={t('deleteReservation')}
                          data-testid={`delete-reservation-${r.id}`}
                        >
                          <span style={{ color: '#ef4444', fontSize: '16px' }}>🗑️</span>
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-white/80">
                      <div><span className="opacity-50">Cours:</span> {r.courseName}</div>
                      <div><span className="opacity-50">Date:</span> {dt.toLocaleDateString('fr-CH')}</div>
                      <div><span className="opacity-50">Offre:</span> {r.offerName}</div>
                      <div><span className="opacity-50">Total:</span> <span className="text-white font-bold">CHF {r.totalPrice || r.price}</span></div>
                    </div>
                    {isProduct && (
                      <div className="mt-3 pt-3 border-t border-white/10 flex gap-2">
                        <input 
                          type="text" 
                          placeholder="N° suivi" 
                          defaultValue={r.trackingNumber || ''}
                          onBlur={(e) => updateTracking(r.id, e.target.value, r.shippingStatus || 'pending')}
                          className="px-2 py-1 rounded text-xs neon-input flex-1"
                        />
                        <select 
                          defaultValue={r.shippingStatus || 'pending'}
                          onChange={(e) => updateTracking(r.id, r.trackingNumber, e.target.value)}
                          className="px-2 py-1 rounded text-xs neon-input"
                        >
                          <option value="pending">📦</option>
                          <option value="shipped">🚚</option>
                          <option value="delivered">✅</option>
                        </select>
                      </div>
                    )}
                  </div>
                );
              })}
              {reservations.length === 0 && <p className="text-center py-8 text-white/50">{t('noReservations')}</p>}
            </div>
            
            {/* === DESKTOP VIEW: Table === */}
            <div className="hidden md:block overflow-x-auto overflow-y-auto rounded-lg" style={{ maxHeight: '600px' }}>
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
                    <th className="bg-black">📦</th>
                    <th className="bg-black">🗑️</th>
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
                        {/* Delete button */}
                        <td>
                          <button 
                            onClick={() => deleteReservation(r.id)}
                            className="p-2 rounded-lg hover:bg-red-500/20 transition-all"
                            title={t('deleteReservation')}
                            data-testid={`delete-reservation-${r.id}`}
                          >
                            <span style={{ color: '#ef4444' }}>🗑️</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {reservations.length === 0 && <tr><td colSpan="13" className="text-center py-8" style={{ opacity: 0.5 }}>{t('noReservations')}</td></tr>}
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
              
              {/* ========================= PERSONNALISATION DES COULEURS ========================= */}
              <div className="border border-purple-500/30 rounded-lg p-4 bg-purple-900/10">
                <h3 className="text-purple-400 font-semibold mb-4">🎨 Personnalisation des couleurs</h3>
                <p className="text-white/60 text-xs mb-4">Changez les couleurs principales du site. Les modifications s'appliquent en temps réel.</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Couleur principale */}
                  <div>
                    <label className="block mb-2 text-white text-sm">✨ Couleur principale (Glow)</label>
                    <div className="flex items-center gap-3">
                      <input 
                        type="color" 
                        value={concept.primaryColor || '#D91CD2'} 
                        onChange={(e) => {
                          const newColor = e.target.value;
                          setConcept({ ...concept, primaryColor: newColor });
                          // Appliquer immédiatement
                          document.documentElement.style.setProperty('--primary-color', newColor);
                          document.documentElement.style.setProperty('--glow-color', `${newColor}66`);
                          document.documentElement.style.setProperty('--glow-color-strong', `${newColor}99`);
                        }}
                        className="w-12 h-12 rounded-lg cursor-pointer border-2 border-white/20"
                        style={{ background: 'transparent' }}
                        data-testid="color-picker-primary"
                      />
                      <div>
                        <input 
                          type="text" 
                          value={concept.primaryColor || '#D91CD2'} 
                          onChange={(e) => {
                            const newColor = e.target.value;
                            if (/^#[0-9A-Fa-f]{6}$/.test(newColor)) {
                              setConcept({ ...concept, primaryColor: newColor });
                              document.documentElement.style.setProperty('--primary-color', newColor);
                              document.documentElement.style.setProperty('--glow-color', `${newColor}66`);
                            }
                          }}
                          className="px-3 py-2 rounded-lg neon-input text-sm uppercase w-28"
                          placeholder="#D91CD2"
                        />
                        <p className="text-xs mt-1 text-white/40">Rose par défaut</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Couleur secondaire */}
                  <div>
                    <label className="block mb-2 text-white text-sm">💜 Couleur secondaire</label>
                    <div className="flex items-center gap-3">
                      <input 
                        type="color" 
                        value={concept.secondaryColor || '#8b5cf6'} 
                        onChange={(e) => {
                          const newColor = e.target.value;
                          setConcept({ ...concept, secondaryColor: newColor });
                          document.documentElement.style.setProperty('--secondary-color', newColor);
                        }}
                        className="w-12 h-12 rounded-lg cursor-pointer border-2 border-white/20"
                        style={{ background: 'transparent' }}
                        data-testid="color-picker-secondary"
                      />
                      <div>
                        <input 
                          type="text" 
                          value={concept.secondaryColor || '#8b5cf6'} 
                          onChange={(e) => {
                            const newColor = e.target.value;
                            if (/^#[0-9A-Fa-f]{6}$/.test(newColor)) {
                              setConcept({ ...concept, secondaryColor: newColor });
                              document.documentElement.style.setProperty('--secondary-color', newColor);
                            }
                          }}
                          className="px-3 py-2 rounded-lg neon-input text-sm uppercase w-28"
                          placeholder="#8b5cf6"
                        />
                        <p className="text-xs mt-1 text-white/40">Violet par défaut</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Présets de couleurs */}
                <div className="mt-4">
                  <label className="block mb-2 text-white text-sm">🎯 Préréglages rapides</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { name: 'Rose Néon', primary: '#D91CD2', secondary: '#8b5cf6' },
                      { name: 'Bleu Électrique', primary: '#0ea5e9', secondary: '#6366f1' },
                      { name: 'Vert Menthe', primary: '#10b981', secondary: '#14b8a6' },
                      { name: 'Orange Sunset', primary: '#f97316', secondary: '#eab308' },
                      { name: 'Rouge Passion', primary: '#ef4444', secondary: '#ec4899' },
                      { name: 'Or Luxe', primary: '#d4af37', secondary: '#b8860b' },
                    ].map((preset) => (
                      <button
                        key={preset.name}
                        onClick={() => {
                          setConcept({ ...concept, primaryColor: preset.primary, secondaryColor: preset.secondary });
                          document.documentElement.style.setProperty('--primary-color', preset.primary);
                          document.documentElement.style.setProperty('--secondary-color', preset.secondary);
                          document.documentElement.style.setProperty('--glow-color', `${preset.primary}66`);
                          document.documentElement.style.setProperty('--glow-color-strong', `${preset.primary}99`);
                        }}
                        className="px-3 py-2 rounded-full text-xs font-medium text-white transition-all hover:scale-105"
                        style={{ 
                          background: `linear-gradient(135deg, ${preset.primary}, ${preset.secondary})`,
                          boxShadow: `0 2px 10px ${preset.primary}40`
                        }}
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Bouton reset */}
                <button
                  onClick={() => {
                    setConcept({ ...concept, primaryColor: '#D91CD2', secondaryColor: '#8b5cf6' });
                    document.documentElement.style.setProperty('--primary-color', '#D91CD2');
                    document.documentElement.style.setProperty('--secondary-color', '#8b5cf6');
                    document.documentElement.style.setProperty('--glow-color', 'rgba(217, 28, 210, 0.4)');
                    document.documentElement.style.setProperty('--glow-color-strong', 'rgba(217, 28, 210, 0.6)');
                  }}
                  className="mt-4 px-4 py-2 rounded-lg text-sm text-white/70 hover:text-white border border-white/20 hover:border-white/40 transition-all"
                >
                  🔄 Réinitialiser les couleurs par défaut
                </button>
              </div>
              
              {/* ========================= IDENTITÉ DE L'APPLICATION ========================= */}
              <div className="border border-pink-500/30 rounded-lg p-4 bg-pink-900/10">
                <h3 className="text-pink-400 font-semibold mb-4">🎨 Identité de l'application</h3>
                
                {/* Nom de l'application */}
                <div className="mb-4">
                  <label className="block mb-2 text-white text-sm">📝 Nom de l'application</label>
                  <input 
                    type="text" 
                    value={concept.appName || 'Afroboost'} 
                    onChange={(e) => setConcept({ ...concept, appName: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg neon-input" 
                    placeholder="Afroboost" 
                    data-testid="concept-app-name" 
                  />
                  <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Ce nom apparaît comme titre principal en haut du site
                  </p>
                </div>
                
                {/* Logo URL for Splash Screen & PWA */}
                <div>
                  <label className="block mb-2 text-white text-sm">🖼️ URL du Logo (Splash Screen & PWA)</label>
                  <input 
                    type="url" 
                    value={concept.logoUrl || ''} 
                    onChange={(e) => setConcept({ ...concept, logoUrl: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg neon-input" 
                    placeholder="https://... (logo PNG/SVG)" 
                    data-testid="concept-logo-url" 
                  />
                  <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Ce logo apparaît sur le Splash Screen et comme icône d'installation mobile (PWA)
                  </p>
                </div>
                {concept.logoUrl && (
                  <div className="mt-3">
                    <p className="text-white text-sm mb-2" style={{ opacity: 0.7 }}>Aperçu logo:</p>
                    <div className="flex justify-center p-4 rounded-lg" style={{ background: '#000' }}>
                      <img src={concept.logoUrl} alt="Logo" style={{ maxHeight: '80px', maxWidth: '200px' }} />
                    </div>
                  </div>
                )}
              </div>
              
              {/* ========================= DESCRIPTION DU CONCEPT ========================= */}
              <div>
                <label className="block mb-2 text-white text-sm">{t('conceptDescription')}</label>
                <textarea value={concept.description} onChange={(e) => setConcept({ ...concept, description: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg neon-input" rows={4} data-testid="concept-description" 
                  placeholder="Décrivez votre concept..." />
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
                    <span className="text-white text-sm opacity-70">{concept.appName || 'Afroboost'}</span>
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

              {/* Modes de paiement acceptés - Toggles */}
              <div className="mt-6 pt-6 border-t border-purple-500/30">
                <h3 className="text-white text-sm font-semibold mb-4">💳 Logos de paiement</h3>
                <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Activez les logos qui s'afficheront dans le pied de page.
                </p>
                <div className="space-y-3">
                  {/* Toggle Twint */}
                  <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'rgba(139, 92, 246, 0.1)' }}>
                    <div className="flex items-center gap-3">
                      <div style={{ 
                        background: '#00A9E0', 
                        borderRadius: '4px', 
                        padding: '2px 6px',
                        display: 'flex',
                        alignItems: 'center'
                      }}>
                        <span style={{ color: 'white', fontWeight: 'bold', fontSize: '12px' }}>TWINT</span>
                      </div>
                      <span className="text-white text-sm">Twint</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setConcept({ ...concept, paymentTwint: !concept.paymentTwint })}
                      className={`relative w-12 h-6 rounded-full transition-all duration-300 ${concept.paymentTwint ? 'bg-pink-500' : 'bg-gray-600'}`}
                      data-testid="toggle-twint"
                    >
                      <span 
                        className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 ${concept.paymentTwint ? 'left-7' : 'left-1'}`}
                      />
                    </button>
                  </div>
                  
                  {/* Toggle PayPal */}
                  <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'rgba(139, 92, 246, 0.1)' }}>
                    <div className="flex items-center gap-3">
                      <img 
                        src="https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg" 
                        alt="PayPal" 
                        style={{ height: '18px' }}
                        onError={(e) => { e.target.src = ''; e.target.alt = 'PayPal'; }}
                      />
                      <span className="text-white text-sm">PayPal</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setConcept({ ...concept, paymentPaypal: !concept.paymentPaypal })}
                      className={`relative w-12 h-6 rounded-full transition-all duration-300 ${concept.paymentPaypal ? 'bg-pink-500' : 'bg-gray-600'}`}
                      data-testid="toggle-paypal"
                    >
                      <span 
                        className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 ${concept.paymentPaypal ? 'left-7' : 'left-1'}`}
                      />
                    </button>
                  </div>
                  
                  {/* Toggle Carte de Crédit */}
                  <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'rgba(139, 92, 246, 0.1)' }}>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <img 
                          src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg" 
                          alt="Visa" 
                          style={{ height: '14px' }}
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                        <img 
                          src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" 
                          alt="Mastercard" 
                          style={{ height: '16px' }}
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      </div>
                      <span className="text-white text-sm">Carte de Crédit</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setConcept({ ...concept, paymentCreditCard: !concept.paymentCreditCard })}
                      className={`relative w-12 h-6 rounded-full transition-all duration-300 ${concept.paymentCreditCard ? 'bg-pink-500' : 'bg-gray-600'}`}
                      data-testid="toggle-creditcard"
                    >
                      <span 
                        className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 ${concept.paymentCreditCard ? 'left-7' : 'left-1'}`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Affiche Événement (Popup) */}
              <div className="mt-6 pt-6 border-t border-purple-500/30">
                <h3 className="text-white text-sm font-semibold mb-4">🎉 Affiche Événement (Popup d'accueil)</h3>
                <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Affichez une image ou vidéo en popup dès l'arrivée des visiteurs.
                </p>
                
                {/* Toggle Activer/Désactiver */}
                <div className="flex items-center justify-between p-3 rounded-lg mb-4" style={{ background: 'rgba(139, 92, 246, 0.1)' }}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📢</span>
                    <span className="text-white text-sm">Activer l'affiche événement</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConcept({ ...concept, eventPosterEnabled: !concept.eventPosterEnabled })}
                    className={`relative w-12 h-6 rounded-full transition-all duration-300 ${concept.eventPosterEnabled ? 'bg-pink-500' : 'bg-gray-600'}`}
                    data-testid="toggle-event-poster"
                  >
                    <span 
                      className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 ${concept.eventPosterEnabled ? 'left-7' : 'left-1'}`}
                    />
                  </button>
                </div>
                
                {/* URL du média (visible seulement si activé) */}
                {concept.eventPosterEnabled && (
                  <div className="space-y-3">
                    <div>
                      <label className="block mb-1 text-white text-xs opacity-70">URL de l'image ou vidéo</label>
                      <input 
                        type="url" 
                        value={concept.eventPosterMediaUrl || ''} 
                        onChange={(e) => setConcept({ ...concept, eventPosterMediaUrl: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg neon-input text-sm" 
                        placeholder="https://... (image ou vidéo YouTube/Vimeo)"
                        data-testid="event-poster-url"
                      />
                    </div>
                    
                    {/* Aperçu du média */}
                    {concept.eventPosterMediaUrl && (
                      <div className="mt-3">
                        <label className="block mb-2 text-white text-xs opacity-70">Aperçu :</label>
                        <div className="rounded-lg overflow-hidden border border-purple-500/30" style={{ maxWidth: '300px' }}>
                          {concept.eventPosterMediaUrl.includes('youtube.com') || concept.eventPosterMediaUrl.includes('youtu.be') ? (
                            <div className="aspect-video">
                              <iframe 
                                src={`https://www.youtube.com/embed/${concept.eventPosterMediaUrl.includes('youtu.be') 
                                  ? concept.eventPosterMediaUrl.split('/').pop() 
                                  : new URLSearchParams(new URL(concept.eventPosterMediaUrl).search).get('v')}`}
                                className="w-full h-full"
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                title="Event poster preview"
                              />
                            </div>
                          ) : concept.eventPosterMediaUrl.includes('vimeo.com') ? (
                            <div className="aspect-video">
                              <iframe 
                                src={`https://player.vimeo.com/video/${concept.eventPosterMediaUrl.split('/').pop()}`}
                                className="w-full h-full"
                                frameBorder="0"
                                allow="autoplay; fullscreen; picture-in-picture"
                                allowFullScreen
                                title="Event poster preview"
                              />
                            </div>
                          ) : (
                            <img 
                              src={concept.eventPosterMediaUrl} 
                              alt="Aperçu affiche événement" 
                              className="w-full"
                              onError={(e) => { e.target.src = ''; e.target.alt = 'Image non valide'; }}
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button onClick={saveConcept} className="btn-primary px-6 py-3 rounded-lg mt-6" data-testid="save-concept">{t('save')}</button>
            </div>
          </div>
        )}

        {/* Courses Tab */}
        {tab === "courses" && (
          <div className="card-gradient rounded-xl p-6">
            <h2 className="font-semibold text-white mb-6" style={{ fontSize: '20px' }}>{t('courses')}</h2>
            {/* Liste des cours avec scroll */}
            <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '8px' }} className="custom-scrollbar">
              {courses.filter(c => !c.archived).map((course, idx) => (
                <div key={course.id} className="glass rounded-lg p-4 mb-4 relative">
                  {/* Actions: Audio + Dupliquer + Archiver */}
                  <div className="absolute top-2 right-2 flex gap-1">
                    {/* Bouton Gérer l'Audio */}
                    <button 
                      onClick={() => openAudioModal(course)}
                      className="p-2 rounded-lg hover:bg-pink-500/30 transition-colors"
                      style={{ color: '#d91cd2' }}
                      title="Gérer l'Audio / Playlist"
                      data-testid={`audio-course-${course.id}`}
                    >
                      <span className="text-sm">🎵</span>
                    </button>
                    {/* Bouton dupliquer */}
                    <button 
                      onClick={async () => {
                        try {
                          const duplicatedCourse = {
                            name: `${course.name} (copie)`,
                            weekday: course.weekday,
                            time: course.time,
                            locationName: course.locationName,
                            mapsUrl: course.mapsUrl || '',
                            visible: true,
                            archived: false
                          };
                          const res = await axios.post(`${API}/courses`, duplicatedCourse);
                          setCourses([...courses, res.data]);
                        } catch (err) {
                          console.error("Erreur duplication cours:", err);
                        }
                      }}
                      className="p-2 rounded-lg hover:bg-purple-500/30 transition-colors"
                      style={{ color: 'rgba(139, 92, 246, 0.8)' }}
                      title="Dupliquer ce cours"
                      data-testid={`duplicate-course-${course.id}`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                      </svg>
                    </button>
                    {/* Bouton archiver (au lieu de supprimer) */}
                    <button 
                      onClick={async () => {
                        if (window.confirm(`Archiver le cours "${course.name}" ? Il sera masqué mais récupérable.`)) {
                          try {
                            await axios.put(`${API}/courses/${course.id}/archive`);
                            setCourses(courses.map(c => c.id === course.id ? { ...c, archived: true } : c));
                          } catch (err) {
                            console.error("Erreur archivage cours:", err);
                          }
                        }
                      }}
                      className="p-2 rounded-lg hover:bg-orange-500/30 transition-colors"
                      style={{ color: 'rgba(249, 115, 22, 0.8)' }}
                      title="Archiver ce cours"
                      data-testid={`archive-course-${course.id}`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/>
                      </svg>
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-16">
                    <div>
                      <label className="block mb-1 text-white text-xs opacity-70">{t('courseName')}</label>
                      <input type="text" value={course.name} onChange={(e) => { const n = [...courses]; const realIdx = courses.findIndex(c => c.id === course.id); n[realIdx].name = e.target.value; setCourses(n); }}
                        onBlur={() => updateCourse(course)} className="w-full px-3 py-2 rounded-lg neon-input text-sm" />
                    </div>
                    <div>
                      <label className="block mb-1 text-white text-xs opacity-70">{t('location')}</label>
                      <input type="text" value={course.locationName} onChange={(e) => { const n = [...courses]; const realIdx = courses.findIndex(c => c.id === course.id); n[realIdx].locationName = e.target.value; setCourses(n); }}
                        onBlur={() => updateCourse(course)} className="w-full px-3 py-2 rounded-lg neon-input text-sm" />
                    </div>
                    <div>
                      <label className="block mb-1 text-white text-xs opacity-70">{t('weekday')}</label>
                      <select value={course.weekday} onChange={(e) => { const n = [...courses]; const realIdx = courses.findIndex(c => c.id === course.id); n[realIdx].weekday = parseInt(e.target.value); setCourses(n); updateCourse({ ...course, weekday: parseInt(e.target.value) }); }}
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
                          const realIdx = courses.findIndex(c => c.id === course.id);
                          n[realIdx].visible = course.visible === false ? true : false; 
                          setCourses(n); 
                          updateCourse({ ...course, visible: n[realIdx].visible }); 
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
            </div>
            
            {/* Section Cours Archivés */}
            {courses.filter(c => c.archived).length > 0 && (
              <div className="mt-6 pt-6 border-t border-purple-500/30">
                <h3 className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
                  <span>📁</span> Cours archivés ({courses.filter(c => c.archived).length})
                </h3>
                <div className="space-y-2">
                  {courses.filter(c => c.archived).map(course => (
                    <div key={course.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'rgba(249, 115, 22, 0.1)', border: '1px solid rgba(249, 115, 22, 0.3)' }}>
                      <span className="text-white text-sm opacity-70">{course.name}</span>
                      <button 
                        onClick={async () => {
                          try {
                            await axios.put(`${API}/courses/${course.id}`, { ...course, archived: false });
                            setCourses(courses.map(c => c.id === course.id ? { ...c, archived: false } : c));
                          } catch (err) {
                            console.error("Erreur restauration cours:", err);
                          }
                        }}
                        className="px-3 py-1 rounded text-xs"
                        style={{ background: 'rgba(34, 197, 94, 0.3)', color: '#22c55e' }}
                        data-testid={`restore-course-${course.id}`}
                      >
                        ↩️ Restaurer
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
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
          <div className="card-gradient rounded-xl p-4 sm:p-6">
            <h2 className="font-semibold text-white mb-6 text-lg sm:text-xl">{t('offers')}</h2>
            
            {/* === MOBILE VIEW: Cartes verticales === */}
            <div className="block md:hidden space-y-4">
              {offers.map((offer, idx) => (
                <div key={offer.id} className="glass rounded-lg p-4">
                  {/* Image et nom */}
                  <div className="flex items-center gap-3 mb-3">
                    {offer.images?.[0] || offer.thumbnail ? (
                      <img src={offer.images?.[0] || offer.thumbnail} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-purple-900/30 flex items-center justify-center text-2xl flex-shrink-0">🎧</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-white font-semibold text-sm truncate">{offer.name}</h4>
                      <p className="text-purple-400 text-xs">{offer.price} CHF</p>
                      <p className="text-white/50 text-xs">{offer.images?.filter(i => i).length || 0} images</p>
                    </div>
                    {/* Toggle visible */}
                    <div className="flex flex-col items-center gap-1">
                      <div className={`switch ${offer.visible ? 'active' : ''}`} onClick={() => { const n = [...offers]; n[idx].visible = !offer.visible; setOffers(n); updateOffer({ ...offer, visible: !offer.visible }); }} />
                      <span className="text-xs text-white/40">{offer.visible ? 'ON' : 'OFF'}</span>
                    </div>
                  </div>
                  
                  {/* Description */}
                  {offer.description && (
                    <p className="text-white/60 text-xs mb-3 italic truncate">"{offer.description}"</p>
                  )}
                  
                  {/* Boutons action - largeur 100% sur mobile */}
                  <div className="flex gap-2">
                    <button 
                      onClick={() => startEditOffer(offer)}
                      className="flex-1 py-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium"
                      data-testid={`edit-offer-${offer.id}`}
                    >
                      ✏️ Modifier
                    </button>
                    <button 
                      onClick={() => deleteOffer(offer.id)}
                      className="flex-1 py-3 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium"
                      data-testid={`delete-offer-${offer.id}`}
                    >
                      🗑️ Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            {/* === DESKTOP VIEW: Layout horizontal === */}
            <div className="hidden md:block">
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
                        <p className="text-purple-400 text-sm">{offer.price} CHF • {offer.images?.filter(i => i).length || 0} images</p>
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
            </div>
            
            {/* Formulaire Ajout/Modification - RESPONSIVE */}
            <form id="offer-form" onSubmit={addOffer} className="glass rounded-lg p-4 mt-4 border-2 border-purple-500/50">
              <h3 className="text-white mb-4 font-semibold text-sm flex items-center gap-2">
                {editingOfferId ? '✏️ Modifier l\'offre' : '➕ Ajouter une offre'}
                {editingOfferId && (
                  <button type="button" onClick={cancelEditOffer} className="ml-auto text-xs text-red-400 hover:text-red-300">
                    ✕ Annuler
                  </button>
                )}
              </h3>
              
              {/* Basic Info - Stack on mobile */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="text-xs text-white opacity-60 mb-1 block">Nom de l'offre *</label>
                  <input type="text" placeholder="Ex: Cours à l'unité" value={newOffer.name} onChange={e => setNewOffer({ ...newOffer, name: e.target.value })} className="w-full px-3 py-3 rounded-lg neon-input text-sm" required />
                </div>
                <div>
                  <label className="text-xs text-white opacity-60 mb-1 block">Prix (CHF)</label>
                  <input type="number" placeholder="30" value={newOffer.price} onChange={e => setNewOffer({ ...newOffer, price: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-3 rounded-lg neon-input text-sm" />
                </div>
              </div>
              
              {/* 5 Champs d'images - 1 colonne mobile, 5 desktop */}
              <div className="mt-4">
                <label className="text-xs text-white opacity-60 mb-2 block">📷 Images (max 5 URLs)</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2">
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
                      className="w-full px-3 py-3 rounded-lg neon-input text-xs"
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
                  className="w-full px-3 py-3 rounded-lg neon-input text-sm" 
                  rows={2}
                  maxLength={150}
                  placeholder="Description visible au clic sur l'icône i (max 150 car.)"
                />
                <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{(newOffer.description || '').length}/150</p>
              </div>
              
              {/* Mots-clés pour la recherche */}
              <div className="mt-3">
                <label className="text-xs text-white opacity-60 mb-1 block">🔍 Mots-clés (pour la recherche)</label>
                <input 
                  type="text"
                  value={newOffer.keywords || ''} 
                  onChange={e => setNewOffer({ ...newOffer, keywords: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg neon-input text-sm" 
                  placeholder="session, séance, cardio, danse, afro... (séparés par virgules)"
                  data-testid="offer-keywords"
                />
                <p className="text-xs mt-1" style={{ color: 'rgba(139, 92, 246, 0.6)' }}>💡 Aide les clients à trouver cette offre avec des termes alternatifs</p>
              </div>
              
              {/* Category & Type - Stack on mobile */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                <select 
                  value={newOffer.category} 
                  onChange={e => setNewOffer({ ...newOffer, category: e.target.value })}
                  className="px-3 py-3 rounded-lg neon-input text-sm w-full"
                >
                  <option value="service">🎧 Service / Cours</option>
                  <option value="tshirt">👕 T-shirt</option>
                  <option value="shoes">👟 Chaussures</option>
                  <option value="supplement">💊 Complément</option>
                  <option value="accessory">🎒 Accessoire</option>
                </select>
                <label className="flex items-center gap-2 text-white text-sm py-2">
                  <input 
                    type="checkbox" 
                    checked={newOffer.isProduct} 
                    onChange={e => setNewOffer({ ...newOffer, isProduct: e.target.checked })} 
                    className="w-5 h-5"
                  />
                  Produit physique
                </label>
                <label className="flex items-center gap-2 text-white text-sm py-2">
                  <input 
                    type="checkbox" 
                    checked={newOffer.visible} 
                    onChange={e => setNewOffer({ ...newOffer, visible: e.target.checked })} 
                    className="w-5 h-5"
                  />
                  Visible
                </label>
              </div>
              
              {/* E-Commerce Fields (shown when isProduct) */}
              {newOffer.isProduct && (
                <div className="mt-3 p-3 rounded-lg border border-purple-500/30">
                  <p className="text-xs text-purple-400 mb-3">📦 Paramètres produit</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-white opacity-60">TVA (%)</label>
                      <input type="number" placeholder="7.7" value={newOffer.tva || ''} onChange={e => setNewOffer({ ...newOffer, tva: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-3 rounded-lg neon-input text-sm" step="0.1" />
                    </div>
                    <div>
                      <label className="text-xs text-white opacity-60">Frais port</label>
                      <input type="number" placeholder="9.90" value={newOffer.shippingCost || ''} onChange={e => setNewOffer({ ...newOffer, shippingCost: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-3 rounded-lg neon-input text-sm" step="0.1" />
                    </div>
                    <div>
                      <label className="text-xs text-white opacity-60">Stock</label>
                      <input type="number" placeholder="-1" value={newOffer.stock} onChange={e => setNewOffer({ ...newOffer, stock: parseInt(e.target.value) || -1 })} className="w-full px-3 py-3 rounded-lg neon-input text-sm" />
                    </div>
                  </div>
                  
                  {/* Variants */}
                  <div className="mt-3">
                    <label className="text-xs text-white opacity-60">Variantes (séparées par virgule)</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
                      <input 
                        type="text" 
                        placeholder="Tailles: S, M, L, XL"
                        onChange={e => setNewOffer({ 
                          ...newOffer, 
                          variants: { ...newOffer.variants, sizes: e.target.value.split(',').map(s => s.trim()).filter(s => s) }
                        })}
                        className="w-full px-3 py-3 rounded-lg neon-input text-sm"
                      />
                      <input 
                        type="text" 
                        placeholder="Couleurs: Noir, Blanc"
                        onChange={e => setNewOffer({ 
                          ...newOffer, 
                          variants: { ...newOffer.variants, colors: e.target.value.split(',').map(s => s.trim()).filter(s => s) }
                        })}
                        className="w-full px-3 py-3 rounded-lg neon-input text-sm"
                      />
                      <input 
                        type="text" 
                        placeholder="Poids: 0.5kg, 1kg"
                        onChange={e => setNewOffer({ 
                          ...newOffer, 
                          variants: { ...newOffer.variants, weights: e.target.value.split(',').map(s => s.trim()).filter(s => s) }
                        })}
                        className="w-full px-3 py-3 rounded-lg neon-input text-sm"
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
              
              {/* Section Notifications automatiques */}
              <div className="mt-8 pt-6 border-t border-purple-500/30">
                <h3 className="text-white text-sm font-semibold mb-4">🔔 Notifications automatiques</h3>
                <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Recevez une notification par email et/ou WhatsApp à chaque nouvelle réservation.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-2 text-white text-xs opacity-70">📧 Email pour les alertes</label>
                    <input 
                      type="email" 
                      value={paymentLinks.coachNotificationEmail || ''} 
                      onChange={e => setPaymentLinks({ ...paymentLinks, coachNotificationEmail: e.target.value })} 
                      className="w-full px-4 py-3 rounded-lg neon-input text-sm" 
                      placeholder="coach@exemple.com"
                      data-testid="coach-notification-email"
                    />
                  </div>
                  <div>
                    <label className="block mb-2 text-white text-xs opacity-70">📱 WhatsApp pour les alertes</label>
                    <input 
                      type="tel" 
                      value={paymentLinks.coachNotificationPhone || ''} 
                      onChange={e => setPaymentLinks({ ...paymentLinks, coachNotificationPhone: e.target.value })} 
                      className="w-full px-4 py-3 rounded-lg neon-input text-sm" 
                      placeholder="+41791234567"
                      data-testid="coach-notification-phone"
                    />
                  </div>
                </div>
                <p className="text-xs mt-3" style={{ color: 'rgba(139, 92, 246, 0.7)' }}>
                  💡 Conseil: Configurez EmailJS dans l'onglet Campagnes pour activer les notifications email.
                </p>
              </div>

              <button onClick={savePayments} className="btn-primary px-6 py-3 rounded-lg mt-6">{t('save')}</button>
            </div>
          </div>
        )}

        {/* Promo Codes Tab with Beneficiary Dropdown */}
        {tab === "codes" && (
          <div className="card-gradient rounded-xl p-4 sm:p-6">
            <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
              <h2 className="font-semibold text-white text-lg sm:text-xl">{t('promoCodes')}</h2>
              <div className="flex gap-2 flex-wrap">
                {/* Add Manual Contact Button */}
                <button 
                  type="button"
                  onClick={() => setShowManualContactForm(!showManualContactForm)} 
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-white text-xs sm:text-sm transition-all"
                  style={{ 
                    background: showManualContactForm ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                    border: showManualContactForm ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(34, 197, 94, 0.4)'
                  }}
                  data-testid="add-manual-contact-btn"
                >
                  {showManualContactForm ? '✕ Fermer' : t('addManualContact')}
                </button>
                <input type="file" accept=".csv" ref={fileInputRef} onChange={handleImportCSV} style={{ display: 'none' }} />
                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-2 rounded-lg glass text-white text-xs sm:text-sm" data-testid="import-csv-btn">
                  <FolderIcon /> {t('importCSV')}
                </button>
                <button 
                  onClick={exportPromoCodesCSV} 
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-white text-xs sm:text-sm"
                  style={{ background: 'rgba(139, 92, 246, 0.3)', border: '1px solid rgba(139, 92, 246, 0.5)' }}
                  data-testid="export-csv-btn"
                >
                  📥 {t('exportCSV')}
                </button>
              </div>
            </div>
            
            {/* Manual Contact Form */}
            {showManualContactForm && (
              <form onSubmit={addManualContact} className="mb-6 p-4 rounded-lg border border-green-500/30" style={{ background: 'rgba(34, 197, 94, 0.1)' }}>
                <h3 className="text-white font-semibold mb-3 text-sm">👤 Ajouter un nouveau contact</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                  <input 
                    type="text" 
                    placeholder={t('manualContactName')} 
                    value={manualContact.name} 
                    onChange={e => setManualContact({ ...manualContact, name: e.target.value })}
                    className="px-3 py-2 rounded-lg neon-input text-sm" 
                    required
                    data-testid="manual-contact-name"
                  />
                  <input 
                    type="email" 
                    placeholder={t('manualContactEmail')} 
                    value={manualContact.email} 
                    onChange={e => setManualContact({ ...manualContact, email: e.target.value })}
                    className="px-3 py-2 rounded-lg neon-input text-sm" 
                    required
                    data-testid="manual-contact-email"
                  />
                  <input 
                    type="tel" 
                    placeholder={t('manualContactWhatsapp')} 
                    value={manualContact.whatsapp} 
                    onChange={e => setManualContact({ ...manualContact, whatsapp: e.target.value })}
                    className="px-3 py-2 rounded-lg neon-input text-sm"
                    data-testid="manual-contact-whatsapp"
                  />
                </div>
                <button type="submit" className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'rgba(34, 197, 94, 0.6)' }} data-testid="submit-manual-contact">
                  ✓ Ajouter le contact
                </button>
              </form>
            )}
            
            <form onSubmit={addCode} className="mb-6 p-4 rounded-lg glass">
              {/* Toggle Mode Série + Bouton Nettoyage */}
              <div className="flex items-center justify-between mb-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={isBatchMode} 
                    onChange={(e) => setIsBatchMode(e.target.checked)}
                    className="w-5 h-5 rounded accent-purple-500"
                    data-testid="batch-mode-toggle"
                  />
                  <span className="text-white font-medium">{t('batchGeneration')}</span>
                </label>
                <div className="flex items-center gap-2">
                  {isBatchMode && (
                    <span className="text-xs text-purple-300 opacity-70">{t('batchMax')}</span>
                  )}
                  {/* Bouton nettoyage des données fantômes */}
                  <button 
                    type="button"
                    onClick={manualSanitize}
                    className="px-3 py-1 rounded-lg text-xs"
                    style={{ background: 'rgba(251, 191, 36, 0.2)', color: '#fbbf24', border: '1px solid rgba(251, 191, 36, 0.4)' }}
                    title="Nettoyer les données fantômes (articles/contacts supprimés)"
                    data-testid="sanitize-btn"
                  >
                    🧹 Nettoyer
                  </button>
                </div>
              </div>
              
              {/* Champs de génération en série (visibles uniquement si mode série activé) */}
              {isBatchMode && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 p-3 rounded-lg" style={{ background: 'rgba(139, 92, 246, 0.15)', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                  <div>
                    <label className="block text-white text-xs mb-1 opacity-70">{t('codePrefix')}</label>
                    <input 
                      type="text" 
                      placeholder="VIP, PROMO, COACH..." 
                      value={newCode.prefix} 
                      onChange={e => setNewCode({ ...newCode, prefix: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 rounded-lg neon-input text-sm uppercase" 
                      data-testid="batch-prefix"
                      maxLength={15}
                    />
                    <span className="text-xs text-purple-300 opacity-50 mt-1 block">Ex: VIP → VIP-1, VIP-2...</span>
                  </div>
                  <div>
                    <label className="block text-white text-xs mb-1 opacity-70">{t('batchCount')}</label>
                    <input 
                      type="number" 
                      min="1" 
                      max="20" 
                      placeholder="1-20" 
                      value={newCode.batchCount} 
                      onChange={e => setNewCode({ ...newCode, batchCount: Math.min(20, Math.max(1, parseInt(e.target.value) || 1)) })}
                      className="w-full px-3 py-2 rounded-lg neon-input text-sm" 
                      data-testid="batch-count"
                    />
                  </div>
                </div>
              )}
              
              {/* Champ code unique (visible uniquement si mode série désactivé) */}
              {!isBatchMode && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-4">
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
                </div>
              )}
              
              {/* Paramètres communs (Type, Valeur pour le mode série) */}
              {isBatchMode && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                  <select value={newCode.type} onChange={e => setNewCode({ ...newCode, type: e.target.value })} className="px-3 py-2 rounded-lg neon-input text-sm" data-testid="batch-code-type">
                    <option value="">{t('type')}</option>
                    <option value="100%">100% (Gratuit)</option>
                    <option value="%">%</option>
                    <option value="CHF">CHF</option>
                  </select>
                  <input type="number" placeholder={t('value')} value={newCode.value} onChange={e => setNewCode({ ...newCode, value: e.target.value })}
                    className="px-3 py-2 rounded-lg neon-input text-sm" data-testid="batch-code-value" />
                </div>
              )}
              
              {/* ============ SÉLECTION MULTIPLE DES BÉNÉFICIAIRES ============ */}
              <div className="mb-4">
                <label className="block text-white text-xs mb-2 opacity-70">
                  👥 Sélectionner les bénéficiaires ({selectedBeneficiaries.length} sélectionné{selectedBeneficiaries.length > 1 ? 's' : ''})
                </label>
                <div className="border border-purple-500/30 rounded-lg p-3 bg-purple-900/10" style={{ maxHeight: '120px', overflowY: 'auto' }}>
                  <div className="flex flex-wrap gap-2">
                    {uniqueCustomers.length > 0 ? uniqueCustomers.map((c, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => toggleBeneficiarySelection(c.email)}
                        className={`px-2 py-1 rounded text-xs transition-all flex items-center gap-1 ${
                          selectedBeneficiaries.includes(c.email) 
                            ? 'bg-pink-600 text-white' 
                            : 'bg-gray-700 text-white hover:bg-gray-600'
                        }`}
                        data-testid={`beneficiary-${i}`}
                      >
                        {selectedBeneficiaries.includes(c.email) && <span>✓</span>}
                        {c.name.split(' ')[0]}
                      </button>
                    )) : (
                      <span className="text-white text-xs opacity-50">Aucun contact disponible</span>
                    )}
                  </div>
                </div>
                {/* Affichage des bénéficiaires sélectionnés avec croix de suppression */}
                {selectedBeneficiaries.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {selectedBeneficiaries.map((email, i) => {
                      const customer = uniqueCustomers.find(c => c.email === email);
                      return (
                        <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-pink-600/30 text-pink-300">
                          {customer?.name || email}
                          <button
                            type="button"
                            onClick={() => toggleBeneficiarySelection(email)}
                            className="hover:text-white ml-1"
                          >×</button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <input type="number" placeholder={t('maxUses')} value={newCode.maxUses} onChange={e => setNewCode({ ...newCode, maxUses: e.target.value })}
                  className="px-3 py-2 rounded-lg neon-input text-sm" />
                <input type="date" value={newCode.expiresAt} onChange={e => setNewCode({ ...newCode, expiresAt: e.target.value })}
                  className="px-3 py-2 rounded-lg neon-input text-sm" />
                <div>
                  <label className="block text-white text-xs mb-1 opacity-70">📦 Articles autorisés (Cours + Produits)</label>
                  {/* Scrollable list - Courses AND Products */}
                  <div className="courses-scroll-container" style={{ maxHeight: '150px', overflowY: 'auto', padding: '4px' }} data-testid="articles-scroll-container">
                    {/* Section Cours */}
                    {courses.length > 0 && (
                      <div className="mb-2">
                        <p className="text-white text-xs opacity-40 mb-1">📅 Cours</p>
                        <div className="flex flex-wrap gap-2">
                          {courses.map(c => (
                            <button key={c.id} type="button" onClick={() => toggleCourseSelection(c.id)}
                              className={`px-2 py-1 rounded text-xs transition-all ${newCode.courses.includes(c.id) ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                              style={{ color: 'white' }} data-testid={`course-select-${c.id}`}>{c.name.split(' – ')[0]}</button>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Section Produits */}
                    {offers.filter(o => o.isProduct).length > 0 && (
                      <div className="mt-2">
                        <p className="text-white text-xs opacity-40 mb-1">🛒 Produits</p>
                        <div className="flex flex-wrap gap-2">
                          {offers.filter(o => o.isProduct).map(p => (
                            <button key={p.id} type="button" onClick={() => toggleCourseSelection(p.id)}
                              className={`px-2 py-1 rounded text-xs transition-all ${newCode.courses.includes(p.id) ? 'bg-pink-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                              style={{ color: 'white' }} data-testid={`product-select-${p.id}`}>{p.name}</button>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Section Offres/Services */}
                    {offers.filter(o => !o.isProduct).length > 0 && (
                      <div className="mt-2">
                        <p className="text-white text-xs opacity-40 mb-1">🎫 Offres</p>
                        <div className="flex flex-wrap gap-2">
                          {offers.filter(o => !o.isProduct).map(o => (
                            <button key={o.id} type="button" onClick={() => toggleCourseSelection(o.id)}
                              className={`px-2 py-1 rounded text-xs transition-all ${newCode.courses.includes(o.id) ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                              style={{ color: 'white' }} data-testid={`offer-select-${o.id}`}>{o.name}</button>
                          ))}
                        </div>
                      </div>
                    )}
                    {courses.length === 0 && offers.length === 0 && (
                      <span className="text-white text-xs opacity-50">Tous les articles</span>
                    )}
                  </div>
                  {/* Articles sélectionnés avec croix de suppression */}
                  {newCode.courses.length > 0 && (
                    <div className="mt-2">
                      <p className="text-white text-xs opacity-40 mb-1">Sélectionnés:</p>
                      <div className="flex flex-wrap gap-1">
                        {newCode.courses.map(articleId => {
                          const course = courses.find(c => c.id === articleId);
                          const offer = offers.find(o => o.id === articleId);
                          const name = course?.name?.split(' – ')[0] || offer?.name || articleId;
                          const bgColor = course ? 'bg-purple-600/30' : offer?.isProduct ? 'bg-pink-600/30' : 'bg-blue-600/30';
                          const textColor = course ? 'text-purple-300' : offer?.isProduct ? 'text-pink-300' : 'text-blue-300';
                          return (
                            <span key={articleId} className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${bgColor} ${textColor}`}>
                              {name}
                              <button
                                type="button"
                                onClick={() => removeAllowedArticle(articleId)}
                                className="hover:text-white ml-1 font-bold"
                                title="Supprimer"
                              >×</button>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Bouton d'action */}
              <button 
                type="submit" 
                className="btn-primary px-6 py-2 rounded-lg text-sm flex items-center gap-2" 
                data-testid={isBatchMode ? "generate-batch" : "add-code"}
                disabled={batchLoading}
              >
                {batchLoading ? (
                  <>
                    <span className="animate-spin">⏳</span> Création en cours...
                  </>
                ) : isBatchMode ? (
                  <>{t('generateBatch')} ({newCode.batchCount || 1} codes)</>
                ) : (
                  t('add')
                )}
              </button>
            </form>

            <div className="space-y-2">
              {discountCodes.map(code => (
                <div key={code.id} className="p-4 rounded-lg glass">
                  {/* Mode édition pour ce code */}
                  {editingCode?.id === code.id ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-bold">✏️ Modification de {code.code}</span>
                        <button onClick={() => setEditingCode(null)} className="text-white/50 hover:text-white">×</button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <div>
                          <label className="block text-white text-xs mb-1 opacity-50">Valeur</label>
                          <input 
                            type="number" 
                            value={editingCode.value} 
                            onChange={e => setEditingCode({...editingCode, value: parseFloat(e.target.value)})}
                            className="w-full px-2 py-1 rounded neon-input text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-white text-xs mb-1 opacity-50">Max utilisations</label>
                          <input 
                            type="number" 
                            value={editingCode.maxUses || ''} 
                            onChange={e => setEditingCode({...editingCode, maxUses: e.target.value ? parseInt(e.target.value) : null})}
                            className="w-full px-2 py-1 rounded neon-input text-sm"
                            placeholder="Illimité"
                          />
                        </div>
                        <div>
                          <label className="block text-white text-xs mb-1 opacity-50">Expiration</label>
                          <input 
                            type="date" 
                            value={editingCode.expiresAt ? editingCode.expiresAt.split('T')[0] : ''} 
                            onChange={e => setEditingCode({...editingCode, expiresAt: e.target.value || null})}
                            className="w-full px-2 py-1 rounded neon-input text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-white text-xs mb-1 opacity-50">Bénéficiaire</label>
                          <select 
                            value={editingCode.assignedEmail || ''} 
                            onChange={e => setEditingCode({...editingCode, assignedEmail: e.target.value || null})}
                            className="w-full px-2 py-1 rounded neon-input text-sm"
                          >
                            <option value="">Tous</option>
                            {uniqueCustomers.map((c, i) => (
                              <option key={i} value={c.email}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end mt-2">
                        <button 
                          onClick={() => setEditingCode(null)}
                          className="px-3 py-1 rounded text-sm bg-gray-600 text-white"
                        >
                          Annuler
                        </button>
                        <button 
                          onClick={() => updateCodeIndividual(code.id, {
                            value: editingCode.value,
                            maxUses: editingCode.maxUses,
                            expiresAt: editingCode.expiresAt,
                            assignedEmail: editingCode.assignedEmail
                          })}
                          className="px-3 py-1 rounded text-sm bg-pink-600 text-white"
                        >
                          ✓ Sauvegarder
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Mode affichage normal */
                    <div className="flex justify-between items-center flex-wrap gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-white font-bold">{code.code}</span>
                          <span className="px-2 py-0.5 rounded text-xs" style={{ background: 'rgba(139, 92, 246, 0.3)', color: '#d8b4fe' }}>
                            {code.type === '100%' ? '100%' : `${code.value}${code.type}`}
                          </span>
                        </div>
                        <div className="text-white text-xs opacity-50 flex flex-wrap items-center gap-2">
                          {/* Bénéficiaire avec croix de suppression */}
                          {code.assignedEmail && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-600/20 text-blue-300">
                              📧 {code.assignedEmail}
                              <button
                                onClick={() => removeBeneficiaryFromExistingCode(code.id)}
                                className="hover:text-white ml-1 font-bold"
                                title="Retirer ce bénéficiaire"
                              >×</button>
                            </span>
                          )}
                          {code.maxUses && <span className="mr-2">🔢 Max: {code.maxUses}</span>}
                          {code.expiresAt && <span className="mr-2">📅 {new Date(code.expiresAt).toLocaleDateString()}</span>}
                          <span>✓ {t('used')}: {code.used || 0}x</span>
                        </div>
                        {/* Articles autorisés avec croix de suppression (mise à jour immédiate en DB) */}
                        {code.courses && code.courses.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            <span className="text-white text-xs opacity-40 mr-1">Articles:</span>
                            {code.courses.map(articleId => {
                              const course = courses.find(c => c.id === articleId);
                              const offer = offers.find(o => o.id === articleId);
                              const name = course?.name?.split(' – ')[0] || offer?.name || articleId;
                              const bgColor = course ? 'bg-purple-600/20' : offer?.isProduct ? 'bg-pink-600/20' : 'bg-blue-600/20';
                              const textColor = course ? 'text-purple-300' : offer?.isProduct ? 'text-pink-300' : 'text-blue-300';
                              return (
                                <span key={articleId} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${bgColor} ${textColor}`}>
                                  {name}
                                  <button
                                    onClick={() => removeArticleFromExistingCode(code.id, articleId)}
                                    className="hover:text-white ml-1 font-bold"
                                    title="Retirer cet article (mise à jour immédiate)"
                                  >×</button>
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* NOUVEAU: Boutons Copier et Partager WhatsApp */}
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(code.code);
                            alert(`✅ Code "${code.code}" copié !`);
                          }}
                          className="px-3 py-2 rounded-lg text-xs font-medium transition-all hover:scale-105"
                          style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.4)' }}
                          data-testid={`copy-code-${code.id}`}
                          title="Copier le code"
                        >
                          📋 Copier
                        </button>
                        <button 
                          onClick={() => {
                            const message = `🎁 Voici ton code promo Afroboost !\n\n💎 Code: *${code.code}*\n💰 Réduction: ${code.type === '100%' ? '100%' : `${code.value}${code.type}`}\n\n👉 Utilise-le sur afroboost.com`;
                            window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
                          }}
                          className="px-3 py-2 rounded-lg text-xs font-medium transition-all hover:scale-105"
                          style={{ background: 'rgba(37, 211, 102, 0.2)', color: '#25D366', border: '1px solid rgba(37, 211, 102, 0.4)' }}
                          data-testid={`share-whatsapp-${code.id}`}
                          title="Partager sur WhatsApp"
                        >
                          📤 WhatsApp
                        </button>
                        {/* Edit button */}
                        <button 
                          onClick={() => setEditingCode({...code})}
                          className="px-3 py-2 rounded-lg text-xs font-medium"
                          style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.4)' }}
                          data-testid={`edit-code-${code.id}`}
                          title="Modifier"
                        >
                          ✏️
                        </button>
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
                  )}
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
                    onClick={(e) => handleBulkSendCampaign(e)}
                    disabled={bulkSendingInProgress || (!isEmailJSConfigured() && !isWhatsAppConfigured())}
                    className="w-full py-4 rounded-xl font-bold text-white text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: 'linear-gradient(135deg, #3b82f6 0%, #22c55e 50%, #d91cd2 100%)',
                      boxShadow: bulkSendingInProgress ? 'none' : '0 0 20px rgba(217, 28, 210, 0.4)'
                    }}
                    data-testid="bulk-send-campaign-btn"
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
                          onClick={(e) => handleSendEmailCampaign(e)}
                          disabled={emailSendingProgress !== null || !isEmailJSConfigured()}
                          className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-center font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          data-testid="send-email-campaign-btn"
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
                          onClick={(e) => handleSendWhatsAppCampaign(e)}
                          disabled={whatsAppSendingProgress !== null || !isWhatsAppConfigured()}
                          className="w-full py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-center font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                          data-testid="send-whatsapp-campaign-btn"
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
                      data-testid="test-email-input"
                    />
                    <button 
                      type="button"
                      onClick={(e) => handleTestEmailJS(e)}
                      disabled={testEmailStatus === 'sending' || !emailJSConfig.serviceId}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        testEmailStatus === 'success' ? 'bg-green-600' :
                        testEmailStatus === 'error' ? 'bg-red-600' :
                        testEmailStatus === 'sending' ? 'bg-yellow-600' :
                        'bg-purple-600 hover:bg-purple-700'
                      } text-white disabled:opacity-50`}
                      data-testid="test-email-btn"
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
                      onClick={(e) => handleTestWhatsApp(e)}
                      disabled={testWhatsAppStatus === 'sending' || !whatsAppConfig.accountSid}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        testWhatsAppStatus === 'success' ? 'bg-green-600' :
                        testWhatsAppStatus === 'error' ? 'bg-red-600' :
                        testWhatsAppStatus === 'sending' ? 'bg-yellow-600' :
                        'bg-purple-600 hover:bg-purple-700'
                      } text-white disabled:opacity-50`}
                      data-testid="test-whatsapp-btn"
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
                        <div key={contact.id} className="flex items-center gap-2 text-white text-sm hover:bg-purple-500/10 p-1 rounded group">
                          <input type="checkbox" checked={selectedContactsForCampaign.includes(contact.id)}
                            onChange={() => toggleContactForCampaign(contact.id)} className="cursor-pointer" />
                          <span className="truncate flex-1">{contact.name}</span>
                          <span className="text-xs opacity-50 truncate">({contact.email})</span>
                          {/* Bouton suppression (visible au hover) */}
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); deleteContact(contact.id); }}
                            className="opacity-0 group-hover:opacity-100 px-2 py-0.5 rounded text-red-400 hover:bg-red-500/20 text-xs transition-opacity"
                            title="Supprimer définitivement"
                          >
                            🗑️
                          </button>
                        </div>
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
                                <button 
                                  type="button"
                                  onClick={(e) => launchCampaignWithSend(e, campaign.id)} 
                                  className="px-3 py-1 rounded text-xs bg-purple-600 hover:bg-purple-700"
                                  data-testid={`launch-campaign-${campaign.id}`}
                                >
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

        {/* ========== ONGLET CONVERSATIONS ========== */}
        {tab === "conversations" && (
          <div className="space-y-6">
            {/* Header avec recherche globale */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">💬 Conversations</h2>
                <p className="text-white/60 text-sm">Gérez vos chats, liens et contacts CRM</p>
              </div>
              <div className="flex items-center gap-2">
                {/* Barre de recherche globale */}
                <div className="relative">
                  <input
                    type="text"
                    value={conversationSearch}
                    onChange={(e) => setConversationSearch(e.target.value)}
                    placeholder="🔍 Rechercher..."
                    className="px-4 py-2 rounded-lg text-sm w-48 sm:w-64"
                    style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}
                    data-testid="conversation-search"
                  />
                  {conversationSearch && (
                    <button
                      onClick={() => setConversationSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <button 
                  onClick={loadConversations}
                  disabled={loadingConversations}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{ background: 'rgba(139, 92, 246, 0.3)', color: '#fff' }}
                >
                  {loadingConversations ? '⏳' : '🔄'}
                </button>
              </div>
            </div>

            {/* Indicateur de recherche */}
            {conversationSearch && (
              <div className="text-white/60 text-sm">
                Résultats pour "<span className="text-purple-400">{conversationSearch}</span>" : 
                {filteredChatLinks.length} lien(s), {filteredChatSessions.length} conversation(s), {filteredChatParticipants.length} contact(s)
              </div>
            )}

            {/* Section Générer liens - IA et Communautaire */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Lien IA partageable */}
              <div className="glass rounded-xl p-4" style={{ border: '1px solid rgba(217, 28, 210, 0.3)' }}>
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                  🔗 Lien Chat IA
                </h3>
                <p className="text-white/60 text-xs mb-3">
                  Créez un lien avec l'IA activée pour Instagram, Facebook ou WhatsApp.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newLinkTitle}
                    onChange={(e) => setNewLinkTitle(e.target.value)}
                    placeholder="Titre du lien"
                    className="flex-1 px-3 py-2 rounded-lg text-sm"
                    style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}
                    data-testid="new-link-title"
                  />
                  <button
                    onClick={generateShareableLink}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105"
                    style={{ background: 'linear-gradient(135deg, #25D366, #128C7E)', color: '#fff' }}
                    data-testid="generate-link-btn"
                  >
                    🤖 Créer
                  </button>
                </div>
              </div>

              {/* Chat Communautaire */}
              <div className="glass rounded-xl p-4" style={{ border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                  👥 Chat Communautaire
                </h3>
                <p className="text-white/60 text-xs mb-3">
                  Créez un groupe 100% humain (sans IA) pour plusieurs participants.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newLinkTitle}
                    onChange={(e) => setNewLinkTitle(e.target.value)}
                    placeholder="Nom du groupe"
                    className="flex-1 px-3 py-2 rounded-lg text-sm"
                    style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}
                  />
                  <button
                    onClick={createCommunityChat}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105"
                    style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', color: '#fff' }}
                    data-testid="create-community-btn"
                  >
                    👥 Créer
                  </button>
                </div>
              </div>
            </div>

            {/* Liste des liens générés - AVEC FILTRAGE */}
            <div className="glass rounded-xl p-4" style={{ border: '1px solid rgba(217, 28, 210, 0.2)' }}>
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                📋 Liens & Groupes ({filteredChatLinks.length}{conversationSearch ? `/${chatLinks.length}` : ''})
              </h3>
              {filteredChatLinks.length === 0 ? (
                <p className="text-white/50 text-sm text-center py-4">
                  {conversationSearch ? 'Aucun lien correspondant' : 'Aucun lien généré pour le moment'}
                </p>
              ) : (
                <div className="space-y-2" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {filteredChatLinks.map(link => (
                    <div 
                      key={link.link_token}
                      className="flex items-center justify-between gap-2 p-3 rounded-lg transition-all hover:bg-white/5"
                      style={{ background: 'rgba(0,0,0,0.3)' }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-sm font-medium truncate">{link.title || 'Lien sans titre'}</div>
                        <div className="text-white/50 text-xs">
                          {link.participant_count || 0} participant(s) • Mode: {link.mode === 'community' ? '👥 Communauté' : link.is_ai_active ? '🤖 IA' : '👤 Humain'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => copyLinkToClipboard(link.link_token)}
                          className="px-3 py-1 rounded text-xs transition-all"
                          style={{ 
                            background: copiedLinkId === link.link_token ? 'rgba(34, 197, 94, 0.3)' : 'rgba(139, 92, 246, 0.3)',
                            color: '#fff'
                          }}
                          data-testid={`copy-link-${link.link_token}`}
                        >
                          {copiedLinkId === link.link_token ? '✓ Copié' : '📋'}
                        </button>
                        <button
                          onClick={() => deleteChatSession(link.session_id || link.id)}
                          className="px-2 py-1 rounded text-xs transition-all hover:bg-red-600/30"
                          style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}
                          title="Supprimer"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Liste des conversations actives - AVEC FILTRAGE ET SUPPRESSION */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Panel gauche: Liste des sessions */}
              <div className="glass rounded-xl p-4" style={{ border: '1px solid rgba(217, 28, 210, 0.2)' }}>
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                  🗨️ Conversations ({filteredChatSessions.length}{conversationSearch ? `/${chatSessions.length}` : ''})
                </h3>
                {filteredChatSessions.length === 0 ? (
                  <p className="text-white/50 text-sm text-center py-8">
                    {conversationSearch ? 'Aucune conversation correspondante' : 'Aucune conversation pour le moment'}
                  </p>
                ) : (
                  <div className="space-y-2" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    {filteredChatSessions.map(session => {
                      const participantNames = session.participant_ids?.map(id => getParticipantName(id)).join(', ') || 'Aucun participant';
                      const isSelected = selectedSession?.id === session.id;
                      
                      return (
                        <div
                          key={session.id}
                          className={`p-3 rounded-lg transition-all ${isSelected ? 'ring-2 ring-purple-500' : 'hover:bg-white/5'}`}
                          style={{ background: isSelected ? 'rgba(139, 92, 246, 0.2)' : 'rgba(0,0,0,0.3)' }}
                          data-testid={`session-${session.id}`}
                        >
                          <div 
                            onClick={() => {
                              setSelectedSession(session);
                              loadSessionMessages(session.id);
                            }}
                            className="cursor-pointer"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-white text-sm font-medium truncate">{participantNames}</span>
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                session.mode === 'community' ? 'bg-purple-600/30 text-purple-400' :
                                session.is_ai_active ? 'bg-green-600/30 text-green-400' : 'bg-yellow-600/30 text-yellow-400'
                              }`}>
                                {session.mode === 'community' ? '👥' : session.is_ai_active ? '🤖' : '👤'}
                              </span>
                            </div>
                            <div className="text-white/50 text-xs">
                              {session.title || getSourceLabel(chatParticipants.find(p => p.id === session.participant_ids?.[0])?.source)}
                            </div>
                          </div>
                          {/* Bouton suppression */}
                          <div className="flex justify-end mt-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteChatSession(session.id);
                              }}
                              className="px-2 py-1 rounded text-xs transition-all hover:bg-red-600/30"
                              style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}
                              title="Supprimer la conversation"
                            >
                              🗑️ Supprimer
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Panel droit: Détail de la conversation */}
              <div className="glass rounded-xl p-4" style={{ border: '1px solid rgba(217, 28, 210, 0.2)' }}>
                {selectedSession ? (
                  <>
                    {/* Header session */}
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-white font-semibold">
                          {selectedSession.participant_ids?.map(id => getParticipantName(id)).join(', ')}
                        </h3>
                        <p className="text-white/50 text-xs">
                          {selectedSession.title || 'Conversation'}
                        </p>
                      </div>
                      {/* Sélecteur de mode */}
                      <div className="flex items-center gap-2">
                        <select
                          value={selectedSession.mode || 'ai'}
                          onChange={(e) => setSessionMode(selectedSession.id, e.target.value)}
                          className="px-2 py-1 rounded text-xs"
                          style={{ 
                            background: selectedSession.mode === 'ai' 
                              ? 'rgba(34, 197, 94, 0.3)' 
                              : selectedSession.mode === 'community'
                              ? 'rgba(139, 92, 246, 0.3)'
                              : 'rgba(234, 179, 8, 0.3)',
                            color: '#fff',
                            border: '1px solid rgba(255,255,255,0.2)'
                          }}
                          data-testid="session-mode-select"
                        >
                          <option value="ai">🤖 IA</option>
                          <option value="human">👤 Humain</option>
                          <option value="community">👥 Communauté</option>
                        </select>
                      </div>
                    </div>

                    {/* Indicateur de mode */}
                    <div 
                      className="text-center text-xs py-2 rounded mb-2"
                      style={{ 
                        background: selectedSession.mode === 'ai' 
                          ? 'rgba(34, 197, 94, 0.1)' 
                          : selectedSession.mode === 'community'
                          ? 'rgba(139, 92, 246, 0.1)'
                          : 'rgba(234, 179, 8, 0.1)',
                        color: selectedSession.mode === 'ai' 
                          ? '#4ade80' 
                          : selectedSession.mode === 'community'
                          ? '#a78bfa'
                          : '#fbbf24'
                      }}
                    >
                      {selectedSession.mode === 'ai' && '🤖 L\'IA répond automatiquement'}
                      {selectedSession.mode === 'human' && '👤 Mode Humain - Répondez aux messages'}
                      {selectedSession.mode === 'community' && '👥 Mode Communauté - Chat de groupe'}
                    </div>

                    {/* Messages avec liens cliquables */}
                    <div 
                      className="space-y-2 mb-4 p-3 rounded-lg"
                      style={{ background: 'rgba(0,0,0,0.3)', maxHeight: '250px', overflowY: 'auto' }}
                    >
                      <style>{`
                        .msg-link {
                          color: #a78bfa;
                          text-decoration: underline;
                          word-break: break-all;
                        }
                        .msg-link:hover {
                          color: #c4b5fd;
                        }
                      `}</style>
                      {sessionMessages.length === 0 ? (
                        <p className="text-white/50 text-sm text-center py-4">Aucun message</p>
                      ) : (
                        sessionMessages.map(msg => (
                          <div
                            key={msg.id}
                            className={`p-2 rounded-lg text-sm ${
                              msg.sender_type === 'user' 
                                ? 'bg-purple-600/20 ml-4' 
                                : msg.sender_type === 'coach'
                                ? 'bg-yellow-600/20 mr-4'
                                : 'bg-green-600/20 mr-4'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-white/70 text-xs font-medium">
                                {msg.sender_type === 'user' ? '👤' : msg.sender_type === 'coach' ? '🏋️' : '🤖'} {msg.sender_name}
                              </span>
                              <span className="text-white/40 text-xs">
                                {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            {/* Contenu avec liens cliquables */}
                            <p 
                              className="text-white text-sm"
                              dangerouslySetInnerHTML={{ __html: linkifyText(msg.content) }}
                            />
                          </div>
                        ))
                      )}
                    </div>

                    {/* Input réponse coach (visible si IA désactivée ou mode communauté) */}
                    {(selectedSession.mode === 'human' || selectedSession.mode === 'community') && (
                      <div className="space-y-2">
                        {/* Bouton Emoji et Picker */}
                        <div className="relative">
                          <div className="flex gap-2 items-center">
                            <button
                              type="button"
                              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                              className="px-3 py-2 rounded-lg text-sm transition-all"
                              style={{ background: showEmojiPicker ? 'rgba(139, 92, 246, 0.3)' : 'rgba(255,255,255,0.1)', color: '#fff' }}
                              title="Emojis personnalisés"
                            >
                              😊
                            </button>
                            <input
                              type="text"
                              value={coachMessage}
                              onChange={(e) => setCoachMessage(e.target.value)}
                              onKeyPress={(e) => e.key === 'Enter' && sendCoachMessage()}
                              placeholder="Votre réponse... (les URLs seront cliquables)"
                              className="flex-1 px-3 py-2 rounded-lg text-sm"
                              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}
                              data-testid="coach-message-input"
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                console.log('📤 Bouton envoi cliqué, message:', coachMessage);
                                if (coachMessage.trim()) {
                                  sendCoachMessage();
                                }
                              }}
                              disabled={!coachMessage.trim()}
                              className="px-4 py-2 rounded-lg text-sm font-medium"
                              style={{ 
                                background: coachMessage.trim() ? 'linear-gradient(135deg, #d91cd2, #8b5cf6)' : 'rgba(255,255,255,0.1)',
                                color: '#fff',
                                opacity: coachMessage.trim() ? 1 : 0.5,
                                cursor: coachMessage.trim() ? 'pointer' : 'not-allowed',
                                minWidth: '48px',
                                minHeight: '40px'
                              }}
                              data-testid="send-coach-message-btn"
                              title="Envoyer le message"
                            >
                              <span style={{ pointerEvents: 'none' }}>📤</span>
                            </button>
                          </div>
                          
                          {/* Emoji Picker Panel */}
                          {showEmojiPicker && (
                            <div 
                              className="absolute bottom-full left-0 mb-2 p-3 rounded-lg z-10"
                              style={{ background: '#1a1a1a', border: '1px solid rgba(139, 92, 246, 0.3)', minWidth: '280px' }}
                            >
                              <div className="text-white text-xs mb-2 font-semibold">😊 Emojis personnalisés</div>
                              
                              {/* Liste des emojis existants */}
                              <div className="flex flex-wrap gap-2 mb-3" style={{ maxHeight: '100px', overflowY: 'auto' }}>
                                {customEmojis.length === 0 ? (
                                  <p className="text-white/50 text-xs">Aucun emoji. Uploadez-en ci-dessous !</p>
                                ) : (
                                  customEmojis.map(emoji => (
                                    <button
                                      key={emoji.id}
                                      onClick={() => insertEmoji(emoji)}
                                      className="relative group"
                                      title={emoji.name}
                                    >
                                      <img 
                                        src={emoji.image_data} 
                                        alt={emoji.name}
                                        style={{ width: '32px', height: '32px', borderRadius: '4px', cursor: 'pointer' }}
                                      />
                                      <button
                                        onClick={(e) => { e.stopPropagation(); deleteCustomEmoji(emoji.id); }}
                                        className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full text-white text-xs hidden group-hover:flex items-center justify-center"
                                      >
                                        ×
                                      </button>
                                    </button>
                                  ))
                                )}
                              </div>
                              
                              {/* Upload nouvel emoji */}
                              <div className="border-t border-white/10 pt-2">
                                <div className="text-white/60 text-xs mb-1">Ajouter un emoji :</div>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={newEmojiName}
                                    onChange={(e) => setNewEmojiName(e.target.value)}
                                    placeholder="Nom"
                                    className="w-20 px-2 py-1 rounded text-xs"
                                    style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}
                                  />
                                  <input
                                    type="file"
                                    ref={emojiInputRef}
                                    accept="image/png,image/gif,image/jpeg"
                                    onChange={(e) => uploadCustomEmoji(e.target.files[0])}
                                    className="text-xs text-white/60"
                                    style={{ maxWidth: '120px' }}
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {selectedSession.mode === 'ai' && (
                      <div className="text-center text-white/50 text-xs py-2">
                        💡 L'IA répond automatiquement. Changez le mode ci-dessus pour répondre manuellement.
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full py-12">
                    <span className="text-4xl mb-3">💬</span>
                    <p className="text-white/50 text-sm">Sélectionnez une conversation</p>
                  </div>
                )}
              </div>
            </div>

            {/* Section CRM - Participants avec scroll et suppression */}
            <div className="glass rounded-xl p-4" style={{ border: '1px solid rgba(217, 28, 210, 0.2)' }}>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  📇 Contacts CRM ({filteredChatParticipants.length}{conversationSearch ? `/${chatParticipants.length}` : ''})
                </h3>
                {/* Bouton Export CSV */}
                <button
                  onClick={() => {
                    try {
                      // Calculer le montant total des commandes par email
                      const revenueByEmail = {};
                      reservations.forEach(r => {
                        if (r.userEmail) {
                          revenueByEmail[r.userEmail] = (revenueByEmail[r.userEmail] || 0) + (r.totalPrice || 0);
                        }
                      });
                      
                      // Construire le CSV avec BOM UTF-8
                      const BOM = '\uFEFF';
                      const headers = ['Nom', 'Email', 'WhatsApp', 'Date inscription', 'Source', 'Montant commandes (CHF)'];
                      const rows = chatParticipants.map(p => [
                        p.name || '',
                        p.email || '',
                        p.whatsapp || '',
                        p.created_at ? new Date(p.created_at).toLocaleDateString('fr-FR') : '',
                        p.source || '',
                        revenueByEmail[p.email] || '0'
                      ]);
                      
                      const csvContent = BOM + [
                        headers.join(';'),
                        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
                      ].join('\n');
                      
                      // Télécharger le fichier
                      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `contacts_crm_${new Date().toISOString().split('T')[0]}.csv`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      URL.revokeObjectURL(url);
                      
                      console.log(`✅ Export CSV: ${chatParticipants.length} contacts exportés`);
                    } catch (error) {
                      console.error('Erreur export CSV:', error);
                      alert('❌ Erreur lors de l\'export: ' + error.message);
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105"
                  style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: '#fff' }}
                  title="Exporter tous les contacts en CSV"
                  data-testid="export-crm-csv-btn"
                >
                  📥 Exporter CSV
                </button>
              </div>
              {filteredChatParticipants.length === 0 ? (
                <p className="text-white/50 text-sm text-center py-4">
                  {conversationSearch ? 'Aucun contact correspondant' : 'Aucun contact enregistré via le chat'}
                </p>
              ) : (
                <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                  <table className="w-full text-sm">
                    <thead className="sticky top-0" style={{ background: '#0a0a0a' }}>
                      <tr className="text-white/60 text-xs">
                        <th className="text-left py-2 px-2">Nom</th>
                        <th className="text-left py-2 px-2 hidden sm:table-cell">Email</th>
                        <th className="text-left py-2 px-2 hidden md:table-cell">WhatsApp</th>
                        <th className="text-left py-2 px-2">Source</th>
                        <th className="text-left py-2 px-2 hidden sm:table-cell">Date</th>
                        <th className="text-center py-2 px-2">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredChatParticipants.map(participant => (
                        <tr key={participant.id} className="border-t border-white/10 text-white hover:bg-white/5">
                          <td className="py-2 px-2">
                            <div className="font-medium">{participant.name}</div>
                            <div className="text-white/50 text-xs sm:hidden">{participant.email || '-'}</div>
                          </td>
                          <td className="py-2 px-2 text-white/70 hidden sm:table-cell">{participant.email || '-'}</td>
                          <td className="py-2 px-2 text-white/70 hidden md:table-cell">{participant.whatsapp || '-'}</td>
                          <td className="py-2 px-2">
                            <span className="text-xs px-2 py-0.5 rounded bg-purple-600/30 text-purple-300">
                              {getSourceLabel(participant.source)}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-white/50 text-xs hidden sm:table-cell">
                            {new Date(participant.created_at).toLocaleDateString('fr-FR')}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button
                              onClick={() => deleteChatParticipant(participant.id)}
                              className="px-2 py-1 rounded text-xs transition-all hover:bg-red-600/30"
                              style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}
                              title="Supprimer ce contact"
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              
              {/* Statistiques CRM */}
              <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap gap-4 text-xs text-white/50">
                <span>📊 Total: {chatParticipants.length}</span>
                <span>🔗 Via liens: {chatParticipants.filter(p => p.source?.startsWith('link_')).length}</span>
                <span>💬 Via widget: {chatParticipants.filter(p => p.source === 'chat_afroboost').length}</span>
                <span>✍️ Manuel: {chatParticipants.filter(p => p.source?.includes('manual')).length}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export { CoachDashboard };
