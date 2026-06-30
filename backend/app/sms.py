"""
NextSMS integration — sends transactional SMS to tenants.
"""
import base64
import logging
import httpx

from app.core import settings

logger = logging.getLogger(__name__)

NEXTSMS_URL = "https://messaging-service.co.tz/api/sms/v1/text/single"


def _auth_header() -> str:
    creds = f"{settings.NEXTSMS_USERNAME}:{settings.NEXTSMS_PASSWORD}"
    return "Basic " + base64.b64encode(creds.encode()).decode()


async def send_sms(to_phone: str, message: str) -> bool:
    """Send a single SMS via NextSMS. Returns True on success, never raises —
    SMS failures should never crash the calling flow (lead saving, billing, etc)."""
    if not settings.NEXTSMS_USERNAME or not to_phone:
        return False

    # Normalize phone — NextSMS expects 255XXXXXXXXX format, no plus, no leading zero
    clean_phone = to_phone.strip().replace("+", "").replace(" ", "")
    if clean_phone.startswith("0"):
        clean_phone = "255" + clean_phone[1:]
    elif not clean_phone.startswith("255"):
        clean_phone = "255" + clean_phone

    payload = {
        "from": settings.NEXTSMS_SENDER_ID,
        "to": clean_phone,
        "text": message,
    }
    headers = {
        "Authorization": _auth_header(),
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(NEXTSMS_URL, json=payload, headers=headers)
            if resp.status_code in (200, 201):
                return True
            logger.warning(f"NextSMS failed [{resp.status_code}]: {resp.text}")
            return False
    except Exception as e:
        logger.error(f"NextSMS error: {e}")
        return False