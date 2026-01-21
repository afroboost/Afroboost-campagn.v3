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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Stripe configuration - utilise la variable d'environnement existante
stripe.api_key = os.environ.get('STRIPE_SECRET_KEY')

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
    """Mark campaign as sending and prepare results"""
    campaign = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    # Get contacts based on targetType
    if campaign.get("targetType") == "all":
        contacts = await db.users.find({}, {"_id": 0}).to_list(1000)
    else:
        selected_ids = campaign.get("selectedContacts", [])
        contacts = await db.users.find({"id": {"$in": selected_ids}}, {"_id": 0}).to_list(1000)
    
    # Prepare results for each contact and channel
    results = []
    channels = campaign.get("channels", {})
    for contact in contacts:
        for channel, enabled in channels.items():
            if enabled:
                results.append({
                    "contactId": contact.get("id", ""),
                    "contactName": contact.get("name", ""),
                    "contactEmail": contact.get("email", ""),
                    "contactPhone": contact.get("whatsapp", ""),
                    "channel": channel,
                    "status": "pending",
                    "sentAt": None
                })
    
    # Update campaign
    await db.campaigns.update_one(
        {"id": campaign_id},
        {"$set": {
            "status": "sending",
            "results": results,
            "updatedAt": datetime.now(timezone.utc).isoformat()
        }}
    )
    
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

class AIConfigUpdate(BaseModel):
    enabled: Optional[bool] = None
    systemPrompt: Optional[str] = None
    model: Optional[str] = None
    provider: Optional[str] = None
    lastMediaUrl: Optional[str] = None

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

@api_router.post("/send-whatsapp")
async def send_whatsapp_message(request: SendWhatsAppRequest):
    """
    Endpoint pour que l'agent IA puisse envoyer des WhatsApp
    Utilise la config Twilio stockée en base
    """
    import httpx
    
    # Récupérer la config WhatsApp/Twilio
    whatsapp_config = await db.whatsapp_config.find_one({"id": "whatsapp_config"}, {"_id": 0})
    
    if not whatsapp_config:
        logger.warning("WhatsApp config not found - simulation mode")
        return {
            "status": "simulated",
            "message": f"WhatsApp prêt pour: {request.to}",
            "simulated": True
        }
    
    account_sid = whatsapp_config.get("accountSid")
    auth_token = whatsapp_config.get("authToken")
    from_number = whatsapp_config.get("fromNumber")
    
    if not account_sid or not auth_token or not from_number:
        logger.warning("Twilio config incomplete - simulation mode")
        return {
            "status": "simulated",
            "message": f"WhatsApp simulé pour: {request.to}",
            "simulated": True
        }
    
    # Formater le numéro
    to_phone = request.to.replace(" ", "").replace("-", "")
    if not to_phone.startswith("+"):
        to_phone = "+41" + to_phone.lstrip("0") if to_phone.startswith("0") else "+" + to_phone
    
    from_phone = from_number if from_number.startswith("+") else "+" + from_number
    
    # Construire la requête Twilio
    twilio_url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
    
    data = {
        "From": f"whatsapp:{from_phone}",
        "To": f"whatsapp:{to_phone}",
        "Body": request.message
    }
    
    if request.mediaUrl:
        data["MediaUrl"] = request.mediaUrl
    
    logger.info(f"IA : Envoi WhatsApp vers {to_phone}")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                twilio_url,
                data=data,
                auth=(account_sid, auth_token)
            )
            
            result = response.json()
            
            if response.status_code >= 400:
                logger.error(f"Twilio error: {result}")
                return {"status": "error", "error": result.get("message", "Unknown error")}
            
            logger.info(f"IA : Message WhatsApp envoyé - SID: {result.get('sid')}")
            print("IA : Message envoyé via WhatsApp (Twilio)")
            
            return {
                "status": "success",
                "sid": result.get("sid"),
                "to": to_phone
            }
            
    except Exception as e:
        logger.error(f"WhatsApp send error: {str(e)}")
        return {"status": "error", "error": str(e)}

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
    """Chat avec l'IA depuis le widget client"""
    import time
    start_time = time.time()
    
    message = data.message
    first_name = data.firstName
    
    if not message:
        raise HTTPException(status_code=400, detail="Message requis")
    
    # Récupérer la config IA
    ai_config = await db.ai_config.find_one({"id": "ai_config"}, {"_id": 0})
    if not ai_config:
        ai_config = AIConfig().model_dump()
    
    if not ai_config.get("enabled"):
        return {"response": "L'assistant IA est actuellement désactivé. Veuillez contacter le coach directement.", "responseTime": 0}
    
    # Construire le contexte avec le prénom
    context = ""
    if first_name:
        context += f"\n\nLe client qui te parle s'appelle {first_name}. Utilise son prénom dans ta réponse pour être chaleureux."
    
    # Récupérer les infos du concept pour contexte
    concept = await db.concept.find_one({"id": "concept"}, {"_id": 0})
    if concept:
        context += f"\n\nContexte Afroboost: {concept.get('description', '')}"
    
    # Récupérer les cours disponibles
    courses = await db.courses.find({"visible": {"$ne": False}}, {"_id": 0}).to_list(10)
    if courses:
        courses_info = "\n".join([f"- {c.get('name', '')} le {c.get('date', '')} à {c.get('time', '')}" for c in courses[:5]])
        context += f"\n\nCours disponibles:\n{courses_info}"
    
    full_system_prompt = ai_config.get("systemPrompt", "Tu es l'assistant IA d'Afroboost, une application de réservation de cours de fitness.") + context
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        import uuid
        
        emergent_key = os.environ.get("EMERGENT_LLM_KEY")
        if not emergent_key:
            return {"response": "Configuration IA incomplète. Contactez l'administrateur.", "responseTime": 0}
        
        # Generate a unique session ID for this chat
        session_id = f"afroboost_chat_{uuid.uuid4().hex[:8]}"
        
        chat = LlmChat(
            api_key=emergent_key,
            session_id=session_id,
            system_message=full_system_prompt
        )
        
        user_msg = UserMessage(text=message)
        ai_response = await chat.send_message(user_msg)
        response_time = round(time.time() - start_time, 2)
        
        # Log la conversation
        await db.ai_logs.insert_one({
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "from": f"widget_{first_name or 'anonymous'}",
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
    participant = await db.chat_participants.find_one({"id": participant_id}, {"_id": 0})
    if not participant:
        raise HTTPException(status_code=404, detail="Participant non trouvé")
    
    # Supprimer le participant
    await db.chat_participants.delete_one({"id": participant_id})
    
    # Optionnel: Retirer le participant de toutes les sessions
    await db.chat_sessions.update_many(
        {"participant_ids": participant_id},
        {"$pull": {"participant_ids": participant_id}}
    )
    
    return {"success": True, "message": f"Participant {participant.get('name', 'inconnu')} supprimé"}

# --- Chat Sessions ---
@api_router.get("/chat/sessions")
async def get_chat_sessions(include_deleted: bool = False):
    """Récupère toutes les sessions de chat (exclut les supprimées par défaut)"""
    query = {} if include_deleted else {"is_deleted": {"$ne": True}}
    sessions = await db.chat_sessions.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return sessions

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
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Si suppression logique, ajouter la date
    if update_data.get("is_deleted"):
        update_data["deleted_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.chat_sessions.update_one(
        {"id": session_id},
        {"$set": update_data}
    )
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

# --- Shareable Links (Liens Partageables) ---
@api_router.post("/chat/generate-link")
async def generate_shareable_link(request: Request):
    """
    Génère un lien partageable unique pour le chat IA.
    Ce lien peut être partagé sur les réseaux sociaux.
    """
    body = await request.json()
    title = body.get("title", "Chat Afroboost")
    
    # Créer une nouvelle session avec un token unique
    session = ChatSession(
        mode="ai",
        is_ai_active=True,
        title=title
    )
    await db.chat_sessions.insert_one(session.model_dump())
    
    # Construire l'URL de partage
    # Note: L'URL de base sera configurée côté frontend
    frontend_url = os.environ.get("FRONTEND_URL", "")
    share_url = f"{frontend_url}/chat/{session.link_token}" if frontend_url else f"/chat/{session.link_token}"
    
    return {
        "link_token": session.link_token,
        "share_url": share_url,
        "session_id": session.id
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
    Envoie un message à l'IA avec le contexte de la session.
    Vérifie que l'IA est active pour cette session avant de répondre.
    
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
    
    # Sauvegarder le message de l'utilisateur
    user_message = EnhancedChatMessage(
        session_id=session_id,
        sender_id=participant_id,
        sender_name=participant.get("name", "Utilisateur"),
        sender_type="user",
        content=message_text,
        mode=session.get("mode", "ai")
    )
    await db.chat_messages.insert_one(user_message.model_dump())
    
    # Vérifier si l'IA est active pour cette session
    if not session.get("is_ai_active", True) or session.get("mode") != "ai":
        return {
            "response": None,
            "ai_active": False,
            "mode": session.get("mode"),
            "message_saved": True,
            "user_message_id": user_message.id
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
    
    # Construire le contexte enrichi pour les ventes
    default_name = "l'utilisateur"
    participant_name = participant.get('name', default_name)
    
    # Récupérer les offres et cours pour les proposer
    offers = await db.offers.find({"active": True}, {"_id": 0}).to_list(10)
    courses = await db.courses.find({"archived": {"$ne": True}}, {"_id": 0}).to_list(10)
    
    # Construire le contexte de vente
    sales_context = "\n\n=== CATALOGUE DISPONIBLE ===\n"
    if offers:
        sales_context += "\n📦 OFFRES SPÉCIALES:\n"
        for offer in offers[:5]:
            sales_context += f"- {offer.get('name', 'Offre')}: {offer.get('price', 'N/A')} CHF - {offer.get('description', '')[:50]}...\n"
    
    if courses:
        sales_context += "\n🎯 COURS DISPONIBLES:\n"
        for course in courses[:5]:
            sales_context += f"- {course.get('title', 'Cours')}: {course.get('price', 'N/A')} CHF - {course.get('schedule', '')}\n"
    
    # Prompt enrichi pour les ventes
    sales_prompt = """
Tu es un assistant commercial expert et chaleureux pour Afroboost, une salle de fitness unique.
Tes objectifs:
1. Répondre aux questions avec enthousiasme
2. Proposer des cours et offres adaptés au client
3. Guider vers la réservation ou l'achat
4. Si le client montre de l'intérêt, propose un lien de paiement Stripe

Quand le client veut réserver ou acheter:
- Propose-lui directement de "cliquer sur le bouton Réserver" sur la page
- Ou dis-lui qu'il peut payer directement sur le site

Sois concis (max 3 phrases), chaleureux et utilise des emojis avec parcimonie.
"""
    
    context = f"\n\nLe client qui te parle s'appelle {participant_name}. Utilise son prénom dans ta réponse."
    context += sales_context
    
    # Récupérer les derniers messages pour le contexte
    recent_messages = await db.chat_messages.find(
        {"session_id": session_id, "is_deleted": {"$ne": True}},
        {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    if recent_messages:
        history = "\n".join([
            f"{'Client' if m.get('sender_type') == 'user' else 'Assistant'}: {m.get('content', '')}"
            for m in reversed(recent_messages[1:])  # Exclure le message actuel
        ])
        context += f"\n\nHistorique récent:\n{history}"
    
    # Récupérer le concept pour contexte
    concept = await db.concept.find_one({"id": "concept"}, {"_id": 0})
    if concept:
        context += f"\n\nContexte: {concept.get('description', '')}"
    
    full_system_prompt = ai_config.get("systemPrompt", "Tu es l'assistant IA d'Afroboost.") + context
    
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
            "from": participant.get("name", "anonymous"),
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

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
