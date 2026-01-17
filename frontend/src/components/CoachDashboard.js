/**
 * CoachDashboard Component
 * Admin panel for managing the Afroboost application
 * Extracted from App.js for better maintainability
 */
import { useState, useEffect, useRef, useMemo } from "react";
import axios from "axios";
import { QRCodeSVG } from "qrcode.react";
import { 
  getEmailJSConfig, 
  saveEmailJSConfig, 
  isEmailJSConfigured, 
  sendBulkEmails,
  testEmailJSConfig 
} from "../services/emailService";
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

const CoachDashboard = ({ t, lang, onBack, onLogout }) => {
  const [tab, setTab] = useState("reservations");
  const [reservations, setReservations] = useState([]);
  const [courses, setCourses] = useState([]);
  const [offers, setOffers] = useState([]);
  const [users, setUsers] = useState([]);
  const [paymentLinks, setPaymentLinks] = useState({ stripe: "", paypal: "", twint: "", coachWhatsapp: "", coachNotificationEmail: "", coachNotificationPhone: "" });
  const [concept, setConcept] = useState({ appName: "Afroboost", description: "", heroImageUrl: "", logoUrl: "", faviconUrl: "", termsText: "", googleReviewsUrl: "", defaultLandingSection: "sessions", externalLink1Title: "", externalLink1Url: "", externalLink2Title: "", externalLink2Url: "", paymentTwint: false, paymentPaypal: false, paymentCreditCard: false, eventPosterEnabled: false, eventPosterMediaUrl: "" });
  const [discountCodes, setDiscountCodes] = useState([]);
  const [newCode, setNewCode] = useState({ code: "", type: "", value: "", assignedEmail: "", courses: [], maxUses: "", expiresAt: "", batchCount: 1, prefix: "" });
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
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
    
    // Si mode série activé, utiliser la fonction batch
    if (isBatchMode && newCode.batchCount > 1) {
      await addBatchCodes(e);
      return;
    }
    
    const response = await axios.post(`${API}/discount-codes`, {
      code: newCode.code || `CODE-${Date.now().toString().slice(-4)}`,
      type: newCode.type, value: parseFloat(newCode.value),
      assignedEmail: newCode.assignedEmail || null,
      courses: newCode.courses, maxUses: newCode.maxUses ? parseInt(newCode.maxUses) : null,
      expiresAt: newCode.expiresAt || null
    });
    setDiscountCodes([...discountCodes, response.data]);
    setNewCode({ code: "", type: "", value: "", assignedEmail: "", courses: [], maxUses: "", expiresAt: "", batchCount: 1, prefix: "" });
  };

  // Génération en série de codes promo
  const addBatchCodes = async (e) => {
    e.preventDefault();
    if (!newCode.type || !newCode.value) return;
    
    const count = Math.min(Math.max(1, parseInt(newCode.batchCount) || 1), 20); // Entre 1 et 20
    const prefix = newCode.prefix?.trim().toUpperCase() || "CODE";
    
    setBatchLoading(true);
    const createdCodes = [];
    
    try {
      for (let i = 1; i <= count; i++) {
        const codeValue = `${prefix}-${i}`;
        const response = await axios.post(`${API}/discount-codes`, {
          code: codeValue,
          type: newCode.type, 
          value: parseFloat(newCode.value),
          assignedEmail: newCode.assignedEmail || null,
          courses: newCode.courses, 
          maxUses: newCode.maxUses ? parseInt(newCode.maxUses) : null,
          expiresAt: newCode.expiresAt || null
        });
        createdCodes.push(response.data);
      }
      
      setDiscountCodes(prev => [...prev, ...createdCodes]);
      setNewCode({ code: "", type: "", value: "", assignedEmail: "", courses: [], maxUses: "", expiresAt: "", batchCount: 1, prefix: "" });
      setIsBatchMode(false);
      alert(`✅ ${count} ${t('batchSuccess')}`);
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
  
  // Delete reservation
  const deleteReservation = async (reservationId) => {
    if (window.confirm(t('confirmDeleteReservation'))) {
      try {
        await axios.delete(`${API}/reservations/${reservationId}`);
        setReservations(reservations.filter(r => r.id !== reservationId));
      } catch (err) {
        console.error("Erreur suppression réservation:", err);
      }
    }
  };
  
  // Add manual contact to users list (for beneficiary dropdown)
  const addManualContact = async (e) => {
    e.preventDefault();
    if (!manualContact.name || !manualContact.email) return;
    try {
      const response = await axios.post(`${API}/users`, {
        name: manualContact.name,
        email: manualContact.email,
        whatsapp: manualContact.whatsapp || ""
      });
      setUsers([...users, response.data]);
      setManualContact({ name: "", email: "", whatsapp: "" });
      setShowManualContactForm(false);
    } catch (err) {
      console.error("Erreur ajout contact:", err);
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
            <button key={tb.id} onClick={() => setTab(tb.id)} className={`coach-tab px-3 py-2 rounded-lg text-xs sm:text-sm ${tab === tb.id ? 'active' : ''}`}
              style={{ color: 'white' }} data-testid={`coach-tab-${tb.id}`}>{tb.label}</button>
          ))}
        </div>

        {/* Reservations Tab - Responsive: Table on PC, Cards on Mobile */}
        {tab === "reservations" && (
          <div className="card-gradient rounded-xl p-4 sm:p-6">
            <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
              <h2 className="font-semibold text-white text-lg sm:text-xl">{t('reservationsList')}</h2>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => setShowScanner(true)} className="btn-primary px-3 py-2 rounded-lg flex items-center gap-2 text-xs sm:text-sm" data-testid="scan-ticket-btn">
                  📷 Scanner
                </button>
                <button onClick={exportCSV} className="csv-btn text-xs sm:text-sm" data-testid="export-csv">{t('downloadCSV')}</button>
              </div>
            </div>
            
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
                  {/* Actions: Dupliquer + Archiver */}
                  <div className="absolute top-2 right-2 flex gap-1">
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
              {/* Toggle Mode Série */}
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
                {isBatchMode && (
                  <span className="text-xs text-purple-300 opacity-70">{t('batchMax')}</span>
                )}
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
                  {/* Beneficiary Dropdown */}
                  <select value={newCode.assignedEmail} onChange={e => setNewCode({ ...newCode, assignedEmail: e.target.value })}
                    className="px-3 py-2 rounded-lg neon-input text-sm" data-testid="new-code-beneficiary">
                    <option value="">{t('selectBeneficiary')}</option>
                    {uniqueCustomers.map((c, i) => (
                      <option key={i} value={c.email}>{c.name} - {c.email}</option>
                    ))}
                  </select>
                </div>
              )}
              
              {/* Paramètres communs (Type, Valeur pour le mode série) */}
              {isBatchMode && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <select value={newCode.type} onChange={e => setNewCode({ ...newCode, type: e.target.value })} className="px-3 py-2 rounded-lg neon-input text-sm" data-testid="batch-code-type">
                    <option value="">{t('type')}</option>
                    <option value="100%">100% (Gratuit)</option>
                    <option value="%">%</option>
                    <option value="CHF">CHF</option>
                  </select>
                  <input type="number" placeholder={t('value')} value={newCode.value} onChange={e => setNewCode({ ...newCode, value: e.target.value })}
                    className="px-3 py-2 rounded-lg neon-input text-sm" data-testid="batch-code-value" />
                  {/* Beneficiary Dropdown */}
                  <select value={newCode.assignedEmail} onChange={e => setNewCode({ ...newCode, assignedEmail: e.target.value })}
                    className="px-3 py-2 rounded-lg neon-input text-sm" data-testid="batch-code-beneficiary">
                    <option value="">{t('selectBeneficiary')}</option>
                    {uniqueCustomers.map((c, i) => (
                      <option key={i} value={c.email}>{c.name} - {c.email}</option>
                    ))}
                  </select>
                </div>
              )}
              
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

export { CoachDashboard };
