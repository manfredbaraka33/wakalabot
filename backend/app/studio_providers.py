"""Gemini calls for Studio: planning/moderation (text or voice), scene generation,
model discovery, and audio conversion."""
import asyncio
import base64
import io
import json
import logging
import tempfile
import time
from pathlib import Path

from google import genai
from google.genai import types
from PIL import Image

from app import studio_config
from app.core import settings
from app.studio_templates import PALETTE_IDS

logger = logging.getLogger("studio.providers")
_client = genai.Client(api_key=settings.GEMINI_API_KEY)


class ProviderError(Exception):
    """Message is safe to show to the user; detail is for the admin test screen."""
    def __init__(self, message: str, detail: str = ""):
        super().__init__(message)
        self.detail = detail


class JobRejected(Exception):
    """Content-policy refusal. Message is safe to show to the user."""


POLICY = (
    "Kataa (safe=false) kama ombi linahusu: picha za watu halisi au kuiga sura/sauti ya mtu halisi; "
    "maudhui ya ngono au uchi; watoto katika mazingira yasiyofaa; siasa, uchaguzi au viongozi wa kisiasa; "
    "chuki, vurugu, silaha; dawa, matibabu au madai ya kiafya; mipango ya uwekezaji/pesa za haraka; "
    "bidhaa haramu au kudanganya wateja; nembo au wahusika wa chapa za wengine. "
    "Matangazo ya kawaida ya bidhaa na huduma ni salama."
)


def _parse_json(text: str) -> dict:
    text = (text or "").strip()
    try:
        return json.loads(text)
    except Exception:
        s, e = text.find("{"), text.rfind("}")
        if s != -1 and e > s:
            try:
                return json.loads(text[s:e + 1])
            except Exception:
                pass
    raise ProviderError("AI haikurudisha jibu sahihi. Jaribu tena.")


# ── Planning + moderation ─────────────────────────────────────────────────────
async def make_plan(*, text: str = "", audio: bytes | None = None, has_photo: bool = False) -> dict:
    styles = ", ".join(f'"{s}"' for s in PALETTE_IDS)
    instruction = (
        "Wewe ni msanifu wa matangazo kwa wafanyabiashara wa Tanzania. Soma maelezo ya mtumiaji "
        f"({'sauti iliyorekodiwa' if audio else 'maandishi'}) na utoe JSON TU yenye funguo hizi:\n"
        '- "safe": true au false\n'
        '- "reason": sababu fupi kwa Kiswahili (tupu kama safe ni true)\n'
        '- "transcript": alichosema/alichoandika mtumiaji, kama kilivyo\n'
        '- "product": jina la bidhaa/huduma (tupu kama halijatajwa), maneno machache\n'
        '- "price": bei kwa tarakimu tu, mf. "25000" (tupu kama haijatajwa)\n'
        '- "offer": ofa fupi isiyozidi herufi 22, mf. "Punguzo 20%" (tupu kama hakuna)\n'
        '- "headline": kichwa cha tangazo kwa Kiswahili cha mtaani, maneno 3 hadi 7, bila emoji\n'
        f'- "style": mojawapo ya {styles} inayofaa bidhaa (mf. "waridi" kwa urembo, "bahari" kwa vifaa vya kisasa)\n'
        '- "visual_prompt": maelezo ya Kiingereza (sentensi 1-3) ya MANDHARI ya tangazo tu: '
        "mazingira, rangi, mwanga, hisia. Bila maandishi, herufi, nembo, wala nyuso za watu halisi. "
        f"{'Bidhaa ya mtumiaji itawekwa kwenye mandhari kutoka kwenye picha aliyopakia.' if has_photo else 'Elezea pia bidhaa kuu.'}\n\n"
        f"Sheria za maudhui: {POLICY}"
    )
    parts = [types.Part.from_text(text=instruction)]
    if audio:
        parts.append(types.Part.from_bytes(data=audio, mime_type="audio/mp3"))
    else:
        parts.append(types.Part.from_text(text=f"Maelezo ya mtumiaji:\n{text.strip()}"))

    try:
        resp = await _client.aio.models.generate_content(
            model=settings.STUDIO_TEXT_MODEL,
            contents=[types.Content(role="user", parts=parts)],
            config=types.GenerateContentConfig(temperature=0.6, max_output_tokens=700,
                                               response_mime_type="application/json"),
        )
    except Exception as e:
        logger.warning("make_plan failed: %s", e)
        raise ProviderError("Huduma ya AI haipatikani kwa sasa. Jaribu tena baadaye.", str(e)[:200])

    plan = _parse_json(resp.text or "")
    return {
        "safe": bool(plan.get("safe", False)),
        "reason": str(plan.get("reason") or "")[:200],
        "transcript": str(plan.get("transcript") or "")[:600],
        "product": str(plan.get("product") or "")[:60],
        "price": "".join(ch for ch in str(plan.get("price") or "") if ch.isdigit())[:12],
        "offer": str(plan.get("offer") or "")[:22],
        "headline": str(plan.get("headline") or "").strip().strip('"')[:60],
        "style": plan.get("style") if plan.get("style") in PALETTE_IDS else "giza",
        "visual_prompt": str(plan.get("visual_prompt") or "")[:600],
    }


# ── Image generation ──────────────────────────────────────────────────────────
def _image_config(aspect: str | None):
    kwargs: dict = {"response_modalities": ["TEXT", "IMAGE"]}
    ImageConfig = getattr(types, "ImageConfig", None)
    if aspect and ImageConfig:
        try:
            kwargs["image_config"] = ImageConfig(aspect_ratio=aspect)
        except Exception:
            pass
    try:
        return types.GenerateContentConfig(**kwargs)
    except Exception:
        kwargs.pop("image_config", None)
        return types.GenerateContentConfig(**kwargs)


def _extract_image(resp) -> Image.Image | None:
    for cand in resp.candidates or []:
        for part in (cand.content.parts if cand.content else []) or []:
            inline = getattr(part, "inline_data", None)
            if inline and inline.data:
                return Image.open(io.BytesIO(inline.data)).convert("RGB")
    return None


def _finish_reason(resp) -> str:
    try:
        return str(resp.candidates[0].finish_reason or "")
    except Exception:
        return ""


async def _generate(model: str, prompt: str, fmt: str, reference: bytes | None) -> Image.Image:
    aspect = "9:16" if fmt == "story" else "1:1"
    contents: list = [prompt]
    if reference:
        contents = [
            types.Part.from_bytes(data=reference, mime_type="image/jpeg"),
            prompt + " Keep the product from the provided photo exactly as it appears "
                     "(same shape, colour and branding) and place it naturally in the scene.",
        ]

    use_cfg, last = True, ""
    for attempt in range(3):
        try:
            resp = await asyncio.wait_for(
                _client.aio.models.generate_content(
                    model=model, contents=contents, config=_image_config(aspect if use_cfg else None)),
                timeout=90,
            )
            img = _extract_image(resp)
            if img is not None:
                return img
            reason = _finish_reason(resp).upper()
            if "SAFETY" in reason or "PROHIBITED" in reason:
                raise ProviderError("Mandhari hii imekataliwa na mfumo wa usalama wa AI. Badilisha maelezo.", reason)
            raise ProviderError("AI haikurudisha picha. Jaribu maelezo tofauti.", reason or "no image in response")
        except ProviderError:
            raise
        except asyncio.TimeoutError:
            last = "timeout"
        except Exception as e:
            last = f"{type(e).__name__}: {e}"
            low = last.lower()
            transient = any(k in low for k in ("429", "500", "503", "unavailable", "overloaded", "deadline", "timeout"))
            if not transient:
                if use_cfg and ("image_config" in low or "aspect" in low or "invalid" in low):
                    use_cfg = False            # this model rejects aspect settings: retry once without them
                    continue
                break
        await asyncio.sleep(2 * (attempt + 1))

    logger.warning("image generation failed (%s): %s", model, last)
    raise ProviderError("Imeshindwa kutengeneza picha ya AI. Credits zimerudishwa.", last[:300])


async def generate_scene(visual_prompt: str, fmt: str, reference: bytes | None) -> Image.Image:
    model = studio_config.image_model()
    if not model:
        raise ProviderError("AI ya picha haijachaguliwa bado. Credits zimerudishwa; wasiliana na support.")
    if not visual_prompt:
        raise ProviderError("Maelezo hayatoshi kutengeneza picha. Jaribu kuelezea zaidi.")
    orientation = "vertical 9:16 composition" if fmt == "story" else "square 1:1 composition"
    prompt = (
        f"{visual_prompt}. Professional advertising photograph, {orientation}, rich lighting, "
        "leave calm empty space near the top and bottom for text overlays. "
        "ABSOLUTELY NO text, letters, numbers, logos or watermarks anywhere in the image."
    )
    return await _generate(model, prompt, fmt, reference)


# ── Model discovery + test (admin screen) ─────────────────────────────────────
def _rank(model_id: str) -> int:
    s = model_id.lower()
    return 0 if "lite" in s else 1 if "flash" in s else 3 if "pro" in s else 2


async def list_image_models() -> list[dict]:
    def collect():
        out = []
        for m in _client.models.list():
            mid = (getattr(m, "name", "") or "").replace("models/", "")
            low = mid.lower()
            if "image" not in low or "imagen" in low:
                continue
            actions = getattr(m, "supported_actions", None) or getattr(m, "supported_generation_methods", None) or []
            if actions and "generateContent" not in actions:
                continue
            out.append({"id": mid, "display_name": getattr(m, "display_name", "") or mid,
                        "description": (getattr(m, "description", "") or "")[:160]})
        return out

    try:
        models = await asyncio.to_thread(collect)
    except Exception as e:
        raise ProviderError("Imeshindwa kupata orodha ya models kutoka Google. Angalia GEMINI_API_KEY.", str(e)[:200])
    models.sort(key=lambda m: _rank(m["id"]))
    if models:
        models[0]["recommended"] = True
    return models


async def test_image_model(model: str) -> dict:
    t0 = time.monotonic()
    img = await _generate(model, "A ceramic coffee mug on a wooden table, soft morning light, "
                                 "shallow depth of field. No text.", "square", None)
    thumb = img.copy()
    thumb.thumbnail((360, 360))
    buf = io.BytesIO()
    thumb.save(buf, "JPEG", quality=80)
    return {
        "ok": True, "seconds": round(time.monotonic() - t0, 1), "width": img.width, "height": img.height,
        "preview": "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode(),
    }


# ── Audio ─────────────────────────────────────────────────────────────────────
async def to_mp3(raw: bytes) -> bytes:
    """Browsers record webm/mp4; Gemini wants mp3/wav. Capped at 60 seconds."""
    with tempfile.TemporaryDirectory() as tmp:
        src, dst = Path(tmp) / "in.bin", Path(tmp) / "out.mp3"
        src.write_bytes(raw)
        try:
            proc = await asyncio.create_subprocess_exec(
                "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(src),
                "-t", "60", "-ac", "1", "-ar", "16000", "-b:a", "48k", str(dst),
                stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL,
            )
            await asyncio.wait_for(proc.wait(), timeout=40)
        except FileNotFoundError:
            raise ProviderError("Seva haina ffmpeg. Wasiliana na support.")
        except asyncio.TimeoutError:
            raise ProviderError("Sauti imechukua muda mrefu kuchakatwa.")
        if not dst.exists() or dst.stat().st_size == 0:
            raise ProviderError("Sauti haikusomeka. Rekodi tena karibu na mdomo wa simu.")
        return dst.read_bytes()