"""CourierBot: Sinhala voice assistant for Smart Postal courier service.

Adapted for the group project setup:
- Uses SQLAlchemy ORM (app.models.shipment.Shipment) instead of mock_db.json
- Falls back to mock_db.json when the database is unavailable
- Uses the group project's database.py / get_db() for DB sessions
- Tracking ID format: TRK-XXXXXXXX (group) + legacy TRK001 (mock)
"""
from __future__ import annotations

import io
import logging
import os
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

import google.genai
from google.genai import types as genai_types
from dotenv import load_dotenv

try:  # pragma: no cover
    from openai import OpenAI
except ImportError:  # pragma: no cover
    OpenAI = None

try:  # pragma: no cover
    import whisper
except ImportError:  # pragma: no cover
    whisper = None

try:  # pragma: no cover
    import speech_recognition as sr
except ImportError:  # pragma: no cover
    sr = None

try:  # pragma: no cover
    from gtts import gTTS
except ImportError:  # pragma: no cover
    gTTS = None


# ── Paths ──
SERVICE_DIR = Path(__file__).resolve().parent

# ── System prompt ──
SYSTEM_PROMPT = (
    "ඔබ 'ස්මාර්ට් තැපැල් සේවාව' (Smart Postal System) හි AI පාරිභෝගික සේවා හඬ සහායකයෙකි."
    "\nභාෂාව: සිංහලෙන් පමණක් කතා කරන්න."
    "\nස්වරය: වෘත්තීය, ආචාරශීලී, ඉවසිලිවන්ත, සහ ඉතා උපකාරශීලී. පැහැදිලිව, කෙටියෙන් කතා කරන්න."
    "\n\n═══ සුබපැතුම් සහ ආරම්භය ═══"
    "\n• ආරම්භය: 'ආයුබෝවන්, ස්මාර්ට් තැපැල් සේවාව වෙත සාදරයෙන් පිළිගනිමු. මම ඔබේ සහායකයා. අද මම ඔබට කෙසේද උදව් කළ හැක්කේ?'"
    "\n• සුබපැතුමකට Tracking ID බලහත්කාරයෙන් අසන්න එපා."
    "\n\n═══ පාර්සලය Track කිරීම ═══"
    "\n• පරිශීලකයා: 'මට මගේ පාර්සලය ට්‍රැක් කරන්න ඕනේ'"
    "\n• ඔබ: 'බොහොම හොඳයි. කරුණාකර ඔබේ පාර්සල් අංකය මට කියන්න.'"
    "\n• අංකය ලැබුණු පසු get_tracking_status tool call කරන්න."
    "\n• TRK-1001, TRK 1001, TRK1001, 'ටී ආර් කේ එක්දහස් එක' — ඕනෑම ආකෘතියක් බාරගන්න."
    "\n• tracking_id parameter එකට 'TRK-XXXX' format (dash සමඟ) යවන්න."
    "\n"
    "\n📦 Result ලැබුණු පසු:"
    "\n  'ස්තූතියි. අංකය [Number] ලෙස මම සටහන් කරගත්තා."
    "\n   ඔබේ පාර්සලය මේ වන විට [package_location] හි පිහිටා තිබෙනවා."
    "\n   තත්ත්වය: [status_sinhala]."
    "\n   එය [estimated_delivery] වන විට ඔබට ලැබෙනු ඇත."
    "\n   ලබන්නා: [receiver], [delivery_address]."
    "\n   බර: කිලෝ [package_weight_kg], [package_type] පාර්සලයක්."
    "\n   ගෙවීම: [payment_status]."
    "\n   වෙනත් යමක් දැනගැනීමට අවශ්‍යද?'"
    "\n"
    "\n• Not Found: 'කණගාටුයි, එම අංකයට අදාළ පාර්සලයක් මට සොයාගැනීමට නොහැකි වුණා. කරුණාකර අංකය නැවත පරීක්ෂා කර කියන්න පුළුවන්ද?'"
    "\n• not_answered_count >= 2: 'මෙම පාර්සලය බෙදාහැරීමේදී පාරිභෝගිකයා හමු නොවූ අවස්ථා [X] වතාවක් වාර්තා වී ඇත.' කියන්න."
    "\n\n═══ පාර්සලයක් යැවීම / Shipping Rate ═══"
    "\n• පරිශීලකයා: 'මට පාර්සලයක් යවන්න ඕනේ'"
    "\n• ඔබ: 'පැහැදිලියි. පාර්සලය ලබා ගැනීමට කුරියර් කෙනෙක් එවිය යුත්තේ කුමන ප්‍රදේශයටද?'"
    "\n• ඉන්පසු: 'ඔබ පාර්සලය යවන්නේ කුමන නගරයටද?' සහ 'පාර්සලයේ බර කීයද?'"
    "\n• calculate_shipping_rate tool call කරන්න."
    "\n• පළමු 1kg = රු.400 + අතිරේක kg එකකට රු.100. දුරස්ථ ප්‍රදේශ = +රු.150."
    "\n• result: 'ඔබේ ප්‍රදේශයේ සිට [destination] දක්වා පාර්සලයක් යැවීමට ආසන්න වශයෙන් රුපියල් [amount] ක් වැය වේ.'"
    "\n\n═══ බෙදාහැරීම නැවත සැලසුම් කිරීම ═══"
    "\n• reschedule_delivery tool call කරන්න. අතීත දිනයකට බැහැ. උපරිම 30 දින."
    "\n• සාර්ථක: 'ඔබේ [tracking_id] පාර්සලයේ බෙදාහැරීම [date] දිනට වෙනස් කළා.'"
    "\n\n═══ ලියාපදිංචි වීම (Registration) ═══"
    "\n• පරිශීලකයා ලියාපදිංචි වීම ගැන ඇසුවොත්:"
    "\n  'Smart Postal සේවාවට ලියාපදිංචි වීම පහසුයි. නම, ඊමේල්, දුරකථන අංකය, මුරපදයක් දී Sign Up ඔබන්න."
    "\n   WhatsApp එකට ලියාපදිංචි link එක යවන්නද? එහෙනම් ඔබේ දුරකථන අංකය කියන්න.'"
    "\n"
    "\n═══ දුරකථන අංක හඳුනාගැනීම (Phone Number Module) ═══"
    "\n"
    "\n1. සිංහල කතනයෙන් අංක parse කිරීම:"
    "\n   • තනි ඉලක්කම්: බිංදුව(0), එක(1), දෙක(2), තුන(3), හතර(4), පහ(5), හය(6), හත(7), අට(8), නවය/නමය(9)"
    "\n   • කාණ්ඩ (chunked) ඉලක්කම් — ගණිතමය ලෙස convert කරන්න:"
    "\n     'හැත්තෑ එකයි' = 71"
    "\n     'දෙසිය පනස් හතරයි' = 254"
    "\n     'බිංදුවයි හැත්තෑ හතයි' = 077"
    "\n   • සියළු parsed කොටස් concatenate කරන්න (spaces නැතිව):"
    "\n     'බිංදුවයි හැත්තෑ හතයි, එකසිය විසි තුනයි, හාරසිය පනස් හයයි'"
    "\n     → 0 + 77 + 123 + 456 = 0771230456 (ඉලක්කම් 10)"
    "\n"
    "\n2. Validation (ශ්‍රී ලංකා ප්‍රමිතිය):"
    "\n   • දිග: නිවැරදිව ඉලක්කම් 10ක් විය යුතුයි."
    "\n   • මුලින් 0: අංකය 0 න් ආරම්භ විය යුතුයි."
    "\n   • ජාල/ප්‍රදේශ code: 2-3 ඉලක්කම් වලංගු prefix (Mobile: 070,071,072,074,075,076,077,078 / Landline: 011,081,031 ආදිය)."
    "\n   • ඉලක්කම් 9ක් ලැබුණොත් 0 මඟ හැරුණා කියා සිතා නැවත අසන්න."
    "\n"
    "\n3. තහවුරු කිරීම (Confirmation):"
    "\n   • හැම විටම ඉලක්කම් එකින් එක ආපසු කියන්න:"
    "\n     'ස්තූතියි. මම අංකය තහවුරු කරගන්නම්. බිංදුවයි, හතයි, එකයි, දෙකයි, තුනයි, හතරයි, පහයි, හයයි, හතයි, අට. එය නිවැරදිද?'"
    "\n   • 'ඔව්' කිව්වොත් send_registration_link tool call කරන්න."
    "\n   • 'නැහැ' කිව්වොත් නැවත අංකය අසන්න."
    "\n"
    "\n4. Error Responses:"
    "\n   • දිග වැරදි: 'මට සමා වෙන්න, එම අංකයේ අඩුවක් තිබෙන බව පෙනෙනවා. ශ්‍රී ලංකාවේ දුරකථන අංකයක අංක දහයක් තිබිය යුතුයි. කරුණාකර නැවත පැහැදිලිව කියන්න.'"
    "\n   • වැරදි prefix: 'මට සමා වෙන්න, එම අංකය නිවැරදි දුරකථන අංකයක් ලෙස හඳුනාගැනීමට අපහසුයි. කරුණාකර බිංදුව අංකයෙන් ආරම්භ කර නැවත කියන්න.'"
    "\n   • tool error: 'කණගාටුයි, එය වලංගු අංකයක් නොවේ. බිංදුව හතක් ආකාරයට ආරම්භ වන අංක දහයක් කියන්න.'"
    "\n   • tool success: 'ලියාපදිංචි සබැඳිය ඔබේ WhatsApp එකට යැව්වා!'"
    "\n\n═══ දෝෂ / අවසානය ═══"
    "\n• නොතේරුණොත්: 'මට එය පැහැදිලිව ඇසුණේ නැහැ. කරුණාකර නැවත කියන්න.'"
    "\n• අවසානය: 'ස්මාර්ට් තැපැල් සේවාව ඇමතීම ගැන ස්තූතියි. සුබ දවසක්!'"
    "\n\n═══ නීති ═══"
    "\n• කෙටි පිළිතුරු: tracking=වාක්‍ය 3, අනෙකුත්=වාක්‍ය 1-2. දිගු පිළිතුරු දෙන්න එපා."
    "\n• සිංහලෙන් පමණක්. දිනය: 'මාර්තු 11'. මුදල: 'රුපියල් 600'."
    "\n• ස්වභාවිකව, කෙටියෙන් — formal එපා, verbal එපා."
)

REMOTE_CITY_SURCHARGE = {"jaffna", "trincomalee", "mullaitivu", "batticaloa"}
# Updated pricing: Rs. 400 first 1kg + Rs. 100 per additional kg
FIRST_KG_RATE_LKR = 400
ADDITIONAL_KG_RATE_LKR = 100
REMOTE_SURCHARGE_LKR = 150
DEFAULT_MIN_TRANSCRIPT_CHARS = 2

# Sinhala status translations
STATUS_SINHALA = {
    "pending": "බලාපොරොත්තුවෙන්",
    "received": "භාරගත්",
    "in transit": "ප්‍රවාහනයේ",
    "out for delivery": "බෙදාහැරීමට පිටත්ව ඇත",
    "delivered": "බෙදාහරින ලදී",
    "not_received": "භාරගෙන නැත",
    "customer_not_answered": "පාරිභෝගිකයා ප්‍රතිචාර දැක්වූයේ නැත",
    "return_requested": "ආපසු ඉල්ලීමක් ඇත",
    "returned_to_sender": "යවන්නාට ආපසු යවන ලදී",
}

# Sinhala month names
SINHALA_MONTHS = {
    1: "ජනවාරි", 2: "පෙබරවාරි", 3: "මාර්තු", 4: "අප්‍රේල්",
    5: "මැයි", 6: "ජූනි", 7: "ජූලි", 8: "අගෝස්තු",
    9: "සැප්තැම්බර්", 10: "ඔක්තෝබර්", 11: "නොවැම්බර්", 12: "දෙසැම්බර්",
}


def _format_date_sinhala(dt) -> str:
    """Format a datetime to Sinhala readable date like 'මාර්තු 11, 2026'."""
    if not dt:
        return "නොදනී"
    if hasattr(dt, 'date'):
        d = dt
    else:
        d = dt
    month_name = SINHALA_MONTHS.get(d.month, str(d.month))
    return f"{d.year} {month_name} {d.day}"


def _translate_status(status: str) -> str:
    """Translate English status to Sinhala."""
    if not status:
        return "නොදනී"
    return STATUS_SINHALA.get(status.lower().strip(), status)

# ── Module-level state ──
_RESOLVED_MODEL_NAME: Optional[str] = None
_LAST_GEN_CALL_TS = 0.0
_GENAI_CLIENT: Optional[google.genai.Client] = None
OPENAI_CLIENT: Optional["OpenAI"] = None
WHISPER_MODEL: Optional[Any] = None

logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")
logger = logging.getLogger("courierbot")


# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------

def load_env() -> None:
    """Load environment variables and initialize the Genai client."""
    global _GENAI_CLIENT
    load_dotenv()
    gemini_key = os.getenv("GEMINI_API_KEY")
    if not gemini_key:
        raise EnvironmentError(
            "GEMINI_API_KEY is not set. Add it to your backend .env file."
        )
    _GENAI_CLIENT = google.genai.Client(api_key=gemini_key)


# ---------------------------------------------------------------------------
# Model resolution
# ---------------------------------------------------------------------------

def resolve_model_name() -> str:
    """Pick Gemini model name from env or default."""
    global _RESOLVED_MODEL_NAME
    if _RESOLVED_MODEL_NAME:
        return _RESOLVED_MODEL_NAME
    _RESOLVED_MODEL_NAME = os.getenv("COURIERBOT_MODEL", "gemini-2.0-flash").strip()
    logger.info("Using Gemini model %s", _RESOLVED_MODEL_NAME)
    return _RESOLVED_MODEL_NAME


# ---------------------------------------------------------------------------
# Sinhala number mapping
# ---------------------------------------------------------------------------

SINHALA_NUMBERS = {
    "බින්දුවයි": "0", "බිංදුවයි": "0", "බින්දුව": "0", "බිංදුව": "0",
    "එක": "1", "එකයි": "1",
    "දෙක": "2", "දෙකයි": "2",
    "තුන": "3", "තුනයි": "3",
    "හතර": "4", "හතරයි": "4",
    "පහ": "5", "පහයි": "5",
    "හය": "6", "හයයි": "6",
    "හත": "7", "හතයි": "7",
    "අට": "8", "අටයි": "8",
    "නමය": "9", "නමයයි": "9", "නවය": "9", "නවයයි": "9",
    "දහය": "10", "දහයයි": "10",
}


def _normalize_tracking_id(raw_id: str) -> str:
    """Normalize a tracking ID, handling Sinhala numbers and various formats.

    Always produces the canonical format TRK-XXXX (with dash).
    Accepts: TRK-1001, TRK1001, TRK 1001, trk1001, Sinhala number words, etc.
    """
    cleaned = raw_id.lower()
    for word, digit in SINHALA_NUMBERS.items():
        cleaned = cleaned.replace(word, digit)

    # Remove all spaces and dashes, uppercase
    normalized = cleaned.upper().replace(" ", "").replace("-", "")

    # Extract the numeric part after TRK
    if normalized.startswith("TRK"):
        num_part = normalized[3:]
        # Always produce TRK-{digits} format
        if num_part.isdigit():
            return f"TRK-{num_part}"
        # Alphanumeric part (e.g. TRK-A1B2C3D4) — keep with dash
        return f"TRK-{num_part}"
    elif normalized.isdigit():
        return f"TRK-{normalized}"

    # Fallback — return as-is uppercased
    return normalized


# ---------------------------------------------------------------------------
# Database-backed tracking lookup
# ---------------------------------------------------------------------------

def _get_tracking_from_db(tracking_id: str) -> Optional[Dict[str, Any]]:
    """Query the real Shipment table via SQLAlchemy. Returns None on failure."""
    try:
        from app.database import SessionLocal
        from app.models.user import User  # noqa: F401 - relationship resolution
        from app.models.voice_auth import VoiceEnrollment, VoiceProfile, VoiceVerification  # noqa: F401
        from app.models.shipment import Shipment

        db = SessionLocal()
        try:
            shipment = (
                db.query(Shipment)
                .filter(Shipment.tracking_number == tracking_id)
                .first()
            )
            if not shipment:
                return None
            # Build rich payload with Sinhala-friendly fields
            status_en = shipment.status or "Unknown"
            payload: Dict[str, Any] = {
                "tracking_id": shipment.tracking_number,
                "status": status_en,
                "status_sinhala": _translate_status(status_en),
                "sender_name": shipment.sender_name or "නොදනී",
                "sender_phone": shipment.sender_phone or "නොදනී",
                "receiver": shipment.receiver_name or "නොදනී",
                "receiver_phone": shipment.receiver_phone or "නොදනී",
                "pickup_address": shipment.pickup_address or "නොදනී",
                "delivery_address": shipment.delivery_address or "නොදනී",
                "package_weight_kg": shipment.package_weight,
                "package_type": shipment.package_type or "Standard",
                "description": shipment.description or "විස්තරයක් නැත",
                "package_location": getattr(shipment, 'package_location', None) or "නොදනී",
                "payment_status": getattr(shipment, 'payment_status', None) or "නොදනී",
                "not_answered_count": getattr(shipment, 'not_answered_count', 0) or 0,
                "created_date": _format_date_sinhala(shipment.created_at),
                "last_update": _format_date_sinhala(
                    getattr(shipment, 'updated_at', None) or shipment.created_at
                ),
            }
            if shipment.estimated_delivery:
                payload["estimated_delivery"] = _format_date_sinhala(shipment.estimated_delivery)
            if shipment.courier_id:
                from app.models.user import User
                courier = db.query(User).filter(User.id == shipment.courier_id).first()
                if courier:
                    payload["rider"] = courier.full_name
            return payload
        finally:
            db.close()
    except Exception as exc:
        logger.warning("DB lookup failed for %s: %s. Falling back to mock.", tracking_id, exc)
        return None


# ---------------------------------------------------------------------------
# Tool functions exposed to Gemini
# ---------------------------------------------------------------------------

def get_tracking_status(tracking_id: str) -> Dict[str, Any]:
    """Return parcel status for a given tracking ID from the database."""
    normalized_id = _normalize_tracking_id(tracking_id)

    db_result = _get_tracking_from_db(normalized_id)
    if db_result is not None:
        return db_result

    return {"tracking_id": normalized_id, "status": "Not Found"}


def calculate_shipping_rate(
    origin_city: str, destination_city: str, weight_kg: float
) -> Dict[str, Any]:
    """Compute shipping cost: Rs. 400 for first 1kg + Rs. 100 per additional kg."""
    try:
        normalized_weight = max(float(weight_kg), 0.1)
    except (ValueError, TypeError):
        raise ValueError("weight_kg must be a numeric value")

    # First 1kg = Rs. 400, each additional kg = Rs. 100
    if normalized_weight <= 1.0:
        base_cost = FIRST_KG_RATE_LKR
    else:
        import math
        additional_kgs = math.ceil(normalized_weight - 1.0)
        base_cost = FIRST_KG_RATE_LKR + (ADDITIONAL_KG_RATE_LKR * additional_kgs)

    destination_key = destination_city.lower().strip()
    origin_key = origin_city.lower().strip()
    remote_fee = REMOTE_SURCHARGE_LKR if destination_key in REMOTE_CITY_SURCHARGE else 0
    same_city_discount = -50 if origin_key == destination_key else 0
    total = round(base_cost + remote_fee + same_city_discount, 2)
    return {
        "origin_city": origin_city,
        "destination_city": destination_city,
        "weight_kg": normalized_weight,
        "first_kg_charge": FIRST_KG_RATE_LKR,
        "additional_kg_charge": ADDITIONAL_KG_RATE_LKR if normalized_weight > 1.0 else 0,
        "is_remote_destination": bool(remote_fee),
        "remote_surcharge": remote_fee,
        "same_city_discount_applied": bool(same_city_discount),
        "total_lkr": total,
    }


def reschedule_delivery(tracking_id: str, new_date: str) -> Dict[str, Any]:
    """Update the targeted delivery date for a tracking ID.

    Validations:
    - Date must be valid ISO format (YYYY-MM-DD)
    - Date must not be in the past
    - Date must not be more than 30 days in the future
    - Already-delivered parcels cannot be rescheduled
    """
    normalized_id = _normalize_tracking_id(tracking_id)

    # --- Date format validation ---
    try:
        parsed_date = datetime.fromisoformat(new_date).date()
    except ValueError:
        return {
            "tracking_id": normalized_id,
            "error": "දිනය වලංගු නැත. කරුණාකර YYYY-MM-DD ආකෘතියෙන් දිනය ලබාදෙන්න.",
        }

    today = datetime.now(timezone.utc).date()

    if parsed_date < today:
        return {
            "tracking_id": normalized_id,
            "error": f"අතීත දිනයකට ({parsed_date.isoformat()}) නැවත සැලසුම් කළ නොහැක. කරුණාකර අනාගත දිනයක් තෝරන්න.",
        }

    max_future = today + timedelta(days=30)
    if parsed_date > max_future:
        return {
            "tracking_id": normalized_id,
            "error": f"දින 30 කට වඩා ඉදිරි දිනයකට නැවත සැලසුම් කළ නොහැක. උපරිම දිනය: {max_future.isoformat()}",
        }

    # ── Try real database ──
    try:
        from app.database import SessionLocal
        from app.models.user import User  # noqa: F401
        from app.models.voice_auth import VoiceEnrollment, VoiceProfile, VoiceVerification  # noqa: F401
        from app.models.shipment import Shipment as ShipmentModel

        db_session = SessionLocal()
        try:
            shipment = (
                db_session.query(ShipmentModel)
                .filter(ShipmentModel.tracking_number == normalized_id)
                .first()
            )
            if shipment:
                if (shipment.status or "").lower() == "delivered":
                    return {
                        "tracking_id": normalized_id,
                        "error": "මෙම පාර්සලය දැනටමත් බෙදා හැර ඇත. බෙදාහැරීම නැවත සැලසුම් කළ නොහැක.",
                    }
                parsed_date_str = parsed_date.isoformat()
                shipment.estimated_delivery = datetime.fromisoformat(parsed_date_str)
                db_session.commit()
                return {
                    "tracking_id": normalized_id,
                    "status": shipment.status or "Unknown",
                    "rescheduled_for": parsed_date_str,
                }
            else:
                return {"tracking_id": normalized_id, "status": "Not Found"}
        finally:
            db_session.close()
    except Exception as exc:
        logger.error("DB reschedule failed for %s: %s", normalized_id, exc)
        return {"tracking_id": normalized_id, "error": str(exc)}


# ---------------------------------------------------------------------------
# Gemini tools & model
# ---------------------------------------------------------------------------

def build_tools() -> List[genai_types.Tool]:
    """Define Gemini function schemas for tool calling."""
    get_status_fn = genai_types.FunctionDeclaration(
        name="get_tracking_status",
        description="Lookup a Smart Postal tracking ID and return its latest status",
        parameters={
            "type": "object",
            "properties": {
                "tracking_id": {
                    "type": "string",
                    "description": "Tracking number (e.g. TRK-1001)",
                }
            },
            "required": ["tracking_id"],
        },
    )

    calc_rate_fn = genai_types.FunctionDeclaration(
        name="calculate_shipping_rate",
        description="Calculate parcel shipping cost in LKR",
        parameters={
            "type": "object",
            "properties": {
                "origin_city": {"type": "string", "description": "Pickup city"},
                "destination_city": {"type": "string", "description": "Drop-off city"},
                "weight_kg": {"type": "number", "description": "Weight in kilograms"},
            },
            "required": ["origin_city", "destination_city", "weight_kg"],
        },
    )

    reschedule_fn = genai_types.FunctionDeclaration(
        name="reschedule_delivery",
        description=(
            "Update a delivery date for an existing tracking ID. "
            "Date must be YYYY-MM-DD, not past, within 30 days, parcel not delivered."
        ),
        parameters={
            "type": "object",
            "properties": {
                "tracking_id": {"type": "string", "description": "Tracking number"},
                "new_date": {
                    "type": "string",
                    "description": "Preferred delivery date (YYYY-MM-DD)",
                },
            },
            "required": ["tracking_id", "new_date"],
        },
    )

    return [genai_types.Tool(function_declarations=[get_status_fn, calc_rate_fn, reschedule_fn])]


def initialize_model() -> Dict[str, Any]:
    """Initialize Google Genai client, resolve model, and build tools.

    Returns a dict with 'client', 'model_name', and 'tools' that callers use
    to create chat sessions via create_chat_session().
    """
    load_env()
    model_name = resolve_model_name()
    tools = build_tools()
    return {"client": _GENAI_CLIENT, "model_name": model_name, "tools": tools}


def create_chat_session(init_data: Dict[str, Any], history=None) -> Any:
    """Create a new chat session using the google-genai SDK."""
    config = genai_types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT,
        tools=init_data["tools"],
        temperature=0.3,
        max_output_tokens=50,
        safety_settings=[
            genai_types.SafetySetting(category="HARM_CATEGORY_HARASSMENT", threshold="OFF"),
            genai_types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH", threshold="OFF"),
            genai_types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold="OFF"),
            genai_types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT", threshold="OFF"),
        ],
    )
    kwargs = {"model": init_data["model_name"], "config": config}
    if history:
        kwargs["history"] = history
    return init_data["client"].chats.create(**kwargs)


# ---------------------------------------------------------------------------
# Chat helpers
# ---------------------------------------------------------------------------

def get_history_turn_limit() -> int:
    try:
        return max(int(os.getenv("COURIERBOT_HISTORY_TURNS", "8")), 1)
    except ValueError:
        return 8


def get_request_cooldown() -> float:
    try:
        return max(float(os.getenv("COURIERBOT_REQUEST_COOLDOWN", "0.75")), 0.0)
    except ValueError:
        return 0.75


FUNCTION_MAP: Dict[str, Callable[..., Dict[str, Any]]] = {
    "get_tracking_status": get_tracking_status,
    "calculate_shipping_rate": calculate_shipping_rate,
    "reschedule_delivery": reschedule_delivery,
}


def enforce_request_cooldown() -> None:
    cooldown = get_request_cooldown()
    if cooldown <= 0:
        return
    global _LAST_GEN_CALL_TS
    now = time.monotonic()
    elapsed = now - _LAST_GEN_CALL_TS
    if elapsed < cooldown:
        time.sleep(cooldown - elapsed)
    _LAST_GEN_CALL_TS = time.monotonic()


def trim_chat_history(init_data: Dict[str, Any], chat: Any) -> Any:
    history = getattr(chat, "history", None) or getattr(chat, "_history", [])
    max_messages = get_history_turn_limit() * 2
    if not history or len(history) <= max_messages:
        return chat
    trimmed_history = list(history[-max_messages:])
    return create_chat_session(init_data, trimmed_history)


def execute_function_call(function_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
    handler = FUNCTION_MAP.get(function_name)
    if handler is None:
        raise ValueError(f"Function {function_name} is not implemented")
    return handler(**arguments)


def extract_function_call(response: Any) -> Optional[tuple[str, Dict[str, Any]]]:
    candidates = getattr(response, "candidates", [])
    for candidate in candidates:
        for part in candidate.content.parts:
            fn_call = getattr(part, "function_call", None)
            if fn_call:
                args = dict(fn_call.args or {})
                return fn_call.name, args
    return None


def handle_model_turn(init_data: Dict[str, Any], chat: Any, user_text: str) -> Tuple[str, Any]:
    """Send user input to Gemini and resolve any tool calls."""
    enforce_request_cooldown()
    response = chat.send_message(user_text)

    while True:
        function_call = extract_function_call(response)
        if not function_call:
            break
        fn_name, fn_args = function_call
        logger.info("Gemini requested function %s with args %s", fn_name, fn_args)
        try:
            result = execute_function_call(fn_name, fn_args)
        except Exception as exc:
            result = {"error": str(exc)}
        enforce_request_cooldown()
        response = chat.send_message(
            genai_types.Part.from_function_response(
                name=fn_name,
                response=result,
            )
        )

    final_text = ""
    candidates = getattr(response, "candidates", [])
    if candidates:
        candidate = candidates[0]
        finish_reason = getattr(candidate, "finish_reason", None)

        if finish_reason == 2:  # SAFETY
            final_text = "සමාවෙන්න, ඔබේ tracking ID එක නැවත කියන්න පුළුවන්ද?"
        elif finish_reason == 3:  # RECITATION
            final_text = "මට මේ පිළිතුර දීමට නොහැක. වෙනත් උදව්වක් අවශ්‍යද?"
        elif hasattr(candidate.content, "parts") and candidate.content.parts:
            for part in candidate.content.parts:
                if hasattr(part, "text") and part.text:
                    final_text += part.text
        else:
            final_text = "මට මොකක්ද කියලා තව පැහැදිලි කරන්න."
    else:
        final_text = "මට මොකක්ද කියලා තව පැහැදිලි කරන්න."

    updated_chat = trim_chat_history(init_data, chat)
    fallback = "මට මොකක්ද කියලා තව පැහැදිලි කරන්න."
    return (final_text or fallback), updated_chat
