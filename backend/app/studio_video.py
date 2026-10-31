"""Studio Video: motion product ads and persona (presenter) ads.
AI makes the motion (and the voice when a persona speaks). OUR engine writes every printed word
(price, phone, offer) on the end card, so the text is always spelled right."""
import asyncio
import base64
import io
import json
import logging
import re
import shutil
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Optional

from google import genai
from google.genai import types
from PIL import Image, ImageDraw
from sqlalchemy import select

from app.core import settings
from app.studio_credits import refund_job
from app.studio_draw import _F
from app.studio_models import CreatorJob
from app.studio_providers import ProviderError
from app.studio_templates import render_template, resolve_choice
from app.studio_worker import IN_DIR, OUT_DIR, SessionLocal, _now

logger = logging.getLogger("studio.video")
VIDEO_IN = IN_DIR.parent / "vin"

STYLES = [
    {"id": "zoom", "name": "Kuvuta Karibu", "hint": "Kamera inasogea polepole",
     "prompt": "Slow cinematic push-in toward the product, soft studio lighting, shallow depth of field, a gentle light sweep across its surface."},
    {"id": "zungusha", "name": "Zungusha", "hint": "Kamera inazunguka bidhaa",
     "prompt": "The camera slowly orbits around the product with smooth 3D parallax, soft reflections and clean studio lighting."},
    {"id": "mwanga", "name": "Rangi na Mwanga", "hint": "Cheche na rangi nyuma",
     "prompt": "Bursts of colorful light particles and soft glowing shapes move behind the product, energetic and glossy; the product stays sharp and centered."},
    {"id": "maisha", "name": "Katika Maisha", "hint": "Mazingira ya kawaida",
     "prompt": "The product sits in a natural lifestyle setting with gentle ambient motion such as moving light and soft shadows, and the camera drifts slowly."},
    {"id": "spotlight", "name": "Mwangaza Mkali", "hint": "Giza na mwanga wa kuvutia",
     "prompt": "Dramatic spotlight on a dark moody background, glints of light slowly sweeping over the product, premium luxury feel."},
    {"id": "kina", "name": "Kina", "hint": "Kina cha picha na bokeh",
     "prompt": "Subtle depth parallax camera move with floating dust particles and soft bokeh lights, calm and elegant."},
    {"id": "inapanda", "name": "Inapanda", "hint": "Bidhaa inaingia kwa nguvu",
     "prompt": "The product rises into frame with a gentle bounce and sparkles, a playful reveal with a smooth camera settle."},
    {"id": "fasta", "name": "Mwendo wa Fasta", "hint": "Haraka, kwa mitandao",
     "prompt": "Fast energetic social-media ad feel with quick camera pushes and whips, bright saturated colors, dynamic and punchy."},
]
STYLE_BY_ID = {s["id"]: s for s in STYLES}

PERSONAS = [
    {"id": "mama", "name": "Mama Biashara", "hint": "Mwanamke wa miaka 40, mkarimu",
     "desc": "a warm, friendly Tanzanian woman in her early 40s with neat colorful everyday clothes and a confident shopkeeper energy"},
    {"id": "kaka", "name": "Kaka Fasta", "hint": "Kijana wa mjini, mtanashati",
     "desc": "a stylish young Tanzanian man in his mid 20s in trendy casual streetwear, energetic and friendly"},
    {"id": "dada", "name": "Dada Mrembo", "hint": "Msichana wa miaka 20, mtindo wa urembo",
     "desc": "a beautiful young Tanzanian woman in her mid 20s with fresh natural makeup and a modern outfit, influencer vibe"},
    {"id": "mzee", "name": "Mzee Mzoefu", "hint": "Mzee anayeaminika",
     "desc": "a trustworthy Tanzanian man in his 50s with a kind face and a neat shirt, calm and confident"},
    {"id": "baba", "name": "Baba Kijana", "hint": "Baba wa miaka 30",
     "desc": "a friendly Tanzanian man in his early 30s in a smart casual shirt with an approachable smile"},
    {"id": "duka", "name": "Dada wa Duka", "hint": "Muuzaji mchangamfu",
     "desc": "a cheerful Tanzanian woman in her late 20s wearing a neat shop apron, welcoming and lively"},
]
PERSONA_BY_ID = {p["id"]: p for p in PERSONAS}

COMMON = ("Vertical 9:16 commercial product video. Keep the product exactly as in the photo: same shape, proportions, "
          "colors, material, labels and any printed text. Do not add any text, captions, logos, watermarks or people. ")

_client_obj = None
_gen_sem = asyncio.Semaphore(max(1, settings.STUDIO_VIDEO_CONCURRENCY))
_asm_sem = asyncio.Semaphore(1)
_tasks: set = set()


def _client():
    global _client_obj
    if _client_obj is None:
        _client_obj = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _client_obj


# ── prompts and text ──────────────────────────────────────────────────────────
def sanitize_line(text: str) -> str:
    t = re.sub(r"[\x00-\x1f\x7f]", " ", text or "").replace('"', "'")
    return " ".join(t.split())[:200]


def motion_prompt(style_id: str, audio: str, seconds: int = 8) -> str:
    st = STYLE_BY_ID.get(style_id, STYLES[0])
    snd = {"silent": "No dialogue and no music.",
           "music": "Include light upbeat modern background music. No dialogue."}.get(audio, "No dialogue.")
    return (f"<FIRST_FRAME> {st['prompt']} {COMMON}A single continuous shot with no scene cuts, "
            f"about {seconds} seconds long. {snd}")


def persona_prompt(line: str, audio: str, seconds: int = 8) -> str:
    base = (f"<FIRST_FRAME> A single continuous shot with no scene cuts, about {seconds} seconds long. "
            "The person looks at the camera, smiles and presents the product held in their hands with natural gestures, "
            "steady camera, soft daylight. Keep the product exactly as in the image. "
            "Do not add any on-screen text, captions, logos or watermarks. ")
    if audio == "voice":
        return base + (f'The person says in natural, conversational Tanzanian Swahili: "{line}" '
                       "Natural lip-sync and a clear voice. Only this sentence is spoken. No background music.")
    return base + "The person does not speak. No dialogue and no music."


async def moderate(text: str) -> tuple[bool, str]:
    prompt = (
        "You review text for an ad-video tool used by small sellers in Tanzania. Return JSON only: "
        '{"safe": true or false, "reason": "short reason in Swahili"}. '
        "Mark safe=false if the text contains or promotes: sexual or adult content, violence, hate or harassment, "
        "politics or election campaigning, medical claims or medicines, investment or get-rich-quick schemes, "
        "illegal goods, minors in unsafe contexts, impersonation of a real named person or celebrity, or another company's brand. "
        "Ordinary product names, prices, offers and friendly sales lines are safe."
    )

    def call():
        return _client().models.generate_content(
            model=settings.STUDIO_TEXT_MODEL, contents=prompt + "\n\nTEXT:\n" + text,
            config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0))

    try:
        data = json.loads((await asyncio.to_thread(call)).text)
        return bool(data.get("safe")), str(data.get("reason") or "")
    except Exception:
        logger.exception("video moderation failed")
        raise ProviderError("Hatuwezi kukagua maneno sasa. Jaribu tena baadaye.")


# ── model calls (the ONLY functions that talk to Google) ──────────────────────
def _gen_video(image_bytes: bytes, prompt: str, seconds: int, with_audio: bool, persona: bool) -> bytes:
    """Image-to-video with Gemini Omni through the Interactions API. Returns MP4 bytes."""
    client = _client()
    if not hasattr(client, "interactions"):
        raise ProviderError("google-genai ni ya zamani. Endesha: pip install -U google-genai")
    content = [
        {"type": "image", "data": base64.b64encode(image_bytes).decode(), "mime_type": "image/jpeg"},
        {"type": "text", "text": prompt},
    ]
    fmt = {"type": "video", "aspect_ratio": "9:16", "resolution": "720p"}
    if (settings.STUDIO_VIDEO_DELIVERY or "uri").lower() == "uri":
        fmt["delivery"] = "uri"
    cfg = {"video_config": {"task": "image_to_video"}}
    attempts = [
        dict(response_format=fmt, generation_config=cfg),
        dict(response_format=fmt),
        dict(response_format={"type": "video", "aspect_ratio": "9:16"}),
    ]
    interaction, last = None, None
    for kw in attempts:
        try:
            interaction = client.interactions.create(model=settings.STUDIO_VIDEO_MODEL, input=content, **kw)
            break
        except Exception as e:
            last = e
    if interaction is None:
        raise ProviderError(f"Modeli ya video imekataa ombi: {str(last)[:220]}")
    out = getattr(interaction, "output_video", None)
    if out is None:
        raise ProviderError("Modeli haikurudisha video (huenda picha au maelezo yamekataliwa).")
    data = getattr(out, "data", None)
    if data:
        return base64.b64decode(data)
    uri = getattr(out, "uri", None)
    if not uri:
        raise ProviderError("Video haikupatikana kwenye jibu la modeli.")
    m = re.search(r"files/([A-Za-z0-9_-]+)", uri)
    name = f"files/{m.group(1)}" if m else f"files/{uri.rstrip('/').split('/')[-1]}"
    t0 = time.time()
    while True:
        info = client.files.get(name=name)
        state = getattr(getattr(info, "state", None), "name", None) or str(getattr(info, "state", ""))
        if state == "ACTIVE":
            break
        if state == "FAILED":
            raise ProviderError("Modeli imeshindwa kutengeneza video.")
        if time.time() - t0 > 480:
            raise ProviderError("Video imechukua muda mrefu mno.")
        time.sleep(5)
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as f:
        tmp = f.name
    try:
        try:
            got = client.files.download(file=uri, destination=tmp)
        except TypeError:
            got = client.files.download(file=uri)
        if isinstance(got, (bytes, bytearray)) and got:
            return bytes(got)
        return Path(tmp).read_bytes()
    except Exception as e:
        raise ProviderError(f"Video imeshindwa kupakuliwa: {str(e)[:200]}")
    finally:
        Path(tmp).unlink(missing_ok=True)


def _persona_still(photo: bytes, persona: dict) -> bytes:
    """Nano Banana composes the presenter holding the seller's exact product. Returns JPEG bytes."""
    model = getattr(settings, "STUDIO_SHOT_MODEL", "gemini-nano-banana-2.1")
    prompt = (f"Create a photorealistic vertical 9:16 photo of {persona['desc']} (a fictional adult, not a real person) "
              "in a bright, clean, simple shop or home setting with soft daylight. "
              "The person holds the product from the reference photo in both hands toward the camera, smiling naturally. "
              "The product must look exactly like the reference: same shape, proportions, color, material, labels and printed text. "
              "Do not add any text, logos or watermarks.")
    configs = (
        types.GenerateContentConfig(response_modalities=["TEXT", "IMAGE"], image_config=types.ImageConfig(aspect_ratio="9:16")),
        types.GenerateContentConfig(response_modalities=["TEXT", "IMAGE"]),
    )
    last = None
    for cfg in configs:
        try:
            resp = _client().models.generate_content(
                model=model, contents=[types.Part.from_bytes(data=photo, mime_type="image/jpeg"), prompt], config=cfg)
            for part in (resp.candidates[0].content.parts or []):
                if getattr(part, "inline_data", None) and part.inline_data.data:
                    im = Image.open(io.BytesIO(part.inline_data.data)).convert("RGB")
                    out = io.BytesIO()
                    im.save(out, "JPEG", quality=92)
                    return out.getvalue()
            last = "no image in the reply"
        except Exception as e:
            last = e
    raise ProviderError(f"Picha ya mtu haikutengenezwa: {str(last)[:200]}")


def _tts_wav(text: str) -> bytes:
    if not settings.STUDIO_TTS_MODEL:
        raise ProviderError("Sauti ya maelezo haijawekwa.")
    resp = _client().models.generate_content(
        model=settings.STUDIO_TTS_MODEL, contents=text,
        config=types.GenerateContentConfig(
            response_modalities=["AUDIO"],
            speech_config=types.SpeechConfig(voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=settings.STUDIO_TTS_VOICE)))))
    try:
        pcm = resp.candidates[0].content.parts[0].inline_data.data
    except Exception:
        raise ProviderError("Sauti haikutengenezwa.")
    r = subprocess.run(["ffmpeg", "-y", "-nostdin", "-loglevel", "error", "-f", "s16le", "-ar", "24000", "-ac", "1",
                        "-i", "pipe:0", "-f", "wav", "pipe:1"], input=pcm, capture_output=True, timeout=60)
    if r.returncode:
        raise ProviderError("ffmpeg imeshindwa kubadilisha sauti.")
    return r.stdout


# ── ffmpeg ────────────────────────────────────────────────────────────────────
def _ff(args: list, timeout: int = 300) -> None:
    r = subprocess.run(["ffmpeg", "-y", "-nostdin", "-loglevel", "error", *args],
                       capture_output=True, text=True, timeout=timeout)
    if r.returncode:
        raise ProviderError("ffmpeg: " + (r.stderr or "")[-300:])


def probe_dur(path) -> float:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                       capture_output=True, text=True, timeout=30)
    try:
        return float(r.stdout.strip())
    except Exception:
        raise ProviderError("Faili ya video haisomeki.")


def has_audio(path) -> bool:
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=codec_type",
                        "-of", "csv=p=0", str(path)], capture_output=True, text=True, timeout=30)
    return "audio" in r.stdout


def assemble(clips: list, card_jpg, out, audio_mode: str, voice_wav=None, card_secs: float = 2.5) -> None:
    """clips -> 720x1280 -> + end card. audio_mode: silent | native | voiceover."""
    n = len(clips)
    durs = [probe_dur(c) for c in clips]
    total = sum(durs) + card_secs
    args = []
    for c in clips:
        args += ["-i", str(c)]
    args += ["-loop", "1", "-framerate", "30", "-t", str(card_secs), "-i", str(card_jpg)]
    if audio_mode == "voiceover":
        args += ["-i", str(voice_wav)]
    norm = "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,setsar=1,fps=30,format=yuv420p"
    fc = [f"[{i}:v]{norm}[v{i}]" for i in range(n)]
    fc.append(f"[{n}:v]{norm},fade=t=in:st=0:d=0.4[v{n}]")
    fc.append("".join(f"[v{i}]" for i in range(n + 1)) + f"concat=n={n + 1}:v=1:a=0[vc]")
    fc.append(f"[vc]fade=t=out:st={total - 0.3:.2f}:d=0.3[vout]")
    maps = ["-map", "[vout]"]
    if audio_mode == "native":
        for i in range(n):
            if has_audio(clips[i]):
                fc.append(f"[{i}:a]aformat=sample_rates=44100:channel_layouts=stereo,atrim=0:{durs[i]:.3f},"
                          f"asetpts=PTS-STARTPTS,apad=whole_dur={durs[i]:.3f}[a{i}]")
            else:
                fc.append(f"anullsrc=r=44100:cl=stereo,atrim=0:{durs[i]:.3f}[a{i}]")
        fc.append(f"anullsrc=r=44100:cl=stereo,atrim=0:{card_secs}[a{n}]")
        fc.append("".join(f"[a{i}]" for i in range(n + 1)) + f"concat=n={n + 1}:v=0:a=1[ac]")
        fc.append(f"[ac]afade=t=out:st={total - 0.8:.2f}:d=0.8[aout]")
        maps += ["-map", "[aout]"]
    elif audio_mode == "voiceover":
        fc.append(f"[{n + 1}:a]aformat=sample_rates=44100:channel_layouts=stereo,adelay=500|500,"
                  f"apad=whole_dur={total:.3f},atrim=0:{total:.3f},afade=t=out:st={total - 0.6:.2f}:d=0.6[aout]")
        maps += ["-map", "[aout]"]
    cmd = args + ["-filter_complex", ";".join(fc)] + maps + [
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "24", "-pix_fmt", "yuv420p", "-r", "30",
        "-movflags", "+faststart"]
    cmd += ["-c:a", "aac", "-b:a", "128k"] if audio_mode in ("native", "voiceover") else ["-an"]
    cmd += ["-t", f"{total:.2f}", "-threads", "2", str(out)]
    _ff(cmd)


# ── end card (our engine: correct Swahili text) ───────────────────────────────
def end_card_jpg(p: dict, photo_bytes: bytes, persona: bool) -> bytes:
    photo = Image.open(io.BytesIO(photo_bytes)).convert("RGB")
    tid, pid = resolve_choice(p.get("template"), p.get("palette"))
    headline = (p.get("headline") or p.get("product_name") or "").strip()[:60]
    jpg = render_template(tid, pid, photo, headline=headline, price=p.get("price", ""), offer=p.get("offer", ""),
                          biz=p.get("business_name", ""), phone=p.get("phone", ""), fmt="story", watermark=False)
    if persona:
        im = Image.open(io.BytesIO(jpg)).convert("RGB")
        d = ImageDraw.Draw(im)
        f = _F(24, False)
        txt = "Video imetengenezwa kwa AI"
        w = d.textlength(txt, font=f)
        d.text(((im.width - w) / 2, im.height - 64), txt, font=f, fill=(235, 235, 235), stroke_width=2, stroke_fill=(0, 0, 0))
        out = io.BytesIO()
        im.save(out, "JPEG", quality=92)
        jpg = out.getvalue()
    return jpg


def clip_seconds(n_photos: int, persona: bool) -> int:
    if persona:
        return 8
    base = int(settings.STUDIO_VIDEO_CLIP_SECONDS)
    return base if n_photos <= 1 else (6 if n_photos == 2 else 4)


# ── the job ───────────────────────────────────────────────────────────────────
async def _run(job_id, p: dict, owner) -> None:
    folder = VIDEO_IN / str(job_id)
    photos = [folder / f"photo{i}.jpg" for i in range(1, int(p.get("n_photos") or 1) + 1)]
    if not all(x.exists() for x in photos):
        if (OUT_DIR / f"{job_id}.mp4").exists():                  # already finished before a restart
            return
        raise ProviderError("Picha hazikupatikana.")
    persona = p.get("kind") == "persona"
    audio = p.get("audio", "silent")
    secs = clip_seconds(len(photos), persona)
    work = Path(tempfile.mkdtemp(prefix="vid_"))
    try:
        async def one_clip(i: int, photo_path: Path) -> Path:
            raw = photo_path.read_bytes()
            async with _gen_sem:
                if persona:
                    still = await asyncio.to_thread(_persona_still, raw, PERSONA_BY_ID.get(p.get("persona"), PERSONAS[0]))
                    data = await asyncio.to_thread(_gen_video, still, persona_prompt(p.get("line", ""), audio, secs), secs,
                                                   audio == "voice", True)
                else:
                    data = await asyncio.to_thread(_gen_video, raw, motion_prompt(p.get("style", "zoom"), audio, secs), secs,
                                                   audio == "music", False)
            target = work / f"clip{i}.mp4"
            target.write_bytes(data)
            return target

        clips = await asyncio.gather(*[one_clip(i, x) for i, x in enumerate(photos)])

        voice_wav = None
        if not persona and audio == "voice":
            wav = await asyncio.to_thread(_tts_wav, p.get("line", ""))
            voice_wav = work / "voice.wav"
            voice_wav.write_bytes(wav)
            if probe_dur(voice_wav) > secs * len(photos) + 2.0:
                raise ProviderError("Maneno ni mengi kwa video hii. Yapunguze.")

        card = work / "card.jpg"
        card.write_bytes(await asyncio.to_thread(end_card_jpg, p, photos[0].read_bytes(), persona))
        mode = "silent" if audio == "silent" else ("voiceover" if voice_wav else "native")
        out = work / "final.mp4"
        async with _asm_sem:
            await asyncio.to_thread(assemble, clips, card, out, mode, voice_wav)
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(out, OUT_DIR / f"{job_id}.mp4")
        api_cost = secs * len(photos) * float(settings.STUDIO_VIDEO_COST_PER_SEC_USD) + (0.04 if persona else 0) + (0.01 if voice_wav else 0)
        async with SessionLocal() as db:
            job = (await db.execute(select(CreatorJob).where(CreatorJob.id == job_id).with_for_update())).scalar_one()
            job.status, job.finished_at = "done", _now()
            job.result_path, job.api_cost_usd = f"out/{job_id}.mp4", api_cost
            job.result_meta = {"kind": p.get("kind"), "style": p.get("style"), "persona": p.get("persona"),
                               "audio": audio, "photos": len(photos), "seconds": secs * len(photos)}
            await db.commit()
    finally:
        shutil.rmtree(work, ignore_errors=True)


async def _fail(job_id, message: str) -> None:
    async with SessionLocal() as db:
        job = (await db.execute(select(CreatorJob).where(CreatorJob.id == job_id).with_for_update())).scalar_one_or_none()
        if job is None or job.status == "done":
            return
        job.status, job.finished_at = "failed", _now()
        if hasattr(job, "error"):
            job.error = message[:300]
        await refund_job(db, job, "Video haikukamilika")
        await db.commit()


async def _guarded(job_id, p: dict, owner) -> None:
    try:
        await asyncio.wait_for(_run(job_id, p, owner), timeout=1200)
    except ProviderError as e:
        logger.warning("video job %s failed: %s", job_id, e)
        await _fail(job_id, str(e))
    except Exception:
        logger.exception("video job %s crashed", job_id)
        await _fail(job_id, "Video imeshindwa. Credits zimerudishwa.")
    finally:
        shutil.rmtree(VIDEO_IN / str(job_id), ignore_errors=True)


def start_video_task(job_id, p: dict, owner) -> None:
    """Called by the poster worker. Runs the video in its own task so posters are never blocked."""
    t = asyncio.get_running_loop().create_task(_guarded(job_id, dict(p), owner))
    _tasks.add(t)
    t.add_done_callback(_tasks.discard)


def maintenance() -> None:
    """Hourly: drop leftover inputs and videos older than the retention period."""
    now = time.time()
    if VIDEO_IN.exists():
        for d in VIDEO_IN.iterdir():
            if d.is_dir() and now - d.stat().st_mtime > 6 * 3600:
                shutil.rmtree(d, ignore_errors=True)
    days = int(getattr(settings, "STUDIO_RETENTION_DAYS", 30))
    for f in OUT_DIR.glob("*.mp4"):
        if now - f.stat().st_mtime > days * 86400:
            f.unlink(missing_ok=True)