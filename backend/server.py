from fastapi import FastAPI, APIRouter, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import stripe
import asyncio
import json

# Web Push imports
try:
    from pywebpush import webpush, WebPushException
    WEBPUSH_AVAILABLE = True
except ImportError:
    WEBPUSH_AVAILABLE = False
    logger = logging.getLogger(__name__)
    logger.warning("pywebpush not installed - push notifications disabled")

# Resend import
try:
    import resend
    RESEND_AVAILABLE = True
except ImportError:
    RESEND_AVAILABLE = False

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Stripe configuration - utilise la variable d'environnement existante
stripe.api_key = os.environ.get('STRIPE_SECRET_KEY')

# VAPID configuration for Web Push
VAPID_PUBLIC_KEY = os.environ.get('VAPID_PUBLIC_KEY', '')
VAPID_PRIVATE_KEY = os.environ.get('VAPID_PRIVATE_KEY', '')
VAPID_CLAIMS_EMAIL = os.environ.get('VAPID_CLAIMS_EMAIL', 'contact@afroboost.ch')

# Resend configuration
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
if RESEND_AVAILABLE and RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

# ==================== TWILIO CONFIGURATION (PRIORITÉ .ENV) ====================
# Les variables .env sont PRIORITAIRES sur la config en base de données
# Cela garantit que le numéro de production ne sera jamais écrasé par le sandbox
TWILIO_ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID', '')
TWILIO_AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN', '')
TWILIO_FROM_NUMBER = os.environ.get('TWILIO_FROM_NUMBER', '')

# VALIDATION CRITIQUE: Vérification des identifiants Twilio au démarrage
# Un Account SID Twilio valide fait EXACTEMENT 34 caractères (AC + 32)
if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER:
    if len(TWILIO_ACCOUNT_SID) != 34 or not TWILIO_ACCOUNT_SID.startswith('AC'):
        print(f"[WHATSAPP-PROD] 🚨 ALERTE CRITIQUE: Account SID invalide ({len(TWILIO_ACCOUNT_SID)} chars, attendu: 34)")
        print(f"[WHATSAPP-PROD] 🚨 SID actuel: {TWILIO_ACCOUNT_SID}")
    else:
        print(f"[WHATSAPP-PROD] ✅ Configuration Twilio VALIDE chargée depuis .env")
        print(f"[WHATSAPP-PROD] 📱 Numéro de production VERROUILLÉ: {TWILIO_FROM_NUMBER}")
        print(f"[WHATSAPP-PROD] 🔑 Account SID: {TWILIO_ACCOUNT_SID[:8]}...{TWILIO_ACCOUNT_SID[-4:]} (34 chars)")
else:
    print(f"[WHATSAPP-PROD] ⚠️ Configuration Twilio incomplète dans .env - utilisation de la config en base")

# SÉCURITÉ: Ne JAMAIS utiliser le numéro Sandbox automatiquement
TWILIO_SANDBOX_NUMBER = "+14155238886"
if TWILIO_FROM_NUMBER == TWILIO_SANDBOX_NUMBER:
    print(f"[WHATSAPP-PROD] 🚨 ALERTE: Numéro Sandbox détecté! Vérifiez votre configuration.")

# MongoDB connection - with fallback for production environments
mongo_url = os.environ.get('MONGO_URL')
if not mongo_url:
    raise RuntimeError("MONGO_URL environment variable is required")

client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'afroboost_db')]

app = FastAPI(title="Afroboost API")
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==================== HEALTH CHECK (Required for Kubernetes) ====================

@app.get("/health")
async def health_check():
    """Health check endpoint for Kubernetes liveness/readiness probes"""
    try:
        # Test MongoDB connection
        await client.admin.command('ping')
        return JSONResponse(
            status_code=200,
            content={"status": "healthy", "database": "connected"}
        )
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return JSONResponse(
            status_code=503,
            content={"status": "unhealthy", "database": "disconnected", "error": str(e)}
        )

@app.get("/api/health")
async def api_health_check():
    """Health check endpoint via /api prefix for Kubernetes"""
    return await health_check()

# Favicon endpoint to prevent 404 errors
@app.get("/api/favicon.ico")
async def favicon():
    """Return empty response for favicon requests to prevent 404 errors"""
    from starlette.responses import Response
    return Response(status_code=204)

@api_router.get("/favicon.ico")
async def api_favicon():
    """Return empty response for favicon requests via API router"""
    from starlette.responses import Response
    return Response(status_code=204)

# ==================== MODELS ====================

class Course(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    weekday: int
    time: str
    locationName: str
    mapsUrl: Optional[str] = ""
    visible: bool = True
    archived: bool = False  # Archive au lieu de supprimer
    playlist: Optional[List[str]] = None  # Liste des URLs audio pour ce cours

class CourseCreate(BaseModel):
    name: str
    weekday: int
    time: str
    locationName: str
    mapsUrl: Optional[str] = ""
    visible: bool = True
    archived: bool = False
    playlist: Optional[List[str]] = None  # Liste des URLs audio

class Offer(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    price: float
    thumbnail: Optional[str] = ""
    videoUrl: Optional[str] = ""
    description: Optional[str] = ""
    keywords: Optional[str] = ""  # Mots-clés pour la recherche (invisible)
    visible: bool = True
    images: List[str] = []  # Support multi-images (max 5)
    # E-commerce fields
    category: Optional[str] = ""  # Ex: "service", "tshirt", "shoes", "supplement"
    isProduct: bool = False  # True = physical product, False = service/course
    variants: Optional[dict] = None  # { sizes: ["S","M","L"], colors: ["Noir","Blanc"], weights: ["0.5kg","1kg"] }
    tva: float = 0.0  # TVA percentage
    shippingCost: float = 0.0  # Frais de port
    stock: int = -1  # -1 = unlimited

class OfferCreate(BaseModel):
    name: str
    price: float
    thumbnail: Optional[str] = ""
    videoUrl: Optional[str] = ""
    description: Optional[str] = ""
    keywords: Optional[str] = ""  # Mots-clés pour la recherche
    visible: bool = True
    images: List[str] = []  # Support multi-images (max 5)
    # E-commerce fields
    category: Optional[str] = ""
    isProduct: bool = False
    variants: Optional[dict] = None
    tva: float = 0.0
    shippingCost: float = 0.0
    stock: int = -1

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str
    whatsapp: Optional[str] = ""
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    name: str
    email: str
    whatsapp: Optional[str] = ""

class Reservation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    reservationCode: str
    userId: str
    userName: str
    userEmail: str
    userWhatsapp: Optional[str] = ""
    courseId: str
    courseName: str
    courseTime: str
    datetime: str
    offerId: str
    offerName: str
    price: float
    quantity: int = 1
    totalPrice: float
    discountCode: Optional[str] = None
    discountType: Optional[str] = None
    discountValue: Optional[float] = None
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    # E-commerce / Shipping fields
    validated: bool = False
    validatedAt: Optional[str] = None
    selectedVariants: Optional[dict] = None  # { size: "M", color: "Noir" }
    variantsText: Optional[str] = None  # "Taille: M, Couleur: Noir"
    shippingAddress: Optional[str] = None  # Adresse de livraison
    isProduct: bool = False  # True si produit physique
    tva: float = 0.0
    shippingCost: float = 0.0
    trackingNumber: Optional[str] = None  # Numéro de suivi colis
    shippingStatus: str = "pending"  # pending, shipped, delivered
    # Multi-date selection support
    selectedDates: Optional[List[str]] = None  # Array of ISO date strings
    selectedDatesText: Optional[str] = None  # Formatted text of selected dates

class ReservationCreate(BaseModel):
    userId: str
    userName: str
    userEmail: str
    userWhatsapp: Optional[str] = ""
    courseId: str
    courseName: str
    courseTime: str
    datetime: str
    offerId: str
    offerName: str
    price: float
    quantity: int = 1
    totalPrice: float
    discountCode: Optional[str] = None
    discountType: Optional[str] = None
    discountValue: Optional[float] = None
    selectedVariants: Optional[dict] = None
    variantsText: Optional[str] = None
    shippingAddress: Optional[str] = None
    isProduct: bool = False
    # Multi-date selection support
    selectedDates: Optional[List[str]] = None  # Array of ISO date strings
    selectedDatesText: Optional[str] = None  # Formatted text of selected dates

class DiscountCode(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str
    type: str  # "100%", "%", "CHF"
    value: float
    assignedEmail: Optional[str] = None
    expiresAt: Optional[str] = None
    courses: List[str] = []
    maxUses: Optional[int] = None
    used: int = 0
    active: bool = True

class DiscountCodeCreate(BaseModel):
    code: str
    type: str
    value: float
    assignedEmail: Optional[str] = None
    expiresAt: Optional[str] = None
    courses: List[str] = []
    maxUses: Optional[int] = None

class PaymentLinks(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = "payment_links"
    stripe: str = ""
    paypal: str = ""
    twint: str = ""
    coachWhatsapp: str = ""
    # Notifications automatiques pour le coach
    coachNotificationEmail: str = ""  # Email pour recevoir les alertes
    coachNotificationPhone: str = ""  # Téléphone pour recevoir les alertes WhatsApp

class PaymentLinksUpdate(BaseModel):
    stripe: Optional[str] = ""
    paypal: Optional[str] = ""
    twint: Optional[str] = ""
    coachWhatsapp: Optional[str] = ""
    coachNotificationEmail: Optional[str] = ""
    coachNotificationPhone: Optional[str] = ""

# Campaign Models for Marketing Module
class CampaignResult(BaseModel):
    contactId: str
    contactName: str
    contactEmail: Optional[str] = ""
    contactPhone: Optional[str] = ""
    channel: str  # "whatsapp", "email", "instagram"
    status: str = "pending"  # "pending", "sent", "failed"
    sentAt: Optional[str] = None

class Campaign(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    message: str
    mediaUrl: Optional[str] = ""
    mediaFormat: str = "16:9"  # "9:16" or "16:9"
    targetType: str = "all"  # "all" or "selected"
    selectedContacts: List[str] = []
    channels: dict = Field(default_factory=lambda: {"whatsapp": True, "email": False, "instagram": False})
    scheduledAt: Optional[str] = None  # ISO date or null for immediate
    status: str = "draft"  # "draft", "scheduled", "sending", "completed"
    results: List[dict] = []
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updatedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class CampaignCreate(BaseModel):
    name: str
    message: str
    mediaUrl: Optional[str] = ""
    mediaFormat: str = "16:9"
    targetType: str = "all"
    selectedContacts: List[str] = []
    channels: dict = Field(default_factory=lambda: {"whatsapp": True, "email": False, "instagram": False})
    scheduledAt: Optional[str] = None

class Concept(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = "concept"
    appName: str = "Afroboost"  # Nom de l'application (titre principal)
    description: str = "Le concept Afroboost : cardio + danse afrobeat + casques audio immersifs. Un entraînement fun, énergétique et accessible à tous."
    heroImageUrl: str = ""
    heroVideoUrl: str = ""
    logoUrl: str = ""
    faviconUrl: str = ""
    termsText: str = ""  # CGV - Conditions Générales de Vente
    googleReviewsUrl: str = ""  # Lien avis Google
    defaultLandingSection: str = "sessions"  # Section d'atterrissage par défaut: "sessions", "offers", "shop"
    # Liens externes
    externalLink1Title: str = ""
    externalLink1Url: str = ""
    externalLink2Title: str = ""
    externalLink2Url: str = ""
    # Modes de paiement acceptés
    paymentTwint: bool = False
    paymentPaypal: bool = False
    paymentCreditCard: bool = False
    # Affiche Événement (popup)
    eventPosterEnabled: bool = False
    eventPosterMediaUrl: str = ""  # URL image ou vidéo
    # Personnalisation des couleurs
    primaryColor: str = "#D91CD2"  # Couleur principale (glow)
    secondaryColor: str = "#8b5cf6"  # Couleur secondaire

class ConceptUpdate(BaseModel):
    appName: Optional[str] = None  # Nom de l'application
    description: Optional[str] = None
    heroImageUrl: Optional[str] = None
    heroVideoUrl: Optional[str] = None
    logoUrl: Optional[str] = None
    faviconUrl: Optional[str] = None
    termsText: Optional[str] = None  # CGV - Conditions Générales de Vente
    googleReviewsUrl: Optional[str] = None  # Lien avis Google
    defaultLandingSection: Optional[str] = None  # Section d'atterrissage par défaut
    # Liens externes
    externalLink1Title: Optional[str] = None
    externalLink1Url: Optional[str] = None
    externalLink2Title: Optional[str] = None
    externalLink2Url: Optional[str] = None
    # Modes de paiement acceptés
    paymentTwint: Optional[bool] = None
    paymentPaypal: Optional[bool] = None
    paymentCreditCard: Optional[bool] = None
    # Affiche Événement (popup)
    eventPosterEnabled: Optional[bool] = None
    eventPosterMediaUrl: Optional[str] = None
    # Personnalisation des couleurs
    primaryColor: Optional[str] = None
    secondaryColor: Optional[str] = None

class AppConfig(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = "app_config"
    background_color: str = "#020617"
    gradient_color: str = "#3b0764"
    primary_color: str = "#d91cd2"
    secondary_color: str = "#8b5cf6"
    text_color: str = "#ffffff"
    font_family: str = "system-ui"
    font_size: int = 16
    app_title: str = "Afroboost"
    app_subtitle: str = "Réservation de casque"
    concept_description: str = "Le concept Afroboost : cardio + danse afrobeat + casques audio immersifs."
    choose_session_text: str = "Choisissez votre session"
    choose_offer_text: str = "Choisissez votre offre"
    user_info_text: str = "Vos informations"
    button_text: str = "Réserver maintenant"

# ==================== FEATURE FLAGS - Services Additionnels ====================
# Business Model: Super Admin contrôle les feature flags globaux
# Les Coachs doivent avoir l'abonnement correspondant pour accéder aux services

class FeatureFlags(BaseModel):
    """
    Configuration globale des services (contrôlée par Super Admin)
    Par défaut, tous les services additionnels sont désactivés
    """
    model_config = ConfigDict(extra="ignore")
    id: str = "feature_flags"
    # Service Audio - Interrupteur général
    AUDIO_SERVICE_ENABLED: bool = False
    # Futurs services (préparation)
    VIDEO_SERVICE_ENABLED: bool = False
    STREAMING_SERVICE_ENABLED: bool = False
    # Timestamp de dernière modification
    updatedAt: Optional[str] = None
    updatedBy: Optional[str] = None  # "super_admin" ou email

class FeatureFlagsUpdate(BaseModel):
    """Mise à jour partielle des feature flags"""
    AUDIO_SERVICE_ENABLED: Optional[bool] = None
    VIDEO_SERVICE_ENABLED: Optional[bool] = None
    STREAMING_SERVICE_ENABLED: Optional[bool] = None

# ==================== COACH SUBSCRIPTION - Droits d'accès aux services ====================
# Business Model: Chaque coach a un profil d'abonnement qui définit ses droits

class CoachSubscription(BaseModel):
    """
    Profil d'abonnement d'un coach - définit les services auxquels il a accès
    Relation: coach_auth.email -> coach_subscription.coachEmail
    """
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    coachEmail: str  # Email du coach (clé de liaison avec coach_auth)
    # Services disponibles selon l'abonnement
    hasAudioService: bool = False  # Accès au service Audio
    hasVideoService: bool = False  # Futur: service Vidéo
    hasStreamingService: bool = False  # Futur: service Streaming
    # Informations d'abonnement
    subscriptionPlan: str = "free"  # "free", "basic", "premium", "enterprise"
    subscriptionStartDate: Optional[str] = None
    subscriptionEndDate: Optional[str] = None
    isActive: bool = True
    # Métadonnées
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updatedAt: Optional[str] = None

class CoachSubscriptionUpdate(BaseModel):
    """Mise à jour partielle de l'abonnement coach"""
    hasAudioService: Optional[bool] = None
    hasVideoService: Optional[bool] = None
    hasStreamingService: Optional[bool] = None
    subscriptionPlan: Optional[str] = None
    subscriptionEndDate: Optional[str] = None
    isActive: Optional[bool] = None

class CoachAuth(BaseModel):
    email: str
    password: str

class CoachLogin(BaseModel):
    email: str
    password: str

# --- Lead Model (Widget IA) ---
class Lead(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = ""
    firstName: str
    whatsapp: str
    email: str
    createdAt: str = ""
    source: str = "widget_ia"

class ChatMessage(BaseModel):
    message: str
    leadId: str = ""
    firstName: str = ""
    email: str = ""  # Email pour CRM auto-save
    whatsapp: str = ""  # WhatsApp pour CRM auto-save
    source: str = "chat_ia"  # Source du contact (lien chat IA)

# ==================== SYSTÈME DE CHAT AMÉLIORÉ ====================
# Modèles pour la reconnaissance des utilisateurs, sessions et modes de conversation

class ChatParticipant(BaseModel):
    """Représente un participant au chat (utilisateur/client)"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    whatsapp: Optional[str] = ""
    email: Optional[str] = ""
    source: str = "chat_afroboost"  # Source par défaut, peut identifier un lien spécifique
    link_token: Optional[str] = None  # Token du lien via lequel l'utilisateur est arrivé
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    last_seen_at: Optional[str] = None

class ChatParticipantCreate(BaseModel):
    name: str
    whatsapp: Optional[str] = ""
    email: Optional[str] = ""
    source: str = "chat_afroboost"
    link_token: Optional[str] = None

class ChatSession(BaseModel):
    """Session de chat avec gestion des modes et participants"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    participant_ids: List[str] = []  # Liste des IDs de participants
    mode: str = "ai"  # "ai", "human", "community"
    is_ai_active: bool = True  # Interrupteur pour désactiver l'IA
    is_deleted: bool = False  # Suppression logique
    link_token: str = Field(default_factory=lambda: str(uuid.uuid4())[:12])  # Token unique pour partage
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: Optional[str] = None
    deleted_at: Optional[str] = None
    # Métadonnées pour le coach
    title: Optional[str] = None  # Titre optionnel pour identifier la session
    notes: Optional[str] = None  # Notes du coach sur cette session
    # Prompt spécifique au lien (PRIORITAIRE sur campaignPrompt)
    custom_prompt: Optional[str] = None  # Nullable - si vide, utilise campaignPrompt global

class ChatSessionCreate(BaseModel):
    mode: str = "ai"
    is_ai_active: bool = True
    title: Optional[str] = None

class ChatSessionUpdate(BaseModel):
    mode: Optional[str] = None
    is_ai_active: Optional[bool] = None
    is_deleted: Optional[bool] = None
    title: Optional[str] = None
    notes: Optional[str] = None
    custom_prompt: Optional[str] = None  # Prompt spécifique au lien

class EnhancedChatMessage(BaseModel):
    """Message de chat amélioré avec session, sender et suppression logique"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    sender_id: str  # ID du participant ou "coach" ou "ai"
    sender_name: str
    sender_type: str = "user"  # "user", "coach", "ai"
    content: str
    mode: str = "ai"  # Mode au moment de l'envoi: "ai", "human", "community"
    is_deleted: bool = False  # Suppression logique
    notified: bool = False  # Pour les notifications coach/client
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    deleted_at: Optional[str] = None

class EnhancedChatMessageCreate(BaseModel):
    session_id: str
    sender_id: str
    sender_name: str
    sender_type: str = "user"
    content: str

class ChatLinkResponse(BaseModel):
    """Réponse pour la génération de lien partageable"""
    link_token: str
    share_url: str
    session_id: str

# ==================== ROUTES ====================

@api_router.get("/")
async def root():
    return {"message": "Afroboost API"}

# --- Courses ---
@api_router.get("/courses", response_model=List[Course])
async def get_courses():
    courses = await db.courses.find({}, {"_id": 0}).to_list(100)
    if not courses:
        # Insert default courses
        default_courses = [
            {"id": str(uuid.uuid4()), "name": "Afroboost Silent – Session Cardio", "weekday": 3, "time": "18:30", "locationName": "Rue des Vallangines 97, Neuchâtel", "mapsUrl": ""},
            {"id": str(uuid.uuid4()), "name": "Afroboost Silent – Sunday Vibes", "weekday": 0, "time": "18:30", "locationName": "Rue des Vallangines 97, Neuchâtel", "mapsUrl": ""}
        ]
        await db.courses.insert_many(default_courses)
        return default_courses
    return courses

@api_router.post("/courses", response_model=Course)
async def create_course(course: CourseCreate):
    course_obj = Course(**course.model_dump())
    await db.courses.insert_one(course_obj.model_dump())
    return course_obj

@api_router.put("/courses/{course_id}", response_model=Course)
async def update_course(course_id: str, course_update: dict):
    """Update a course - supports partial updates including playlist"""
    # Récupérer le cours existant
    existing = await db.courses.find_one({"id": course_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Cours non trouvé")
    
    # Fusionner les données (mise à jour partielle)
    update_data = {k: v for k, v in course_update.items() if v is not None}
    
    await db.courses.update_one({"id": course_id}, {"$set": update_data})
    updated = await db.courses.find_one({"id": course_id}, {"_id": 0})
    return updated

@api_router.put("/courses/{course_id}/archive")
async def archive_course(course_id: str):
    """Archive a course instead of deleting it"""
    await db.courses.update_one({"id": course_id}, {"$set": {"archived": True}})
    updated = await db.courses.find_one({"id": course_id}, {"_id": 0})
    return {"success": True, "course": updated}

@api_router.delete("/courses/{course_id}")
async def delete_course(course_id: str):
    await db.courses.delete_one({"id": course_id})
    return {"success": True}

# --- Offers ---
@api_router.get("/offers", response_model=List[Offer])
async def get_offers():
    offers = await db.offers.find({}, {"_id": 0}).to_list(100)
    if not offers:
        default_offers = [
            {"id": str(uuid.uuid4()), "name": "Cours à l'unité", "price": 30, "thumbnail": "", "videoUrl": "", "description": "", "visible": True},
            {"id": str(uuid.uuid4()), "name": "Carte 10 cours", "price": 150, "thumbnail": "", "videoUrl": "", "description": "", "visible": True},
            {"id": str(uuid.uuid4()), "name": "Abonnement 1 mois", "price": 109, "thumbnail": "", "videoUrl": "", "description": "", "visible": True}
        ]
        await db.offers.insert_many(default_offers)
        return default_offers
    return offers

@api_router.post("/offers", response_model=Offer)
async def create_offer(offer: OfferCreate):
    offer_obj = Offer(**offer.model_dump())
    await db.offers.insert_one(offer_obj.model_dump())
    return offer_obj

@api_router.put("/offers/{offer_id}", response_model=Offer)
async def update_offer(offer_id: str, offer: OfferCreate):
    await db.offers.update_one({"id": offer_id}, {"$set": offer.model_dump()})
    updated = await db.offers.find_one({"id": offer_id}, {"_id": 0})
    return updated

@api_router.delete("/offers/{offer_id}")
async def delete_offer(offer_id: str):
    """Supprime une offre et nettoie les références dans les codes promo"""
    # 1. Supprimer l'offre
    await db.offers.delete_one({"id": offer_id})
    
    # 2. Nettoyer les références dans les codes promo (retirer l'offre des 'courses'/articles autorisés)
    await db.discount_codes.update_many(
        {"courses": offer_id},
        {"$pull": {"courses": offer_id}}
    )
    
    return {"success": True, "message": "Offre supprimée et références nettoyées"}

# --- Product Categories ---
@api_router.get("/categories")
async def get_categories():
    categories = await db.categories.find({}, {"_id": 0}).to_list(100)
    return categories if categories else [
        {"id": "service", "name": "Services & Cours", "icon": "🎧"},
        {"id": "tshirt", "name": "T-shirts", "icon": "👕"},
        {"id": "shoes", "name": "Chaussures", "icon": "👟"},
        {"id": "supplement", "name": "Compléments", "icon": "💊"},
        {"id": "accessory", "name": "Accessoires", "icon": "🎒"}
    ]

@api_router.post("/categories")
async def create_category(category: dict):
    category["id"] = category.get("id") or str(uuid.uuid4())[:8]
    await db.categories.insert_one(category)
    return category

# --- Shipping / Tracking ---
@api_router.put("/reservations/{reservation_id}/tracking")
async def update_tracking(reservation_id: str, tracking_data: dict):
    """Update shipping tracking for an order"""
    update_fields = {}
    if "trackingNumber" in tracking_data:
        update_fields["trackingNumber"] = tracking_data["trackingNumber"]
    if "shippingStatus" in tracking_data:
        update_fields["shippingStatus"] = tracking_data["shippingStatus"]
    
    await db.reservations.update_one(
        {"id": reservation_id},
        {"$set": update_fields}
    )
    updated = await db.reservations.find_one({"id": reservation_id}, {"_id": 0})
    return {"success": True, "reservation": updated}

# --- Users ---
@api_router.get("/users", response_model=List[User])
async def get_users():
    users = await db.users.find({}, {"_id": 0}).to_list(1000)
    for user in users:
        if isinstance(user.get('createdAt'), str):
            user['createdAt'] = datetime.fromisoformat(user['createdAt'].replace('Z', '+00:00'))
    return users

@api_router.post("/users", response_model=User)
async def create_user(user: UserCreate):
    user_obj = User(**user.model_dump())
    doc = user_obj.model_dump()
    doc['createdAt'] = doc['createdAt'].isoformat()
    await db.users.insert_one(doc)
    return user_obj

@api_router.get("/users/{user_id}", response_model=User)
async def get_user(user_id: str):
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if isinstance(user.get('createdAt'), str):
        user['createdAt'] = datetime.fromisoformat(user['createdAt'].replace('Z', '+00:00'))
    return user

@api_router.put("/users/{user_id}", response_model=User)
async def update_user(user_id: str, user: UserCreate):
    """Update an existing user/contact"""
    existing = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_data = user.model_dump()
    await db.users.update_one({"id": user_id}, {"$set": update_data})
    updated = await db.users.find_one({"id": user_id}, {"_id": 0})
    if isinstance(updated.get('createdAt'), str):
        updated['createdAt'] = datetime.fromisoformat(updated['createdAt'].replace('Z', '+00:00'))
    return updated

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str):
    """Supprime un utilisateur/contact et nettoie les références dans les codes promo"""
    # 1. Récupérer l'email de l'utilisateur avant suppression
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_email = user.get("email")
    
    # 2. Supprimer l'utilisateur
    await db.users.delete_one({"id": user_id})
    
    # 3. Nettoyer les références dans les codes promo (retirer l'email des assignedEmail)
    if user_email:
        await db.discount_codes.update_many(
            {"assignedEmail": user_email},
            {"$set": {"assignedEmail": None}}
        )
    
    return {"success": True, "message": "Contact supprimé et références nettoyées"}

# --- Reservations ---
@api_router.get("/reservations")
async def get_reservations(
    page: int = 1,
    limit: int = 20,
    all_data: bool = False
):
    """
    Get reservations with pagination for performance optimization.
    - page: Page number (default 1)
    - limit: Items per page (default 20)
    - all_data: If True, returns all reservations (for export CSV)
    """
    # Projection optimisée: ne récupérer que les champs nécessaires pour l'affichage initial
    projection = {
        "_id": 0,
        "id": 1,
        "reservationCode": 1,
        "userName": 1,
        "userEmail": 1,
        "userWhatsapp": 1,
        "courseName": 1,
        "courseTime": 1,
        "datetime": 1,
        "offerName": 1,
        "totalPrice": 1,
        "quantity": 1,
        "validated": 1,
        "validatedAt": 1,
        "createdAt": 1,
        "selectedDates": 1,
        "selectedDatesText": 1,
        "selectedVariants": 1,
        "variantsText": 1,
        "isProduct": 1,
        "shippingStatus": 1,
        "trackingNumber": 1
    }
    
    if all_data:
        # Pour l'export CSV, récupérer tous les champs
        reservations = await db.reservations.find({}, {"_id": 0}).sort("createdAt", -1).to_list(10000)
    else:
        # Pagination avec tri par date de création (les plus récentes en premier)
        skip = (page - 1) * limit
        reservations = await db.reservations.find({}, projection).sort("createdAt", -1).skip(skip).limit(limit).to_list(limit)
    
    # Compter le total pour la pagination
    total_count = await db.reservations.count_documents({})
    
    for res in reservations:
        if isinstance(res.get('createdAt'), str):
            res['createdAt'] = datetime.fromisoformat(res['createdAt'].replace('Z', '+00:00'))
    
    return {
        "data": reservations,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total_count,
            "pages": (total_count + limit - 1) // limit  # Ceiling division
        }
    }

@api_router.post("/reservations", response_model=Reservation)
async def create_reservation(reservation: ReservationCreate):
    res_code = f"AFR-{str(uuid.uuid4())[:6].upper()}"
    res_obj = Reservation(**reservation.model_dump(), reservationCode=res_code)
    doc = res_obj.model_dump()
    doc['createdAt'] = doc['createdAt'].isoformat()
    await db.reservations.insert_one(doc)
    return res_obj

@api_router.post("/reservations/{reservation_code}/validate")
async def validate_reservation(reservation_code: str):
    """Validate a reservation by QR code scan (coach action)"""
    reservation = await db.reservations.find_one({"reservationCode": reservation_code}, {"_id": 0})
    if not reservation:
        raise HTTPException(status_code=404, detail="Réservation non trouvée")
    
    # Mark as validated
    await db.reservations.update_one(
        {"reservationCode": reservation_code},
        {"$set": {"validated": True, "validatedAt": datetime.now(timezone.utc).isoformat()}}
    )
    return {"success": True, "message": "Réservation validée", "reservation": reservation}

@api_router.delete("/reservations/{reservation_id}")
async def delete_reservation(reservation_id: str):
    await db.reservations.delete_one({"id": reservation_id})
    return {"success": True}

# ==================== COACH NOTIFICATIONS ====================

class CoachNotificationPayload(BaseModel):
    """Payload for coach notification"""
    clientName: str
    clientEmail: str
    clientWhatsapp: str
    offerName: str
    courseName: str
    sessionDate: str
    amount: float
    reservationCode: str

@api_router.post("/notify-coach")
async def notify_coach(payload: CoachNotificationPayload):
    """
    Endpoint to trigger coach notification.
    Returns the notification config so frontend can send via EmailJS/WhatsApp.
    """
    try:
        # Get payment links config which contains coach notification settings
        payment_links = await db.payment_links.find_one({"id": "payment_links"}, {"_id": 0})
        if not payment_links:
            return {"success": False, "message": "Configuration non trouvée"}
        
        coach_email = payment_links.get("coachNotificationEmail", "")
        coach_phone = payment_links.get("coachNotificationPhone", "")
        
        if not coach_email and not coach_phone:
            return {"success": False, "message": "Aucune adresse de notification configurée"}
        
        # Format notification message
        notification_message = f"""🎉 NOUVELLE RÉSERVATION !

👤 Client: {payload.clientName}
📧 Email: {payload.clientEmail}
📱 WhatsApp: {payload.clientWhatsapp}

🎯 Offre: {payload.offerName}
📅 Cours: {payload.courseName}
🕐 Date: {payload.sessionDate}
💰 Montant: {payload.amount} CHF

🔑 Code: {payload.reservationCode}

---
Notification automatique Afroboost"""

        return {
            "success": True,
            "coachEmail": coach_email,
            "coachPhone": coach_phone,
            "message": notification_message,
            "subject": f"🎉 Nouvelle réservation - {payload.clientName}"
        }
    except Exception as e:
        logger.error(f"Error in notify-coach: {e}")
        return {"success": False, "message": str(e)}

# --- Discount Codes ---
@api_router.get("/discount-codes", response_model=List[DiscountCode])
async def get_discount_codes():
    codes = await db.discount_codes.find({}, {"_id": 0}).to_list(1000)
    return codes

@api_router.post("/discount-codes", response_model=DiscountCode)
async def create_discount_code(code: DiscountCodeCreate):
    code_obj = DiscountCode(**code.model_dump())
    await db.discount_codes.insert_one(code_obj.model_dump())
    return code_obj

@api_router.put("/discount-codes/{code_id}")
async def update_discount_code(code_id: str, updates: dict):
    await db.discount_codes.update_one({"id": code_id}, {"$set": updates})
    updated = await db.discount_codes.find_one({"id": code_id}, {"_id": 0})
    return updated

@api_router.delete("/discount-codes/{code_id}")
async def delete_discount_code(code_id: str):
    await db.discount_codes.delete_one({"id": code_id})
    return {"success": True}

@api_router.post("/discount-codes/validate")
async def validate_discount_code(data: dict):
    code_str = data.get("code", "").strip().upper()  # Normalize: trim + uppercase
    user_email = data.get("email", "").strip()
    course_id = data.get("courseId", "").strip()
    
    # Case-insensitive search using regex
    code = await db.discount_codes.find_one({
        "code": {"$regex": f"^{code_str}$", "$options": "i"},  # Case insensitive match
        "active": True
    }, {"_id": 0})
    
    if not code:
        return {"valid": False, "message": "Code inconnu ou invalide"}
    
    # Check expiration date
    if code.get("expiresAt"):
        try:
            expiry = code["expiresAt"]
            if isinstance(expiry, str):
                # Handle various date formats
                expiry = expiry.replace('Z', '+00:00')
                if 'T' not in expiry:
                    expiry = expiry + "T23:59:59+00:00"
                expiry_date = datetime.fromisoformat(expiry)
            else:
                expiry_date = expiry
            if expiry_date < datetime.now(timezone.utc):
                return {"valid": False, "message": "Code promo expiré"}
        except Exception as e:
            print(f"Date parsing error: {e}")
    
    # Check max uses
    if code.get("maxUses") and code.get("used", 0) >= code["maxUses"]:
        return {"valid": False, "message": "Code promo épuisé (nombre max d'utilisations atteint)"}
    
    # Check if course is allowed - IMPORTANT: empty list = all courses allowed
    allowed_courses = code.get("courses", [])
    if allowed_courses and len(allowed_courses) > 0:
        if course_id not in allowed_courses:
            return {"valid": False, "message": "Code non applicable à ce cours"}
    
    # Check assigned email
    if code.get("assignedEmail") and code["assignedEmail"].strip():
        if code["assignedEmail"].strip().lower() != user_email.lower():
            return {"valid": False, "message": "Code réservé à un autre compte"}
    
    return {"valid": True, "code": code}

@api_router.post("/discount-codes/{code_id}/use")
async def use_discount_code(code_id: str):
    await db.discount_codes.update_one({"id": code_id}, {"$inc": {"used": 1}})
    return {"success": True}

# ==================== SANITIZE DATA (Nettoyage des données fantômes) ====================

@api_router.post("/sanitize-data")
async def sanitize_data():
    """
    Nettoie automatiquement les données fantômes:
    - Retire des codes promo les IDs d'offres/cours qui n'existent plus
    - Retire des codes promo les emails de bénéficiaires qui n'existent plus
    """
    # 1. Récupérer tous les IDs valides
    valid_offer_ids = set()
    valid_course_ids = set()
    valid_user_emails = set()
    
    offers = await db.offers.find({}, {"id": 1, "_id": 0}).to_list(1000)
    for o in offers:
        if o.get("id"):
            valid_offer_ids.add(o["id"])
    
    courses = await db.courses.find({}, {"id": 1, "_id": 0}).to_list(1000)
    for c in courses:
        if c.get("id"):
            valid_course_ids.add(c["id"])
    
    users = await db.users.find({}, {"email": 1, "_id": 0}).to_list(1000)
    for u in users:
        if u.get("email"):
            valid_user_emails.add(u["email"])
    
    all_valid_article_ids = valid_offer_ids | valid_course_ids
    
    # 2. Nettoyer les codes promo
    discount_codes = await db.discount_codes.find({}, {"_id": 0}).to_list(1000)
    cleaned_count = 0
    
    for code in discount_codes:
        updates = {}
        
        # Nettoyer les articles (courses) fantômes
        if code.get("courses"):
            valid_courses = [c for c in code["courses"] if c in all_valid_article_ids]
            if len(valid_courses) != len(code["courses"]):
                updates["courses"] = valid_courses
        
        # Nettoyer les bénéficiaires fantômes
        if code.get("assignedEmail") and code["assignedEmail"] not in valid_user_emails:
            updates["assignedEmail"] = None
        
        # Appliquer les mises à jour
        if updates:
            await db.discount_codes.update_one({"id": code["id"]}, {"$set": updates})
            cleaned_count += 1
    
    return {
        "success": True,
        "message": f"Nettoyage terminé: {cleaned_count} codes promo nettoyés",
        "stats": {
            "valid_offers": len(valid_offer_ids),
            "valid_courses": len(valid_course_ids),
            "valid_users": len(valid_user_emails),
            "codes_cleaned": cleaned_count
        }
    }

# --- Campaigns (Marketing Module) ---
@api_router.get("/campaigns")
async def get_campaigns():
    campaigns = await db.campaigns.find({}, {"_id": 0}).sort("createdAt", -1).to_list(100)
    return campaigns

@api_router.get("/campaigns/{campaign_id}")
async def get_campaign(campaign_id: str):
    campaign = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign

@api_router.post("/campaigns")
async def create_campaign(campaign: CampaignCreate):
    campaign_data = Campaign(
        name=campaign.name,
        message=campaign.message,
        mediaUrl=campaign.mediaUrl,
        mediaFormat=campaign.mediaFormat,
        targetType=campaign.targetType,
        selectedContacts=campaign.selectedContacts,
        channels=campaign.channels,
        scheduledAt=campaign.scheduledAt,
        status="scheduled" if campaign.scheduledAt else "draft"
    ).model_dump()
    await db.campaigns.insert_one(campaign_data)
    return {k: v for k, v in campaign_data.items() if k != "_id"}

@api_router.put("/campaigns/{campaign_id}")
async def update_campaign(campaign_id: str, data: dict):
    data["updatedAt"] = datetime.now(timezone.utc).isoformat()
    await db.campaigns.update_one({"id": campaign_id}, {"$set": data})
    return await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})

@api_router.delete("/campaigns/{campaign_id}")
async def delete_campaign(campaign_id: str):
    await db.campaigns.delete_one({"id": campaign_id})
    return {"success": True}

@api_router.post("/campaigns/{campaign_id}/launch")
async def launch_campaign(campaign_id: str):
    """
    Lance une campagne immédiatement.
    - WhatsApp: Envoi DIRECT via Twilio (pas de file d'attente)
    - Email: Envoi DIRECT via Resend
    - Instagram: Non supporté (manuel)
    
    Chaque canal est indépendant: l'échec d'un email ne bloque pas WhatsApp.
    """
    campaign = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    # Get contacts based on targetType
    if campaign.get("targetType") == "all":
        contacts = await db.users.find({}, {"_id": 0}).to_list(1000)
    else:
        selected_ids = campaign.get("selectedContacts", [])
        contacts = await db.users.find({"id": {"$in": selected_ids}}, {"_id": 0}).to_list(1000)
    
    # Prepare results and tracking
    results = []
    channels = campaign.get("channels", {})
    message_content = campaign.get("message", "")
    media_url = campaign.get("mediaUrl", "")
    campaign_name = campaign.get("name", "Campagne")
    
    success_count = 0
    fail_count = 0
    
    logger.info(f"[CAMPAIGN-LAUNCH] 🚀 Lancement campagne '{campaign_name}' - {len(contacts)} contact(s)")
    
    for contact in contacts:
        contact_id = contact.get("id", "")
        contact_name = contact.get("name", "")
        contact_email = contact.get("email", "")
        contact_phone = contact.get("whatsapp", "")
        
        # ==================== ENVOI WHATSAPP (INDÉPENDANT) ====================
        if channels.get("whatsapp") and contact_phone:
            whatsapp_result = {
                "contactId": contact_id,
                "contactName": contact_name,
                "contactEmail": contact_email,
                "contactPhone": contact_phone,
                "channel": "whatsapp",
                "status": "pending",
                "sentAt": None
            }
            
            try:
                # Envoi DIRECT via Twilio
                wa_response = await send_whatsapp_direct(
                    to_phone=contact_phone,
                    message=message_content,
                    media_url=media_url if media_url else None
                )
                
                if wa_response.get("status") == "success":
                    whatsapp_result["status"] = "sent"
                    whatsapp_result["sentAt"] = datetime.now(timezone.utc).isoformat()
                    whatsapp_result["sid"] = wa_response.get("sid")
                    success_count += 1
                    logger.info(f"[CAMPAIGN-LAUNCH] ✅ WhatsApp envoyé à {contact_name} ({contact_phone})")
                elif wa_response.get("status") == "simulated":
                    whatsapp_result["status"] = "simulated"
                    whatsapp_result["sentAt"] = datetime.now(timezone.utc).isoformat()
                    logger.info(f"[CAMPAIGN-LAUNCH] 🧪 WhatsApp simulé pour {contact_name} ({contact_phone})")
                else:
                    whatsapp_result["status"] = "failed"
                    whatsapp_result["error"] = wa_response.get("error", "Unknown error")
                    fail_count += 1
                    logger.error(f"[CAMPAIGN-LAUNCH] ❌ WhatsApp échoué pour {contact_name}: {wa_response.get('error')}")
            except Exception as e:
                whatsapp_result["status"] = "failed"
                whatsapp_result["error"] = str(e)
                fail_count += 1
                logger.error(f"[CAMPAIGN-LAUNCH] ❌ Exception WhatsApp pour {contact_name}: {str(e)}")
            
            results.append(whatsapp_result)
        
        # ==================== ENVOI EMAIL (INDÉPENDANT) ====================
        if channels.get("email") and contact_email:
            email_result = {
                "contactId": contact_id,
                "contactName": contact_name,
                "contactEmail": contact_email,
                "contactPhone": contact_phone,
                "channel": "email",
                "status": "pending",
                "sentAt": None
            }
            
            try:
                # Envoi via l'endpoint interne (Resend)
                if RESEND_AVAILABLE and RESEND_API_KEY:
                    # Préparer le template email
                    subject = f"📢 {campaign_name}"
                    first_name = contact_name.split()[0] if contact_name else "ami(e)"
                    
                    html_content = f"""<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><title>Message Afroboost</title></head>
<body style="margin:0;padding:20px;background:#f5f5f5;font-family:Arial,sans-serif;">
<div style="max-width:480px;margin:0 auto;background:#111;border-radius:10px;overflow:hidden;">
<div style="background:#9333EA;padding:16px 20px;text-align:center;">
<span style="color:#fff;font-size:22px;font-weight:bold;">Afroboost</span>
</div>
<div style="padding:20px;color:#fff;font-size:14px;line-height:1.6;">
<p>Salut {first_name},</p>
{message_content.replace(chr(10), '<br>')}
</div>
<div style="padding:15px 20px;border-top:1px solid #333;text-align:center;">
<a href="https://afroboosteur.com" style="color:#9333EA;text-decoration:none;font-size:11px;">afroboosteur.com</a>
</div>
</div>
</body>
</html>"""
                    
                    params = {
                        "from": "Afroboost <notifications@afroboosteur.com>",
                        "to": [contact_email],
                        "subject": subject,
                        "html": html_content
                    }
                    
                    email_response = await asyncio.to_thread(resend.Emails.send, params)
                    email_result["status"] = "sent"
                    email_result["sentAt"] = datetime.now(timezone.utc).isoformat()
                    email_result["email_id"] = email_response.get("id")
                    success_count += 1
                    logger.info(f"[CAMPAIGN-LAUNCH] ✅ Email envoyé à {contact_name} ({contact_email})")
                else:
                    email_result["status"] = "simulated"
                    email_result["sentAt"] = datetime.now(timezone.utc).isoformat()
                    logger.info(f"[CAMPAIGN-LAUNCH] 🧪 Email simulé pour {contact_name} ({contact_email})")
            except Exception as e:
                email_result["status"] = "failed"
                email_result["error"] = str(e)
                fail_count += 1
                logger.error(f"[CAMPAIGN-LAUNCH] ❌ Email échoué pour {contact_name}: {str(e)}")
            
            results.append(email_result)
        
        # ==================== INSTAGRAM (NON SUPPORTÉ - MANUEL) ====================
        if channels.get("instagram"):
            results.append({
                "contactId": contact_id,
                "contactName": contact_name,
                "contactEmail": contact_email,
                "contactPhone": contact_phone,
                "channel": "instagram",
                "status": "manual",
                "sentAt": None,
                "note": "Envoi manuel requis"
            })
    
    # Déterminer le statut final
    all_sent = all(r.get("status") in ["sent", "simulated", "manual"] for r in results)
    final_status = "completed" if all_sent else "sending"
    
    # Update campaign
    await db.campaigns.update_one(
        {"id": campaign_id},
        {"$set": {
            "status": final_status,
            "results": results,
            "updatedAt": datetime.now(timezone.utc).isoformat(),
            "launchedAt": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    logger.info(f"[CAMPAIGN-LAUNCH] 🏁 Campagne '{campaign_name}' terminée - ✅{success_count} / ❌{fail_count}")
    
    return await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})

@api_router.post("/campaigns/{campaign_id}/mark-sent")
async def mark_campaign_sent(campaign_id: str, data: dict):
    """Mark specific result as sent"""
    contact_id = data.get("contactId")
    channel = data.get("channel")
    
    await db.campaigns.update_one(
        {"id": campaign_id, "results.contactId": contact_id, "results.channel": channel},
        {"$set": {
            "results.$.status": "sent",
            "results.$.sentAt": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Check if all results are sent
    campaign = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if campaign:
        all_sent = all(r.get("status") == "sent" for r in campaign.get("results", []))
        if all_sent:
            await db.campaigns.update_one(
                {"id": campaign_id},
                {"$set": {"status": "completed", "updatedAt": datetime.now(timezone.utc).isoformat()}}
            )
    
    return {"success": True}

# --- Payment Links ---
@api_router.get("/payment-links", response_model=PaymentLinks)
async def get_payment_links():
    links = await db.payment_links.find_one({"id": "payment_links"}, {"_id": 0})
    if not links:
        default_links = PaymentLinks().model_dump()
        await db.payment_links.insert_one(default_links)
        return default_links
    return links

@api_router.put("/payment-links")
async def update_payment_links(links: PaymentLinksUpdate):
    await db.payment_links.update_one(
        {"id": "payment_links"}, 
        {"$set": links.model_dump()}, 
        upsert=True
    )
    return await db.payment_links.find_one({"id": "payment_links"}, {"_id": 0})

# --- Stripe Checkout avec TWINT ---

class CreateCheckoutRequest(BaseModel):
    """Requête pour créer une session de paiement Stripe"""
    productName: str
    amount: float  # Montant en CHF (decimal, ex: 25.00)
    customerEmail: Optional[str] = None
    originUrl: str  # URL d'origine du frontend pour construire success/cancel URLs
    reservationData: Optional[dict] = None  # Données de réservation pour metadata

@api_router.post("/create-checkout-session")
async def create_checkout_session(request: CreateCheckoutRequest):
    """
    Crée une session Stripe Checkout avec support pour cartes et TWINT.
    TWINT nécessite la devise CHF.
    """
    if not stripe.api_key:
        raise HTTPException(status_code=500, detail="Stripe API key not configured")
    
    # Construire les URLs dynamiquement basées sur l'origine frontend
    # {CHECKOUT_SESSION_ID} est remplacé automatiquement par Stripe
    success_url = f"{request.originUrl}?status=success&session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{request.originUrl}?status=canceled"
    
    # Montant en centimes (Stripe utilise les plus petites unités)
    amount_cents = int(request.amount * 100)
    
    # Préparer les metadata
    metadata = {
        "product_name": request.productName,
        "customer_email": request.customerEmail or "",
        "source": "afroboost_checkout"
    }
    if request.reservationData:
        metadata["reservation_id"] = request.reservationData.get("id", "")
        metadata["course_name"] = request.reservationData.get("courseName", "")
    
    # Méthodes de paiement: card + twint (devise CHF obligatoire pour TWINT)
    payment_methods = ['card', 'twint']
    
    try:
        # Créer la session Stripe avec card + twint
        session = stripe.checkout.Session.create(
            payment_method_types=payment_methods,
            line_items=[{
                'price_data': {
                    'currency': 'chf',  # CHF obligatoire pour TWINT
                    'product_data': {
                        'name': request.productName,
                    },
                    'unit_amount': amount_cents,
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=success_url,
            cancel_url=cancel_url,
            customer_email=request.customerEmail,
            metadata=metadata,
        )
        
        # Créer l'entrée dans payment_transactions
        transaction = {
            "id": str(uuid.uuid4()),
            "session_id": session.id,
            "amount": request.amount,
            "currency": "chf",
            "product_name": request.productName,
            "customer_email": request.customerEmail,
            "metadata": metadata,
            "payment_status": "pending",
            "payment_methods": payment_methods,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.payment_transactions.insert_one(transaction)
        
        logger.info(f"Stripe session created with payment methods: {payment_methods}, session_id: {session.id}")
        
        return {
            "sessionId": session.id,
            "url": session.url,
            "paymentMethods": payment_methods
        }
        
    except stripe.error.InvalidRequestError as e:
        # Si TWINT cause une erreur (non activé sur le compte), fallback sur card seul
        logger.warning(f"TWINT not available, falling back to card only: {str(e)}")
        
        try:
            session = stripe.checkout.Session.create(
                payment_method_types=['card'],
                line_items=[{
                    'price_data': {
                        'currency': 'chf',
                        'product_data': {
                            'name': request.productName,
                        },
                        'unit_amount': amount_cents,
                    },
                    'quantity': 1,
                }],
                mode='payment',
                success_url=success_url,
                cancel_url=cancel_url,
                customer_email=request.customerEmail,
                metadata=metadata,
            )
            
            # Créer l'entrée dans payment_transactions
            transaction = {
                "id": str(uuid.uuid4()),
                "session_id": session.id,
                "amount": request.amount,
                "currency": "chf",
                "product_name": request.productName,
                "customer_email": request.customerEmail,
                "metadata": metadata,
                "payment_status": "pending",
                "payment_methods": ['card'],
                "warning": "TWINT not available",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.payment_transactions.insert_one(transaction)
            
            logger.info(f"Stripe session created with card only (TWINT fallback), session_id: {session.id}")
            
            return {
                "sessionId": session.id,
                "url": session.url,
                "paymentMethods": ['card'],
                "warning": "TWINT not available on this Stripe account"
            }
            
        except stripe.error.StripeError as fallback_error:
            logger.error(f"Stripe fallback error: {str(fallback_error)}")
            raise HTTPException(status_code=500, detail=f"Payment error: {str(fallback_error)}")
            
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Payment error: {str(e)}")

@api_router.get("/checkout-status/{session_id}")
async def get_checkout_status(session_id: str):
    """
    Vérifie le statut d'une session de paiement Stripe.
    """
    if not stripe.api_key:
        raise HTTPException(status_code=500, detail="Stripe API key not configured")
    
    try:
        session = stripe.checkout.Session.retrieve(session_id)
        
        # Mettre à jour le statut dans la base de données
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {
                "payment_status": session.payment_status,
                "status": session.status,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        return {
            "status": session.status,
            "paymentStatus": session.payment_status,
            "amountTotal": session.amount_total,
            "currency": session.currency,
            "metadata": session.metadata
        }
        
    except stripe.error.StripeError as e:
        logger.error(f"Error checking checkout status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error checking status: {str(e)}")

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """
    Webhook Stripe pour recevoir les événements de paiement.
    """
    try:
        body = await request.body()
        event = stripe.Event.construct_from(
            stripe.util.json.loads(body), stripe.api_key
        )
        
        # Gérer les événements de paiement
        if event.type == 'checkout.session.completed':
            session = event.data.object
            await db.payment_transactions.update_one(
                {"session_id": session.id},
                {"$set": {
                    "payment_status": session.payment_status,
                    "status": "completed",
                    "webhook_received_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            logger.info(f"Payment completed for session: {session.id}")
            
        elif event.type == 'checkout.session.expired':
            session = event.data.object
            await db.payment_transactions.update_one(
                {"session_id": session.id},
                {"$set": {
                    "status": "expired",
                    "webhook_received_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            logger.info(f"Payment expired for session: {session.id}")
        
        return {"received": True}
        
    except Exception as e:
        logger.error(f"Webhook error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Webhook error: {str(e)}")

# --- Concept ---
@api_router.get("/concept", response_model=Concept)
async def get_concept():
    concept = await db.concept.find_one({"id": "concept"}, {"_id": 0})
    if not concept:
        default_concept = Concept().model_dump()
        await db.concept.insert_one(default_concept)
        return default_concept
    return concept

@api_router.put("/concept")
async def update_concept(concept: ConceptUpdate):
    try:
        updates = {k: v for k, v in concept.model_dump().items() if v is not None}
        print(f"Updating concept with: {updates}")
        result = await db.concept.update_one({"id": "concept"}, {"$set": updates}, upsert=True)
        print(f"Update result: matched={result.matched_count}, modified={result.modified_count}")
        updated = await db.concept.find_one({"id": "concept"}, {"_id": 0})
        return updated
    except Exception as e:
        print(f"Error updating concept: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- Config ---
@api_router.get("/config", response_model=AppConfig)
async def get_config():
    config = await db.config.find_one({"id": "app_config"}, {"_id": 0})
    if not config:
        default_config = AppConfig().model_dump()
        await db.config.insert_one(default_config)
        return default_config
    return config

@api_router.put("/config")
async def update_config(config_update: dict):
    await db.config.update_one({"id": "app_config"}, {"$set": config_update}, upsert=True)
    return await db.config.find_one({"id": "app_config"}, {"_id": 0})

# ==================== GOOGLE OAUTH AUTHENTICATION ====================
# Business: Authentification Google exclusive pour le Super Admin / Coach
# Seul l'email autorisé peut accéder au dashboard

# Email autorisé pour l'accès Coach/Super Admin
AUTHORIZED_COACH_EMAIL = os.environ.get("AUTHORIZED_COACH_EMAIL", "contact.artboost@gmail.com")

class GoogleAuthSession(BaseModel):
    """Session d'authentification Google"""
    model_config = ConfigDict(extra="ignore")
    session_id: str
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class GoogleUser(BaseModel):
    """Utilisateur authentifié via Google"""
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    is_coach: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_login: Optional[datetime] = None

@api_router.post("/auth/google/session")
async def process_google_session(request: Request, response: Response):
    """
    Traite le session_id reçu après authentification Google.
    Vérifie que l'email est autorisé (coach@afroboost.com).
    
    REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    """
    try:
        body = await request.json()
        session_id = body.get("session_id")
        
        if not session_id:
            raise HTTPException(status_code=400, detail="session_id requis")
        
        # Appeler l'API Emergent pour récupérer les données de session
        import httpx
        async with httpx.AsyncClient() as client:
            emergent_response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id}
            )
            
            if emergent_response.status_code != 200:
                raise HTTPException(status_code=401, detail="Session invalide ou expirée")
            
            user_data = emergent_response.json()
        
        email = user_data.get("email", "").lower()
        name = user_data.get("name", "")
        picture = user_data.get("picture", "")
        session_token = user_data.get("session_token", "")
        
        # ===== VÉRIFICATION CRITIQUE : Email autorisé uniquement =====
        if email != AUTHORIZED_COACH_EMAIL.lower():
            return {
                "success": False,
                "error": "access_denied",
                "message": f"⛔ Accès réservé. Seul {AUTHORIZED_COACH_EMAIL} peut accéder à ce dashboard."
            }
        
        # Créer ou mettre à jour l'utilisateur
        user_id = f"coach_{uuid.uuid4().hex[:12]}"
        existing_user = await db.google_users.find_one({"email": email}, {"_id": 0})
        
        if existing_user:
            user_id = existing_user.get("user_id", user_id)
            await db.google_users.update_one(
                {"email": email},
                {"$set": {
                    "name": name,
                    "picture": picture,
                    "last_login": datetime.now(timezone.utc).isoformat()
                }}
            )
        else:
            await db.google_users.insert_one({
                "user_id": user_id,
                "email": email,
                "name": name,
                "picture": picture,
                "is_coach": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "last_login": datetime.now(timezone.utc).isoformat()
            })
        
        # Créer la session
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        await db.coach_sessions.delete_many({"user_id": user_id})  # Supprimer les anciennes sessions
        await db.coach_sessions.insert_one({
            "session_id": str(uuid.uuid4()),
            "user_id": user_id,
            "email": email,
            "name": name,
            "session_token": session_token,
            "expires_at": expires_at.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Définir le cookie httpOnly
        response.set_cookie(
            key="coach_session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            max_age=7 * 24 * 60 * 60,  # 7 jours
            path="/"
        )
        
        return {
            "success": True,
            "user": {
                "user_id": user_id,
                "email": email,
                "name": name,
                "picture": picture,
                "is_coach": True
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Google auth error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/auth/me")
async def get_current_user(request: Request):
    """
    Vérifie la session actuelle et retourne les infos utilisateur.
    Utilisé pour vérifier si l'utilisateur est connecté.
    """
    # Récupérer le token depuis le cookie ou le header Authorization
    session_token = request.cookies.get("coach_session_token")
    
    if not session_token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Non authentifié")
    
    # Vérifier la session
    session = await db.coach_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if not session:
        raise HTTPException(status_code=401, detail="Session invalide")
    
    # Vérifier l'expiration
    expires_at = session.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        await db.coach_sessions.delete_one({"session_token": session_token})
        raise HTTPException(status_code=401, detail="Session expirée")
    
    # Récupérer l'utilisateur
    user = await db.google_users.find_one(
        {"user_id": session.get("user_id")},
        {"_id": 0}
    )
    
    if not user:
        raise HTTPException(status_code=401, detail="Utilisateur non trouvé")
    
    return {
        "user_id": user.get("user_id"),
        "email": user.get("email"),
        "name": user.get("name"),
        "picture": user.get("picture"),
        "is_coach": user.get("is_coach", True)
    }

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """
    Déconnexion: supprime la session et le cookie.
    """
    session_token = request.cookies.get("coach_session_token")
    
    if session_token:
        await db.coach_sessions.delete_many({"session_token": session_token})
    
    response.delete_cookie(
        key="coach_session_token",
        path="/",
        secure=True,
        samesite="none"
    )
    
    return {"success": True, "message": "Déconnexion réussie"}

# --- Legacy Coach Auth (conservé pour compatibilité mais déprécié) ---
@api_router.get("/coach-auth")
async def get_coach_auth():
    """DÉPRÉCIÉ: Utilisez /auth/me à la place"""
    return {"email": AUTHORIZED_COACH_EMAIL, "auth_method": "google_oauth"}

@api_router.post("/coach-auth/login")
async def coach_login(login: CoachLogin):
    """DÉPRÉCIÉ: Utilisez l'authentification Google OAuth"""
    return {
        "success": False, 
        "message": "L'authentification par mot de passe a été désactivée. Veuillez utiliser 'Se connecter avec Google'."
    }

# ==================== FEATURE FLAGS API (Super Admin Only) ====================
# Business: Seul le Super Admin peut activer/désactiver les services globaux

@api_router.get("/feature-flags")
async def get_feature_flags():
    """
    Récupère la configuration des feature flags
    Par défaut, tous les services additionnels sont désactivés
    """
    flags = await db.feature_flags.find_one({"id": "feature_flags"}, {"_id": 0})
    if not flags:
        # Créer la config par défaut (tout désactivé)
        default_flags = {
            "id": "feature_flags",
            "AUDIO_SERVICE_ENABLED": False,
            "VIDEO_SERVICE_ENABLED": False,
            "STREAMING_SERVICE_ENABLED": False,
            "updatedAt": None,
            "updatedBy": None
        }
        await db.feature_flags.insert_one(default_flags.copy())  # .copy() pour éviter mutation
        # Retourner sans _id
        return {k: v for k, v in default_flags.items() if k != "_id"}
    return flags

@api_router.put("/feature-flags")
async def update_feature_flags(update: FeatureFlagsUpdate):
    """
    Met à jour les feature flags (Super Admin only)
    TODO: Ajouter authentification Super Admin
    """
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    update_data["updatedAt"] = datetime.now(timezone.utc).isoformat()
    update_data["updatedBy"] = "super_admin"  # TODO: Récupérer depuis le token
    
    await db.feature_flags.update_one(
        {"id": "feature_flags"}, 
        {"$set": update_data}, 
        upsert=True
    )
    return await db.feature_flags.find_one({"id": "feature_flags"}, {"_id": 0})

# ==================== COACH SUBSCRIPTION API ====================
# Business: Gestion des abonnements et droits des coachs

@api_router.get("/coach-subscription")
async def get_coach_subscription():
    """
    Récupère l'abonnement du coach actuel
    Utilise l'email de coach_auth pour trouver l'abonnement correspondant
    """
    # Récupérer l'email du coach actuel
    coach_auth = await db.coach_auth.find_one({"id": "coach_auth"}, {"_id": 0})
    if not coach_auth:
        return {"error": "Coach auth not found"}
    
    coach_email = coach_auth.get("email", "coach@afroboost.com")
    
    # Chercher l'abonnement correspondant
    subscription = await db.coach_subscriptions.find_one(
        {"coachEmail": coach_email}, 
        {"_id": 0}
    )
    
    if not subscription:
        # Créer un abonnement par défaut (free, sans services additionnels)
        default_sub = {
            "id": str(uuid.uuid4()),
            "coachEmail": coach_email,
            "hasAudioService": False,
            "hasVideoService": False,
            "hasStreamingService": False,
            "subscriptionPlan": "free",
            "subscriptionStartDate": datetime.now(timezone.utc).isoformat(),
            "subscriptionEndDate": None,
            "isActive": True,
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "updatedAt": None
        }
        await db.coach_subscriptions.insert_one(default_sub.copy())  # .copy() pour éviter mutation
        # Retourner sans _id
        return {k: v for k, v in default_sub.items() if k != "_id"}
    
    return subscription

@api_router.put("/coach-subscription")
async def update_coach_subscription(update: CoachSubscriptionUpdate):
    """
    Met à jour l'abonnement du coach
    TODO: Ajouter vérification Super Admin pour modifications sensibles
    """
    coach_auth = await db.coach_auth.find_one({"id": "coach_auth"}, {"_id": 0})
    if not coach_auth:
        raise HTTPException(status_code=404, detail="Coach auth not found")
    
    coach_email = coach_auth.get("email", "coach@afroboost.com")
    
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    update_data["updatedAt"] = datetime.now(timezone.utc).isoformat()
    
    await db.coach_subscriptions.update_one(
        {"coachEmail": coach_email},
        {"$set": update_data},
        upsert=True
    )
    
    return await db.coach_subscriptions.find_one({"coachEmail": coach_email}, {"_id": 0})

# ==================== SERVICE ACCESS VERIFICATION ====================
# Business: Fonction centrale pour vérifier l'accès aux services

@api_router.get("/verify-service-access/{service_name}")
async def verify_service_access(service_name: str):
    """
    Vérifie si un service est accessible pour le coach actuel.
    
    Logique de vérification (BOTH conditions must be true):
    1. Feature flag global activé (Super Admin)
    2. Coach a l'abonnement correspondant
    
    Args:
        service_name: "audio", "video", "streaming"
    
    Returns:
        {
            "hasAccess": bool,
            "reason": str,
            "featureFlagEnabled": bool,
            "coachHasSubscription": bool
        }
    """
    # Mapper les noms de service aux champs
    service_map = {
        "audio": ("AUDIO_SERVICE_ENABLED", "hasAudioService"),
        "video": ("VIDEO_SERVICE_ENABLED", "hasVideoService"),
        "streaming": ("STREAMING_SERVICE_ENABLED", "hasStreamingService")
    }
    
    if service_name not in service_map:
        raise HTTPException(status_code=400, detail=f"Service inconnu: {service_name}")
    
    flag_field, sub_field = service_map[service_name]
    
    # 1. Vérifier le feature flag global
    flags = await db.feature_flags.find_one({"id": "feature_flags"}, {"_id": 0})
    feature_enabled = flags.get(flag_field, False) if flags else False
    
    # 2. Vérifier l'abonnement du coach
    coach_auth = await db.coach_auth.find_one({"id": "coach_auth"}, {"_id": 0})
    coach_email = coach_auth.get("email", "coach@afroboost.com") if coach_auth else "coach@afroboost.com"
    
    subscription = await db.coach_subscriptions.find_one({"coachEmail": coach_email}, {"_id": 0})
    coach_has_service = subscription.get(sub_field, False) if subscription else False
    
    # Déterminer l'accès et la raison
    has_access = feature_enabled and coach_has_service
    
    if not feature_enabled:
        reason = f"Service {service_name} désactivé globalement (contacter l'administrateur)"
    elif not coach_has_service:
        reason = f"Votre abonnement n'inclut pas le service {service_name}"
    else:
        reason = "Accès autorisé"
    
    return {
        "hasAccess": has_access,
        "reason": reason,
        "featureFlagEnabled": feature_enabled,
        "coachHasSubscription": coach_has_service,
        "service": service_name
    }

# ==================== EMAILJS CONFIG (MongoDB) ====================

class EmailJSConfig(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = "emailjs_config"
    serviceId: str = ""
    templateId: str = ""
    publicKey: str = ""

class EmailJSConfigUpdate(BaseModel):
    serviceId: Optional[str] = None
    templateId: Optional[str] = None
    publicKey: Optional[str] = None

@api_router.get("/emailjs-config")
async def get_emailjs_config():
    config = await db.emailjs_config.find_one({"id": "emailjs_config"}, {"_id": 0})
    if not config:
        return {"id": "emailjs_config", "serviceId": "", "templateId": "", "publicKey": ""}
    return config

@api_router.put("/emailjs-config")
async def update_emailjs_config(config: EmailJSConfigUpdate):
    updates = {k: v for k, v in config.model_dump().items() if v is not None}
    updates["id"] = "emailjs_config"
    await db.emailjs_config.update_one({"id": "emailjs_config"}, {"$set": updates}, upsert=True)
    return await db.emailjs_config.find_one({"id": "emailjs_config"}, {"_id": 0})

# ==================== WHATSAPP CONFIG (MongoDB) ====================

class WhatsAppConfig(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = "whatsapp_config"
    accountSid: str = ""
    authToken: str = ""
    fromNumber: str = ""
    apiMode: str = "twilio"

class WhatsAppConfigUpdate(BaseModel):
    accountSid: Optional[str] = None
    authToken: Optional[str] = None
    fromNumber: Optional[str] = None
    apiMode: Optional[str] = None

@api_router.get("/whatsapp-config")
async def get_whatsapp_config():
    config = await db.whatsapp_config.find_one({"id": "whatsapp_config"}, {"_id": 0})
    if not config:
        return {"id": "whatsapp_config", "accountSid": "", "authToken": "", "fromNumber": "", "apiMode": "twilio"}
    return config

@api_router.put("/whatsapp-config")
async def update_whatsapp_config(config: WhatsAppConfigUpdate):
    updates = {k: v for k, v in config.model_dump().items() if v is not None}
    updates["id"] = "whatsapp_config"
    await db.whatsapp_config.update_one({"id": "whatsapp_config"}, {"$set": updates}, upsert=True)
    return await db.whatsapp_config.find_one({"id": "whatsapp_config"}, {"_id": 0})

# ==================== DATA MIGRATION (localStorage -> MongoDB) ====================

class MigrationData(BaseModel):
    model_config = ConfigDict(extra="ignore")
    emailJSConfig: Optional[dict] = None
    whatsAppConfig: Optional[dict] = None
    aiConfig: Optional[dict] = None
    reservations: Optional[List[dict]] = None
    coachAuth: Optional[dict] = None

@api_router.post("/migrate-data")
async def migrate_localstorage_to_mongodb(data: MigrationData):
    """
    Endpoint pour migrer les données du localStorage vers MongoDB.
    Appelé une seule fois lors de la première utilisation après la migration.
    """
    migrated = {"emailJS": False, "whatsApp": False, "ai": False, "reservations": 0, "coachAuth": False}
    
    # Migration EmailJS Config
    if data.emailJSConfig and data.emailJSConfig.get("serviceId"):
        existing = await db.emailjs_config.find_one({"id": "emailjs_config"})
        if not existing or not existing.get("serviceId"):
            await db.emailjs_config.update_one(
                {"id": "emailjs_config"}, 
                {"$set": {**data.emailJSConfig, "id": "emailjs_config"}}, 
                upsert=True
            )
            migrated["emailJS"] = True
    
    # Migration WhatsApp Config
    if data.whatsAppConfig and data.whatsAppConfig.get("accountSid"):
        existing = await db.whatsapp_config.find_one({"id": "whatsapp_config"})
        if not existing or not existing.get("accountSid"):
            await db.whatsapp_config.update_one(
                {"id": "whatsapp_config"}, 
                {"$set": {**data.whatsAppConfig, "id": "whatsapp_config"}}, 
                upsert=True
            )
            migrated["whatsApp"] = True
    
    # Migration AI Config
    if data.aiConfig and data.aiConfig.get("systemPrompt"):
        existing = await db.ai_config.find_one({"id": "ai_config"})
        if not existing or not existing.get("systemPrompt"):
            await db.ai_config.update_one(
                {"id": "ai_config"}, 
                {"$set": {**data.aiConfig, "id": "ai_config"}}, 
                upsert=True
            )
            migrated["ai"] = True
    
    # Migration Reservations
    if data.reservations:
        for res in data.reservations:
            if res.get("reservationCode"):
                existing = await db.reservations.find_one({"reservationCode": res["reservationCode"]})
                if not existing:
                    await db.reservations.insert_one(res)
                    migrated["reservations"] += 1
    
    # Migration Coach Auth
    if data.coachAuth:
        existing = await db.coach_auth.find_one({"id": "coach_auth"})
        if not existing:
            await db.coach_auth.update_one(
                {"id": "coach_auth"}, 
                {"$set": {**data.coachAuth, "id": "coach_auth"}}, 
                upsert=True
            )
            migrated["coachAuth"] = True
    
    logger.info(f"Migration completed: {migrated}")
    return {"success": True, "migrated": migrated}

@api_router.get("/migration-status")
async def get_migration_status():
    """Vérifie si les données ont été migrées vers MongoDB"""
    emailjs = await db.emailjs_config.find_one({"id": "emailjs_config"}, {"_id": 0})
    whatsapp = await db.whatsapp_config.find_one({"id": "whatsapp_config"}, {"_id": 0})
    ai = await db.ai_config.find_one({"id": "ai_config"}, {"_id": 0})
    reservations_count = await db.reservations.count_documents({})
    
    return {
        "emailJS": bool(emailjs and emailjs.get("serviceId")),
        "whatsApp": bool(whatsapp and whatsapp.get("accountSid")),
        "ai": bool(ai and ai.get("systemPrompt")),
        "reservationsCount": reservations_count,
        "migrationComplete": True
    }

# ==================== AI WHATSAPP AGENT ====================

class AIConfig(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = "ai_config"
    enabled: bool = False
    systemPrompt: str = """Tu es l'assistant virtuel d'Afroboost, une expérience fitness unique combinant cardio, danse afrobeat et casques audio immersifs.

Ton rôle:
- Répondre aux questions sur les cours, les offres et les réservations
- Être chaleureux, dynamique et motivant comme un coach fitness
- Utiliser un ton amical et des emojis appropriés
- Personnaliser les réponses avec le prénom du client quand disponible

Si tu ne connais pas la réponse, oriente vers le contact: contact.artboost@gmail.com"""
    model: str = "gpt-4o-mini"
    provider: str = "openai"
    lastMediaUrl: str = ""
    twintPaymentUrl: str = ""  # Lien de paiement Twint direct pour les ventes
    campaignPrompt: str = ""  # Prompt Campagne PRIORITAIRE - Ajouté à la fin du contexte

class AIConfigUpdate(BaseModel):
    enabled: Optional[bool] = None
    systemPrompt: Optional[str] = None
    model: Optional[str] = None
    provider: Optional[str] = None
    lastMediaUrl: Optional[str] = None
    twintPaymentUrl: Optional[str] = None  # Lien de paiement Twint direct
    campaignPrompt: Optional[str] = None  # Prompt Campagne PRIORITAIRE

class AILog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    fromPhone: str
    clientName: Optional[str] = None
    incomingMessage: str
    aiResponse: str
    responseTime: float = 0  # En secondes

class WhatsAppWebhook(BaseModel):
    From: str  # whatsapp:+41XXXXXXXXX
    Body: str
    To: Optional[str] = None
    MediaUrl0: Optional[str] = None

# --- AI Config Routes ---
@api_router.get("/ai-config")
async def get_ai_config():
    config = await db.ai_config.find_one({"id": "ai_config"}, {"_id": 0})
    if not config:
        default_config = AIConfig().model_dump()
        await db.ai_config.insert_one(default_config)
        return default_config
    return config

@api_router.put("/ai-config")
async def update_ai_config(config: AIConfigUpdate):
    updates = {k: v for k, v in config.model_dump().items() if v is not None}
    await db.ai_config.update_one({"id": "ai_config"}, {"$set": updates}, upsert=True)
    return await db.ai_config.find_one({"id": "ai_config"}, {"_id": 0})

# --- AI Logs Routes ---
@api_router.get("/ai-logs")
async def get_ai_logs():
    logs = await db.ai_logs.find({}, {"_id": 0}).sort("timestamp", -1).to_list(50)
    return logs

@api_router.delete("/ai-logs")
async def clear_ai_logs():
    await db.ai_logs.delete_many({})
    return {"success": True}

# --- WhatsApp Webhook (Twilio) ---
@api_router.post("/webhook/whatsapp")
async def handle_whatsapp_webhook(webhook: WhatsAppWebhook):
    """
    Webhook pour recevoir les messages WhatsApp entrants via Twilio
    Répond automatiquement avec l'IA si activée
    """
    import time
    start_time = time.time()
    
    # Récupérer la config IA
    ai_config = await db.ai_config.find_one({"id": "ai_config"}, {"_id": 0})
    if not ai_config or not ai_config.get("enabled"):
        logger.info(f"AI disabled, ignoring message from {webhook.From}")
        return {"status": "ai_disabled"}
    
    # Extraire le numéro de téléphone
    from_phone = webhook.From.replace("whatsapp:", "")
    incoming_message = webhook.Body
    
    logger.info(f"Incoming WhatsApp from {from_phone}: {incoming_message}")
    
    # Chercher le client dans les réservations
    client_name = None
    normalized_phone = from_phone.replace("+", "").replace(" ", "")
    reservations = await db.reservations.find({}, {"_id": 0}).to_list(1000)
    
    for res in reservations:
        res_phone = (res.get("whatsapp") or res.get("phone") or "").replace("+", "").replace(" ", "").replace("-", "")
        if res_phone and normalized_phone.endswith(res_phone[-9:]):
            client_name = res.get("userName") or res.get("name")
            break
    
    # Construire le contexte
    context = ""
    if client_name:
        context += f"\n\nLe client qui te parle s'appelle {client_name}. Utilise son prénom dans ta réponse."
    
    last_media = ai_config.get("lastMediaUrl", "")
    if last_media:
        context += f"\n\nNote: Tu as récemment envoyé un média à ce client: {last_media}. Tu peux lui demander s'il l'a bien reçu."
    
    full_system_prompt = ai_config.get("systemPrompt", "") + context
    
    # Appeler l'IA
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        emergent_key = os.environ.get("EMERGENT_LLM_KEY")
        if not emergent_key:
            logger.error("EMERGENT_LLM_KEY not configured")
            return {"status": "error", "message": "AI key not configured"}
        
        # Créer une session unique par numéro de téléphone
        session_id = f"whatsapp_{normalized_phone}"
        
        chat = LlmChat(
            api_key=emergent_key,
            session_id=session_id,
            system_message=full_system_prompt
        ).with_model(ai_config.get("provider", "openai"), ai_config.get("model", "gpt-4o-mini"))
        
        user_message = UserMessage(text=incoming_message)
        ai_response = await chat.send_message(user_message)
        
        response_time = time.time() - start_time
        
        # Sauvegarder le log
        log_entry = AILog(
            fromPhone=from_phone,
            clientName=client_name,
            incomingMessage=incoming_message,
            aiResponse=ai_response,
            responseTime=response_time
        ).model_dump()
        await db.ai_logs.insert_one(log_entry)
        
        logger.info(f"AI responded to {from_phone} in {response_time:.2f}s")
        
        # Retourner la réponse (Twilio attend un TwiML ou un JSON)
        # Pour une réponse automatique, Twilio utilise TwiML
        return {
            "status": "success",
            "response": ai_response,
            "clientName": client_name,
            "responseTime": response_time
        }
        
    except Exception as e:
        logger.error(f"AI error: {str(e)}")
        return {"status": "error", "message": str(e)}

# --- Endpoint pour envoyer WhatsApp depuis le frontend (Liaison IA -> Twilio) ---
class SendWhatsAppRequest(BaseModel):
    to: str
    message: str
    mediaUrl: str = None

# ==================== FONCTION UTILITAIRE WHATSAPP ====================
async def _get_twilio_config():
    """
    Récupère la configuration Twilio avec PRIORITÉ aux variables .env.
    Ordre de priorité:
    1. Variables d'environnement (.env) - PRODUCTION
    2. Configuration en base de données - FALLBACK
    
    Retourne: (account_sid, auth_token, from_number) ou (None, None, None) si non configuré
    """
    # PRIORITÉ 1: Variables d'environnement (.env)
    if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER:
        logger.info(f"[WHATSAPP-PROD] ✅ Utilisation config .env - Numéro: {TWILIO_FROM_NUMBER}")
        return TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
    
    # PRIORITÉ 2: Configuration en base de données (fallback)
    whatsapp_config = await db.whatsapp_config.find_one({"id": "whatsapp_config"}, {"_id": 0})
    if whatsapp_config:
        account_sid = whatsapp_config.get("accountSid")
        auth_token = whatsapp_config.get("authToken")
        from_number = whatsapp_config.get("fromNumber")
        
        if account_sid and auth_token and from_number:
            logger.info(f"[WHATSAPP-PROD] ⚠️ Utilisation config DB (fallback) - Numéro: {from_number}")
            return account_sid, auth_token, from_number
    
    return None, None, None


async def send_whatsapp_direct(to_phone: str, message: str, media_url: str = None) -> dict:
    """
    Fonction interne pour envoyer un message WhatsApp via Twilio.
    Utilisée par l'endpoint /send-whatsapp et par /campaigns/{id}/launch.
    
    Args:
        to_phone: Numéro de téléphone du destinataire
        message: Corps du message
        media_url: URL d'un média à joindre (optionnel)
    
    Returns:
        dict avec status, sid (si succès), error (si échec)
    """
    import httpx
    
    # Récupérer la config Twilio (priorité .env)
    account_sid, auth_token, from_number = await _get_twilio_config()
    
    if not account_sid or not auth_token or not from_number:
        logger.warning("[WHATSAPP-PROD] ❌ Configuration Twilio manquante - mode simulation")
        return {
            "status": "simulated",
            "message": f"WhatsApp simulé pour: {to_phone}",
            "simulated": True
        }
    
    # Formater le numéro destinataire
    clean_to = to_phone.replace(" ", "").replace("-", "")
    if not clean_to.startswith("+"):
        clean_to = "+41" + clean_to.lstrip("0") if clean_to.startswith("0") else "+" + clean_to
    
    # Formater le numéro expéditeur
    clean_from = from_number if from_number.startswith("+") else "+" + from_number
    
    # Construire la requête Twilio
    twilio_url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
    
    data = {
        "From": f"whatsapp:{clean_from}",
        "To": f"whatsapp:{clean_to}",
        "Body": message
    }
    
    if media_url:
        data["MediaUrl"] = media_url
    
    logger.info(f"[WHATSAPP-PROD] 📤 Envoi via {clean_from} vers {clean_to}")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                twilio_url,
                data=data,
                auth=(account_sid, auth_token)
            )
            
            result = response.json()
            
            if response.status_code >= 400:
                error_msg = result.get("message", "Unknown error")
                logger.error(f"[WHATSAPP-PROD] ❌ Erreur Twilio: {error_msg}")
                print(f"[WHATSAPP-PROD] Message envoyé via {clean_from} vers {clean_to} - Status: ERROR ({error_msg})")
                return {"status": "error", "error": error_msg}
            
            sid = result.get("sid", "")
            logger.info(f"[WHATSAPP-PROD] ✅ Message envoyé - SID: {sid}")
            print(f"[WHATSAPP-PROD] Message envoyé via {clean_from} vers {clean_to} - Status: SUCCESS (SID: {sid})")
            
            return {
                "status": "success",
                "sid": sid,
                "to": clean_to,
                "from": clean_from
            }
            
    except Exception as e:
        logger.error(f"[WHATSAPP-PROD] ❌ Exception: {str(e)}")
        print(f"[WHATSAPP-PROD] Message envoyé via {clean_from} vers {clean_to} - Status: ERROR ({str(e)})")
        return {"status": "error", "error": str(e)}


@api_router.post("/send-whatsapp")
async def send_whatsapp_message(request: SendWhatsAppRequest):
    """
    Endpoint pour envoyer un message WhatsApp.
    Utilise la config Twilio avec PRIORITÉ aux variables .env.
    """
    return await send_whatsapp_direct(
        to_phone=request.to,
        message=request.message,
        media_url=request.mediaUrl
    )

# --- Endpoint pour tester l'IA manuellement ---
@api_router.post("/ai-test")
async def test_ai_response(data: dict):
    """Test l'IA avec un message manuel"""
    import time
    start_time = time.time()
    
    message = data.get("message", "")
    client_name = data.get("clientName", "")
    
    if not message:
        raise HTTPException(status_code=400, detail="Message requis")
    
    # Récupérer la config IA
    ai_config = await db.ai_config.find_one({"id": "ai_config"}, {"_id": 0})
    if not ai_config:
        ai_config = AIConfig().model_dump()
    
    # Construire le contexte
    context = ""
    if client_name:
        context += f"\n\nLe client qui te parle s'appelle {client_name}. Utilise son prénom dans ta réponse."
    
    last_media = ai_config.get("lastMediaUrl", "")
    if last_media:
        context += f"\n\nNote: Tu as récemment envoyé un média à ce client: {last_media}."
    
    full_system_prompt = ai_config.get("systemPrompt", "") + context
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        emergent_key = os.environ.get("EMERGENT_LLM_KEY")
        if not emergent_key:
            raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY non configuré")
        
        chat = LlmChat(
            api_key=emergent_key,
            session_id=f"test_{int(time.time())}",
            system_message=full_system_prompt
        ).with_model(ai_config.get("provider", "openai"), ai_config.get("model", "gpt-4o-mini"))
        
        user_message = UserMessage(text=message)
        ai_response = await chat.send_message(user_message)
        
        response_time = time.time() - start_time
        
        return {
            "success": True,
            "response": ai_response,
            "responseTime": response_time
        }
        
    except Exception as e:
        logger.error(f"AI test error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# --- Leads Routes (Widget IA) ---
@api_router.get("/leads")
async def get_leads():
    """Récupère tous les leads capturés via le widget IA"""
    leads = await db.leads.find({}, {"_id": 0}).sort("createdAt", -1).to_list(500)
    return leads

@api_router.post("/leads")
async def create_lead(lead: Lead):
    """Enregistre un nouveau lead depuis le widget IA"""
    from datetime import datetime, timezone
    
    lead_data = lead.model_dump()
    lead_data["id"] = f"lead_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}_{lead.whatsapp[-4:]}"
    lead_data["createdAt"] = datetime.now(timezone.utc).isoformat()
    
    # Vérifier si le lead existe déjà (même email ou WhatsApp)
    existing = await db.leads.find_one({
        "$or": [
            {"email": lead.email},
            {"whatsapp": lead.whatsapp}
        ]
    })
    
    if existing:
        # Mettre à jour le lead existant
        await db.leads.update_one(
            {"id": existing["id"]},
            {"$set": {"firstName": lead.firstName, "updatedAt": lead_data["createdAt"]}}
        )
        existing["firstName"] = lead.firstName
        return {**existing, "_id": None}
    
    await db.leads.insert_one(lead_data)
    return {k: v for k, v in lead_data.items() if k != "_id"}

@api_router.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str):
    """Supprime un lead"""
    result = await db.leads.delete_one({"id": lead_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")
    return {"success": True}

# --- Chat IA Widget ---
@api_router.post("/chat")
async def chat_with_ai(data: ChatMessage):
    """
    Chat avec l'IA depuis le widget client.
    
    Fonctionnalités:
    1. SYNCHRONISATION IA: Récupère dynamiquement les offres et articles
    2. CRM AUTO-SAVE: Enregistre automatiquement le prospect (anti-doublon)
    3. CONTEXTE DYNAMIQUE: Injecte les infos dans le prompt système
    """
    import time
    start_time = time.time()
    
    message = data.message
    first_name = data.firstName
    email = data.email
    whatsapp = data.whatsapp
    source = data.source or "chat_ia"
    
    if not message:
        raise HTTPException(status_code=400, detail="Message requis")
    
    # === 1. CRM AUTO-SAVE (Anti-doublon) ===
    # Enregistrer le prospect dans chat_participants si email ou whatsapp fourni
    if email or whatsapp:
        try:
            # Vérifier si le contact existe déjà (par email OU whatsapp)
            existing_contact = None
            if email:
                existing_contact = await db.chat_participants.find_one({"email": email}, {"_id": 0})
            if not existing_contact and whatsapp:
                # Normaliser le numéro WhatsApp
                clean_whatsapp = whatsapp.replace(" ", "").replace("-", "")
                existing_contact = await db.chat_participants.find_one({
                    "$or": [
                        {"whatsapp": whatsapp},
                        {"whatsapp": clean_whatsapp}
                    ]
                }, {"_id": 0})
            
            if not existing_contact:
                # Créer le nouveau contact
                new_participant = {
                    "id": str(uuid.uuid4()),
                    "name": first_name or "Visiteur Chat IA",
                    "email": email or "",
                    "whatsapp": whatsapp or "",
                    "source": f"Lien Chat IA ({source})",
                    "link_token": None,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "last_seen_at": datetime.now(timezone.utc).isoformat()
                }
                await db.chat_participants.insert_one(new_participant)
                logger.info(f"[CRM-AUTO] Nouveau contact créé: {first_name or 'Visiteur'} ({email or whatsapp}) - Source: {source}")
            else:
                # Mettre à jour last_seen_at
                await db.chat_participants.update_one(
                    {"id": existing_contact.get("id")},
                    {"$set": {"last_seen_at": datetime.now(timezone.utc).isoformat()}}
                )
                logger.info(f"[CRM-AUTO] Contact existant mis à jour: {existing_contact.get('name')}")
        except Exception as crm_error:
            logger.warning(f"[CRM-AUTO] Erreur enregistrement CRM (non bloquant): {crm_error}")
    
    # === 2. RÉCUPÉRER LA CONFIG IA ===
    ai_config = await db.ai_config.find_one({"id": "ai_config"}, {"_id": 0})
    if not ai_config:
        ai_config = AIConfig().model_dump()
    
    if not ai_config.get("enabled"):
        return {"response": "L'assistant IA est actuellement désactivé. Veuillez contacter le coach directement.", "responseTime": 0}
    
    # === 3. CONSTRUIRE LE CONTEXTE DYNAMIQUE (VISION TOTALE DU SITE) ===
    context = "\n\n========== CONNAISSANCES DU SITE AFROBOOST ==========\n"
    context += "Utilise EXCLUSIVEMENT ces informations pour répondre sur les produits, cours, offres et articles.\n"
    context += "IMPORTANT: Vérifie TOUJOURS l'INVENTAIRE BOUTIQUE avant de dire qu'un produit n'existe pas !\n"
    
    # Prénom du client
    if first_name:
        context += f"\n👤 CLIENT: {first_name} - Utilise son prénom pour être chaleureux.\n"
    
    # Concept/Description du site
    try:
        concept = await db.concept.find_one({"id": "concept"}, {"_id": 0})
        if concept and concept.get('description'):
            context += f"\n📌 À PROPOS D'AFROBOOST:\n{concept.get('description', '')[:500]}\n"
    except Exception as e:
        logger.warning(f"[CHAT-IA] Erreur récupération concept: {e}")
    
    # === SECTION 1: INVENTAIRE BOUTIQUE (PRODUITS PHYSIQUES) ===
    try:
        # Récupérer TOUS les éléments de la collection offers
        all_offers = await db.offers.find({"visible": {"$ne": False}}, {"_id": 0}).to_list(50)
        
        # LOG DE DIAGNOSTIC (PRINT EXPLICITE)
        print(f"[DEBUG IA CONTEXT] ====== DÉBUT DIAGNOSTIC ======")
        print(f"[DEBUG IA CONTEXT] Nombre d'offres récupérées: {len(all_offers)}")
        for o in all_offers:
            print(f"[DEBUG IA CONTEXT] - {o.get('name')}: {o.get('price')} CHF (isProduct: {o.get('isProduct', False)})")
        
        # Séparer les PRODUITS des SERVICES
        products = [o for o in all_offers if o.get('isProduct') == True]
        services = [o for o in all_offers if not o.get('isProduct')]
        
        print(f"[DEBUG IA CONTEXT] Produits boutique: {len(products)}")
        print(f"[DEBUG IA CONTEXT] Services/Offres: {len(services)}")
        
        # === PRODUITS BOUTIQUE (café, vêtements, accessoires...) ===
        if products:
            context += "\n\n🛒 INVENTAIRE BOUTIQUE (Produits en vente):\n"
            for p in products[:15]:  # Max 15 produits
                name = p.get('name', 'Produit')
                price = p.get('price', 0)
                desc = p.get('description', '')[:150] if p.get('description') else ''
                category = p.get('category', '')
                stock = p.get('stock', -1)
                
                context += f"  ★ {name.upper()} : {price} CHF"
                if category:
                    context += f" (Catégorie: {category})"
                if stock > 0:
                    context += f" - En stock: {stock}"
                context += "\n"
                if desc:
                    context += f"    Description: {desc}\n"
            context += "  → Si un client demande un de ces produits, CONFIRME qu'il est disponible !\n"
            print(f"[DEBUG IA CONTEXT] ✅ Section INVENTAIRE BOUTIQUE ajoutée avec {len(products)} produits")
        else:
            context += "\n\n🛒 INVENTAIRE BOUTIQUE: Aucun produit en vente actuellement.\n"
            print(f"[DEBUG IA CONTEXT] ⚠️ Aucun produit trouvé!")
        
        # === SERVICES ET OFFRES (abonnements, cours à l'unité...) ===
        if services:
            context += "\n\n💰 OFFRES ET TARIFS (Services):\n"
            for s in services[:10]:
                name = s.get('name', 'Offre')
                price = s.get('price', 0)
                desc = s.get('description', '')[:100] if s.get('description') else ''
                
                context += f"  • {name} : {price} CHF"
                if desc:
                    context += f" - {desc}"
                context += "\n"
        else:
            context += "\n\n💰 OFFRES: Aucune offre spéciale actuellement.\n"
            
    except Exception as e:
        logger.error(f"[CHAT-IA] ❌ Erreur récupération offres/produits: {e}")
        context += "\n\n🛒 BOUTIQUE: Informations temporairement indisponibles.\n"
    
    # === SECTION 2: COURS DISPONIBLES ===
    try:
        courses = await db.courses.find({"visible": {"$ne": False}}, {"_id": 0}).to_list(20)
        if courses:
            context += "\n\n🎯 COURS DISPONIBLES:\n"
            for c in courses[:10]:  # Max 10 cours
                name = c.get('name', 'Cours')
                date = c.get('date', '')
                time_slot = c.get('time', '')
                location = c.get('location', '')
                price = c.get('price', '')
                description = c.get('description', '')[:80] if c.get('description') else ''
                
                context += f"  • {name}"
                if date:
                    context += f" - {date}"
                if time_slot:
                    context += f" à {time_slot}"
                if location:
                    context += f" ({location})"
                if price:
                    context += f" - {price} CHF"
                context += "\n"
                if description:
                    context += f"    → {description}\n"
        else:
            context += "\n\n🎯 COURS: Aucun cours programmé actuellement. Invite le client à suivre nos réseaux pour les prochaines dates.\n"
    except Exception as e:
        logger.warning(f"[CHAT-IA] Erreur récupération cours: {e}")
        context += "\n\n🎯 COURS: Informations temporairement indisponibles.\n"
    
    # === SECTION 3: ARTICLES ET ACTUALITÉS ===
    try:
        # Récupérer les 10 articles les plus récents
        articles = await db.articles.find(
            {"visible": {"$ne": False}}, 
            {"_id": 0}
        ).sort("createdAt", -1).to_list(10)
        
        if articles:
            context += "\n\n📰 DERNIERS ARTICLES ET ACTUALITÉS:\n"
            for a in articles[:5]:  # Max 5 articles dans le contexte
                title = a.get('title', 'Article')
                summary = a.get('summary', '')[:120] if a.get('summary') else ''
                link = a.get('link', '')
                
                context += f"  • {title}\n"
                if summary:
                    context += f"    → {summary}\n"
                if link:
                    context += f"    🔗 Lien: {link}\n"
        else:
            context += "\n\n📰 ARTICLES: Pas d'articles récents. Le blog arrive bientôt !\n"
    except Exception as e:
        logger.warning(f"[CHAT-IA] Erreur récupération articles: {e}")
        # Silencieux si pas de collection articles
    
    # === SECTION 4: PROMOS SPÉCIALES (avec masquage des codes) ===
    # L'IA peut connaître les remises pour calculer les prix, mais JAMAIS les codes
    # PRODUCTION-READY: Try/except individuel pour chaque promo
    try:
        active_promos = await db.discount_codes.find({"active": True}, {"_id": 0}).to_list(20)
        if active_promos:
            context += "\n\n🎁 PROMOTIONS EN COURS:\n"
            promos_injected = 0
            for promo in active_promos[:5]:
                try:
                    # MASQUAGE TECHNIQUE: Le champ 'code' n'est JAMAIS lu ni transmis
                    # Seuls 'type' et 'value' sont utilisés pour le calcul
                    promo_type = promo.get('type', '%')
                    promo_value = promo.get('value', 0)
                    
                    # Validation: S'assurer que value est un nombre valide
                    if promo_value is None:
                        promo_value = 0
                    promo_value = float(promo_value)
                    
                    # Construire la description SANS le code réel
                    # Le placeholder [CODE_APPLIQUÉ_AU_PANIER] est la SEULE chose visible
                    if promo_type == '100%':
                        context += "  • Remise 100% disponible (code: [CODE_APPLIQUÉ_AU_PANIER])\n"
                    elif promo_type == '%':
                        context += "  • Remise de " + str(promo_value) + "% disponible (code: [CODE_APPLIQUÉ_AU_PANIER])\n"
                    elif promo_type == 'CHF':
                        context += "  • Remise de " + str(promo_value) + " CHF disponible (code: [CODE_APPLIQUÉ_AU_PANIER])\n"
                    else:
                        # Type inconnu: afficher quand même sans révéler le code
                        context += "  • Promotion disponible (code: [CODE_APPLIQUÉ_AU_PANIER])\n"
                    promos_injected += 1
                except Exception as promo_error:
                    # Log l'erreur mais continue avec les autres promos
                    logger.warning(f"[CHAT-IA] ⚠️ Promo ignorée (erreur parsing): {promo_error}")
                    continue
            
            if promos_injected > 0:
                context += "  → Tu peux calculer les prix réduits avec ces remises.\n"
                context += "  → Ne dis JAMAIS le code. Dis simplement: 'Le code est appliqué automatiquement au panier.'\n"
                logger.info(f"[CHAT-IA] ✅ {promos_injected} promos injectées (codes masqués)")
    except Exception as e:
        logger.warning(f"[CHAT-IA] Erreur récupération promos (non bloquant): {e}")
    
    # === SECTION 5: LIEN DE PAIEMENT TWINT ===
    twint_payment_url = ai_config.get("twintPaymentUrl", "")
    if twint_payment_url and twint_payment_url.strip():
        context += f"\n\n💳 LIEN DE PAIEMENT TWINT:\n"
        context += f"  URL: {twint_payment_url}\n"
        context += "  → Quand un client confirme vouloir acheter, propose-lui ce lien de paiement sécurisé Twint.\n"
        print(f"[DEBUG IA CONTEXT] ✅ Lien Twint injecté: {twint_payment_url[:50]}...")
    
    # === RÈGLES STRICTES POUR L'IA ===
    # Détecter intention essai gratuit
    message_lower = message.lower()
    is_trial_intent = any(word in message_lower for word in ['essai', 'gratuit', 'tester', 'essayer', 'test', 'découvrir'])
    
    # =====================================================================
    # ARCHITECTURE DE PROMPT AUDITÉE (BASE → SECURITY → CAMPAIGN)
    # Structure pyramidale avec surcharge: CAMPAIGN écrase tout le reste
    # =====================================================================
    
    # --- 1. BASE_PROMPT : Limite l'IA aux produits/cours ---
    BASE_PROMPT = """
╔══════════════════════════════════════════════════════════════════╗
║                    BASE_PROMPT - IDENTITÉ IA                     ║
╚══════════════════════════════════════════════════════════════════╝

🎯 IDENTITÉ:
Tu es un agent expert en vente d'articles, cours et offres Afroboost.
Tu ne parles QUE du catalogue Afroboost (produits, cours, offres listés ci-dessus).

✅ CONTENU AUTORISÉ (EXCLUSIVEMENT):
- Les PRODUITS de l'INVENTAIRE BOUTIQUE listés ci-dessus
- Les COURS disponibles listés ci-dessus
- Les OFFRES et TARIFS listés ci-dessus
- Le concept Afroboost (cardio + danse afrobeat)

🎯 TON STYLE:
- Coach motivant et énergique
- Utilise le prénom du client
- Oriente vers l'INSCRIPTION IMMÉDIATE
- Emojis: 🔥💪🎉
- Réponses courtes et percutantes
"""

    # --- 2. SECURITY_PROMPT : Règle non négociable ---
    SECURITY_PROMPT = """
╔══════════════════════════════════════════════════════════════════╗
║              SECURITY_PROMPT - RÈGLE NON NÉGOCIABLE              ║
╚══════════════════════════════════════════════════════════════════╝

⛔ RÈGLE NON NÉGOCIABLE:
Si la question ne concerne pas un produit ou un cours Afroboost, réponds:
"Désolé, je suis uniquement programmé pour vous assister sur nos offres et formations. 🙏"

🚫 N'invente JAMAIS de codes promo. Si une remise existe, dis: "Le code sera appliqué automatiquement au panier."

🚫 INTERDICTIONS ABSOLUES:
- Ne réponds JAMAIS aux questions hors-sujet (politique, météo, cuisine, président, etc.)
- Ne révèle JAMAIS un code promo textuel
- N'invente JAMAIS d'offres ou de prix
"""

    # Ajout de règles contextuelles
    if is_trial_intent:
        SECURITY_PROMPT += """

🆓 FLOW ESSAI GRATUIT:
1. "Super ! 🔥 Les 10 premiers peuvent tester gratuitement !"
2. "Tu préfères Mercredi ou Dimanche ?"
3. Attends sa réponse avant de demander ses coordonnées.
"""
    
    if twint_payment_url and twint_payment_url.strip():
        SECURITY_PROMPT += f"""

💳 PAIEMENT: Propose ce lien Twint: {twint_payment_url}
"""
    else:
        SECURITY_PROMPT += """

💳 PAIEMENT: Oriente vers le coach WhatsApp ou email pour finaliser.
"""

    # --- 3. CAMPAIGN_PROMPT : Récupéré de la base de données ---
    CAMPAIGN_PROMPT = ai_config.get("campaignPrompt", "").strip()
    
    # GARDE-FOU: Limite à 2000 caractères pour éviter de saturer le contexte OpenAI
    MAX_CAMPAIGN_LENGTH = 2000
    if len(CAMPAIGN_PROMPT) > MAX_CAMPAIGN_LENGTH:
        logger.warning("[CHAT-IA] ⚠️ CAMPAIGN_PROMPT tronqué (dépassement " + str(MAX_CAMPAIGN_LENGTH) + " chars)")
        CAMPAIGN_PROMPT = CAMPAIGN_PROMPT[:MAX_CAMPAIGN_LENGTH] + "... [TRONQUÉ]"
    
    # --- INJECTION FINALE : BASE + SECURITY + CAMPAIGN ---
    context += BASE_PROMPT
    context += SECURITY_PROMPT
    
    if CAMPAIGN_PROMPT:
        # PRODUCTION-READY: Concaténation sécurisée (pas de f-string pour éviter les erreurs)
        context += "\n\n--- INSTRUCTIONS PRIORITAIRES DE LA CAMPAGNE ACTUELLE (ÉCRASE TOUT LE RESTE) ---\n"
        context += "╔══════════════════════════════════════════════════════════════════╗\n"
        context += "║   🚨 CAMPAIGN_PROMPT - PRIORITÉ ABSOLUE (ÉCRASE TOUT LE RESTE)   ║\n"
        context += "╚══════════════════════════════════════════════════════════════════╝\n\n"
        context += CAMPAIGN_PROMPT
        context += "\n\n╔══════════════════════════════════════════════════════════════════╗\n"
        context += "║              FIN DES INSTRUCTIONS PRIORITAIRES                   ║\n"
        context += "╚══════════════════════════════════════════════════════════════════╝\n"
        # LOG SÉCURISÉ: Uniquement la longueur, pas le contenu
        logger.info("[CHAT-IA] ✅ Prompt injecté (len: " + str(len(CAMPAIGN_PROMPT)) + ")")
    
    # Assemblage final du prompt système
    full_system_prompt = ai_config.get("systemPrompt", "Tu es l'assistant IA d'Afroboost.") + context
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        emergent_key = os.environ.get("EMERGENT_LLM_KEY")
        if not emergent_key:
            return {"response": "Configuration IA incomplète. Contactez l'administrateur.", "responseTime": 0}
        
        # Generate a unique session ID for this chat
        chat_session_id = f"afroboost_chat_{uuid.uuid4().hex[:8]}"
        
        chat = LlmChat(
            api_key=emergent_key,
            session_id=chat_session_id,
            system_message=full_system_prompt
        )
        
        user_msg = UserMessage(text=message)
        ai_response = await chat.send_message(user_msg)
        response_time = round(time.time() - start_time, 2)
        
        # Log la conversation
        await db.ai_logs.insert_one({
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "from": f"widget_{first_name or 'anonymous'}",
            "email": email or "",
            "whatsapp": whatsapp or "",
            "source": source,
            "message": message,
            "response": ai_response,
            "responseTime": response_time
        })
        
        return {
            "response": ai_response,
            "responseTime": response_time
        }
        
    except Exception as e:
        logger.error(f"Chat AI error: {str(e)}")
        return {"response": "Désolé, une erreur s'est produite. Veuillez réessayer.", "responseTime": 0}

# ==================== ENHANCED CHAT SYSTEM API ====================
# Système de chat amélioré avec reconnaissance utilisateur, modes et liens partageables

# --- Chat Participants (CRM) ---
@api_router.get("/chat/participants")
async def get_chat_participants():
    """Récupère tous les participants du chat (CRM)"""
    participants = await db.chat_participants.find({}, {"_id": 0}).to_list(1000)
    return participants

@api_router.get("/chat/participants/{participant_id}")
async def get_chat_participant(participant_id: str):
    """Récupère un participant par son ID"""
    participant = await db.chat_participants.find_one({"id": participant_id}, {"_id": 0})
    if not participant:
        raise HTTPException(status_code=404, detail="Participant non trouvé")
    return participant

@api_router.post("/chat/participants")
async def create_chat_participant(participant: ChatParticipantCreate):
    """Crée un nouveau participant"""
    participant_obj = ChatParticipant(**participant.model_dump())
    await db.chat_participants.insert_one(participant_obj.model_dump())
    return participant_obj.model_dump()

@api_router.get("/chat/participants/find")
async def find_participant(
    name: Optional[str] = None,
    email: Optional[str] = None,
    whatsapp: Optional[str] = None
):
    """
    Recherche un participant par nom, email ou WhatsApp.
    Utilisé pour la reconnaissance automatique des utilisateurs.
    """
    query = {"$or": []}
    
    if name:
        query["$or"].append({"name": {"$regex": name, "$options": "i"}})
    if email:
        query["$or"].append({"email": {"$regex": f"^{email}$", "$options": "i"}})
    if whatsapp:
        # Nettoyer le numéro WhatsApp pour la recherche
        clean_whatsapp = whatsapp.replace(" ", "").replace("-", "").replace("+", "")
        query["$or"].append({"whatsapp": {"$regex": clean_whatsapp}})
    
    if not query["$or"]:
        return None
    
    participant = await db.chat_participants.find_one(query, {"_id": 0})
    return participant

@api_router.put("/chat/participants/{participant_id}")
async def update_chat_participant(participant_id: str, update_data: dict):
    """Met à jour un participant"""
    update_data["last_seen_at"] = datetime.now(timezone.utc).isoformat()
    await db.chat_participants.update_one(
        {"id": participant_id},
        {"$set": update_data}
    )
    updated = await db.chat_participants.find_one({"id": participant_id}, {"_id": 0})
    return updated

@api_router.delete("/chat/participants/{participant_id}")
async def delete_chat_participant(participant_id: str):
    """Supprime un participant du CRM"""
    logger.info(f"[DELETE] Suppression participant: {participant_id}")
    
    participant = await db.chat_participants.find_one({"id": participant_id}, {"_id": 0})
    if not participant:
        logger.warning(f"[DELETE] Participant non trouvé: {participant_id}")
        raise HTTPException(status_code=404, detail="Participant non trouvé")
    
    # Supprimer le participant
    result = await db.chat_participants.delete_one({"id": participant_id})
    logger.info(f"[DELETE] Participant supprimé: deleted_count={result.deleted_count}")
    
    # Optionnel: Retirer le participant de toutes les sessions
    sessions_update = await db.chat_sessions.update_many(
        {"participant_ids": participant_id},
        {"$pull": {"participant_ids": participant_id}}
    )
    logger.info(f"[DELETE] Sessions mises à jour: modified_count={sessions_update.modified_count}")
    
    logger.info(f"[DELETE] Participant {participant.get('name', 'inconnu')} supprimé avec succès ✅")
    return {"success": True, "message": f"Participant {participant.get('name', 'inconnu')} supprimé"}

# --- Chat Sessions ---
@api_router.get("/chat/sessions")
async def get_chat_sessions(include_deleted: bool = False):
    """Récupère toutes les sessions de chat (exclut les supprimées par défaut)"""
    query = {} if include_deleted else {"is_deleted": {"$ne": True}}
    sessions = await db.chat_sessions.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return sessions

# ==================== CRM AVANCÉ - HISTORIQUE CONVERSATIONS ====================
@api_router.get("/conversations")
async def get_conversations_advanced(
    page: int = 1,
    limit: int = 20,
    query: str = "",
    include_deleted: bool = False
):
    """
    Endpoint CRM avancé pour les conversations avec pagination et recherche.
    
    Paramètres:
    - page: Numéro de page (commence à 1)
    - limit: Nombre d'éléments par page (max 100)
    - query: Recherche dans les noms de participants, emails, contenus de messages
    - include_deleted: Inclure les sessions supprimées
    
    Retourne:
    - conversations: Liste des conversations enrichies avec dernier message et date
    - total: Nombre total de conversations
    - page: Page actuelle
    - pages: Nombre total de pages
    - has_more: Indique s'il y a plus de pages
    """
    import re
    
    # Limiter à 100 max
    limit = min(limit, 100)
    skip = (page - 1) * limit
    
    # Query de base pour les sessions
    base_query = {} if include_deleted else {"is_deleted": {"$ne": True}}
    
    # Si recherche, d'abord trouver les participants correspondants
    matching_participant_ids = []
    matching_session_ids = []
    
    if query and query.strip():
        search_regex = {"$regex": re.escape(query), "$options": "i"}
        
        # Rechercher dans les participants
        matching_participants = await db.chat_participants.find({
            "$or": [
                {"name": search_regex},
                {"email": search_regex},
                {"whatsapp": search_regex}
            ]
        }, {"_id": 0, "id": 1}).to_list(500)
        matching_participant_ids = [p["id"] for p in matching_participants]
        
        # Rechercher dans les messages
        matching_messages = await db.chat_messages.find({
            "content": search_regex,
            "is_deleted": {"$ne": True}
        }, {"_id": 0, "session_id": 1}).to_list(500)
        matching_session_ids = list(set([m["session_id"] for m in matching_messages]))
        
        # Rechercher dans les titres de session
        title_sessions = await db.chat_sessions.find({
            "title": search_regex,
            **base_query
        }, {"_id": 0, "id": 1}).to_list(500)
        matching_session_ids.extend([s["id"] for s in title_sessions])
        matching_session_ids = list(set(matching_session_ids))
        
        # Construire la query finale
        if matching_participant_ids or matching_session_ids:
            base_query["$or"] = []
            if matching_participant_ids:
                base_query["$or"].append({"participant_ids": {"$in": matching_participant_ids}})
            if matching_session_ids:
                base_query["$or"].append({"id": {"$in": matching_session_ids}})
        else:
            # Aucun résultat
            return {
                "conversations": [],
                "total": 0,
                "page": page,
                "pages": 0,
                "has_more": False
            }
    
    # Compter le total
    total = await db.chat_sessions.count_documents(base_query)
    pages = (total + limit - 1) // limit
    
    # Récupérer les sessions paginées
    sessions = await db.chat_sessions.find(
        base_query, 
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Enrichir chaque session avec le dernier message et les infos participant
    enriched_conversations = []
    
    for session in sessions:
        # Récupérer le dernier message
        last_message = await db.chat_messages.find_one(
            {"session_id": session["id"], "is_deleted": {"$ne": True}},
            {"_id": 0},
            sort=[("created_at", -1)]
        )
        
        # Récupérer les infos des participants
        participants_info = []
        for pid in session.get("participant_ids", []):
            participant = await db.chat_participants.find_one({"id": pid}, {"_id": 0})
            if participant:
                participants_info.append({
                    "id": participant.get("id"),
                    "name": participant.get("name", "Inconnu"),
                    "email": participant.get("email", ""),
                    "whatsapp": participant.get("whatsapp", ""),
                    "source": participant.get("source", "")
                })
        
        # Compter le nombre de messages
        message_count = await db.chat_messages.count_documents({
            "session_id": session["id"],
            "is_deleted": {"$ne": True}
        })
        
        enriched_conversations.append({
            **session,
            "participants": participants_info,
            "last_message": {
                "content": last_message.get("content", "")[:100] if last_message else "",
                "sender_name": last_message.get("sender_name", "") if last_message else "",
                "sender_type": last_message.get("sender_type", "") if last_message else "",
                "created_at": last_message.get("created_at", "") if last_message else ""
            } if last_message else None,
            "message_count": message_count
        })
    
    logger.info(f"[CRM] Conversations: page={page}, limit={limit}, query='{query}', total={total}")
    
    return {
        "conversations": enriched_conversations,
        "total": total,
        "page": page,
        "pages": pages,
        "has_more": page < pages
    }

@api_router.get("/chat/sessions/{session_id}")
async def get_chat_session(session_id: str):
    """Récupère une session par son ID"""
    session = await db.chat_sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session non trouvée")
    return session

@api_router.get("/chat/sessions/by-token/{link_token}")
async def get_chat_session_by_token(link_token: str):
    """
    Récupère une session par son token de partage.
    Utilisé quand un utilisateur arrive via un lien partagé.
    """
    session = await db.chat_sessions.find_one(
        {"link_token": link_token, "is_deleted": {"$ne": True}}, 
        {"_id": 0}
    )
    if not session:
        raise HTTPException(status_code=404, detail="Lien invalide ou session expirée")
    return session

@api_router.post("/chat/sessions")
async def create_chat_session(session: ChatSessionCreate):
    """Crée une nouvelle session de chat"""
    session_obj = ChatSession(**session.model_dump())
    await db.chat_sessions.insert_one(session_obj.model_dump())
    return session_obj.model_dump()

@api_router.put("/chat/sessions/{session_id}")
async def update_chat_session(session_id: str, update: ChatSessionUpdate):
    """
    Met à jour une session de chat.
    Utilisé pour changer le mode (IA/Humain/Communautaire) ou supprimer logiquement.
    """
    logger.info(f"[DELETE] Mise à jour session {session_id}: {update.model_dump()}")
    
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Si suppression logique, ajouter la date
    if update_data.get("is_deleted"):
        update_data["deleted_at"] = datetime.now(timezone.utc).isoformat()
        logger.info(f"[DELETE] Session {session_id} marquée comme supprimée (is_deleted=True)")
    
    result = await db.chat_sessions.update_one(
        {"id": session_id},
        {"$set": update_data}
    )
    logger.info(f"[DELETE] Résultat update: matched={result.matched_count}, modified={result.modified_count}")
    
    updated = await db.chat_sessions.find_one({"id": session_id}, {"_id": 0})
    return updated

@api_router.post("/chat/sessions/{session_id}/add-participant")
async def add_participant_to_session(session_id: str, participant_id: str):
    """Ajoute un participant à une session existante"""
    session = await db.chat_sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session non trouvée")
    
    # Vérifier que le participant existe
    participant = await db.chat_participants.find_one({"id": participant_id}, {"_id": 0})
    if not participant:
        raise HTTPException(status_code=404, detail="Participant non trouvé")
    
    # Ajouter le participant s'il n'est pas déjà présent
    if participant_id not in session.get("participant_ids", []):
        await db.chat_sessions.update_one(
            {"id": session_id},
            {
                "$push": {"participant_ids": participant_id},
                "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
            }
        )
    
    updated = await db.chat_sessions.find_one({"id": session_id}, {"_id": 0})
    return updated

@api_router.post("/chat/sessions/{session_id}/toggle-ai")
async def toggle_session_ai(session_id: str):
    """
    Bascule l'état de l'IA pour une session.
    Si l'IA est active, elle devient inactive et inversement.
    """
    session = await db.chat_sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session non trouvée")
    
    new_state = not session.get("is_ai_active", True)
    new_mode = "ai" if new_state else "human"
    
    await db.chat_sessions.update_one(
        {"id": session_id},
        {"$set": {
            "is_ai_active": new_state,
            "mode": new_mode,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    updated = await db.chat_sessions.find_one({"id": session_id}, {"_id": 0})
    return updated

# --- Chat Messages ---
@api_router.get("/chat/sessions/{session_id}/messages")
async def get_session_messages(session_id: str, include_deleted: bool = False):
    """Récupère tous les messages d'une session (exclut les supprimés par défaut)"""
    query = {"session_id": session_id}
    if not include_deleted:
        query["is_deleted"] = {"$ne": True}
    
    messages = await db.chat_messages.find(query, {"_id": 0}).sort("created_at", 1).to_list(500)
    return messages

@api_router.post("/chat/messages")
async def create_chat_message(message: EnhancedChatMessageCreate):
    """
    Crée un nouveau message dans une session.
    Met à jour automatiquement le mode du message selon l'état de la session.
    """
    # Récupérer la session pour connaître le mode actuel
    session = await db.chat_sessions.find_one({"id": message.session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session non trouvée")
    
    message_obj = EnhancedChatMessage(
        **message.model_dump(),
        mode=session.get("mode", "ai")
    )
    await db.chat_messages.insert_one(message_obj.model_dump())
    return message_obj.model_dump()

@api_router.put("/chat/messages/{message_id}/delete")
async def soft_delete_message(message_id: str):
    """Suppression logique d'un message"""
    await db.chat_messages.update_one(
        {"id": message_id},
        {"$set": {
            "is_deleted": True,
            "deleted_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    return {"success": True, "message": "Message marqué comme supprimé"}

# ==================== NOTIFICATIONS (SONORES ET VISUELLES) ====================

@api_router.get("/notifications/unread")
async def get_unread_notifications(
    target: str = "coach",  # "coach" ou "client"
    session_id: Optional[str] = None,
    include_ai: bool = False  # Inclure les réponses IA dans les notifications coach
):
    """
    Récupère les messages non notifiés pour le coach ou un client.
    Optimisé pour le polling toutes les 10 secondes.
    
    Paramètres:
    - target: "coach" pour les messages user, "client" pour les réponses AI/coach
    - session_id: Optionnel, filtrer par session
    - include_ai: Si true et target=coach, inclut aussi les réponses IA (pour suivi)
    
    Retourne:
    - count: Nombre de messages non notifiés
    - messages: Liste des messages (max 10, triés par date décroissante)
    - target: Target demandé
    """
    query = {
        "is_deleted": {"$ne": True},
        "notified": {"$ne": True}
    }
    
    if target == "coach":
        if include_ai:
            # Messages utilisateurs + réponses IA (pour suivi)
            query["sender_type"] = {"$in": ["user", "ai"]}
        else:
            # Seulement messages des utilisateurs
            query["sender_type"] = "user"
    else:
        # Messages de l'IA ou du coach destinés aux clients
        query["sender_type"] = {"$in": ["ai", "coach"]}
    
    if session_id:
        query["session_id"] = session_id
    
    # Compter le nombre total (limité pour performance)
    count = await db.chat_messages.count_documents(query)
    
    # Récupérer les messages non notifiés les plus récents (max 10 pour performance)
    messages = await db.chat_messages.find(
        query, 
        {"_id": 0, "id": 1, "session_id": 1, "sender_name": 1, "sender_type": 1, "content": 1, "created_at": 1}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    return {
        "count": count,
        "messages": messages,
        "target": target
    }

@api_router.put("/notifications/mark-read")
async def mark_notifications_read(request: Request):
    """
    Marque des messages comme notifiés.
    
    Body:
    - message_ids: Liste des IDs de messages à marquer comme notifiés
    - all_for_target: "coach" ou "client" pour marquer tous les messages non lus
    - session_id: Optionnel, pour limiter à une session
    """
    body = await request.json()
    message_ids = body.get("message_ids", [])
    all_for_target = body.get("all_for_target")
    session_id = body.get("session_id")
    
    update_count = 0
    
    if message_ids:
        # Marquer des messages spécifiques
        result = await db.chat_messages.update_many(
            {"id": {"$in": message_ids}},
            {"$set": {"notified": True}}
        )
        update_count = result.modified_count
    
    elif all_for_target:
        # Marquer tous les messages pour un target
        query = {
            "is_deleted": {"$ne": True},
            "notified": {"$ne": True}
        }
        
        if all_for_target == "coach":
            query["sender_type"] = "user"
        else:
            query["sender_type"] = {"$in": ["ai", "coach"]}
        
        if session_id:
            query["session_id"] = session_id
        
        result = await db.chat_messages.update_many(
            query,
            {"$set": {"notified": True}}
        )
        update_count = result.modified_count
    
    logger.info(f"[NOTIFICATIONS] Marqué {update_count} messages comme lus (target: {all_for_target})")
    
    return {
        "success": True,
        "marked_count": update_count
    }

# --- Shareable Links (Liens Partageables) ---
@api_router.post("/chat/generate-link")
async def generate_shareable_link(request: Request):
    """
    Génère un lien partageable unique pour le chat IA.
    Ce lien peut être partagé sur les réseaux sociaux.
    
    Body optionnel:
    {
        "title": "Titre du lien",
        "custom_prompt": "Prompt spécifique (nullable, prioritaire sur campaignPrompt)"
    }
    """
    body = await request.json()
    title = body.get("title", "Chat Afroboost")
    custom_prompt = body.get("custom_prompt")  # Nullable - si vide/null, sera None
    
    # Normaliser: si chaîne vide ou whitespace only, mettre à None
    if custom_prompt and isinstance(custom_prompt, str):
        custom_prompt = custom_prompt.strip() if custom_prompt.strip() else None
    
    # Créer une nouvelle session avec un token unique
    session = ChatSession(
        mode="ai",
        is_ai_active=True,
        title=title,
        custom_prompt=custom_prompt
    )
    await db.chat_sessions.insert_one(session.model_dump())
    
    # Construire l'URL de partage
    # Note: L'URL de base sera configurée côté frontend
    frontend_url = os.environ.get("FRONTEND_URL", "")
    share_url = f"{frontend_url}/chat/{session.link_token}" if frontend_url else f"/chat/{session.link_token}"
    
    logger.info(f"[CHAT-LINK] Lien créé: {session.link_token} (custom_prompt: {'oui' if custom_prompt else 'non'})")
    
    return {
        "link_token": session.link_token,
        "share_url": share_url,
        "session_id": session.id,
        "has_custom_prompt": custom_prompt is not None
    }

@api_router.get("/chat/links")
async def get_all_chat_links():
    """
    Récupère tous les liens de chat générés.
    Utile pour le coach pour gérer ses liens partagés.
    """
    sessions = await db.chat_sessions.find(
        {"is_deleted": {"$ne": True}},
        {"_id": 0, "id": 1, "link_token": 1, "title": 1, "mode": 1, "is_ai_active": 1, "created_at": 1, "participant_ids": 1}
    ).sort("created_at", -1).to_list(100)
    
    # Ajouter le nombre de participants pour chaque lien
    for session in sessions:
        session["participant_count"] = len(session.get("participant_ids", []))
    
    return sessions

@api_router.delete("/chat/links/{link_id}")
async def delete_chat_link(link_id: str):
    """
    Supprime un lien de chat (suppression logique).
    Le lien ne sera plus accessible et n'apparaîtra plus dans la liste.
    """
    logger.info(f"[DELETE] Suppression lien: {link_id}")
    
    result = await db.chat_sessions.update_one(
        {"$or": [{"id": link_id}, {"link_token": link_id}]},
        {"$set": {"is_deleted": True, "deleted_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    logger.info(f"[DELETE] Résultat: matched={result.matched_count}, modified={result.modified_count}")
    
    if result.modified_count == 0:
        logger.warning(f"[DELETE] Lien non trouvé: {link_id}")
        raise HTTPException(status_code=404, detail="Lien non trouvé")
    
    logger.info(f"[DELETE] Lien {link_id} supprimé avec succès ✅")
    return {"success": True, "message": "Lien supprimé"}

# --- Intelligent Chat Entry Point ---
@api_router.post("/chat/smart-entry")
async def smart_chat_entry(request: Request):
    """
    Point d'entrée intelligent pour le chat.
    
    1. Vérifie si l'utilisateur existe déjà (par nom, email ou WhatsApp)
    2. Si oui, récupère ses sessions précédentes et son historique
    3. Si non, crée un nouveau participant et une nouvelle session
    4. Retourne les infos du participant et la session active
    
    Body attendu:
    {
        "name": "John",
        "email": "john@example.com",  // Optionnel
        "whatsapp": "+41761234567",   // Optionnel
        "link_token": "abc123"         // Optionnel - si via lien partagé
    }
    """
    body = await request.json()
    name = body.get("name", "").strip()
    email = body.get("email", "").strip()
    whatsapp = body.get("whatsapp", "").strip()
    link_token = body.get("link_token")
    
    if not name:
        raise HTTPException(status_code=400, detail="Le nom est requis")
    
    # Rechercher un participant existant
    existing_participant = None
    search_query = {"$or": []}
    
    if email:
        search_query["$or"].append({"email": {"$regex": f"^{email}$", "$options": "i"}})
    if whatsapp:
        clean_whatsapp = whatsapp.replace(" ", "").replace("-", "").replace("+", "")
        if clean_whatsapp:
            search_query["$or"].append({"whatsapp": {"$regex": clean_whatsapp}})
    
    # Recherche aussi par nom exact
    search_query["$or"].append({"name": {"$regex": f"^{name}$", "$options": "i"}})
    
    if search_query["$or"]:
        existing_participant = await db.chat_participants.find_one(search_query, {"_id": 0})
    
    # Déterminer la source
    source = f"link_{link_token}" if link_token else "chat_afroboost"
    
    if existing_participant:
        # Participant reconnu - mettre à jour last_seen
        participant_id = existing_participant["id"]
        update_fields = {"last_seen_at": datetime.now(timezone.utc).isoformat()}
        
        # Mettre à jour les infos si nouvelles
        if email and not existing_participant.get("email"):
            update_fields["email"] = email
        if whatsapp and not existing_participant.get("whatsapp"):
            update_fields["whatsapp"] = whatsapp
        
        await db.chat_participants.update_one(
            {"id": participant_id},
            {"$set": update_fields}
        )
        
        participant = await db.chat_participants.find_one({"id": participant_id}, {"_id": 0})
        is_returning = True
    else:
        # Nouveau participant
        participant_obj = ChatParticipant(
            name=name,
            email=email,
            whatsapp=whatsapp,
            source=source,
            link_token=link_token
        )
        await db.chat_participants.insert_one(participant_obj.model_dump())
        participant = participant_obj.model_dump()
        participant_id = participant["id"]
        is_returning = False
    
    # Trouver ou créer la session
    session = None
    
    if link_token:
        # Si via lien partagé, utiliser cette session
        session = await db.chat_sessions.find_one(
            {"link_token": link_token, "is_deleted": {"$ne": True}},
            {"_id": 0}
        )
    
    if not session:
        # Chercher une session active existante pour ce participant
        sessions = await db.chat_sessions.find(
            {
                "participant_ids": participant_id,
                "is_deleted": {"$ne": True}
            },
            {"_id": 0}
        ).sort("created_at", -1).to_list(1)
        
        if sessions:
            session = sessions[0]
    
    if not session:
        # Créer une nouvelle session
        session_obj = ChatSession(
            mode="ai",
            is_ai_active=True,
            participant_ids=[participant_id]
        )
        await db.chat_sessions.insert_one(session_obj.model_dump())
        session = session_obj.model_dump()
    else:
        # Ajouter le participant à la session s'il n'y est pas
        if participant_id not in session.get("participant_ids", []):
            await db.chat_sessions.update_one(
                {"id": session["id"]},
                {
                    "$push": {"participant_ids": participant_id},
                    "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
                }
            )
            session = await db.chat_sessions.find_one({"id": session["id"]}, {"_id": 0})
    
    # Récupérer l'historique des messages si participant existant
    chat_history = []
    if is_returning:
        chat_history = await db.chat_messages.find(
            {"session_id": session["id"], "is_deleted": {"$ne": True}},
            {"_id": 0}
        ).sort("created_at", 1).to_list(50)
    
    return {
        "participant": participant,
        "session": session,
        "is_returning": is_returning,
        "chat_history": chat_history,
        "message": f"Ravi de te revoir, {name} !" if is_returning else f"Bienvenue, {name} !"
    }

# --- AI Chat with Session Context ---
@api_router.post("/chat/ai-response")
async def get_ai_response_with_session(request: Request):
    """
    Envoie un message à l'IA avec le contexte COMPLET de la session.
    Inclut les produits, offres, cours et articles depuis MongoDB.
    
    Body attendu:
    {
        "session_id": "xxx",
        "participant_id": "xxx",
        "message": "Bonjour!"
    }
    """
    import time
    start_time = time.time()
    
    body = await request.json()
    session_id = body.get("session_id")
    participant_id = body.get("participant_id")
    message_text = body.get("message", "").strip()
    
    if not session_id or not participant_id or not message_text:
        raise HTTPException(status_code=400, detail="session_id, participant_id et message sont requis")
    
    # Récupérer la session
    session = await db.chat_sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session non trouvée")
    
    # Récupérer le participant
    participant = await db.chat_participants.find_one({"id": participant_id}, {"_id": 0})
    if not participant:
        raise HTTPException(status_code=404, detail="Participant non trouvé")
    
    participant_name = participant.get("name", "Utilisateur")
    
    # Sauvegarder le message de l'utilisateur
    user_message = EnhancedChatMessage(
        session_id=session_id,
        sender_id=participant_id,
        sender_name=participant_name,
        sender_type="user",
        content=message_text,
        mode=session.get("mode", "ai")
    )
    await db.chat_messages.insert_one(user_message.model_dump())
    
    # Vérifier si l'IA est active pour cette session
    if not session.get("is_ai_active", True) or session.get("mode") != "ai":
        # Mode humain - Notifier le coach par e-mail (non-bloquant)
        asyncio.create_task(
            notify_coach_new_message(
                participant_name=participant_name,
                message_preview=message_text,
                session_id=session_id
            )
        )
        return {
            "response": None,
            "ai_active": False,
            "mode": session.get("mode"),
            "message_saved": True,
            "user_message_id": user_message.id,
            "coach_notified": True
        }
    
    # Récupérer la config IA
    ai_config = await db.ai_config.find_one({"id": "ai_config"}, {"_id": 0})
    if not ai_config or not ai_config.get("enabled"):
        return {
            "response": "L'assistant IA est actuellement désactivé.",
            "ai_active": False,
            "message_saved": True,
            "user_message_id": user_message.id
        }
    
    # =====================================================================
    # CONTEXTE DYNAMIQUE COMPLET (IDENTIQUE À /api/chat)
    # Récupère TOUS les produits, offres, cours et articles depuis MongoDB
    # =====================================================================
    logger.info("[CHAT-AI-RESPONSE] 🔄 Construction du contexte...")
    
    context = "\n\n========== CONNAISSANCES DU SITE AFROBOOST ==========\n"
    context += "Utilise EXCLUSIVEMENT ces informations pour répondre sur les produits, cours, offres et articles.\n"
    context += "IMPORTANT: Vérifie TOUJOURS l'INVENTAIRE BOUTIQUE avant de dire qu'un produit n'existe pas !\n"
    
    # Prénom du client
    context += f"\n👤 CLIENT: {participant_name} - Utilise son prénom pour être chaleureux.\n"
    
    # Concept/Description du site
    try:
        concept = await db.concept.find_one({"id": "concept"}, {"_id": 0})
        if concept and concept.get('description'):
            context += f"\n📌 À PROPOS D'AFROBOOST:\n{concept.get('description', '')[:500]}\n"
    except Exception as e:
        logger.warning(f"[CHAT-AI-RESPONSE] Erreur récupération concept: {e}")
    
    # === SECTION 1: INVENTAIRE BOUTIQUE (PRODUITS PHYSIQUES) ===
    try:
        # Récupérer TOUS les éléments de la collection offers
        all_offers = await db.offers.find({"visible": {"$ne": False}}, {"_id": 0}).to_list(50)
        
        # LOG DE DIAGNOSTIC EXPLICITE
        logger.info(f"[CHAT-AI-RESPONSE] ====== DIAGNOSTIC CONTEXTE ======")
        logger.info(f"[CHAT-AI-RESPONSE] Nombre d'offres récupérées: {len(all_offers)}")
        for o in all_offers:
            logger.info(f"[CHAT-AI-RESPONSE] - {o.get('name')}: {o.get('price')} CHF (isProduct: {o.get('isProduct', False)})")
        
        # Séparer les PRODUITS des SERVICES
        products = [o for o in all_offers if o.get('isProduct') == True]
        services = [o for o in all_offers if not o.get('isProduct')]
        
        logger.info(f"[CHAT-AI-RESPONSE] ✅ Produits boutique: {len(products)}")
        logger.info(f"[CHAT-AI-RESPONSE] ✅ Services/Offres: {len(services)}")
        
        # === PRODUITS BOUTIQUE (café, vêtements, accessoires...) ===
        if products:
            context += "\n\n🛒 INVENTAIRE BOUTIQUE (Produits en vente):\n"
            for p in products[:15]:  # Max 15 produits
                name = p.get('name', 'Produit')
                price = p.get('price', 0)
                desc = p.get('description', '')[:150] if p.get('description') else ''
                category = p.get('category', '')
                stock = p.get('stock', -1)
                
                context += f"  ★ {name.upper()} : {price} CHF"
                if category:
                    context += f" (Catégorie: {category})"
                if stock > 0:
                    context += f" - En stock: {stock}"
                context += "\n"
                if desc:
                    context += f"    Description: {desc}\n"
            context += "  → Si un client demande un de ces produits, CONFIRME qu'il est disponible !\n"
            logger.info(f"[CHAT-AI-RESPONSE] ✅ Section INVENTAIRE BOUTIQUE ajoutée avec {len(products)} produits")
        else:
            context += "\n\n🛒 INVENTAIRE BOUTIQUE: Aucun produit en vente actuellement.\n"
            logger.warning(f"[CHAT-AI-RESPONSE] ⚠️ Aucun produit trouvé!")
        
        # === SERVICES ET OFFRES (abonnements, cours à l'unité...) ===
        if services:
            context += "\n\n💰 OFFRES ET TARIFS (Services):\n"
            for s in services[:10]:
                name = s.get('name', 'Offre')
                price = s.get('price', 0)
                desc = s.get('description', '')[:100] if s.get('description') else ''
                
                context += f"  • {name} : {price} CHF"
                if desc:
                    context += f" - {desc}"
                context += "\n"
        else:
            context += "\n\n💰 OFFRES: Aucune offre spéciale actuellement.\n"
            
    except Exception as e:
        logger.error(f"[CHAT-AI-RESPONSE] ❌ Erreur récupération offres/produits: {e}")
        context += "\n\n🛒 BOUTIQUE: Informations temporairement indisponibles.\n"
    
    # === SECTION 2: COURS DISPONIBLES ===
    try:
        courses = await db.courses.find({"visible": {"$ne": False}}, {"_id": 0}).to_list(20)
        if courses:
            context += "\n\n🎯 COURS DISPONIBLES:\n"
            for c in courses[:10]:  # Max 10 cours
                name = c.get('name', 'Cours')
                date = c.get('date', '')
                time_slot = c.get('time', '')
                location = c.get('locationName', c.get('location', ''))
                price = c.get('price', '')
                description = c.get('description', '')[:80] if c.get('description') else ''
                
                context += f"  • {name}"
                if date:
                    context += f" - {date}"
                if time_slot:
                    context += f" à {time_slot}"
                if location:
                    context += f" ({location})"
                if price:
                    context += f" - {price} CHF"
                context += "\n"
                if description:
                    context += f"    → {description}\n"
        else:
            context += "\n\n🎯 COURS: Aucun cours programmé actuellement. Invite le client à suivre nos réseaux pour les prochaines dates.\n"
    except Exception as e:
        logger.warning(f"[CHAT-AI-RESPONSE] Erreur récupération cours: {e}")
        context += "\n\n🎯 COURS: Informations temporairement indisponibles.\n"
    
    # === SECTION 3: ARTICLES ET ACTUALITÉS ===
    try:
        # Récupérer les 10 articles les plus récents
        articles = await db.articles.find(
            {"visible": {"$ne": False}}, 
            {"_id": 0}
        ).sort("createdAt", -1).to_list(10)
        
        if articles:
            context += "\n\n📰 DERNIERS ARTICLES ET ACTUALITÉS:\n"
            for a in articles[:5]:  # Max 5 articles dans le contexte
                title = a.get('title', 'Article')
                summary = a.get('summary', '')[:120] if a.get('summary') else ''
                link = a.get('link', '')
                
                context += f"  • {title}\n"
                if summary:
                    context += f"    → {summary}\n"
                if link:
                    context += f"    🔗 Lien: {link}\n"
        else:
            context += "\n\n📰 ARTICLES: Pas d'articles récents. Le blog arrive bientôt !\n"
    except Exception as e:
        logger.warning(f"[CHAT-AI-RESPONSE] Erreur récupération articles: {e}")
        # Silencieux si pas de collection articles
    
    # === SECTION 4: PROMOS SPÉCIALES (avec masquage des codes) ===
    # L'IA peut connaître les remises pour calculer les prix, mais JAMAIS les codes
    # PRODUCTION-READY: Try/except individuel pour chaque promo
    try:
        active_promos = await db.discount_codes.find({"active": True}, {"_id": 0}).to_list(20)
        if active_promos:
            context += "\n\n🎁 PROMOTIONS EN COURS:\n"
            promos_injected = 0
            for promo in active_promos[:5]:
                try:
                    # MASQUAGE TECHNIQUE: Le champ 'code' n'est JAMAIS lu ni transmis
                    # Seuls 'type' et 'value' sont utilisés pour le calcul
                    promo_type = promo.get('type', '%')
                    promo_value = promo.get('value', 0)
                    
                    # Validation: S'assurer que value est un nombre valide
                    if promo_value is None:
                        promo_value = 0
                    promo_value = float(promo_value)
                    
                    # Construire la description SANS le code réel
                    # Le placeholder [CODE_APPLIQUÉ_AU_PANIER] est la SEULE chose visible
                    if promo_type == '100%':
                        context += "  • Remise 100% disponible (code: [CODE_APPLIQUÉ_AU_PANIER])\n"
                    elif promo_type == '%':
                        context += "  • Remise de " + str(promo_value) + "% disponible (code: [CODE_APPLIQUÉ_AU_PANIER])\n"
                    elif promo_type == 'CHF':
                        context += "  • Remise de " + str(promo_value) + " CHF disponible (code: [CODE_APPLIQUÉ_AU_PANIER])\n"
                    else:
                        # Type inconnu: afficher quand même sans révéler le code
                        context += "  • Promotion disponible (code: [CODE_APPLIQUÉ_AU_PANIER])\n"
                    promos_injected += 1
                except Exception as promo_error:
                    # Log l'erreur mais continue avec les autres promos
                    logger.warning(f"[CHAT-IA] ⚠️ Promo ignorée (erreur parsing): {promo_error}")
                    continue
            
            if promos_injected > 0:
                context += "  → Tu peux calculer les prix réduits avec ces remises.\n"
                context += "  → Ne dis JAMAIS le code. Dis simplement: 'Le code est appliqué automatiquement au panier.'\n"
                logger.info(f"[CHAT-IA] ✅ {promos_injected} promos injectées (codes masqués)")
    except Exception as e:
        logger.warning(f"[CHAT-IA] Erreur récupération promos (non bloquant): {e}")
    
    # === SECTION 5: LIEN DE PAIEMENT TWINT ===
    twint_payment_url = ai_config.get("twintPaymentUrl", "")
    if twint_payment_url and twint_payment_url.strip():
        context += f"\n\n💳 LIEN DE PAIEMENT TWINT:\n"
        context += f"  URL: {twint_payment_url}\n"
        context += "  → Quand un client confirme vouloir acheter, propose-lui ce lien de paiement sécurisé Twint.\n"
        logger.info(f"[CHAT-AI-RESPONSE] ✅ Lien Twint injecté: {twint_payment_url[:50]}...")
    else:
        logger.info(f"[CHAT-AI-RESPONSE] ⚠️ Pas de lien Twint configuré")
    
    # === HISTORIQUE DE CONVERSATION ===
    try:
        recent_messages = await db.chat_messages.find(
            {"session_id": session_id, "is_deleted": {"$ne": True}},
            {"_id": 0}
        ).sort("created_at", -1).limit(10).to_list(10)
        
        if recent_messages and len(recent_messages) > 1:
            history = "\n".join([
                f"{'Client' if m.get('sender_type') == 'user' else 'Assistant'}: {m.get('content', '')}"
                for m in reversed(recent_messages[1:])  # Exclure le message actuel
            ])
            context += f"\n\n📜 HISTORIQUE RÉCENT:\n{history}"
    except Exception as e:
        logger.warning(f"[CHAT-AI-RESPONSE] Erreur récupération historique: {e}")
    
    # === RÈGLES STRICTES POUR L'IA ===
    # Détecter intention essai gratuit
    user_message_lower = message_text.lower() if message_text else ""
    is_trial_intent = any(word in user_message_lower for word in ['essai', 'gratuit', 'tester', 'essayer', 'test', 'découvrir'])
    
    # =====================================================================
    # ARCHITECTURE DE PROMPT AUDITÉE (BASE → SECURITY → CAMPAIGN)
    # Structure pyramidale avec surcharge: CAMPAIGN écrase tout le reste
    # =====================================================================
    
    # --- 1. BASE_PROMPT : Limite l'IA aux produits/cours ---
    BASE_PROMPT = """
╔══════════════════════════════════════════════════════════════════╗
║                    BASE_PROMPT - IDENTITÉ IA                     ║
╚══════════════════════════════════════════════════════════════════╝

🎯 IDENTITÉ:
Tu es un agent expert en vente d'articles, cours et offres Afroboost.
Tu ne parles QUE du catalogue Afroboost (produits, cours, offres listés ci-dessus).

✅ CONTENU AUTORISÉ (EXCLUSIVEMENT):
- Les PRODUITS de l'INVENTAIRE BOUTIQUE listés ci-dessus
- Les COURS disponibles listés ci-dessus
- Les OFFRES et TARIFS listés ci-dessus
- Le concept Afroboost (cardio + danse afrobeat)

🎯 TON STYLE:
- Coach motivant et énergique
- Utilise le prénom du client
- Oriente vers l'INSCRIPTION IMMÉDIATE
- Emojis: 🔥💪🎉
- Réponses courtes et percutantes
"""

    # --- 2. SECURITY_PROMPT : Règle non négociable ---
    SECURITY_PROMPT = """
╔══════════════════════════════════════════════════════════════════╗
║              SECURITY_PROMPT - RÈGLE NON NÉGOCIABLE              ║
╚══════════════════════════════════════════════════════════════════╝

⛔ RÈGLE NON NÉGOCIABLE:
Si la question ne concerne pas un produit ou un cours Afroboost, réponds:
"Désolé, je suis uniquement programmé pour vous assister sur nos offres et formations. 🙏"

🚫 N'invente JAMAIS de codes promo. Si une remise existe, dis: "Le code sera appliqué automatiquement au panier."

🚫 INTERDICTIONS ABSOLUES:
- Ne réponds JAMAIS aux questions hors-sujet (politique, météo, cuisine, président, etc.)
- Ne révèle JAMAIS un code promo textuel
- N'invente JAMAIS d'offres ou de prix
"""

    # Ajout de règles contextuelles
    if is_trial_intent:
        SECURITY_PROMPT += """

🆓 FLOW ESSAI GRATUIT:
1. "Super ! 🔥 Les 10 premiers peuvent tester gratuitement !"
2. "Tu préfères Mercredi ou Dimanche ?"
3. Attends sa réponse avant de demander ses coordonnées.
"""
    
    if twint_payment_url and twint_payment_url.strip():
        SECURITY_PROMPT += f"""

💳 PAIEMENT: Propose ce lien Twint: {twint_payment_url}
"""
    else:
        SECURITY_PROMPT += """

💳 PAIEMENT: Oriente vers le coach WhatsApp ou email pour finaliser.
"""

    # --- 3. PROMPT PRIORITAIRE : custom_prompt du lien > campaignPrompt global ---
    # HIÉRARCHIE DE PRIORITÉ:
    # 1. custom_prompt (du lien spécifique) - Si défini, IGNORE campaignPrompt
    # 2. campaignPrompt (global de la campagne) - Utilisé si custom_prompt est vide/null
    # 3. Aucun prompt supplémentaire - Comportement par défaut
    
    FINAL_PROMPT = ""
    prompt_source = "none"
    
    # Vérifier si la session a un custom_prompt
    session_custom_prompt = session.get("custom_prompt") if session else None
    if session_custom_prompt and isinstance(session_custom_prompt, str) and session_custom_prompt.strip():
        FINAL_PROMPT = session_custom_prompt.strip()
        prompt_source = "custom_prompt (lien)"
        logger.info("[CHAT-AI-RESPONSE] ✅ Utilisation du custom_prompt du lien")
    else:
        # Fallback sur campaignPrompt global
        FINAL_PROMPT = ai_config.get("campaignPrompt", "").strip()
        if FINAL_PROMPT:
            prompt_source = "campaignPrompt (global)"
    
    # GARDE-FOU: Limite à 2000 caractères pour éviter de saturer le contexte OpenAI
    MAX_CAMPAIGN_LENGTH = 2000
    if len(FINAL_PROMPT) > MAX_CAMPAIGN_LENGTH:
        logger.warning("[CHAT-AI-RESPONSE] ⚠️ PROMPT tronqué (dépassement " + str(MAX_CAMPAIGN_LENGTH) + " chars)")
        FINAL_PROMPT = FINAL_PROMPT[:MAX_CAMPAIGN_LENGTH] + "... [TRONQUÉ]"
    
    # --- INJECTION FINALE : BASE + SECURITY + PROMPT PRIORITAIRE ---
    context += BASE_PROMPT
    context += SECURITY_PROMPT
    
    if FINAL_PROMPT:
        # PRODUCTION-READY: Concaténation sécurisée (pas de f-string)
        context += "\n\n--- INSTRUCTIONS PRIORITAIRES DE LA CAMPAGNE ACTUELLE (ÉCRASE TOUT LE RESTE) ---\n"
        context += "╔══════════════════════════════════════════════════════════════════╗\n"
        context += "║   🚨 PROMPT PRIORITAIRE - PRIORITÉ ABSOLUE (ÉCRASE TOUT LE RESTE)   ║\n"
        context += "╚══════════════════════════════════════════════════════════════════╝\n\n"
        context += FINAL_PROMPT
        context += "\n\n╔══════════════════════════════════════════════════════════════════╗\n"
        context += "║              FIN DES INSTRUCTIONS PRIORITAIRES                   ║\n"
        context += "╚══════════════════════════════════════════════════════════════════╝\n"
        # LOG SÉCURISÉ: Uniquement la source et la longueur, pas le contenu
        logger.info("[CHAT-AI-RESPONSE] ✅ Prompt injecté (source: " + prompt_source + ", len: " + str(len(FINAL_PROMPT)) + ")")
    
    # Assemblage final du prompt système
    full_system_prompt = ai_config.get("systemPrompt", "Tu es l'assistant IA d'Afroboost.") + context
    
    logger.info("[CHAT-AI-RESPONSE] ✅ Contexte construit")
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        emergent_key = os.environ.get("EMERGENT_LLM_KEY")
        if not emergent_key:
            return {"response": "Configuration IA incomplète.", "ai_active": False}
        
        chat = LlmChat(
            api_key=emergent_key,
            session_id=f"afroboost_session_{session_id}",
            system_message=full_system_prompt
        )
        
        user_msg = UserMessage(text=message_text)
        ai_response_text = await chat.send_message(user_msg)
        response_time = round(time.time() - start_time, 2)
        
        logger.info(f"[CHAT-AI-RESPONSE] ✅ Réponse IA générée en {response_time}s")
        
        # Sauvegarder la réponse de l'IA
        ai_message = EnhancedChatMessage(
            session_id=session_id,
            sender_id="ai",
            sender_name="Assistant Afroboost",
            sender_type="ai",
            content=ai_response_text,
            mode="ai"
        )
        await db.chat_messages.insert_one(ai_message.model_dump())
        
        # Log
        await db.ai_logs.insert_one({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "session_id": session_id,
            "from": participant_name,
            "message": message_text,
            "response": ai_response_text,
            "responseTime": response_time
        })
        
        return {
            "response": ai_response_text,
            "ai_active": True,
            "mode": "ai",
            "response_time": response_time,
            "user_message_id": user_message.id,
            "ai_message_id": ai_message.id
        }
        
    except Exception as e:
        logger.error(f"AI Chat error: {str(e)}")
        return {
            "response": "Désolé, une erreur s'est produite. Veuillez réessayer.",
            "ai_active": True,
            "error": str(e)
        }

# --- Coach Response to Chat ---
@api_router.post("/chat/coach-response")
async def send_coach_response(request: Request):
    """
    Permet au coach d'envoyer un message dans une session.
    Utilisé en mode "human" ou "community".
    """
    body = await request.json()
    session_id = body.get("session_id")
    message_text = body.get("message", "").strip()
    coach_name = body.get("coach_name", "Coach")
    
    if not session_id or not message_text:
        raise HTTPException(status_code=400, detail="session_id et message sont requis")
    
    session = await db.chat_sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session non trouvée")
    
    # Créer le message du coach
    coach_message = EnhancedChatMessage(
        session_id=session_id,
        sender_id="coach",
        sender_name=coach_name,
        sender_type="coach",
        content=message_text,
        mode=session.get("mode", "human")
    )
    await db.chat_messages.insert_one(coach_message.model_dump())
    
    return {
        "success": True,
        "message_id": coach_message.id,
        "mode": session.get("mode")
    }

# --- Private Chat from Community ---
@api_router.post("/chat/start-private")
async def start_private_chat(request: Request):
    """
    Crée une session de chat privée entre deux participants.
    Utilisé quand un utilisateur clique sur un autre dans un chat communautaire.
    
    Body attendu:
    {
        "initiator_id": "xxx",  # ID du participant qui initie
        "target_id": "xxx",     # ID du participant cible
        "community_session_id": "xxx"  # ID de la session communautaire d'origine
    }
    """
    body = await request.json()
    initiator_id = body.get("initiator_id")
    target_id = body.get("target_id")
    community_session_id = body.get("community_session_id")
    
    if not initiator_id or not target_id:
        raise HTTPException(status_code=400, detail="initiator_id et target_id sont requis")
    
    # Vérifier que les deux participants existent
    initiator = await db.chat_participants.find_one({"id": initiator_id}, {"_id": 0})
    target = await db.chat_participants.find_one({"id": target_id}, {"_id": 0})
    
    if not initiator or not target:
        raise HTTPException(status_code=404, detail="Participant non trouvé")
    
    # Vérifier s'il existe déjà une session privée entre ces deux personnes
    existing_session = await db.chat_sessions.find_one({
        "participant_ids": {"$all": [initiator_id, target_id], "$size": 2},
        "mode": "human",
        "is_deleted": {"$ne": True}
    }, {"_id": 0})
    
    if existing_session:
        return {
            "session": existing_session,
            "is_new": False,
            "message": f"Reprise de la conversation avec {target.get('name', 'ce participant')}"
        }
    
    # Créer une nouvelle session privée
    private_session = ChatSession(
        mode="human",
        is_ai_active=False,
        participant_ids=[initiator_id, target_id],
        title=f"Discussion privée: {initiator.get('name', '')} & {target.get('name', '')}"
    )
    await db.chat_sessions.insert_one(private_session.model_dump())
    
    # Message d'accueil
    welcome_message = EnhancedChatMessage(
        session_id=private_session.id,
        sender_id="system",
        sender_name="Système",
        sender_type="ai",
        content=f"💬 Discussion privée créée entre {initiator.get('name', '')} et {target.get('name', '')}.",
        mode="human"
    )
    await db.chat_messages.insert_one(welcome_message.model_dump())
    
    return {
        "session": private_session.model_dump(),
        "is_new": True,
        "message": f"Nouvelle discussion privée avec {target.get('name', 'ce participant')}"
    }

# --- Custom Emojis/Stickers ---
@api_router.get("/chat/emojis")
async def get_custom_emojis():
    """Récupère tous les emojis personnalisés uploadés par le coach"""
    emojis = await db.custom_emojis.find({"active": True}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return emojis

@api_router.post("/chat/emojis")
async def upload_custom_emoji(request: Request):
    """
    Upload un emoji personnalisé (image base64).
    
    Body attendu:
    {
        "name": "happy",
        "image_data": "data:image/png;base64,...",
        "category": "emotions"  # optionnel
    }
    """
    body = await request.json()
    name = body.get("name", "").strip()
    image_data = body.get("image_data", "")
    category = body.get("category", "custom")
    
    if not name or not image_data:
        raise HTTPException(status_code=400, detail="name et image_data sont requis")
    
    # Valider le format base64
    if not image_data.startswith("data:image/"):
        raise HTTPException(status_code=400, detail="Format d'image invalide. Utilisez base64 (data:image/...)")
    
    emoji_obj = {
        "id": str(uuid.uuid4()),
        "name": name,
        "image_data": image_data,
        "category": category,
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.custom_emojis.insert_one(emoji_obj)
    
    # Retourner sans _id (MongoDB l'ajoute automatiquement)
    emoji_obj.pop("_id", None)
    return emoji_obj

@api_router.delete("/chat/emojis/{emoji_id}")
async def delete_custom_emoji(emoji_id: str):
    """Supprime un emoji personnalisé"""
    result = await db.custom_emojis.delete_one({"id": emoji_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Emoji non trouvé")
    return {"success": True, "message": "Emoji supprimé"}

# --- Get Session Participants (for community chat) ---
@api_router.get("/chat/sessions/{session_id}/participants")
async def get_session_participants(session_id: str):
    """Récupère les détails des participants d'une session"""
    session = await db.chat_sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session non trouvée")
    
    participant_ids = session.get("participant_ids", [])
    participants = []
    
    for pid in participant_ids:
        participant = await db.chat_participants.find_one({"id": pid}, {"_id": 0})
        if participant:
            participants.append({
                "id": participant.get("id"),
                "name": participant.get("name"),
                "last_seen_at": participant.get("last_seen_at")
            })
    
    return participants

# ==================== WEB PUSH NOTIFICATIONS ====================

@api_router.get("/push/vapid-key")
async def get_vapid_public_key():
    """Retourne la clé publique VAPID pour l'inscription côté client"""
    return {"publicKey": VAPID_PUBLIC_KEY}

@api_router.post("/push/subscribe")
async def subscribe_push(request: Request):
    """
    Enregistre une souscription push pour un participant.
    
    Body attendu:
    {
        "participant_id": "xxx",
        "subscription": {
            "endpoint": "https://...",
            "keys": {
                "p256dh": "...",
                "auth": "..."
            }
        }
    }
    """
    body = await request.json()
    participant_id = body.get("participant_id")
    subscription = body.get("subscription")
    
    if not participant_id or not subscription:
        raise HTTPException(status_code=400, detail="participant_id et subscription sont requis")
    
    # Sauvegarder la souscription
    sub_obj = {
        "id": str(uuid.uuid4()),
        "participant_id": participant_id,
        "subscription": subscription,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "active": True
    }
    
    # Mettre à jour ou créer
    await db.push_subscriptions.update_one(
        {"participant_id": participant_id},
        {"$set": sub_obj},
        upsert=True
    )
    
    logger.info(f"Push subscription registered for participant {participant_id}")
    return {"success": True, "message": "Souscription enregistrée"}

@api_router.delete("/push/subscribe/{participant_id}")
async def unsubscribe_push(participant_id: str):
    """Désactive la souscription push d'un participant"""
    await db.push_subscriptions.update_one(
        {"participant_id": participant_id},
        {"$set": {"active": False}}
    )
    return {"success": True, "message": "Souscription désactivée"}

async def send_push_notification(participant_id: str, title: str, body: str, data: dict = None):
    """
    Envoie une notification push à un participant.
    Retourne True si envoyé avec succès, False sinon.
    """
    if not WEBPUSH_AVAILABLE or not VAPID_PRIVATE_KEY:
        logger.warning("Web Push not configured")
        return False
    
    # Récupérer la souscription
    sub = await db.push_subscriptions.find_one(
        {"participant_id": participant_id, "active": True},
        {"_id": 0}
    )
    
    if not sub or not sub.get("subscription"):
        logger.info(f"No push subscription for participant {participant_id}")
        return False
    
    subscription_info = sub["subscription"]
    
    payload = json.dumps({
        "title": title,
        "body": body,
        "icon": "/favicon.ico",
        "badge": "/favicon.ico",
        "data": data or {},
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    try:
        webpush(
            subscription_info=subscription_info,
            data=payload,
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={"sub": f"mailto:{VAPID_CLAIMS_EMAIL}"}
        )
        logger.info(f"Push notification sent to {participant_id}")
        return True
    except WebPushException as e:
        logger.error(f"Push notification failed: {str(e)}")
        # Si la souscription est invalide, la désactiver
        if e.response and e.response.status_code in [404, 410]:
            await db.push_subscriptions.update_one(
                {"participant_id": participant_id},
                {"$set": {"active": False}}
            )
        return False
    except Exception as e:
        logger.error(f"Push notification error: {str(e)}")
        return False

async def send_backup_email(participant_id: str, message_preview: str):
    """
    Envoie un email de backup si la notification push échoue.
    """
    # Récupérer les infos du participant d'abord pour la simulation
    participant = await db.chat_participants.find_one({"id": participant_id}, {"_id": 0})
    if not participant or not participant.get("email"):
        logger.info(f"No email for participant {participant_id}")
        return False
    
    email = participant["email"]
    name = participant.get("name", "")
    
    # Mode simulation si Resend non configuré
    if not RESEND_AVAILABLE or not RESEND_API_KEY:
        logger.info(f"[SIMULATION EMAIL] To: {email}, Name: {name}")
        logger.info(f"[SIMULATION EMAIL] Subject: 💬 Nouvelle réponse sur Afroboost")
        logger.info(f"[SIMULATION EMAIL] Body preview: {message_preview[:100]}...")
        logger.info(f"[SIMULATION EMAIL] Email would be sent successfully (Resend not configured)")
        return True  # Retourne True pour la simulation
    
    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #d91cd2, #8b5cf6); padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">💬 Afroboost</h1>
        </div>
        <div style="background: #1a1a1a; padding: 30px; color: #ffffff; border-radius: 0 0 12px 12px;">
            <p style="font-size: 16px; margin-bottom: 20px;">
                Bonjour {name} 👋
            </p>
            <p style="font-size: 14px; color: #cccccc; margin-bottom: 20px;">
                Vous avez reçu une réponse sur Afroboost :
            </p>
            <div style="background: rgba(139, 92, 246, 0.2); padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 3px solid #8b5cf6;">
                <p style="margin: 0; font-size: 14px; color: #ffffff;">
                    "{message_preview[:150]}{'...' if len(message_preview) > 150 else ''}"
                </p>
            </div>
            <a href="https://afroboosteur.com" 
               style="display: inline-block; background: linear-gradient(135deg, #d91cd2, #8b5cf6); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                Voir la conversation
            </a>
            <p style="font-size: 12px; color: #666666; margin-top: 30px;">
                Cet email a été envoyé car vous avez une notification en attente sur Afroboost.
            </p>
        </div>
    </div>
    """
    
    try:
        params = {
            "from": "Afroboost <notifications@afroboosteur.com>",
            "to": [email],
            "subject": "💬 Nouvelle réponse sur Afroboost",
            "html": html_content
        }
        
        # Appel non-bloquant
        email_result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Backup email sent to {email}: {email_result}")
        return True
    except Exception as e:
        logger.error(f"Backup email failed: {str(e)}")
        return False

async def notify_coach_new_message(participant_name: str, message_preview: str, session_id: str):
    """
    Notifie le coach par e-mail quand un message arrive en mode humain.
    Crucial pour ne pas rater de ventes.
    """
    # Récupérer l'email du coach depuis coach_auth
    coach_auth = await db.coach_auth.find_one({}, {"_id": 0})
    if not coach_auth or not coach_auth.get("email"):
        logger.warning("Coach email not configured - cannot send notification")
        return False
    
    coach_email = coach_auth.get("email")
    
    # Mode simulation si Resend non configuré
    if not RESEND_AVAILABLE or not RESEND_API_KEY:
        logger.info(f"[SIMULATION COACH EMAIL] To: {coach_email}")
        logger.info(f"[SIMULATION COACH EMAIL] Subject: 🔔 Nouveau message de {participant_name}")
        logger.info(f"[SIMULATION COACH EMAIL] Message: {message_preview[:100]}...")
        logger.info(f"[SIMULATION COACH EMAIL] Session ID: {session_id}")
        logger.info(f"[SIMULATION COACH EMAIL] Email would be sent successfully (Resend not configured)")
        return True
    
    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #d91cd2, #8b5cf6); padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🔔 Nouveau message !</h1>
        </div>
        <div style="background: #1a1a1a; padding: 30px; color: #ffffff; border-radius: 0 0 12px 12px;">
            <p style="font-size: 16px; margin-bottom: 20px;">
                <strong>{participant_name}</strong> vous a envoyé un message :
            </p>
            <div style="background: rgba(139, 92, 246, 0.2); padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 3px solid #8b5cf6;">
                <p style="margin: 0; font-size: 14px; color: #ffffff;">
                    "{message_preview[:200]}{'...' if len(message_preview) > 200 else ''}"
                </p>
            </div>
            <p style="font-size: 12px; color: #aaaaaa; margin-bottom: 20px;">
                Ce message nécessite votre réponse en mode humain.
            </p>
            <a href="https://afroboosteur.com/coach" 
               style="display: inline-block; background: linear-gradient(135deg, #d91cd2, #8b5cf6); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                Répondre maintenant
            </a>
        </div>
    </div>
    """
    
    try:
        params = {
            "from": "Afroboost <notifications@afroboosteur.com>",
            "to": [coach_email],
            "subject": f"🔔 Nouveau message de {participant_name}",
            "html": html_content
        }
        
        email_result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Coach notification email sent: {email_result}")
        return True
    except Exception as e:
        logger.error(f"Coach notification email failed: {str(e)}")
        return False

# =============================================
# ENDPOINT CAMPAGNES EMAIL VIA RESEND
# =============================================
@api_router.post("/campaigns/send-email")
async def send_campaign_email(request: Request):
    """
    Envoie un email de campagne via Resend.
    Remplace EmailJS pour un contrôle total côté serveur.
    
    Body attendu:
    {
        "to_email": "destinataire@example.com",
        "to_name": "Nom Destinataire",
        "subject": "Sujet de l'email",
        "message": "Contenu HTML ou texte",
        "media_url": "URL du visuel ou lien interne /v/slug (optionnel)"
    }
    """
    body = await request.json()
    to_email = body.get("to_email")
    to_name = body.get("to_name", "")
    subject = body.get("subject", "Message d'Afroboost")
    message = body.get("message", "")
    media_url = body.get("media_url", None)
    
    # LOG DEBUG CRITIQUE
    logger.info(f"=== CAMPAGNE EMAIL ===")
    logger.info(f"To: {to_email}")
    logger.info(f"Subject: {subject}")
    logger.info(f"Media URL reçu: {media_url}")
    logger.info(f"======================")
    
    if not to_email:
        raise HTTPException(status_code=400, detail="to_email requis")
    if not message:
        raise HTTPException(status_code=400, detail="message requis")
    
    # Vérifier que Resend est configuré
    if not RESEND_AVAILABLE or not RESEND_API_KEY:
        logger.warning("Resend non configuré pour les campagnes")
        return {"success": False, "error": "Resend non configuré"}
    
    # === TRAITEMENT DU MEDIA URL ===
    media_html = ""
    if media_url:
        thumbnail_url = None
        click_url = media_url
        
        # Déterminer l'URL de base du frontend (production ou preview)
        # PRIORITÉ: 1. FRONTEND_URL explicite, 2. Même domaine que REACT_APP_BACKEND_URL
        frontend_base = os.environ.get('FRONTEND_URL', '')
        
        # Si pas de FRONTEND_URL ou si c'est afroboosteur.com, vérifier si on est en preview
        if not frontend_base or 'afroboosteur.com' in frontend_base:
            # Utiliser le même domaine que le backend (pour l'environnement preview)
            # Le backend est appelé via REACT_APP_BACKEND_URL qui contient le domaine preview
            from fastapi import Request
            # Par défaut, utiliser afroboosteur.com pour la production
            frontend_base = 'https://afroboosteur.com'
        
        logger.info(f"Frontend base URL: {frontend_base}")
        
        # Vérifier si c'est un lien média interne
        # Formats supportés: /v/slug, /api/share/slug, afroboosteur.com/v/slug
        slug = None
        if '/api/share/' in media_url:
            slug = media_url.split('/api/share/')[-1].split('?')[0].split('#')[0].strip('/')
        elif '/v/' in media_url:
            slug = media_url.split('/v/')[-1].split('?')[0].split('#')[0].strip('/')
        
        if slug:
            # Récupérer la thumbnail depuis la base de données
            media_link = await db.media_links.find_one({"slug": slug.lower()}, {"_id": 0})
            if media_link:
                thumbnail_url = media_link.get("thumbnail") or media_link.get("custom_thumbnail")
                # HASH ROUTING: Utiliser /#/v/{slug} pour garantir le fonctionnement
                # sans configuration serveur (100% côté client)
                click_url = f"{frontend_base}/#/v/{slug}"
                logger.info(f"Media link found for slug {slug}: click_url={click_url}, thumbnail={thumbnail_url}")
            else:
                logger.warning(f"Media link not found for slug: {slug}")
        else:
            # URL externe directe (image)
            thumbnail_url = media_url
        
        # Générer le HTML de l'image cliquable - V5 FINAL (taille réduite -20%)
        if thumbnail_url:
            if thumbnail_url.startswith('http://'):
                thumbnail_url = thumbnail_url.replace('http://', 'https://')
            
            # Template V5 : Card RÉDUITE (-20%) avec image + bouton
            # Image: 400px au lieu de 536px
            media_html = f'''<!-- Image cliquable (taille réduite) -->
<a href="{click_url}" style="display:block;text-decoration:none;">
<img src="{thumbnail_url}" width="400" style="display:block;width:100%;max-width:400px;border-radius:8px;margin:0 auto;" alt="Aperçu vidéo">
</a>
<!-- Bouton "Voir la vidéo" -->
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:15px;">
<tr><td align="center">
<a href="{click_url}" style="display:inline-block;padding:12px 28px;background:#E91E63;color:#ffffff;text-decoration:none;border-radius:8px;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;">
&#9658; Voir la vidéo
</a>
</td></tr>
</table>'''
    
    # =====================================================
    # Template Email V5 FINAL - Anti-Promotions Maximal
    # =====================================================
    # RÈGLES GMAIL ANTI-PROMOTIONS:
    # 1. TEXTE BRUT en premier (3 lignes minimum AVANT tout design)
    # 2. Salutation personnalisée
    # 3. Ratio texte > image
    # 4. Pas de gradient CSS (Gmail les ignore parfois)
    # 5. Taille réduite de 20%
    
    # Extraire le prénom pour personnalisation
    to_name = body.get("to_name", "")
    first_name = to_name.split()[0] if to_name else "ami(e)"
    
    # Preheader invisible pour la délivrabilité (apparaît dans l'aperçu Gmail)
    preheader_text = f"Salut {first_name}, découvre notre nouvelle vidéo exclusive !"
    
    # LOG pour debug - vérifier l'URL de clic (seulement si media_url présent)
    if media_url:
        logger.info(f"Email click_url FINAL: {click_url}")
    
    html_content = f'''<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Message Afroboost</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">

<!-- PREHEADER INVISIBLE -->
<div style="display:none;font-size:1px;color:#f5f5f5;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
{preheader_text}
</div>

<!-- WRAPPER -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f5f5;">
<tr><td align="center" style="padding:20px 10px;">

<!-- ========== TEXTE BRUT ANTI-PROMOTIONS (3 lignes AVANT le design) ========== -->
<table width="480" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
<tr><td style="color:#333333;font-size:14px;line-height:1.6;font-family:Arial,sans-serif;padding-bottom:15px;">
Salut {first_name},<br><br>
J'ai une nouvelle vidéo à te partager. Je pense qu'elle va te plaire !<br>
Clique sur le bouton ci-dessous pour la découvrir.
</td></tr>
</table>

<!-- ========== CARD PRINCIPALE (taille réduite 480px) ========== -->
<table width="480" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background-color:#111111;border-radius:10px;overflow:hidden;">

<!-- HEADER VIOLET -->
<tr><td align="center" style="background-color:#9333EA;padding:16px 20px;">
<a href="https://afroboosteur.com" style="color:#ffffff;font-size:22px;font-weight:bold;text-decoration:none;font-family:Arial,sans-serif;">Afroboost</a>
</td></tr>

<!-- CONTENU -->
<tr><td style="padding:20px;">

<!-- IMAGE + BOUTON -->
{media_html}

<!-- MESSAGE -->
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:20px;">
<tr><td style="color:#ffffff;font-size:14px;line-height:1.6;font-family:Arial,sans-serif;">
{message.replace(chr(10), '<br>')}
</td></tr>
</table>

</td></tr>

<!-- FOOTER -->
<tr><td align="center" style="padding:15px 20px;border-top:1px solid #333333;">
<p style="color:#888888;font-size:11px;margin:0;font-family:Arial,sans-serif;">
<a href="https://afroboosteur.com" style="color:#9333EA;text-decoration:none;">afroboosteur.com</a>
</p>
</td></tr>

</table>

</td></tr>
</table>

</body>
</html>'''
    
    try:
        params = {
            "from": "Afroboost <notifications@afroboosteur.com>",
            "to": [to_email],
            "subject": subject,
            "html": html_content
        }
        
        email_result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Campaign email sent to {to_email}: {email_result}")
        return {"success": True, "email_id": email_result.get("id"), "to": to_email}
    except Exception as e:
        logger.error(f"Campaign email failed: {str(e)}")
        return {"success": False, "error": str(e)}

@api_router.post("/push/send")
async def send_push_to_participant(request: Request):
    """
    Endpoint pour envoyer manuellement une notification push.
    
    Body attendu:
    {
        "participant_id": "xxx",
        "title": "Nouveau message",
        "body": "Vous avez une réponse...",
        "send_email_backup": true
    }
    """
    body = await request.json()
    participant_id = body.get("participant_id")
    title = body.get("title", "Afroboost")
    message_body = body.get("body", "Vous avez un nouveau message")
    send_email_backup = body.get("send_email_backup", True)
    
    if not participant_id:
        raise HTTPException(status_code=400, detail="participant_id requis")
    
    # Essayer d'envoyer la notification push
    push_sent = await send_push_notification(participant_id, title, message_body)
    
    email_sent = False
    if not push_sent and send_email_backup:
        # Planifier l'email de backup après 5 minutes
        # Pour l'instant, on l'envoie directement si push échoue
        email_sent = await send_backup_email(participant_id, message_body)
    
    return {
        "push_sent": push_sent,
        "email_sent": email_sent,
        "participant_id": participant_id
    }

# =============================================
# LECTEUR MÉDIA UNIFIÉ - AFROBOOST
# =============================================

class MediaLinkCreate(BaseModel):
    """Modèle pour créer un lien média personnalisé"""
    slug: str = Field(..., description="Slug mémorable (ex: promo-danse)")
    video_url: str = Field(..., description="URL YouTube ou Vimeo")
    title: str = Field(..., description="Titre de la campagne")
    description: Optional[str] = Field(None, description="Description/message")
    custom_thumbnail: Optional[str] = Field(None, description="URL thumbnail personnalisée")
    cta_text: Optional[str] = Field(None, description="Texte du bouton CTA")
    cta_link: Optional[str] = Field(None, description="Lien du bouton CTA")
    campaign_id: Optional[str] = Field(None, description="ID campagne associée")

def extract_youtube_id(url: str) -> Optional[str]:
    """Extrait l'ID YouTube d'une URL"""
    import re
    patterns = [
        r'(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})',
        r'youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})'
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None

@api_router.post("/media/create")
async def create_media_link(data: MediaLinkCreate):
    """
    Crée un lien média personnalisé pour les campagnes.
    Génère une URL afroboosteur.com/v/[slug]
    """
    # Vérifier si le slug existe déjà
    existing = await db.media_links.find_one({"slug": data.slug})
    if existing:
        raise HTTPException(status_code=400, detail=f"Le slug '{data.slug}' existe déjà")
    
    # Extraire l'ID YouTube si applicable
    youtube_id = extract_youtube_id(data.video_url)
    
    # Générer la thumbnail automatique si pas de custom
    thumbnail = data.custom_thumbnail
    if not thumbnail and youtube_id:
        thumbnail = f"https://img.youtube.com/vi/{youtube_id}/maxresdefault.jpg"
    
    media_link = {
        "id": str(uuid.uuid4()),
        "slug": data.slug.lower().strip(),
        "video_url": data.video_url,
        "youtube_id": youtube_id,
        "title": data.title,
        "description": data.description or "",
        "thumbnail": thumbnail,
        "cta_text": data.cta_text,
        "cta_link": data.cta_link,
        "campaign_id": data.campaign_id,
        "views": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.media_links.insert_one(media_link)
    
    return {
        "success": True,
        "media_link": {
            "id": media_link["id"],
            "slug": media_link["slug"],
            "url": f"https://afroboosteur.com/api/share/{media_link['slug']}",
            "viewer_url": f"https://afroboosteur.com/v/{media_link['slug']}",
            "thumbnail": media_link["thumbnail"]
        }
    }

@api_router.get("/media/{slug}")
async def get_media_link(slug: str):
    """
    Récupère les infos d'un lien média par son slug.
    Incrémente le compteur de vues.
    """
    media = await db.media_links.find_one({"slug": slug.lower()}, {"_id": 0})
    if not media:
        raise HTTPException(status_code=404, detail="Média non trouvé")
    
    # Incrémenter les vues
    await db.media_links.update_one(
        {"slug": slug.lower()},
        {"$inc": {"views": 1}}
    )
    
    return media

@api_router.get("/media/{slug}/thumbnail")
async def get_media_thumbnail(slug: str):
    """
    Récupère uniquement la thumbnail d'un lien média.
    Utilisé par le frontend pour l'aperçu des campagnes.
    """
    media = await db.media_links.find_one({"slug": slug.lower()}, {"_id": 0, "thumbnail": 1, "custom_thumbnail": 1, "title": 1})
    if not media:
        raise HTTPException(status_code=404, detail="Média non trouvé")
    
    return {
        "thumbnail": media.get("custom_thumbnail") or media.get("thumbnail"),
        "title": media.get("title", "")
    }

@api_router.get("/media/{slug}/og")
async def get_media_opengraph(slug: str):
    """
    Retourne une page HTML avec les meta tags OpenGraph pour les previews WhatsApp/réseaux sociaux.
    """
    media = await db.media_links.find_one({"slug": slug.lower()}, {"_id": 0})
    if not media:
        raise HTTPException(status_code=404, detail="Média non trouvé")
    
    # Générer la page HTML avec meta tags
    html = f"""<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{media.get('title', 'Afroboost')}</title>
    
    <!-- OpenGraph pour WhatsApp/Facebook/LinkedIn -->
    <meta property="og:title" content="{media.get('title', 'Afroboost')}" />
    <meta property="og:description" content="{media.get('description', 'Découvrez cette vidéo exclusive Afroboost')[:200]}" />
    <meta property="og:image" content="{media.get('thumbnail', '')}" />
    <meta property="og:image:width" content="1280" />
    <meta property="og:image:height" content="720" />
    <meta property="og:url" content="https://afroboosteur.com/v/{slug}" />
    <meta property="og:type" content="video.other" />
    <meta property="og:site_name" content="Afroboost" />
    
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="{media.get('title', 'Afroboost')}" />
    <meta name="twitter:description" content="{media.get('description', 'Découvrez cette vidéo exclusive Afroboost')[:200]}" />
    <meta name="twitter:image" content="{media.get('thumbnail', '')}" />
    
    <!-- Redirection automatique vers la page React -->
    <script>
        window.location.href = "https://afroboosteur.com/v/{slug}";
    </script>
</head>
<body style="background: #000; color: #fff; font-family: system-ui; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
    <div style="text-align: center;">
        <h1 style="background: linear-gradient(135deg, #d91cd2, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
            {media.get('title', 'Afroboost')}
        </h1>
        <p>Redirection en cours...</p>
        <a href="https://afroboosteur.com/v/{slug}" style="color: #d91cd2;">Cliquez ici si la redirection ne fonctionne pas</a>
    </div>
</body>
</html>"""
    
    from fastapi.responses import HTMLResponse
    return HTMLResponse(content=html, status_code=200)

@api_router.get("/go/{slug}")
async def redirect_to_media(slug: str):
    """
    Endpoint de redirection HTTP 302 vers la page média.
    Utilisé dans les emails pour garantir une redirection fiable
    même si le serveur de production n'est pas configuré pour le routage SPA.
    """
    # Vérifier que le média existe
    media = await db.media_links.find_one({"slug": slug.lower()}, {"_id": 0, "title": 1})
    if not media:
        raise HTTPException(status_code=404, detail="Média non trouvé")
    
    # Incrémenter les vues
    await db.media_links.update_one(
        {"slug": slug.lower()},
        {"$inc": {"views": 1}}
    )
    
    # Déterminer l'URL de destination
    frontend_base = os.environ.get('FRONTEND_URL', 'https://afroboosteur.com')
    redirect_url = f"{frontend_base}/v/{slug}"
    
    logger.info(f"Redirect /api/go/{slug} -> {redirect_url}")
    
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url=redirect_url, status_code=302)

@api_router.get("/media")
async def list_media_links():
    """Liste tous les liens média créés"""
    media_links = await db.media_links.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return media_links

@api_router.delete("/media/{slug}")
async def delete_media_link(slug: str):
    """Supprime un lien média"""
    result = await db.media_links.delete_one({"slug": slug.lower()})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Média non trouvé")
    return {"success": True, "deleted": slug}

@api_router.put("/media/{slug}")
async def update_media_link(slug: str, request: Request):
    """Met à jour un lien média existant"""
    body = await request.json()
    
    # Vérifier que le média existe
    existing = await db.media_links.find_one({"slug": slug.lower()})
    if not existing:
        raise HTTPException(status_code=404, detail="Média non trouvé")
    
    # Préparer les champs à mettre à jour
    update_fields = {}
    
    if "title" in body and body["title"]:
        update_fields["title"] = body["title"]
    if "description" in body:
        update_fields["description"] = body["description"] or ""
    if "video_url" in body and body["video_url"]:
        update_fields["video_url"] = body["video_url"]
        # Extraire l'ID YouTube si c'est une URL YouTube
        youtube_id = extract_youtube_id(body["video_url"])
        if youtube_id:
            update_fields["youtube_id"] = youtube_id
            # Mettre à jour la thumbnail si pas de custom
            if not body.get("custom_thumbnail"):
                update_fields["thumbnail"] = f"https://img.youtube.com/vi/{youtube_id}/maxresdefault.jpg"
    if "custom_thumbnail" in body:
        update_fields["custom_thumbnail"] = body["custom_thumbnail"] or None
        if body["custom_thumbnail"]:
            update_fields["thumbnail"] = body["custom_thumbnail"]
    if "cta_text" in body:
        update_fields["cta_text"] = body["cta_text"] or None
    if "cta_link" in body:
        update_fields["cta_link"] = body["cta_link"] or None
    
    if not update_fields:
        return {"success": True, "message": "Aucune modification"}
    
    # Mettre à jour
    await db.media_links.update_one(
        {"slug": slug.lower()},
        {"$set": update_fields}
    )
    
    # Retourner le média mis à jour
    updated = await db.media_links.find_one({"slug": slug.lower()}, {"_id": 0})
    return {"success": True, "media_link": updated}

# ==================== ENDPOINT DE PARTAGE AVEC OPENGRAPH ====================
# Cet endpoint est ACCESSIBLE via /api/share/{slug} et sert les balises OG pour WhatsApp

@api_router.get("/share/{slug}")
async def share_media_with_opengraph(slug: str, request: Request):
    """
    URL DE PARTAGE PRINCIPALE pour WhatsApp/réseaux sociaux.
    
    IMPORTANT: Utilisez https://afroboosteur.com/api/share/{slug} pour partager !
    Cette URL passe par le backend et sert les balises OpenGraph aux crawlers.
    
    Workflow:
    1. WhatsApp/Facebook crawle cette URL
    2. Le backend retourne les balises og:image, og:title, etc.
    3. L'utilisateur qui clique est redirigé vers /v/{slug} (frontend React)
    """
    media = await db.media_links.find_one({"slug": slug.lower()}, {"_id": 0})
    if not media:
        raise HTTPException(status_code=404, detail="Média non trouvé")
    
    # Incrémenter les vues
    await db.media_links.update_one({"slug": slug.lower()}, {"$inc": {"views": 1}})
    
    # Échapper les caractères spéciaux pour éviter XSS
    title = (media.get('title', 'Afroboost') or 'Afroboost').replace('"', '&quot;').replace('<', '&lt;').replace('>', '&gt;')
    description = (media.get('description', 'Découvrez cette vidéo exclusive Afroboost') or 'Découvrez cette vidéo exclusive Afroboost')[:200].replace('"', '&quot;').replace('<', '&lt;').replace('>', '&gt;')
    thumbnail = media.get('custom_thumbnail') or media.get('thumbnail') or ''
    youtube_id = media.get('youtube_id', '')
    cta_text = media.get('cta_text', '')
    cta_link = media.get('cta_link', '')
    
    # URL de partage et URL du viewer
    share_url = f"https://afroboosteur.com/api/share/{slug}"
    viewer_url = f"https://afroboosteur.com/v/{slug}"
    
    # Générer la page HTML avec meta tags OpenGraph COMPLETS
    html = f"""<!DOCTYPE html>
<html lang="fr" prefix="og: https://ogp.me/ns#">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title} - Afroboost</title>
    
    <!-- ===== OPENGRAPH POUR WHATSAPP/FACEBOOK/LINKEDIN ===== -->
    <meta property="og:type" content="video.other" />
    <meta property="og:site_name" content="Afroboost" />
    <meta property="og:title" content="{title}" />
    <meta property="og:description" content="{description}" />
    <meta property="og:url" content="{share_url}" />
    
    <!-- IMAGE - CRITIQUE POUR WHATSAPP -->
    <meta property="og:image" content="{thumbnail}" />
    <meta property="og:image:secure_url" content="{thumbnail}" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="1280" />
    <meta property="og:image:height" content="720" />
    <meta property="og:image:alt" content="{title}" />
    
    <!-- VIDEO (optionnel mais aide WhatsApp) -->
    {f'<meta property="og:video" content="https://www.youtube.com/embed/{youtube_id}" />' if youtube_id else ''}
    {f'<meta property="og:video:secure_url" content="https://www.youtube.com/embed/{youtube_id}" />' if youtube_id else ''}
    {f'<meta property="og:video:type" content="text/html" />' if youtube_id else ''}
    {f'<meta property="og:video:width" content="1280" />' if youtube_id else ''}
    {f'<meta property="og:video:height" content="720" />' if youtube_id else ''}
    
    <!-- TWITTER CARD -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@afroboost" />
    <meta name="twitter:title" content="{title}" />
    <meta name="twitter:description" content="{description}" />
    <meta name="twitter:image" content="{thumbnail}" />
    
    <!-- WHATSAPP SPECIFIQUE -->
    <meta property="al:web:url" content="{viewer_url}" />
    
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            background: linear-gradient(180deg, #000 0%, #1a0a1f 100%);
            min-height: 100vh;
            color: #fff;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }}
        .container {{
            text-align: center;
            max-width: 500px;
            width: 100%;
        }}
        .logo {{
            font-size: 28px;
            font-weight: bold;
            background: linear-gradient(135deg, #d91cd2, #8b5cf6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 30px;
        }}
        .thumbnail {{
            width: 100%;
            max-width: 480px;
            border-radius: 16px;
            box-shadow: 0 0 40px rgba(217, 28, 210, 0.4);
            margin-bottom: 20px;
        }}
        h1 {{
            font-size: 24px;
            margin-bottom: 15px;
            line-height: 1.3;
        }}
        p {{
            color: rgba(255,255,255,0.7);
            margin-bottom: 25px;
            line-height: 1.5;
        }}
        .cta {{
            display: inline-block;
            padding: 16px 32px;
            background: linear-gradient(135deg, #d91cd2, #8b5cf6);
            color: white;
            text-decoration: none;
            border-radius: 12px;
            font-weight: bold;
            font-size: 18px;
            transition: transform 0.2s, box-shadow 0.2s;
            box-shadow: 0 4px 20px rgba(217, 28, 210, 0.4);
        }}
        .cta:hover {{
            transform: scale(1.05);
            box-shadow: 0 6px 30px rgba(217, 28, 210, 0.6);
        }}
        .loader {{
            width: 40px;
            height: 40px;
            border: 4px solid rgba(217, 28, 210, 0.3);
            border-top-color: #d91cd2;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px;
        }}
        @keyframes spin {{ to {{ transform: rotate(360deg); }} }}
        .redirect-msg {{
            font-size: 14px;
            color: rgba(255,255,255,0.5);
            margin-top: 30px;
        }}
    </style>
    
    <!-- REDIRECTION AUTOMATIQUE VERS LE LECTEUR -->
    <script>
        // Redirection après un court délai pour permettre aux crawlers de lire les meta tags
        setTimeout(function() {{
            window.location.href = "{viewer_url}";
        }}, 1500);
    </script>
</head>
<body>
    <div class="container">
        <div class="logo">🎧 Afroboost</div>
        
        {f'<img src="{thumbnail}" alt="{title}" class="thumbnail" />' if thumbnail else ''}
        
        <h1>{title}</h1>
        <p>{description}</p>
        
        <a href="{viewer_url}" class="cta">
            ▶️ {cta_text if cta_text else 'Voir la vidéo'}
        </a>
        
        <p class="redirect-msg">
            <span class="loader" style="display:inline-block;width:16px;height:16px;vertical-align:middle;margin-right:8px;"></span>
            Redirection en cours...
        </p>
    </div>
</body>
</html>"""
    
    from fastapi.responses import HTMLResponse
    return HTMLResponse(content=html, status_code=200)

# ==================== ROUTE RACINE /v/{slug} POUR OPENGRAPH ====================
# Cette route est essentielle pour que WhatsApp puisse afficher les aperçus riches

@app.get("/v/{slug}")
async def serve_media_opengraph_page(slug: str, request: Request):
    """
    Sert une page HTML avec les meta tags OpenGraph pour les previews WhatsApp.
    WhatsApp/Facebook crawle cette URL et récupère les balises og:.
    La page redirige ensuite vers le frontend React pour l'affichage.
    """
    media = await db.media_links.find_one({"slug": slug.lower()}, {"_id": 0})
    if not media:
        raise HTTPException(status_code=404, detail="Média non trouvé")
    
    # Échapper les caractères spéciaux pour éviter XSS
    title = (media.get('title', 'Afroboost') or 'Afroboost').replace('"', '&quot;').replace('<', '&lt;').replace('>', '&gt;')
    description = (media.get('description', 'Découvrez cette vidéo exclusive Afroboost') or '')[:200].replace('"', '&quot;').replace('<', '&lt;').replace('>', '&gt;')
    thumbnail = media.get('thumbnail', '') or ''
    
    # Déterminer l'URL du frontend (production ou preview)
    frontend_url = os.environ.get('FRONTEND_URL', 'https://afroboosteur.com')
    viewer_url = f"{frontend_url}/v/{slug}"
    
    # Générer la page HTML avec meta tags
    html = f"""<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    
    <!-- OpenGraph pour WhatsApp/Facebook/LinkedIn -->
    <meta property="og:title" content="{title}" />
    <meta property="og:description" content="{description}" />
    <meta property="og:image" content="{thumbnail}" />
    <meta property="og:image:width" content="1280" />
    <meta property="og:image:height" content="720" />
    <meta property="og:url" content="https://afroboosteur.com/v/{slug}" />
    <meta property="og:type" content="video.other" />
    <meta property="og:site_name" content="Afroboost" />
    
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="{title}" />
    <meta name="twitter:description" content="{description}" />
    <meta name="twitter:image" content="{thumbnail}" />
    
    <style>
        body {{
            background: linear-gradient(180deg, #000 0%, #1a0a1f 100%);
            color: #fff;
            font-family: system-ui, -apple-system, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            padding: 20px;
            box-sizing: border-box;
        }}
        .container {{
            text-align: center;
            max-width: 400px;
        }}
        h1 {{
            background: linear-gradient(135deg, #d91cd2, #8b5cf6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 20px;
        }}
        .loader {{
            width: 40px;
            height: 40px;
            border: 4px solid rgba(217, 28, 210, 0.3);
            border-top-color: #d91cd2;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px;
        }}
        @keyframes spin {{
            to {{ transform: rotate(360deg); }}
        }}
        a {{
            color: #d91cd2;
            text-decoration: none;
        }}
        a:hover {{
            text-decoration: underline;
        }}
    </style>
    
    <!-- Redirection automatique -->
    <script>
        // Rediriger vers le frontend React après un court délai
        // Ce délai permet aux crawlers de lire les meta tags
        setTimeout(function() {{
            window.location.href = "{viewer_url}";
        }}, 100);
    </script>
</head>
<body>
    <div class="container">
        <div class="loader"></div>
        <h1>{title}</h1>
        <p>Chargement de la vidéo...</p>
        <p style="margin-top: 20px; font-size: 14px; opacity: 0.7;">
            <a href="{viewer_url}">Cliquez ici si vous n'êtes pas redirigé</a>
        </p>
    </div>
</body>
</html>"""
    
    from fastapi.responses import HTMLResponse
    return HTMLResponse(content=html, status_code=200)

# === SCHEDULER HEALTH ENDPOINTS (définis avant include_router) ===
@api_router.get("/scheduler/status")
async def get_scheduler_status():
    """Endpoint pour vérifier que le scheduler est en vie."""
    from datetime import datetime, timezone
    return {
        "scheduler_running": True,  # Le scheduler est toujours actif si le serveur tourne
        "interval_seconds": 10
    }

@api_router.get("/scheduler/health")
async def get_scheduler_health():
    """
    Endpoint de santé du scheduler pour le dashboard.
    Renvoie le statut et le dernier timestamp d'exécution.
    """
    from datetime import datetime, timezone
    # Accéder à la variable globale qui sera mise à jour par le thread scheduler
    global SCHEDULER_LAST_HEARTBEAT, SCHEDULER_RUNNING
    try:
        return {
            "status": "active" if SCHEDULER_RUNNING else "stopped",
            "last_run": SCHEDULER_LAST_HEARTBEAT
        }
    except:
        return {
            "status": "unknown",
            "last_run": None
        }

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dynamic manifest.json endpoint for PWA
@app.get("/api/manifest.json")
async def get_dynamic_manifest():
    """Serve dynamic manifest.json with logo and name from coach settings"""
    concept = await db.concept.find_one({})
    
    # Use coach-configured favicon (priority) or logo as fallback
    logo_url = None
    app_name = "Afroboost"  # Default name
    if concept:
        # faviconUrl has priority, then logoUrl (same as frontend)
        logo_url = concept.get("faviconUrl") or concept.get("logoUrl")
        # Use custom appName if configured
        if concept.get("appName"):
            app_name = concept.get("appName")
    
    manifest = {
        "short_name": app_name,
        "name": f"{app_name} - Réservation de casque",
        "description": concept.get("description", "Le concept Afroboost : cardio + danse afrobeat + casques audio immersifs.") if concept else "Le concept Afroboost : cardio + danse afrobeat + casques audio immersifs.",
        "icons": [
            {
                "src": "favicon.ico",
                "sizes": "64x64 32x32 24x24 16x16",
                "type": "image/x-icon"
            }
        ],
        "start_url": ".",
        "display": "standalone",
        "theme_color": "#000000",
        "background_color": "#000000",
        "orientation": "portrait-primary"
    }
    
    # Add dynamic logo icons if configured
    if logo_url:
        manifest["icons"] = [
            {
                "src": logo_url,
                "sizes": "192x192",
                "type": "image/png",
                "purpose": "any maskable"
            },
            {
                "src": logo_url,
                "sizes": "512x512",
                "type": "image/png",
                "purpose": "any maskable"
            },
            {
                "src": "favicon.ico",
                "sizes": "64x64 32x32 24x24 16x16",
                "type": "image/x-icon"
            }
        ]
    else:
        # Fallback to default icons
        manifest["icons"] = [
            {
                "src": "favicon.ico",
                "sizes": "64x64 32x32 24x24 16x16",
                "type": "image/x-icon"
            },
            {
                "src": "logo192.png",
                "type": "image/png",
                "sizes": "192x192",
                "purpose": "any maskable"
            },
            {
                "src": "logo512.png",
                "type": "image/png",
                "sizes": "512x512",
                "purpose": "any maskable"
            }
        ]
    
    from fastapi.responses import JSONResponse
    return JSONResponse(content=manifest, media_type="application/manifest+json")

# ==================== SCHEDULER INTÉGRÉ (THREAD AUTOMATIQUE) ====================
# Le scheduler tourne en arrière-plan dès le démarrage du serveur
# Il vérifie les campagnes programmées toutes les 10 secondes

import threading
import time as time_module
from datetime import datetime, timezone, timedelta

# Variable globale pour contrôler le scheduler
SCHEDULER_RUNNING = False
SCHEDULER_LAST_HEARTBEAT = None
SCHEDULER_INTERVAL = 10  # secondes - Heartbeat toutes les 10s

def parse_campaign_date(date_str):
    """Parse une date ISO et la convertit en datetime UTC."""
    if not date_str:
        return None
    try:
        if 'Z' in date_str:
            date_str = date_str.replace('Z', '+00:00')
        if '+' in date_str or '-' in date_str[-6:]:
            dt = datetime.fromisoformat(date_str)
        else:
            dt = datetime.fromisoformat(date_str)
            dt = dt.replace(tzinfo=timezone.utc)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception as e:
        logger.warning(f"[SCHEDULER] Date parsing error '{date_str}': {e}")
        return None

def scheduler_send_email_sync(to_email, to_name, subject, message, media_url=None):
    """Envoi synchrone d'email pour le scheduler (utilise requests)."""
    import requests
    try:
        # Appeler l'API interne
        response = requests.post(
            "http://localhost:8001/api/campaigns/send-email",
            json={
                "to_email": to_email,
                "to_name": to_name,
                "subject": subject,
                "message": message,
                "media_url": media_url
            },
            timeout=30
        )
        if response.status_code == 200:
            result = response.json()
            if result.get("success"):
                return True, None
            return False, result.get("error", "Unknown error")
        return False, f"HTTP {response.status_code}"
    except Exception as e:
        return False, str(e)

def scheduler_send_whatsapp_sync(to_phone, message, media_url=None):
    """Envoi synchrone de WhatsApp pour le scheduler."""
    import requests
    
    # Utiliser la config .env en priorité
    account_sid = TWILIO_ACCOUNT_SID
    auth_token = TWILIO_AUTH_TOKEN
    from_number = TWILIO_FROM_NUMBER
    
    if not account_sid or not auth_token or not from_number:
        return False, "Twilio config missing", None
    
    # Formater les numéros
    clean_to = to_phone.replace(" ", "").replace("-", "")
    if not clean_to.startswith("+"):
        clean_to = "+41" + clean_to.lstrip("0") if clean_to.startswith("0") else "+" + clean_to
    clean_from = from_number if from_number.startswith("+") else "+" + from_number
    
    twilio_url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
    data = {
        "From": f"whatsapp:{clean_from}",
        "To": f"whatsapp:{clean_to}",
        "Body": message
    }
    if media_url:
        data["MediaUrl"] = media_url
    
    try:
        response = requests.post(twilio_url, data=data, auth=(account_sid, auth_token), timeout=30)
        result = response.json()
        if response.status_code >= 400:
            error_msg = result.get("message", "Unknown error")
            print(f"[WHATSAPP-PROD] Message via {clean_from} vers {clean_to} - Status: ERROR ({error_msg})")
            return False, error_msg, None
        sid = result.get("sid", "")
        print(f"[WHATSAPP-PROD] Message via {clean_from} vers {clean_to} - Status: SUCCESS (SID: {sid})")
        return True, None, sid
    except Exception as e:
        return False, str(e), None

def scheduler_loop():
    """Boucle principale du scheduler - tourne en arrière-plan."""
    global SCHEDULER_RUNNING, SCHEDULER_LAST_HEARTBEAT
    
    from pymongo import MongoClient
    
    # Connexion MongoDB synchrone pour le thread
    mongo_client = MongoClient(os.environ.get('MONGO_URL'))
    scheduler_db = mongo_client[os.environ.get('DB_NAME', 'test_database')]
    
    logger.info("[SCHEDULER] ✅ Thread démarré - Mode DAEMON actif")
    print("[SYSTEM] ✅ Scheduler is ONLINE - Checking campaigns every 10s")
    
    SCHEDULER_RUNNING = True
    
    while SCHEDULER_RUNNING:
        try:
            now = datetime.now(timezone.utc)
            now_str = now.strftime('%H:%M:%S')
            SCHEDULER_LAST_HEARTBEAT = now.isoformat()
            
            # HEARTBEAT TOUTES LES 10 SECONDES (visible dans les logs)
            print(f"[DEBUG-DAEMON] Heartbeat - Scan de la DB en cours... ({now_str} UTC)")
            
            # Chercher les campagnes programmées (inclut pending_quota pour retry automatique)
            campaigns = list(scheduler_db.campaigns.find(
                {"status": {"$in": ["scheduled", "sending", "pending_quota"]}},
                {"_id": 0}
            ))
            
            logger.info(f"[SCHEDULER] 📋 {len(campaigns)} campagne(s) à vérifier")
            
            for campaign in campaigns:
                try:
                    campaign_id = campaign.get("id")
                    campaign_name = campaign.get("name", "Sans nom")
                    
                    # Récupérer les dates
                    scheduled_at = campaign.get("scheduledAt")
                    scheduled_dates = campaign.get("scheduledDates", [])
                    sent_dates = campaign.get("sentDates", [])
                    
                    # Normaliser
                    if scheduled_at and not scheduled_dates:
                        scheduled_dates = [scheduled_at]
                    
                    if not scheduled_dates:
                        # LOG DE DIAGNOSTIC
                        print(f"[TIME-CHECK] Campagne: {campaign_name} | Pas de date programmée | SKIP")
                        continue
                    
                    # Trouver les dates à traiter avec LOG DE DIAGNOSTIC
                    dates_to_process = []
                    for date_str in scheduled_dates:
                        parsed_date = parse_campaign_date(date_str)
                        if parsed_date:
                            is_past = parsed_date <= now
                            already_sent = date_str in sent_dates
                            should_process = is_past and not already_sent
                            
                            # LOG DE DIAGNOSTIC TEMPOREL
                            print(f"[TIME-CHECK] Campagne: {campaign_name} | Date prévue: {date_str[:19]} | Heure actuelle UTC: {now.isoformat()[:19]} | Match: {should_process}")
                            
                            if should_process:
                                dates_to_process.append(date_str)
                        else:
                            print(f"[TIME-CHECK] Campagne: {campaign_name} | Date invalide: {date_str} | SKIP")
                    
                    if not dates_to_process:
                        continue
                    
                    logger.info(f"[SCHEDULER] 🎯 Traitement: {campaign_name} - {len(dates_to_process)} date(s)")
                    print(f"[SCHEDULER] 🎯 EXÉCUTION: {campaign_name}")
                    
                    # Récupérer les contacts
                    target_type = campaign.get("targetType", "all")
                    selected_contacts = campaign.get("selectedContacts", [])
                    
                    if target_type == "all":
                        contacts = list(scheduler_db.users.find({}, {"_id": 0}))
                    else:
                        contacts = list(scheduler_db.users.find({"id": {"$in": selected_contacts}}, {"_id": 0}))
                    
                    if not contacts:
                        # Marquer comme terminée si aucun contact
                        scheduler_db.campaigns.update_one(
                            {"id": campaign_id},
                            {"$set": {"status": "completed", "updatedAt": now.isoformat()},
                             "$addToSet": {"sentDates": {"$each": dates_to_process}}}
                        )
                        continue
                    
                    channels = campaign.get("channels", {})
                    message = campaign.get("message", "")
                    media_url = campaign.get("mediaUrl", "")
                    
                    success_count = 0
                    fail_count = 0
                    results = campaign.get("results", [])
                    
                    for contact in contacts:
                        contact_id = contact.get("id", "")
                        contact_email = contact.get("email", "")
                        contact_name = contact.get("name", "")
                        contact_phone = contact.get("whatsapp", "")
                        
                        # ========== EMAIL (try/except isolé) ==========
                        if channels.get("email") and contact_email:
                            try:
                                success, error = scheduler_send_email_sync(
                                    to_email=contact_email,
                                    to_name=contact_name,
                                    subject=f"📢 {campaign_name}",
                                    message=message,
                                    media_url=media_url if media_url else None
                                )
                                
                                result_entry = {
                                    "contactId": contact_id,
                                    "contactName": contact_name,
                                    "contactEmail": contact_email,
                                    "channel": "email",
                                    "status": "sent" if success else "failed",
                                    "error": error if not success else None,
                                    "sentAt": now.isoformat()
                                }
                                results.append(result_entry)
                                
                                if success:
                                    success_count += 1
                                    logger.info(f"[SCHEDULER] ✅ Email envoyé à {contact_email}")
                                    print(f"[SCHEDULER] ✅ Email OK: {contact_email}")
                                else:
                                    fail_count += 1
                                    # Détecter le quota épuisé
                                    is_quota_error = error and ("quota" in error.lower() or "limit" in error.lower() or "429" in str(error))
                                    if is_quota_error:
                                        logger.error(f"[SCHEDULER] 🔴 QUOTA EMAIL ÉPUISÉ ({contact_email})")
                                        print(f"[SCHEDULER] 🔴 QUOTA EMAIL ÉPUISÉ - Marquage failed_quota")
                                    else:
                                        logger.error(f"[SCHEDULER] ❌ Email échoué ({contact_email}): {error}")
                                        print(f"[SCHEDULER] ❌ Email ÉCHEC: {contact_email}")
                                    
                            except Exception as e:
                                logger.error(f"[SCHEDULER] ❌ Exception Email ({contact_email}): {e}")
                                print(f"[SCHEDULER] ❌ Exception Email: {e}")
                                fail_count += 1
                                continue  # PASSER AU CONTACT SUIVANT
                        
                        # ========== WHATSAPP (try/except isolé) ==========
                        if channels.get("whatsapp") and contact_phone:
                            try:
                                success, error, sid = scheduler_send_whatsapp_sync(
                                    to_phone=contact_phone,
                                    message=message,
                                    media_url=media_url if media_url else None
                                )
                                
                                result_entry = {
                                    "contactId": contact_id,
                                    "contactName": contact_name,
                                    "contactPhone": contact_phone,
                                    "channel": "whatsapp",
                                    "status": "sent" if success else "failed",
                                    "error": error if not success else None,
                                    "sid": sid,
                                    "sentAt": now.isoformat()
                                }
                                results.append(result_entry)
                                
                                if success:
                                    success_count += 1
                                    logger.info(f"[SCHEDULER] ✅ WhatsApp envoyé à {contact_phone}")
                                    print(f"[SCHEDULER] ✅ WhatsApp OK: {contact_phone}")
                                else:
                                    fail_count += 1
                                    logger.error(f"[SCHEDULER] ❌ WhatsApp échoué ({contact_phone}): {error}")
                                    print(f"[SCHEDULER] ❌ WhatsApp ÉCHEC: {contact_phone}")
                                    
                            except Exception as e:
                                logger.error(f"[SCHEDULER] ❌ Exception WhatsApp ({contact_phone}): {e}")
                                print(f"[SCHEDULER] ❌ Exception WhatsApp: {e}")
                                fail_count += 1
                                continue  # PASSER AU CONTACT SUIVANT
                    
                    # Vérifier si c'est un échec de quota email (pour le retry automatique)
                    has_quota_error = any(
                        r.get("error") and ("quota" in r.get("error", "").lower() or "limit" in r.get("error", "").lower())
                        for r in results
                    )
                    
                    # LOGIQUE DE REPRISE SUR QUOTA:
                    # - Si quota épuisé: NE PAS marquer la date comme traitée → retry automatique demain
                    # - Si autre erreur ou succès: marquer normalement
                    if has_quota_error and success_count == 0:
                        # QUOTA ÉPUISÉ: Laisser en attente pour retry automatique
                        new_status = "pending_quota"
                        # NE PAS ajouter la date à sentDates → sera retraitée au prochain cycle
                        new_sent_dates = sent_dates  # Garder les dates existantes sans ajouter
                        
                        scheduler_db.campaigns.update_one(
                            {"id": campaign_id},
                            {"$set": {
                                "status": new_status,
                                "results": results,
                                "sentDates": new_sent_dates,
                                "updatedAt": now.isoformat(),
                                "lastQuotaError": now.isoformat()  # Timestamp du dernier échec quota
                            }}
                        )
                        
                        logger.info(f"[SCHEDULER] 🟠 {campaign_name}: QUOTA ÉPUISÉ → En attente de retry automatique")
                        print(f"[SCHEDULER] 🟠 Campagne '{campaign_name}' → pending_quota (retry automatique demain)")
                    else:
                        # Traitement normal (succès ou échec non-quota)
                        new_sent_dates = list(set(sent_dates + dates_to_process))
                        all_dates_done = set(new_sent_dates) >= set(scheduled_dates)
                        
                        if fail_count > 0 and success_count == 0:
                            new_status = "failed"
                        elif all_dates_done:
                            new_status = "completed"
                        else:
                            new_status = "scheduled"
                        
                        scheduler_db.campaigns.update_one(
                            {"id": campaign_id},
                            {"$set": {
                                "status": new_status,
                                "results": results,
                                "sentDates": new_sent_dates,
                                "updatedAt": now.isoformat(),
                                "lastProcessedAt": now.isoformat()
                            }}
                        )
                        
                        status_emoji = "🟢" if new_status == "completed" else "🔴"
                        logger.info(f"[SCHEDULER] {status_emoji} {campaign_name}: {new_status} (✓{success_count}/✗{fail_count})")
                        print(f"[SCHEDULER] {status_emoji} Campagne '{campaign_name}' → {new_status} (✓{success_count}/✗{fail_count})")
                    
                except Exception as campaign_error:
                    logger.error(f"[SCHEDULER] ❌ Erreur campagne {campaign.get('id')}: {campaign_error}")
                    continue  # PASSER À LA CAMPAGNE SUIVANTE
            
        except Exception as e:
            logger.error(f"[SCHEDULER] ❌ Erreur dans la boucle: {e}")
        
        # Attendre avant le prochain cycle
        time_module.sleep(SCHEDULER_INTERVAL)
    
    logger.info("[SCHEDULER] Thread arrêté")

# Variable pour le thread du scheduler
scheduler_thread = None

@app.on_event("startup")
async def startup_scheduler():
    """Lance le scheduler dans un thread séparé au démarrage du serveur."""
    global scheduler_thread
    
    logger.info("[SYSTEM] 🚀 Démarrage du serveur Afroboost...")
    print("[SYSTEM] ============================================")
    print("[SYSTEM] 🚀 AFROBOOST SERVER STARTING...")
    print(f"[SYSTEM] 📱 Twilio FROM: {TWILIO_FROM_NUMBER}")
    print("[SYSTEM] ============================================")
    
    # Démarrer le scheduler dans un thread daemon
    scheduler_thread = threading.Thread(target=scheduler_loop, daemon=True, name="CampaignScheduler")
    scheduler_thread.start()
    
    logger.info("[SYSTEM] ✅ Scheduler thread lancé avec succès")

@app.on_event("shutdown")
async def shutdown_db_client():
    global SCHEDULER_RUNNING
    SCHEDULER_RUNNING = False
    client.close()
    logger.info("[SYSTEM] Serveur arrêté")
