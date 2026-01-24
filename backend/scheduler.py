#!/usr/bin/env python3
"""
SCHEDULER DE CAMPAGNES AFROBOOST
================================
Script autonome pour l'envoi programmé des campagnes marketing.

Usage:
    python scheduler.py              # Exécution unique
    python scheduler.py --loop       # Boucle infinie (toutes les 60s)
    python scheduler.py --dry-run    # Mode test sans envoi réel

Ce script doit être exécuté via cron ou supervisord pour garantir
la fiabilité des envois programmés.
"""

import os
import sys
import time
import logging
import argparse
from datetime import datetime, timezone
from pathlib import Path

# Charger les variables d'environnement
from dotenv import load_dotenv
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB synchrone (pas besoin d'async pour le scheduler)
from pymongo import MongoClient
import requests

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - [SCHEDULER] %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# Configuration MongoDB
MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME', 'test_database')

if not MONGO_URL:
    logger.error("MONGO_URL non configuré. Arrêt du scheduler.")
    sys.exit(1)

# Configuration API
# En mode scheduler, on appelle directement l'API backend
BACKEND_URL = os.environ.get('BACKEND_URL', 'http://localhost:8001')

# Nombre maximum de tentatives avant échec
MAX_RETRY_ATTEMPTS = 3

# Connexion MongoDB
try:
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    # Test de connexion
    client.admin.command('ping')
    logger.info(f"✅ Connexion MongoDB réussie: {DB_NAME}")
except Exception as e:
    logger.error(f"❌ Erreur connexion MongoDB: {e}")
    sys.exit(1)


def get_current_utc_time():
    """Retourne l'heure actuelle en UTC (timezone-aware)."""
    return datetime.now(timezone.utc)


def parse_scheduled_date(date_str):
    """
    Parse une date ISO et la convertit en datetime UTC.
    Gère les formats avec et sans timezone.
    """
    if not date_str:
        return None
    
    try:
        # Essayer différents formats
        if 'Z' in date_str:
            date_str = date_str.replace('Z', '+00:00')
        
        if '+' in date_str or '-' in date_str[-6:]:
            # Format avec timezone
            dt = datetime.fromisoformat(date_str)
        else:
            # Format sans timezone - considérer comme UTC
            dt = datetime.fromisoformat(date_str)
            dt = dt.replace(tzinfo=timezone.utc)
        
        # Convertir en UTC si nécessaire
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        
        return dt
    except Exception as e:
        logger.warning(f"Impossible de parser la date '{date_str}': {e}")
        return None


def send_campaign_email(to_email, to_name, subject, message, media_url=None):
    """
    Envoie un email de campagne via l'API backend.
    Retourne (success: bool, error: str|None)
    """
    try:
        payload = {
            "to_email": to_email,
            "to_name": to_name,
            "subject": subject,
            "message": message
        }
        if media_url:
            payload["media_url"] = media_url
        
        response = requests.post(
            f"{BACKEND_URL}/api/campaigns/send-email",
            json=payload,
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get("success"):
                return True, None
            else:
                return False, result.get("error", "Erreur inconnue")
        else:
            return False, f"HTTP {response.status_code}: {response.text[:200]}"
    
    except requests.Timeout:
        return False, "Timeout lors de l'envoi"
    except Exception as e:
        return False, str(e)


def process_campaign(campaign, dry_run=False):
    """
    Traite une campagne programmée:
    - Vérifie les dates d'envoi
    - Envoie aux contacts ciblés
    - Met à jour le statut
    
    Retourne: (processed: bool, success_count: int, fail_count: int)
    """
    campaign_id = campaign.get("id")
    campaign_name = campaign.get("name", "Sans nom")
    
    logger.info(f"📧 Traitement campagne: {campaign_name} ({campaign_id})")
    
    now = get_current_utc_time()
    
    # === GESTION DES DATES ===
    # Supporte les deux formats: scheduledAt (date unique) ou scheduledDates (multi-dates)
    scheduled_at = campaign.get("scheduledAt")
    scheduled_dates = campaign.get("scheduledDates", [])
    sent_dates = campaign.get("sentDates", [])
    
    # Normaliser: si scheduledAt existe et scheduledDates est vide, créer une liste
    if scheduled_at and not scheduled_dates:
        scheduled_dates = [scheduled_at]
    
    if not scheduled_dates:
        logger.warning(f"  ⚠️ Aucune date programmée pour cette campagne")
        return False, 0, 0
    
    # Trouver les dates à traiter (passées et non encore envoyées)
    dates_to_process = []
    for date_str in scheduled_dates:
        scheduled_dt = parse_scheduled_date(date_str)
        if scheduled_dt and scheduled_dt <= now and date_str not in sent_dates:
            dates_to_process.append(date_str)
    
    if not dates_to_process:
        logger.info(f"  ⏳ Aucune date à traiter maintenant (prochaine: {scheduled_dates[0] if scheduled_dates else 'N/A'})")
        return False, 0, 0
    
    logger.info(f"  📅 {len(dates_to_process)} date(s) à traiter: {dates_to_process}")
    
    # === RÉCUPÉRER LES CONTACTS ===
    target_type = campaign.get("targetType", "all")
    selected_contacts = campaign.get("selectedContacts", [])
    
    if target_type == "all":
        contacts = list(db.users.find({}, {"_id": 0}))
    else:
        contacts = list(db.users.find({"id": {"$in": selected_contacts}}, {"_id": 0}))
    
    if not contacts:
        logger.warning(f"  ⚠️ Aucun contact trouvé pour cette campagne")
        # Marquer comme terminée si aucun contact
        db.campaigns.update_one(
            {"id": campaign_id},
            {"$set": {"status": "completed", "updatedAt": now.isoformat()}}
        )
        return True, 0, 0
    
    logger.info(f"  👥 {len(contacts)} contact(s) ciblés")
    
    # === VÉRIFIER LES CANAUX ===
    channels = campaign.get("channels", {})
    email_enabled = channels.get("email", False)
    
    if not email_enabled:
        logger.info(f"  📧 Canal email désactivé - Passage au statut 'completed'")
        # Marquer comme terminée même si email non activé
        # (WhatsApp n'est pas géré par ce scheduler)
        all_dates_processed = set(sent_dates + dates_to_process) >= set(scheduled_dates)
        new_status = "completed" if all_dates_processed else "scheduled"
        db.campaigns.update_one(
            {"id": campaign_id},
            {
                "$set": {"status": new_status, "updatedAt": now.isoformat()},
                "$addToSet": {"sentDates": {"$each": dates_to_process}}
            }
        )
        return True, 0, 0
    
    # === PRÉPARER L'ENVOI ===
    message = campaign.get("message", "")
    media_url = campaign.get("mediaUrl", "")
    subject = f"📢 {campaign_name}"
    
    success_count = 0
    fail_count = 0
    results = campaign.get("results", [])
    retry_counts = campaign.get("retryCounts", {})
    
    # === ENVOYER AUX CONTACTS ===
    for contact in contacts:
        contact_id = contact.get("id", "")
        contact_email = contact.get("email", "")
        contact_name = contact.get("name", "")
        
        if not contact_email:
            logger.warning(f"    ⚠️ Contact {contact_name} sans email - ignoré")
            continue
        
        # Vérifier si déjà envoyé
        already_sent = any(
            r.get("contactId") == contact_id and 
            r.get("channel") == "email" and 
            r.get("status") == "sent"
            for r in results
        )
        
        if already_sent:
            logger.info(f"    ✓ {contact_email} - Déjà envoyé")
            success_count += 1
            continue
        
        # Vérifier le nombre de tentatives
        retry_key = f"{contact_id}_email"
        current_retries = retry_counts.get(retry_key, 0)
        
        if current_retries >= MAX_RETRY_ATTEMPTS:
            logger.error(f"    ❌ {contact_email} - Max tentatives atteint ({MAX_RETRY_ATTEMPTS})")
            fail_count += 1
            continue
        
        # === ENVOI ===
        if dry_run:
            logger.info(f"    🧪 [DRY-RUN] {contact_email} - Email simulé")
            success = True
            error = None
        else:
            logger.info(f"    📤 Envoi à {contact_email}...")
            success, error = send_campaign_email(
                to_email=contact_email,
                to_name=contact_name,
                subject=subject,
                message=message,
                media_url=media_url if media_url else None
            )
        
        if success:
            logger.info(f"    ✅ {contact_email} - Envoyé avec succès")
            success_count += 1
            
            # Mettre à jour le résultat
            result_entry = {
                "contactId": contact_id,
                "contactName": contact_name,
                "contactEmail": contact_email,
                "channel": "email",
                "status": "sent",
                "sentAt": now.isoformat()
            }
            
            # Chercher et mettre à jour ou ajouter
            result_found = False
            for i, r in enumerate(results):
                if r.get("contactId") == contact_id and r.get("channel") == "email":
                    results[i] = result_entry
                    result_found = True
                    break
            if not result_found:
                results.append(result_entry)
        else:
            logger.error(f"    ❌ {contact_email} - Échec: {error}")
            fail_count += 1
            retry_counts[retry_key] = current_retries + 1
    
    # === MISE À JOUR DE LA CAMPAGNE ===
    new_sent_dates = list(set(sent_dates + dates_to_process))
    all_dates_processed = set(new_sent_dates) >= set(scheduled_dates)
    
    # Déterminer le nouveau statut
    if fail_count > 0 and success_count == 0:
        # Tous échoués
        new_status = "failed"
    elif all_dates_processed:
        # Toutes les dates traitées
        new_status = "completed"
    else:
        # Encore des dates à venir
        new_status = "scheduled"
    
    # Mettre à jour en base
    update_data = {
        "status": new_status,
        "results": results,
        "sentDates": new_sent_dates,
        "retryCounts": retry_counts,
        "updatedAt": now.isoformat(),
        "lastProcessedAt": now.isoformat()
    }
    
    db.campaigns.update_one(
        {"id": campaign_id},
        {"$set": update_data}
    )
    
    status_emoji = "✅" if new_status == "completed" else ("❌" if new_status == "failed" else "⏳")
    logger.info(f"  {status_emoji} Campagne mise à jour: {new_status} (✓{success_count} / ✗{fail_count})")
    
    return True, success_count, fail_count


def run_scheduler(dry_run=False):
    """
    Exécute un cycle du scheduler:
    1. Cherche les campagnes programmées
    2. Vérifie si leur heure est passée
    3. Les traite et met à jour leur statut
    """
    now = get_current_utc_time()
    logger.info(f"{'='*60}")
    logger.info(f"🚀 SCHEDULER AFROBOOST - Exécution à {now.isoformat()}")
    logger.info(f"{'='*60}")
    
    if dry_run:
        logger.info("⚠️ MODE DRY-RUN: Aucun email ne sera réellement envoyé")
    
    # Chercher les campagnes programmées
    campaigns = list(db.campaigns.find(
        {"status": {"$in": ["scheduled", "sending"]}},
        {"_id": 0}
    ))
    
    logger.info(f"📋 {len(campaigns)} campagne(s) programmée(s) trouvée(s)")
    
    if not campaigns:
        logger.info("Aucune campagne à traiter.")
        return
    
    total_success = 0
    total_fail = 0
    campaigns_processed = 0
    
    for campaign in campaigns:
        try:
            processed, success, fail = process_campaign(campaign, dry_run=dry_run)
            if processed:
                campaigns_processed += 1
                total_success += success
                total_fail += fail
        except Exception as e:
            logger.error(f"❌ Erreur lors du traitement de la campagne {campaign.get('id')}: {e}")
            import traceback
            traceback.print_exc()
    
    logger.info(f"{'='*60}")
    logger.info(f"📊 RÉSUMÉ: {campaigns_processed} campagne(s) traitée(s)")
    logger.info(f"   ✅ Succès: {total_success} | ❌ Échecs: {total_fail}")
    logger.info(f"{'='*60}")


def main():
    """Point d'entrée principal du scheduler."""
    parser = argparse.ArgumentParser(description="Scheduler de campagnes Afroboost")
    parser.add_argument("--loop", action="store_true", help="Exécuter en boucle infinie (toutes les 60s)")
    parser.add_argument("--dry-run", action="store_true", help="Mode test sans envoi réel")
    parser.add_argument("--interval", type=int, default=60, help="Intervalle en secondes (défaut: 60)")
    args = parser.parse_args()
    
    if args.loop:
        logger.info(f"🔄 Mode boucle activé (intervalle: {args.interval}s)")
        while True:
            try:
                run_scheduler(dry_run=args.dry_run)
            except Exception as e:
                logger.error(f"Erreur dans la boucle scheduler: {e}")
            time.sleep(args.interval)
    else:
        run_scheduler(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
