// /components/ChatWidget.js - Widget IA flottant avec capture de leads et reconnaissance automatique
// Architecture modulaire Afroboost - Utilise l'API chat améliorée
// Fonctionnalités: Notifications push, sons, liens cliquables, suppression historique, chat communautaire

import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { playNotificationSound, linkifyText } from '../services/notificationService';
import { 
  isPushSupported, 
  promptForNotifications, 
  registerServiceWorker,
  isSubscribed 
} from '../services/pushNotificationService';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Clé localStorage pour la mémorisation client
const CHAT_CLIENT_KEY = 'af_chat_client';
const CHAT_SESSION_KEY = 'af_chat_session';

// Icône WhatsApp SVG
const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" width="28" height="28" fill="white">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

// Icône Fermer
const CloseIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="white">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
  </svg>
);

// Icône Envoyer
const SendIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="white">
    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
  </svg>
);

// Icône Corbeille
const TrashIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
  </svg>
);

// Icône Groupe
const GroupIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
  </svg>
);

/**
 * Composant pour afficher un message avec liens cliquables et emojis
 */
const MessageBubble = ({ msg, isUser, onParticipantClick, isCommunity, currentUserId }) => {
  // Convertir le texte en HTML avec liens cliquables
  const htmlContent = linkifyText(msg.text);
  const isOtherUser = isCommunity && msg.type === 'user' && msg.senderId && msg.senderId !== currentUserId;
  
  return (
    <div
      style={{
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        maxWidth: '85%'
      }}
    >
      <div
        style={{
          background: isUser 
            ? 'linear-gradient(135deg, #d91cd2, #8b5cf6)' 
            : 'rgba(255,255,255,0.1)',
          color: '#fff',
          padding: '10px 14px',
          borderRadius: isUser 
            ? '16px 16px 4px 16px' 
            : '16px 16px 16px 4px',
          fontSize: '13px',
          lineHeight: '1.4'
        }}
      >
        {/* Indicateur si message du coach */}
        {msg.type === 'coach' && (
          <div style={{ fontSize: '10px', opacity: 0.7, marginBottom: '4px' }}>
            🏋️ Coach
          </div>
        )}
        {/* Nom cliquable pour discussion privée en mode communautaire */}
        {isOtherUser && msg.sender && (
          <button
            onClick={() => onParticipantClick && onParticipantClick(msg.senderId, msg.sender)}
            style={{
              fontSize: '10px',
              opacity: 0.8,
              marginBottom: '4px',
              background: 'none',
              border: 'none',
              color: '#a78bfa',
              cursor: 'pointer',
              padding: 0,
              textDecoration: 'underline'
            }}
            title="Cliquer pour envoyer un message privé"
          >
            👤 {msg.sender} (cliquer pour discuter)
          </button>
        )}
        {/* Rendu du texte avec liens cliquables */}
        <span 
          dangerouslySetInnerHTML={{ __html: htmlContent }}
          style={{ wordBreak: 'break-word' }}
        />
      </div>
    </div>
  );
};

/**
 * Widget de chat IA flottant avec reconnaissance automatique et historique
 * Utilise l'API /api/chat/smart-entry pour identifier les utilisateurs
 */
export const ChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState('form'); // 'form' | 'chat' | 'coach'
  const [leadData, setLeadData] = useState({ firstName: '', whatsapp: '', email: '' });
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isReturningClient, setIsReturningClient] = useState(false);
  const [sessionData, setSessionData] = useState(null);
  const [participantId, setParticipantId] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [isCommunityMode, setIsCommunityMode] = useState(false);
  const [lastMessageCount, setLastMessageCount] = useState(0);
  const [privateChatTarget, setPrivateChatTarget] = useState(null);
  const [messageCount, setMessageCount] = useState(0); // Compteur de messages pour prompt notif
  const [pushEnabled, setPushEnabled] = useState(false);
  const [isCoachMode, setIsCoachMode] = useState(false); // Mode coach depuis le widget
  const [coachSessions, setCoachSessions] = useState([]); // Liste des sessions pour le coach
  const [selectedCoachSession, setSelectedCoachSession] = useState(null); // Session sélectionnée par le coach
  const messagesEndRef = useRef(null);
  const pollingRef = useRef(null);

  // Email du coach autorisé
  const COACH_EMAIL = 'contact.artboost@gmail.com';

  // Enregistrer le Service Worker au montage
  useEffect(() => {
    if (isPushSupported()) {
      registerServiceWorker().then(() => {
        setPushEnabled(isSubscribed());
      });
    }
  }, []);

  // Extraire le token de lien depuis l'URL si présent
  const getLinkTokenFromUrl = () => {
    const path = window.location.pathname;
    const match = path.match(/\/chat\/([a-zA-Z0-9-]+)/);
    return match ? match[1] : null;
  };

  // === POLLING pour nouveaux messages (mode humain/communautaire) ===
  const pollForNewMessages = useCallback(async () => {
    if (!sessionData?.id) return;
    
    try {
      const res = await axios.get(`${API}/chat/sessions/${sessionData.id}/messages`);
      const newMessages = res.data;
      
      // Vérifier s'il y a de nouveaux messages
      if (newMessages.length > lastMessageCount) {
        const latestMessage = newMessages[newMessages.length - 1];
        
        // Si le dernier message n'est pas de l'utilisateur actuel, notification
        if (latestMessage.sender_id !== participantId && latestMessage.sender_type !== 'user') {
          playNotificationSound('coach');
        }
        
        // Mettre à jour les messages avec senderId pour la fonctionnalité de chat privé
        const formattedMessages = newMessages.map(m => ({
          id: m.id,
          type: m.sender_type === 'user' ? 'user' : m.sender_type === 'coach' ? 'coach' : 'ai',
          text: m.content,
          sender: m.sender_name,
          senderId: m.sender_id
        }));
        setMessages(formattedMessages);
        setLastMessageCount(newMessages.length);
      }
    } catch (err) {
      console.warn('Polling error:', err);
    }
  }, [sessionData, participantId, lastMessageCount]);

  // === DÉMARRER UNE DISCUSSION PRIVÉE ===
  const startPrivateChat = async (targetId, targetName) => {
    if (!participantId || !targetId) return;
    
    const confirm = window.confirm(`💬 Voulez-vous démarrer une discussion privée avec ${targetName} ?`);
    if (!confirm) return;
    
    setIsLoading(true);
    try {
      const response = await axios.post(`${API}/chat/start-private`, {
        initiator_id: participantId,
        target_id: targetId,
        community_session_id: sessionData?.id
      });
      
      const { session, is_new, message } = response.data;
      
      // Sauvegarder la nouvelle session
      localStorage.setItem(CHAT_SESSION_KEY, JSON.stringify(session));
      setSessionData(session);
      setIsCommunityMode(false);
      setPrivateChatTarget({ id: targetId, name: targetName });
      
      // Charger les messages de la nouvelle session
      const messagesRes = await axios.get(`${API}/chat/sessions/${session.id}/messages`);
      const formattedMessages = messagesRes.data.map(m => ({
        id: m.id,
        type: m.sender_type === 'user' ? 'user' : m.sender_type === 'coach' ? 'coach' : 'ai',
        text: m.content,
        sender: m.sender_name,
        senderId: m.sender_id
      }));
      
      setMessages([
        { type: 'ai', text: message },
        ...formattedMessages
      ]);
      setLastMessageCount(formattedMessages.length + 1);
      
      playNotificationSound('message');
      
    } catch (err) {
      console.error('Start private chat error:', err);
      alert('Erreur lors de la création de la discussion privée');
    } finally {
      setIsLoading(false);
    }
  };

  // Démarrer le polling quand en mode humain ou communautaire
  useEffect(() => {
    if (sessionData && !sessionData.is_ai_active && step === 'chat') {
      pollingRef.current = setInterval(pollForNewMessages, 3000);
    }
    
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [sessionData, step, pollForNewMessages]);

  // === MÉMORISATION CLIENT: Charger les données au démarrage ===
  useEffect(() => {
    const savedClient = localStorage.getItem(CHAT_CLIENT_KEY);
    const savedSession = localStorage.getItem(CHAT_SESSION_KEY);
    
    if (savedClient) {
      try {
        const clientData = JSON.parse(savedClient);
        if (clientData.firstName && clientData.email) {
          setLeadData(clientData);
          setIsReturningClient(true);
          if (clientData.participantId) {
            setParticipantId(clientData.participantId);
          }
          // Vérifier si c'est le coach
          if (clientData.email.toLowerCase() === COACH_EMAIL.toLowerCase()) {
            setIsCoachMode(true);
            console.log('🏋️ Mode Coach activé depuis le widget');
          }
          console.log(`🎉 Client reconnu: ${clientData.firstName}`);
        }
      } catch (err) {
        console.error('Error loading saved client:', err);
        localStorage.removeItem(CHAT_CLIENT_KEY);
      }
    }

    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        setSessionData(session);
        setIsCommunityMode(session.mode === 'community');
      } catch (err) {
        localStorage.removeItem(CHAT_SESSION_KEY);
      }
    }

    // Si on arrive via un lien partagé, ouvrir automatiquement le widget
    const linkToken = getLinkTokenFromUrl();
    if (linkToken) {
      setIsOpen(true);
    }
  }, []);

  // === MODE COACH: Charger les sessions actives ===
  const loadCoachSessions = async () => {
    try {
      const res = await axios.get(`${API}/chat/sessions`);
      // Filtrer les sessions non supprimées avec des messages récents
      const activeSessions = res.data.filter(s => !s.is_deleted);
      setCoachSessions(activeSessions);
    } catch (err) {
      console.error('Error loading coach sessions:', err);
    }
  };

  // === MODE COACH: Charger les messages d'une session ===
  const loadCoachSessionMessages = async (session) => {
    setSelectedCoachSession(session);
    try {
      const res = await axios.get(`${API}/chat/sessions/${session.id}/messages`);
      const formattedMessages = res.data.map(m => ({
        id: m.id,
        type: m.sender_type === 'user' ? 'user' : m.sender_type === 'coach' ? 'coach' : 'ai',
        text: m.content,
        sender: m.sender_name,
        senderId: m.sender_id
      }));
      setMessages(formattedMessages);
      setLastMessageCount(formattedMessages.length);
    } catch (err) {
      console.error('Error loading session messages:', err);
    }
  };

  // === MODE COACH: Envoyer une réponse ===
  const sendCoachResponse = async () => {
    if (!selectedCoachSession || !inputMessage.trim()) return;
    
    setIsLoading(true);
    try {
      await axios.post(`${API}/chat/coach-response`, {
        session_id: selectedCoachSession.id,
        message: inputMessage.trim(),
        coach_name: 'Coach'
      });
      setInputMessage('');
      // Recharger les messages
      await loadCoachSessionMessages(selectedCoachSession);
      playNotificationSound('message');
    } catch (err) {
      console.error('Error sending coach response:', err);
      alert('Erreur lors de l\'envoi du message');
    } finally {
      setIsLoading(false);
    }
  };

  // Charger les sessions quand le mode coach est activé
  useEffect(() => {
    if (isCoachMode && isOpen) {
      loadCoachSessions();
      setStep('coach');
    }
  }, [isCoachMode, isOpen]);

  // Scroll vers le bas des messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // === SMART ENTRY: Point d'entrée intelligent avec reconnaissance ===
  const handleSmartEntry = async (clientData, linkToken = null) => {
    try {
      const response = await axios.post(`${API}/chat/smart-entry`, {
        name: clientData.firstName,
        email: clientData.email,
        whatsapp: clientData.whatsapp,
        link_token: linkToken
      });

      const { participant, session, is_returning, chat_history, message } = response.data;

      // Sauvegarder les données
      const fullClientData = {
        ...clientData,
        participantId: participant.id
      };
      localStorage.setItem(CHAT_CLIENT_KEY, JSON.stringify(fullClientData));
      localStorage.setItem(CHAT_SESSION_KEY, JSON.stringify(session));

      setParticipantId(participant.id);
      setSessionData(session);
      setIsReturningClient(is_returning);
      setIsCommunityMode(session.mode === 'community');

      // Restaurer l'historique si utilisateur reconnu
      if (is_returning && chat_history && chat_history.length > 0) {
        const restoredMessages = chat_history.map(msg => ({
          id: msg.id,
          type: msg.sender_type === 'user' ? 'user' : msg.sender_type === 'coach' ? 'coach' : 'ai',
          text: msg.content,
          sender: msg.sender_name
        }));
        setMessages([
          { type: 'ai', text: message },
          ...restoredMessages
        ]);
        setLastMessageCount(chat_history.length + 1);
      } else {
        setMessages([{
          type: 'ai',
          text: message
        }]);
        setLastMessageCount(1);
      }

      setStep('chat');
      return { success: true, session, participant };

    } catch (err) {
      console.error('Smart entry error:', err);
      // Fallback: continuer sans le backend amélioré
      setMessages([{
        type: 'ai',
        text: `Enchanté ${clientData.firstName} ! 👋 Comment puis-je t'aider ?`
      }]);
      setStep('chat');
      return { success: false };
    }
  };

  // Valider et enregistrer le lead
  const handleSubmitLead = async (e) => {
    e.preventDefault();
    setError('');
    
    // Validation
    if (!leadData.firstName.trim()) {
      setError('Le prénom est requis');
      return;
    }
    if (!leadData.whatsapp.trim()) {
      setError('Le numéro WhatsApp est requis');
      return;
    }
    if (!leadData.email.trim() || !leadData.email.includes('@')) {
      setError('Un email valide est requis');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const clientData = {
        firstName: leadData.firstName.trim(),
        whatsapp: leadData.whatsapp.trim(),
        email: leadData.email.trim().toLowerCase()
      };

      // Utiliser le smart entry pour la reconnaissance automatique
      const linkToken = getLinkTokenFromUrl();
      await handleSmartEntry(clientData, linkToken);

      // Backup: créer aussi un lead (ancien système)
      try {
        await axios.post(`${API}/leads`, {
          firstName: clientData.firstName,
          whatsapp: clientData.whatsapp,
          email: clientData.email,
          source: linkToken ? `link_${linkToken}` : 'widget_ia'
        });
      } catch (leadErr) {
        console.warn('Lead creation failed, continuing anyway:', leadErr);
      }
      
    } catch (err) {
      console.error('Error:', err);
      // Fallback
      localStorage.setItem(CHAT_CLIENT_KEY, JSON.stringify({
        firstName: leadData.firstName.trim(),
        whatsapp: leadData.whatsapp.trim(),
        email: leadData.email.trim().toLowerCase()
      }));
      
      setStep('chat');
      setMessages([{
        type: 'ai',
        text: `Enchanté ${leadData.firstName} ! 👋 Comment puis-je t'aider ?`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // === CLIENT RECONNU: Ouvrir directement le chat ===
  const handleReturningClientStart = async () => {
    setIsLoading(true);
    
    try {
      const linkToken = getLinkTokenFromUrl();
      await handleSmartEntry(leadData, linkToken);
    } catch (err) {
      console.error('Error:', err);
      setStep('chat');
      setMessages([{
        type: 'ai',
        text: `Bonjour ${leadData.firstName} ! 😊 Comment puis-je t'aider ?`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // === Ouvrir le widget ===
  const handleOpenWidget = () => {
    setIsOpen(true);
    
    // Si client reconnu et pas encore en mode chat, ouvrir directement le chat
    if (isReturningClient && step === 'form') {
      handleReturningClientStart();
    }
  };

  // Envoyer un message au chat avec contexte de session
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;
    
    const userMessage = inputMessage.trim();
    setInputMessage('');
    setMessages(prev => [...prev, { type: 'user', text: userMessage }]);
    setLastMessageCount(prev => prev + 1);
    setMessageCount(prev => prev + 1);
    setIsLoading(true);
    
    try {
      // Si on a une session active, utiliser l'API améliorée
      if (sessionData && participantId) {
        const response = await axios.post(`${API}/chat/ai-response`, {
          session_id: sessionData.id,
          participant_id: participantId,
          message: userMessage
        });
        
        if (response.data.response) {
          // Jouer un son pour la réponse
          playNotificationSound('message');
          
          setMessages(prev => [...prev, { 
            type: 'ai', 
            text: response.data.response
          }]);
          setLastMessageCount(prev => prev + 1);
        } else if (!response.data.ai_active) {
          // IA désactivée - message en attente
          setMessages(prev => [...prev, { 
            type: 'ai', 
            text: isCommunityMode 
              ? "Message envoyé au groupe ! 👥 Les autres participants verront votre message."
              : "Message reçu ! Le coach vous répondra bientôt. 💬"
          }]);
        }
      } else {
        // Fallback: ancien système
        const response = await axios.post(`${API}/chat`, {
          message: userMessage,
          firstName: leadData.firstName,
          leadId: ''
        });
        
        playNotificationSound('message');
        
        setMessages(prev => [...prev, { 
          type: 'ai', 
          text: response.data.response || "Désolé, je n'ai pas pu traiter votre message."
        }]);
      }
      
      // === PROMPT NOTIFICATIONS PUSH après le premier message ===
      if (messageCount === 1 && participantId && !pushEnabled) {
        // Attendre un peu avant de demander (non intrusif)
        setTimeout(async () => {
          const result = await promptForNotifications(participantId);
          if (result.subscribed) {
            setPushEnabled(true);
            console.log('✅ Push notifications enabled');
          }
        }, 2000);
      }
      
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [...prev, { 
        type: 'ai', 
        text: "Désolé, une erreur s'est produite. Veuillez réessayer."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // === SUPPRIMER L'HISTORIQUE ===
  const handleDeleteHistory = async () => {
    if (!sessionData?.id) return;
    
    const confirm = window.confirm('Êtes-vous sûr de vouloir supprimer votre historique de conversation ?');
    if (!confirm) return;
    
    try {
      // Marquer tous les messages comme supprimés
      for (const msg of messages) {
        if (msg.id) {
          await axios.put(`${API}/chat/messages/${msg.id}/delete`);
        }
      }
      
      // Vider l'affichage local
      setMessages([{
        type: 'ai',
        text: '🗑️ Historique supprimé. Comment puis-je vous aider ?'
      }]);
      setLastMessageCount(1);
      setShowMenu(false);
      
    } catch (err) {
      console.error('Delete history error:', err);
      alert('Erreur lors de la suppression de l\'historique');
    }
  };

  // Réinitialiser le widget
  const handleClose = () => {
    setIsOpen(false);
    setShowMenu(false);
  };

  // Option pour changer d'identité (nouveau client)
  const handleChangeIdentity = () => {
    localStorage.removeItem(CHAT_CLIENT_KEY);
    localStorage.removeItem(CHAT_SESSION_KEY);
    setLeadData({ firstName: '', whatsapp: '', email: '' });
    setIsReturningClient(false);
    setStep('form');
    setMessages([]);
    setSessionData(null);
    setParticipantId(null);
    setShowMenu(false);
    setLastMessageCount(0);
  };

  return (
    <>
      {/* Style pour les liens dans les messages et responsive mobile */}
      <style>{`
        .chat-link {
          color: #a78bfa;
          text-decoration: underline;
          word-break: break-all;
        }
        .chat-link:hover {
          color: #c4b5fd;
        }
        
        /* Chat widget responsive - plus grand sur mobile */
        @media (max-width: 640px) {
          .chat-widget-window {
            bottom: 0 !important;
            right: 0 !important;
            left: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            height: 85vh !important;
            max-height: 85vh !important;
            border-radius: 16px 16px 0 0 !important;
          }
          .chat-widget-button {
            bottom: 20px !important;
            right: 16px !important;
            width: 60px !important;
            height: 60px !important;
          }
        }
        
        @media (min-width: 641px) and (max-width: 1024px) {
          .chat-widget-window {
            width: 400px !important;
            height: 70vh !important;
            max-height: 70vh !important;
          }
        }
      `}</style>

      {/* Bouton flottant WhatsApp */}
      {!isOpen && (
        <button
          onClick={handleOpenWidget}
          className="chat-widget-button fixed z-50 shadow-lg transition-all duration-300 hover:scale-110"
          style={{
            bottom: '80px',
            right: '20px',
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: '#25D366',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 15px rgba(37, 211, 102, 0.4)'
          }}
          data-testid="chat-widget-button"
        >
          <WhatsAppIcon />
          {/* Badge si client reconnu */}
          {isReturningClient && (
            <span 
              style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                background: '#d91cd2',
                border: '2px solid #0a0a0a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                color: '#fff'
              }}
            >
              ✓
            </span>
          )}
        </button>
      )}

      {/* Fenêtre de chat - Responsive */}
      {isOpen && (
        <div
          className="chat-widget-window fixed z-50 shadow-2xl"
          style={{
            bottom: '80px',
            right: '20px',
            width: '380px',
            maxWidth: 'calc(100vw - 40px)',
            height: '70vh',
            maxHeight: '85vh',
            minHeight: '400px',
            borderRadius: '16px',
            background: '#0a0a0a',
            border: '1px solid rgba(217, 28, 210, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
          data-testid="chat-widget-window"
        >
          {/* Header */}
          <div 
            style={{
              background: isCommunityMode 
                ? 'linear-gradient(135deg, #8b5cf6, #6366f1)' 
                : 'linear-gradient(135deg, #25D366, #128C7E)',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0
            }}
          >
            <div className="flex items-center gap-3">
              <div 
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {isCommunityMode ? <GroupIcon /> : <WhatsAppIcon />}
              </div>
              <div>
                <div className="text-white font-semibold text-sm">
                  {isCommunityMode ? 'Communauté Afroboost' : 'Afroboost'}
                </div>
                <div className="text-white text-xs" style={{ opacity: 0.8 }}>
                  {isReturningClient && step === 'chat' 
                    ? `👋 ${leadData.firstName}` 
                    : isCommunityMode 
                      ? '👥 Chat Groupe'
                      : sessionData?.is_ai_active === false 
                        ? '👤 Mode Coach'
                        : '🤖 Assistant IA'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Menu burger */}
              {step === 'chat' && (
                <div className="relative">
                  <button
                    onClick={() => setShowMenu(!showMenu)}
                    style={{
                      background: 'rgba(255,255,255,0.2)',
                      border: 'none',
                      borderRadius: '8px',
                      width: '32px',
                      height: '32px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: '16px'
                    }}
                    data-testid="chat-menu-btn"
                  >
                    ⋮
                  </button>
                  
                  {/* Menu déroulant */}
                  {showMenu && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '40px',
                        right: '0',
                        background: '#1a1a1a',
                        borderRadius: '8px',
                        border: '1px solid rgba(255,255,255,0.1)',
                        overflow: 'hidden',
                        minWidth: '180px',
                        zIndex: 100
                      }}
                    >
                      <button
                        onClick={handleDeleteHistory}
                        className="w-full px-4 py-3 text-left text-sm hover:bg-white/10 flex items-center gap-2"
                        style={{ color: '#ef4444', border: 'none', background: 'none' }}
                        data-testid="delete-history-btn"
                      >
                        <TrashIcon /> Supprimer l'historique
                      </button>
                      <button
                        onClick={handleChangeIdentity}
                        className="w-full px-4 py-3 text-left text-sm hover:bg-white/10 flex items-center gap-2"
                        style={{ color: '#fff', border: 'none', background: 'none' }}
                        data-testid="change-identity-btn"
                      >
                        🔄 Changer d'identité
                      </button>
                    </div>
                  )}
                </div>
              )}
              
              <button
                onClick={handleClose}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                data-testid="chat-close-btn"
              >
                <CloseIcon />
              </button>
            </div>
          </div>

          {/* Contenu avec scroll */}
          <div style={{ 
            flex: 1, 
            overflow: 'hidden', 
            display: 'flex', 
            flexDirection: 'column',
            minHeight: 0
          }}>
            
            {/* Formulaire de capture avec scroll */}
            {step === 'form' && (
              <div 
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <form 
                  onSubmit={handleSubmitLead}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    minHeight: 'min-content'
                  }}
                >
                  <p className="text-white text-sm text-center mb-2">
                    👋 Avant de commencer, présentez-vous !
                  </p>
                  
                  {error && (
                    <div style={{ 
                      background: 'rgba(239, 68, 68, 0.2)', 
                      color: '#ef4444', 
                      padding: '8px 12px', 
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}>
                      {error}
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-white text-xs mb-1" style={{ opacity: 0.7 }}>Prénom *</label>
                    <input
                      type="text"
                      value={leadData.firstName}
                      onChange={(e) => setLeadData({ ...leadData, firstName: e.target.value })}
                      placeholder="Votre prénom"
                      className="w-full px-3 py-2 rounded-lg text-sm"
                      style={{
                        background: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        color: '#fff',
                        outline: 'none'
                      }}
                      data-testid="lead-firstname"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-white text-xs mb-1" style={{ opacity: 0.7 }}>Numéro WhatsApp *</label>
                    <input
                      type="tel"
                      value={leadData.whatsapp}
                      onChange={(e) => setLeadData({ ...leadData, whatsapp: e.target.value })}
                      placeholder="+41 79 123 45 67"
                      className="w-full px-3 py-2 rounded-lg text-sm"
                      style={{
                        background: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        color: '#fff',
                        outline: 'none'
                      }}
                      data-testid="lead-whatsapp"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-white text-xs mb-1" style={{ opacity: 0.7 }}>Email *</label>
                    <input
                      type="email"
                      value={leadData.email}
                      onChange={(e) => setLeadData({ ...leadData, email: e.target.value })}
                      placeholder="votre@email.com"
                      className="w-full px-3 py-2 rounded-lg text-sm"
                      style={{
                        background: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        color: '#fff',
                        outline: 'none'
                      }}
                      data-testid="lead-email"
                    />
                  </div>
                  
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="py-3 rounded-lg font-semibold text-sm transition-all"
                    style={{
                      background: '#25D366',
                      color: '#fff',
                      border: 'none',
                      cursor: isLoading ? 'wait' : 'pointer',
                      opacity: isLoading ? 0.7 : 1,
                      marginTop: '8px'
                    }}
                    data-testid="lead-submit"
                  >
                    {isLoading ? 'Chargement...' : 'Commencer le chat 💬'}
                  </button>
                  
                  <p className="text-center text-xs" style={{ color: 'rgba(255,255,255,0.4)', marginTop: '8px' }}>
                    Vos données sont protégées et utilisées uniquement pour vous contacter.
                  </p>
                </form>
              </div>
            )}

            {/* === MODE COACH: Interface de gestion des conversations === */}
            {step === 'coach' && isCoachMode && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                {/* Header Coach */}
                <div style={{ 
                  background: 'rgba(217, 28, 210, 0.2)', 
                  padding: '8px 16px', 
                  borderBottom: '1px solid rgba(217, 28, 210, 0.3)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ color: '#d91cd2', fontSize: '12px', fontWeight: 'bold' }}>
                    🏋️ Mode Coach
                  </span>
                  <button
                    onClick={loadCoachSessions}
                    style={{ 
                      background: 'rgba(255,255,255,0.1)', 
                      border: 'none', 
                      padding: '4px 8px', 
                      borderRadius: '4px',
                      color: '#fff',
                      fontSize: '11px',
                      cursor: 'pointer'
                    }}
                  >
                    🔄 Rafraîchir
                  </button>
                </div>

                {/* Liste des sessions ou messages */}
                {!selectedCoachSession ? (
                  <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                    <div style={{ color: '#fff', fontSize: '12px', marginBottom: '12px', opacity: 0.7 }}>
                      Conversations actives ({coachSessions.length})
                    </div>
                    {coachSessions.length === 0 ? (
                      <div style={{ color: '#fff', opacity: 0.5, textAlign: 'center', padding: '20px', fontSize: '13px' }}>
                        Aucune conversation active
                      </div>
                    ) : (
                      coachSessions.map(session => (
                        <div
                          key={session.id}
                          onClick={() => loadCoachSessionMessages(session)}
                          style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            padding: '10px',
                            marginBottom: '8px',
                            cursor: 'pointer'
                          }}
                        >
                          <div style={{ color: '#fff', fontSize: '13px', fontWeight: '500' }}>
                            {session.title || `Session ${session.id.slice(0, 8)}`}
                          </div>
                          <div style={{ color: '#888', fontSize: '11px', marginTop: '4px' }}>
                            {session.mode === 'human' ? '👤 Mode Humain' : session.mode === 'community' ? '👥 Communauté' : '🤖 IA'}
                            {' • '}
                            {new Date(session.created_at).toLocaleDateString('fr-FR')}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <>
                    {/* Header session sélectionnée */}
                    <div style={{ 
                      padding: '8px 12px', 
                      borderBottom: '1px solid rgba(255,255,255,0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <button
                        onClick={() => setSelectedCoachSession(null)}
                        style={{ 
                          background: 'none', 
                          border: 'none', 
                          color: '#d91cd2', 
                          cursor: 'pointer',
                          fontSize: '14px'
                        }}
                      >
                        ← Retour
                      </button>
                      <span style={{ color: '#fff', fontSize: '12px' }}>
                        {selectedCoachSession.title || `Session ${selectedCoachSession.id.slice(0, 8)}`}
                      </span>
                    </div>

                    {/* Messages */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {messages.map((msg, idx) => (
                        <MessageBubble 
                          key={idx} 
                          msg={msg} 
                          isUser={msg.type === 'coach'}
                        />
                      ))}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Input coach */}
                    <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && sendCoachResponse()}
                        placeholder="Votre réponse..."
                        style={{
                          flex: 1,
                          background: 'rgba(255,255,255,0.1)',
                          border: '1px solid rgba(255,255,255,0.2)',
                          borderRadius: '20px',
                          padding: '8px 16px',
                          color: '#fff',
                          fontSize: '13px',
                          outline: 'none'
                        }}
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          sendCoachResponse();
                        }}
                        disabled={isLoading || !inputMessage.trim()}
                        style={{
                          background: inputMessage.trim() ? 'linear-gradient(135deg, #d91cd2, #8b5cf6)' : 'rgba(255,255,255,0.1)',
                          border: 'none',
                          borderRadius: '50%',
                          width: '40px',
                          height: '40px',
                          cursor: inputMessage.trim() ? 'pointer' : 'not-allowed',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: inputMessage.trim() ? 1 : 0.5
                        }}
                        data-testid="coach-widget-send-btn"
                      >
                        <span style={{ pointerEvents: 'none' }}><SendIcon /></span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            
            {/* Zone de chat */}
            {step === 'chat' && (
              <>
                {/* Indicateur mode non-IA */}
                {sessionData && !sessionData.is_ai_active && (
                  <div 
                    style={{
                      background: isCommunityMode ? 'rgba(139, 92, 246, 0.2)' : 'rgba(234, 179, 8, 0.2)',
                      padding: '8px 16px',
                      textAlign: 'center',
                      fontSize: '11px',
                      color: isCommunityMode ? '#a78bfa' : '#fbbf24',
                      borderBottom: '1px solid rgba(255,255,255,0.1)'
                    }}
                  >
                    {isCommunityMode 
                      ? '👥 Mode Communauté - Plusieurs participants' 
                      : privateChatTarget
                      ? `💬 Discussion privée avec ${privateChatTarget.name}`
                      : '👤 Mode Humain - Le coach vous répondra'}
                  </div>
                )}

                <div 
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    minHeight: 0
                  }}
                >
                  {messages.map((msg, idx) => (
                    <MessageBubble 
                      key={idx} 
                      msg={msg} 
                      isUser={msg.type === 'user' && msg.senderId === participantId}
                      onParticipantClick={startPrivateChat}
                      isCommunity={isCommunityMode}
                      currentUserId={participantId}
                    />
                  ))}
                  
                  {isLoading && (
                    <div style={{ alignSelf: 'flex-start' }}>
                      <div
                        style={{
                          background: 'rgba(255,255,255,0.1)',
                          color: '#fff',
                          padding: '10px 14px',
                          borderRadius: '16px 16px 16px 4px',
                          fontSize: '13px'
                        }}
                      >
                        <span className="animate-pulse">...</span>
                      </div>
                    </div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </div>
                
                {/* Input message */}
                <div 
                  style={{
                    padding: '12px',
                    borderTop: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex',
                    gap: '8px',
                    flexShrink: 0
                  }}
                >
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Écrivez votre message..."
                    className="flex-1 px-3 py-2 rounded-full text-sm"
                    style={{
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      color: '#fff',
                      outline: 'none'
                    }}
                    data-testid="chat-input"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={isLoading || !inputMessage.trim()}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: '#25D366',
                      border: 'none',
                      cursor: isLoading ? 'wait' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: isLoading || !inputMessage.trim() ? 0.5 : 1,
                      flexShrink: 0
                    }}
                    data-testid="chat-send-btn"
                  >
                    <SendIcon />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default ChatWidget;
