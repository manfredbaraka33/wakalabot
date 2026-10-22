"""Tiny persistent admin config (JSON file in storage/, survives deploys).
Lets the admin pick the image model from the screen instead of editing .env."""
import json
import os
import threading
from pathlib import Path

from app.core import settings

_PATH = Path(__file__).resolve().parent.parent / "storage" / "studio" / "config.json"
_lock = threading.Lock()


def _read() -> dict:
    try:
        return json.loads(_PATH.read_text("utf-8"))
    except Exception:
        return {}


def get(key: str, default=None):
    v = _read().get(key)
    return default if v in (None, "") else v


def set_many(**values) -> None:
    with _lock:
        data = _read()
        data.update(values)
        _PATH.parent.mkdir(parents=True, exist_ok=True)
        tmp = _PATH.with_suffix(".tmp")
        tmp.write_text(json.dumps(data), "utf-8")
        os.replace(tmp, _PATH)


def image_model() -> str:
    return str(get("image_model") or settings.STUDIO_IMAGE_MODEL or "")


def image_cost_usd() -> float:
    try:
        return float(get("image_cost_usd", settings.STUDIO_IMAGE_COST_USD))
    except (TypeError, ValueError):
        return float(settings.STUDIO_IMAGE_COST_USD)