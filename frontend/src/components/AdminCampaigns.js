// AdminCampaigns.js - Gestionnaire de campagnes marketing avec envoi Email/WA/Insta
// Compatible Vercel - Extrait de App.js pour architecture modulaire
import { useState, useMemo, useEffect } from 'react';
import emailjs from '@emailjs/browser';

// Initialisation immédiate d'EmailJS avec votre clé publique
emailjs.init("5LfgQSIEQoqq_XSqt");

// === HOOKS PERSONNALISÉS POUR LES CAMPAGNES ===

/**
 * Hook pour gérer les statistiques des contacts
 */
export const useContactStats = (allContacts, selectedContactsForCampaign, targetType) => {
  return useMemo(() => {
    const contacts = targetType === "selected" 
      ? allContacts.filter(c => selectedContactsForCampaign.includes(c.id))
      : allContacts;
    return {
      total: contacts.length,
      withEmail: contacts.filter(c => c.email && c.email.includes('@')).length,
      withPhone: contacts.filter(c => c.phone).length,
      contacts
    };
  }, [allContacts, selectedContactsForCampaign, targetType]);
};

/**
 * Hook pour la gestion du mode envoi direct
 */
export const useDirectSend = (allContacts, selectedContactsForCampaign, targetType) => {
  const [directSendMode, setDirectSendMode] = useState(false);
  const [currentWhatsAppIndex, setCurrentWhatsAppIndex] = useState(0);
  const [instagramProfile, setInstagramProfile] = useState("afroboost");
  const [messageCopied, setMessageCopied] = useState(false);
  const [isSendingAuto, setIsSendingAuto] = useState(false);

  // Obtenir les contacts pour l'envoi direct
  const getContactsForDirectSend = () => {
    if (targetType === "selected") {
      return allContacts.filter(c => selectedContactsForCampaign.includes(c.id));
    }
    return allContacts;
  };

  // Générer mailto: groupé avec BCC pour tous les emails
  const generateGroupedEmailLink = (campaignName, message, mediaUrl) => {
    const contacts = getContactsForDirectSend();
    const emails = contacts.map(c => c.email).filter(e => e && e.includes('@'));
    
    if (emails.length === 0) return null;
    
    const subject = campaignName || "Afroboost - Message";
    const body = mediaUrl 
      ? `${message}\n\n🔗 Voir le visuel: ${mediaUrl}`
      : message;
    
    const firstEmail = emails[0];
    const bccEmails = emails.slice(1).join(',');
    
    return `mailto:${firstEmail}?${bccEmails ? `bcc=${bccEmails}&` : ''}subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  // Obtenir le contact WhatsApp actuel
  const getCurrentWhatsAppContact = () => {
    const contacts = getContactsForDirectSend().filter(c => c.phone);
    return contacts[currentWhatsAppIndex] || null;
  };

  // Navigation WhatsApp
  const nextWhatsAppContact = () => {
    const contacts = getContactsForDirectSend().filter(c => c.phone);
    if (currentWhatsAppIndex < contacts.length - 1) {
      setCurrentWhatsAppIndex(currentWhatsAppIndex + 1);
    }
  };

  const prevWhatsAppContact = () => {
    if (currentWhatsAppIndex > 0) {
      setCurrentWhatsAppIndex(currentWhatsAppIndex - 1);
    }
  };

  // Copier le message pour Instagram
  const copyMessageForInstagram = async (message, mediaUrl) => {
    const fullMessage = mediaUrl 
      ? `${message}\n\n🔗 ${mediaUrl}`
      : message;
    
    try {
      await navigator.clipboard.writeText(fullMessage);
      setMessageCopied(true);
      setTimeout(() => setMessageCopied(false), 3000);
    } catch (err) {
      const textarea = document.createElement('textarea');
      textarea.value = fullMessage;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setMessageCopied(true);
      setTimeout(() => setMessageCopied(false), 3000);
    }
  };

  // --- NOUVELLE FONCTION D'ENVOI AUTOMATIQUE EMAILJS ---
  const sendAutoEmailJS = async (campaignName, message) => {
    const contacts = getContactsForDirectSend().filter(c => c.email && c.email.includes('@'));
    if (contacts.length === 0) {
      alert("Aucun contact avec email valide trouvé.");
      return;
    }

    setIsSendingAuto(true);
    let successCount = 0;

    try {
      for (const contact of contacts) {
        await emailjs.send(
          "service_8mrmxim",
          "template_3n1u86p",
          {
            to_name: contact.name || "Client",
            to_email: contact.email,
            message: message,
            subject: campaignName || "Afroboost - Message Spécial"
          }
        );
        successCount++;
      }
      alert(`Félicitations ! ${successCount} email(s) envoyé(s) avec succès via EmailJS.`);
    } catch (error) {
      console.error("Erreur EmailJS:", error);
      alert("L'envoi a échoué. Vérifiez vos crédits EmailJS ou la console.");
    } finally {
      setIsSendingAuto(false);
    }
  };

  return {
    directSendMode,
    setDirectSendMode,
    currentWhatsAppIndex,
    instagramProfile,
    setInstagramProfile,
    messageCopied,
    isSendingAuto,
    sendAutoEmailJS,
    generateGroupedEmailLink,
    getCurrentWhatsAppContact,
    nextWhatsAppContact,
    prevWhatsAppContact,
    copyMessageForInstagram,
    getContactsForDirectSend
  };
};

// === FONCTIONS UTILITAIRES POUR LES CAMPAGNES ===

export const generateWhatsAppLink = (phone, message, mediaUrl, contactName) => {
  const formattedPhone = phone?.replace(/\D/g, '');
  let personalizedMessage = message;
  if (contactName) {
    const firstName = contactName.split(' ')[0];
    personalizedMessage = message.replace(/{prénom}/gi, firstName);
  }
  const fullMessage = mediaUrl 
    ? `${personalizedMessage}\n\n🔗 Voir le visuel: ${mediaUrl}`
    : personalizedMessage;
  return `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(fullMessage)}`;
};

export const generateInstagramLink = (username) => {
  return `https://instagram.com/${username || 'afroboost'}`;
};

// === COMPOSANT COMPTEUR DE CONTACTS ===
export const ContactCounter = ({ contactStats, directSendMode, onToggleDirectSend }) => (
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
          onClick={onToggleDirectSend}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${directSendMode ? 'bg-pink-600 text-white' : 'glass text-white border border-purple-500/30'}`}
        >
          {directSendMode ? '✓ Mode Envoi Direct' : '🚀 Envoi Direct'}
        </button>
      </div>
    </div>
  </div>
);

// === COMPOSANT MODE ENVOI DIRECT ===
export const DirectSendPanel = ({
  contactStats,
  newCampaign,
  setNewCampaign,
  generateGroupedEmailLink,
  generateWhatsAppLink,
  getCurrentWhatsAppContact,
  currentWhatsAppIndex,
  prevWhatsAppContact,
  nextWhatsAppContact,
  instagramProfile,
  setInstagramProfile,
  copyMessageForInstagram,
  messageCopied,
  isSendingAuto,
  sendAutoEmailJS
}) => (
  <div className="mb-8 p-5 rounded-xl glass border-2 border-pink-500/50">
    <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
      🚀 Envoi Direct par Canal
      <span className="text-xs text-pink-400 font-normal">(Utilisez le message ci-dessous)</span>
    </h3>

    <div className="mb-4">
      <label className="block mb-2 text-white text-sm">Message à envoyer</label>
      <textarea 
        value={newCampaign.message} 
        onChange={e => setNewCampaign({...newCampaign, message: e.target.value})}
        className="w-full px-4 py-3 rounded-lg neon-input" 
        rows={3}
        placeholder="Votre message..."
      />
      {newCampaign.mediaUrl && (
        <p className="text-xs text-green-400 mt-1">✓ Média attaché: {newCampaign.mediaUrl.substring(0, 50)}...</p>
      )}
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      
      {/* === EMAIL AUTOMATISÉ EMAILJS === */}
      <div className="p-4 rounded-xl bg-blue-900/40 border-2 border-blue-400">
        <h4 className="text-white font-bold mb-3 flex items-center gap-2 text-sm">
          📧 Email Automatique
        </h4>
        <button 
          type="button"
          onClick={() => sendAutoEmailJS(newCampaign.name, newCampaign.message)}
          disabled={isSendingAuto || contactStats.withEmail === 0}
          className={`w-full py-3 rounded-lg ${isSendingAuto ? 'bg-gray-600' : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:scale-105'} text-white text-center font-bold transition-all shadow-lg`}
        >
          {isSendingAuto ? '⏳ Envoi...' : '🚀 Lancer l\'envoi'}
        </button>
        <p className="text-[10px] text-blue-200 mt-2 text-center">Via votre compte EmailJS</p>
      </div>

      {/* === WHATSAPP UN PAR UN === */}
      <div className="p-4 rounded-xl bg-green-900/20 border border-green-500/30">
        <h4 className="text-white font-semibold mb-3 flex items-center gap-2 text-sm">
          📱 WhatsApp
        </h4>
        {contactStats.withPhone > 0 ? (
          <>
            <p className="text-xs text-white/60 mb-2">
              Contact {currentWhatsAppIndex + 1}/{contactStats.withPhone}
            </p>
            {getCurrentWhatsAppContact() && (
              <p className="text-sm text-green-300 mb-3 truncate font-medium">
                → {getCurrentWhatsAppContact()?.name}
              </p>
            )}
            <a 
              href={getCurrentWhatsAppContact() ? generateWhatsAppLink(
                getCurrentWhatsAppContact()?.phone,
                newCampaign.message,
                newCampaign.mediaUrl,
                getCurrentWhatsAppContact()?.name
              ) : '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-center font-medium mb-2 transition-all"
            >
              📱 Ouvrir WA
            </a>
            <div className="flex gap-2">
              <button 
                type="button"
                onClick={prevWhatsAppContact}
                disabled={currentWhatsAppIndex === 0}
                className="flex-1 py-1 rounded-lg glass text-white text-xs disabled:opacity-30"
              >
                ←
              </button>
              <button 
                type="button"
                onClick={nextWhatsAppContact}
                disabled={currentWhatsAppIndex >= contactStats.withPhone - 1}
                className="flex-1 py-1 rounded-lg glass text-white text-xs disabled:opacity-30"
              >
                →
              </button>
            </div>
          </>
        ) : (
          <button disabled className="w-full py-3 rounded-lg bg-gray-600/50 text-gray-400 cursor-not-allowed">
            Aucun numéro
          </button>
        )}
      </div>

      {/* === INSTAGRAM DM === */}
      <div className="p-4 rounded-xl bg-purple-900/20 border border-purple-500/30">
        <h4 className="text-white font-semibold mb-3 flex items-center gap-2 text-sm">
          📸 Instagram DM
        </h4>
        <button 
          type="button"
          onClick={() => copyMessageForInstagram(newCampaign.message, newCampaign.mediaUrl)}
          className={`w-full py-2 rounded-lg ${messageCopied ? 'bg-green-600' : 'bg-purple-600 hover:bg-purple-700'} text-white text-sm font-medium mb-2 transition-all`}
        >
          {messageCopied ? '✓ Copié !' : '📋 Copier'}
        </button>
        <a 
          href={generateInstagramLink(instagramProfile)}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full py-2 rounded-lg glass text-white text-center text-xs hover:bg-purple-500/20 transition-all"
        >
          Ouvrir IG
        </a>
      </div>

    </div>
  </div>
);

// === COMPOSANT BADGE STATUT ===
export const CampaignStatusBadge = ({ status }) => {
  const statusConfig = {
    draft: { label: '📝 Brouillon', className: 'bg-gray-600/30 text-gray-400' },
    scheduled: { label: '⏰ Programmée', className: 'bg-yellow-600/30 text-yellow-400' },
    sending: { label: '🚀 En cours', className: 'bg-blue-600/30 text-blue-400' },
    completed: { label: '✅ Terminée', className: 'bg-green-600/30 text-green-400' },
    failed: { label: '❌ Échouée', className: 'bg-red-600/30 text-red-400' }
  };
  
  const config = statusConfig[status] || statusConfig.draft;
  
  return (
    <span className={`px-2 py-1 rounded text-xs ${config.className}`}>
      {config.label}
    </span>
  );
};

// === COMPOSANT RESULT BADGE ===
export const ResultBadge = ({ status }) => {
  if (status === 'sent') {
    return <span className="px-2 py-1 rounded text-xs bg-green-600/30 text-green-400">✅ Envoyé</span>;
  }
  if (status === 'failed') {
    return <span className="px-2 py-1 rounded text-xs bg-red-600/30 text-red-400">❌ Échec</span>;
  }
  return <span className="px-2 py-1 rounded text-xs bg-gray-600/30 text-gray-400">⏳ En attente</span>;
};

export default {
  useContactStats,
  useDirectSend,
  generateWhatsAppLink,
  generateInstagramLink,
  ContactCounter,
  DirectSendPanel,
  CampaignStatusBadge,
  ResultBadge
};