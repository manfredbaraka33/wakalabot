"""
Instagram DM integration via Meta Graph API.

Flow:
  Merchant → connects Instagram Business account via OAuth → we store page token
  Customer → DMs the business on Instagram → Meta POSTs to our webhook
  Webhook → routes to correct tenant → AI engine processes → reply sent via Graph API

Webhook URL: https://wakalabot.co.tz/api/v1/instagram/webhook
OAuth callback: https://wakalabot.co.tz/api/v1/instagram/callback
"""
import logging
import re
import uuid
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse, RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_tenant
from app.core import settings
from app.db import get_db
from app.models import Tenant, Conversation
from app.services import ai_engine

# Import the wallet check and mode resolver from api.py
from app.api import _check_wallet, _resolve_ai_mode

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/instagram", tags=["instagram"])

META_API = "https://graph.facebook.com/v19.0"


# ── Meta API helpers ──────────────────────────────────────────────────────────

async def _exchange_code(code: str) -> str:
    """Exchange OAuth code for a short-lived user access token."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            f"{META_API}/oauth/access_token",
            params={
                "client_id": settings.META_APP_ID,
                "client_secret": settings.META_APP_SECRET,
                "redirect_uri": f"{settings.APP_URL}/api/v1/instagram/callback",
                "code": code,
            }
        )
        resp.raise_for_status()
        return resp.json()["access_token"]


async def _extend_token(short_token: str) -> str:
    """Exchange short-lived token for a 60-day long-lived token."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            f"{META_API}/oauth/access_token",
            params={
                "grant_type": "fb_exchange_token",
                "client_id": settings.META_APP_ID,
                "client_secret": settings.META_APP_SECRET,
                "fb_exchange_token": short_token,
            }
        )
        resp.raise_for_status()
        return resp.json()["access_token"]


async def _get_pages(user_token: str) -> list:
    """Get all Facebook Pages this user manages, with Instagram accounts linked."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            f"{META_API}/me/accounts",
            params={
                "access_token": user_token,
                "fields": "id,name,access_token,instagram_business_account",
            }
        )
        resp.raise_for_status()
        return resp.json().get("data", [])


async def _subscribe_page(page_id: str, page_token: str) -> bool:
    """Subscribe a Page to our app so webhook events start flowing."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            f"{META_API}/{page_id}/subscribed_apps",
            params={
                "subscribed_fields": "messages,messaging_postbacks",
                "access_token": page_token,
            }
        )
        return resp.status_code == 200


async def _unsubscribe_page(page_id: str, page_token: str) -> bool:
    """Remove app subscription from a Page on disconnect."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.delete(
            f"{META_API}/{page_id}/subscribed_apps",
            params={"access_token": page_token}
        )
        return resp.status_code == 200


async def _send_reply(page_id: str, page_token: str, recipient_id: str, text: str) -> bool:
    """Send an Instagram DM reply via the Messenger Platform API."""
    # Instagram enforces a 1000-character limit on DM text
    text = text[:1000]
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            f"{META_API}/{page_id}/messages",
            json={
                "recipient": {"id": recipient_id},
                "message": {"text": text},
                "messaging_type": "RESPONSE",
            },
            params={"access_token": page_token}
        )
        if resp.status_code != 200:
            logger.warning(f"Instagram send failed [{resp.status_code}]: {resp.text}")
            return False
        return True


# ── Webhook — GET (Meta verification) ────────────────────────────────────────

@router.get("/webhook")
async def verify_webhook(
    hub_mode: str = Query(default="", alias="hub.mode"),
    hub_challenge: str = Query(default="", alias="hub.challenge"),
    hub_verify_token: str = Query(default="", alias="hub.verify_token"),
):
    """
    Meta calls this endpoint once when you register the webhook in the developer console.
    It passes the verify token you set, and expects the challenge echoed back as plain text.
    If the token doesn't match, we return 403 and Meta will reject the webhook registration.
    """
    if hub_mode == "subscribe" and hub_verify_token == settings.META_VERIFY_TOKEN:
        return PlainTextResponse(hub_challenge)
    logger.warning(f"Webhook verification failed — received token: {hub_verify_token}")
    raise HTTPException(status_code=403, detail="Webhook verification failed")


# ── Webhook — POST (incoming DMs) ─────────────────────────────────────────────

@router.post("/webhook")
async def handle_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Meta POSTs every Instagram DM event here.
    We identify which tenant it belongs to via the page_id,
    run the message through the AI engine, and reply immediately.
    Must return 200 quickly — Meta will retry if we take more than 20 seconds.
    """
    body = await request.json()

    # Meta sends both 'instagram' and 'page' objects — handle both
    if body.get("object") not in ("instagram", "page"):
        return {"status": "ignored"}

    for entry in body.get("entry", []):
        page_id = str(entry.get("id", ""))
        if not page_id:
            continue

        # Find which tenant owns this page
        result = await db.execute(
            select(Tenant).where(Tenant.instagram_page_id == page_id)
        )
        tenant = result.scalar_one_or_none()
        if not tenant:
            logger.debug(f"No tenant found for Instagram page_id: {page_id}")
            continue

        for event in entry.get("messaging", []):
            sender_id = event.get("sender", {}).get("id", "")
            message = event.get("message", {})
            text = (message.get("text") or "").strip()

            # Skip echoes (messages the Page itself sent) and empty messages
            if not text or message.get("is_echo"):
                continue

            # Skip if sender is the page itself (avoid infinite loops)
            if sender_id == page_id:
                continue

            # Customer identifier — Instagram sender PSID
            customer_phone = f"ig_{sender_id}"

            try:
                # Wallet/subscription check — same as web chat
                await _check_wallet(tenant.id, db)
                effective_mode = await _resolve_ai_mode(tenant, db)

                reply, tools_used, new_msg = await ai_engine.get_answer(
                    db=db,
                    user_input=text,
                    tenant_id=tenant.id,
                    customer_phone=customer_phone,
                    customer_name=None,
                    biz_name=tenant.biz_name,
                    ai_mode=effective_mode,
                    is_guest=True,  # Instagram users are always guests — no verified phone
                )

                # Tag the conversation as Instagram-sourced
                conv_result = await db.execute(
                    select(Conversation).where(
                        Conversation.tenant_id == tenant.id,
                        Conversation.customer_phone == customer_phone,
                    )
                )
                conv = conv_result.scalar_one_or_none()
                if conv and conv.channel != "instagram":
                    conv.channel = "instagram"
                    await db.commit()

                # Strip [IMAGE_URL:...] tags — Instagram DM can't render them
                clean_reply = re.sub(r'\[IMAGE_URL:[^\]]+\]', '', reply).strip()
                if not clean_reply:
                    clean_reply = "Samahani, kuna tatizo. Tafadhali jaribu tena."

                await _send_reply(
                    page_id=page_id,
                    page_token=tenant.instagram_access_token,
                    recipient_id=sender_id,
                    text=clean_reply,
                )

            except HTTPException as e:
                if e.status_code == 402:
                    # Wallet empty — send one specific message, don't crash
                    await _send_reply(
                        page_id=page_id,
                        page_token=tenant.instagram_access_token,
                        recipient_id=sender_id,
                        text="Samahani, huduma hii haipo kwa sasa. Tafadhali wasiliana na biashara moja kwa moja.",
                    )
                else:
                    logger.error(f"Instagram webhook HTTP error for tenant {tenant.id}: {e.detail}")
            except Exception:
                logger.exception(f"Instagram webhook unhandled error for tenant {tenant.id}")

    # Always return 200 — Meta will spam retries if we return anything else
    return {"status": "ok"}


# ── OAuth connect flow ────────────────────────────────────────────────────────

@router.get("/connect")
async def connect_start(
    tenant: Tenant = Depends(get_current_tenant),
):
    """
    Merchant clicks 'Connect Instagram' in Shop Settings.
    We redirect them to Meta OAuth to grant permissions.
    The state parameter carries their tenant ID so we know who's connecting on callback.
    """
    oauth_url = (
        "https://www.facebook.com/v19.0/dialog/oauth"
        f"?client_id={settings.META_APP_ID}"
        f"&redirect_uri={settings.APP_URL}/api/v1/instagram/callback"
        f"&scope=instagram_manage_messages,pages_messaging,"
        f"pages_read_engagement,pages_manage_metadata"
        f"&state={tenant.id}"
        f"&response_type=code"
    )
    return RedirectResponse(oauth_url)


@router.get("/callback")
async def connect_callback(
    code: str = Query(...),
    state: str = Query(...),
    error: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """
    Meta redirects here after the merchant approves (or denies) the OAuth request.
    We exchange the code for tokens, find their Instagram-connected Page, and store everything.
    """
    dashboard_url = f"{settings.APP_URL}/dashboard/settings"

    # User denied — redirect back with error flag
    if error:
        logger.warning(f"Instagram OAuth denied for state={state}: {error}")
        return RedirectResponse(f"{dashboard_url}?ig_error=denied")

    try:
        tenant_id = uuid.UUID(state)
    except ValueError:
        return RedirectResponse(f"{dashboard_url}?ig_error=invalid_state")

    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        return RedirectResponse(f"{dashboard_url}?ig_error=tenant_not_found")

    try:
        # Step 1: Short-lived user token
        short_token = await _exchange_code(code)

        # Step 2: Extend to 60-day token
        long_token = await _extend_token(short_token)

        # Step 3: Get all Pages this user manages
        pages = await _get_pages(long_token)

        # Step 4: Find a Page that has Instagram Business Account connected
        target_page = None
        ig_account_id = None
        for page in pages:
            if page.get("instagram_business_account"):
                target_page = page
                ig_account_id = page["instagram_business_account"]["id"]
                break

        if not target_page:
            logger.warning(f"No Instagram Business Account found for tenant {tenant_id}")
            return RedirectResponse(
                f"{dashboard_url}?ig_error=no_instagram_business_account"
            )

        # Step 5: Subscribe the page to our webhook
        subscribed = await _subscribe_page(
            page_id=target_page["id"],
            page_token=target_page["access_token"],
        )
        if not subscribed:
            logger.warning(f"Failed to subscribe page {target_page['id']} to webhook")
            # Don't block — subscription can be retried, credentials are still valid

        # Step 6: Store everything
        tenant.instagram_page_id = target_page["id"]
        tenant.instagram_access_token = target_page["access_token"]
        tenant.instagram_account_id = ig_account_id
        await db.commit()

        logger.info(
            f"Instagram connected for tenant {tenant_id}: "
            f"page={target_page['id']}, ig_account={ig_account_id}"
        )
        return RedirectResponse(f"{dashboard_url}?ig_connected=1")

    except httpx.HTTPStatusError as e:
        logger.error(f"Meta API error during Instagram connect for tenant {tenant_id}: {e}")
        return RedirectResponse(f"{dashboard_url}?ig_error=meta_api_error")
    except Exception:
        logger.exception(f"Unexpected error during Instagram connect for tenant {tenant_id}")
        return RedirectResponse(f"{dashboard_url}?ig_error=unknown")


# ── Status and disconnect ─────────────────────────────────────────────────────

@router.get("/status")
async def instagram_status(
    tenant: Tenant = Depends(get_current_tenant),
) -> dict:
    if not tenant.instagram_page_id:
        return {"connected": False}
    return {
        "connected": True,
        "page_id": tenant.instagram_page_id,
        "account_id": tenant.instagram_account_id,
    }


@router.delete("/disconnect")
async def instagram_disconnect(
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if tenant.instagram_page_id and tenant.instagram_access_token:
        try:
            await _unsubscribe_page(
                page_id=tenant.instagram_page_id,
                page_token=tenant.instagram_access_token,
            )
        except Exception:
            pass  # Best effort — even if unsubscribe fails, we clear local credentials

    tenant.instagram_page_id = None
    tenant.instagram_access_token = None
    tenant.instagram_account_id = None
    await db.commit()
    return {"status": "disconnected"}