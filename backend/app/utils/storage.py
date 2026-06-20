"""
Cloudinary image upload utility.
Uploads product images to the wakalabot/products/ folder
and returns the secure HTTPS URL.
"""
import asyncio
from typing import Optional

import cloudinary
import cloudinary.uploader
from fastapi import UploadFile

from app.core import settings

# Configure Cloudinary once at import time
cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET,
    secure=True,
)

ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


async def upload_image(file: UploadFile, folder: str = "wakalabot/products") -> str:
    """Upload an image file to Cloudinary and return its secure_url.

    Raises ValueError for invalid file type or size.
    """
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise ValueError(
            f"Unsupported image type '{file.content_type}'. "
            "Allowed: JPEG, PNG, WebP, GIF."
        )

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise ValueError("Image file exceeds the 5 MB limit.")

    # cloudinary.uploader.upload is synchronous — run in a thread
    result = await asyncio.to_thread(
        cloudinary.uploader.upload,
        contents,
        folder=folder,
        resource_type="image",
    )
    return result["secure_url"]


async def delete_image(public_id: str) -> None:
    """Delete an image from Cloudinary by its public_id (best-effort)."""
    await asyncio.to_thread(
        cloudinary.uploader.destroy,
        public_id,
        resource_type="image",
    )


def public_id_from_url(url: Optional[str]) -> Optional[str]:
    """Extract Cloudinary public_id from a secure_url (for deletion)."""
    if not url or "cloudinary.com" not in url:
        return None
    # e.g. https://res.cloudinary.com/<cloud>/image/upload/v123/wakalabot/products/abc.jpg
    # public_id = wakalabot/products/abc  (no extension)
    try:
        parts = url.split("/upload/")
        path = parts[1]
        # Strip version segment v<digits>/
        if path.startswith("v") and "/" in path:
            path = path.split("/", 1)[1]
        # Strip file extension
        if "." in path.rsplit("/", 1)[-1]:
            path = path.rsplit(".", 1)[0]
        return path
    except Exception:
        return None


def optimise_url(url: Optional[str]) -> Optional[str]:
    """Inject f_auto,q_auto into a Cloudinary URL for low-bandwidth delivery.

    Converts:
      .../image/upload/v123/...
    Into:
      .../image/upload/f_auto,q_auto/v123/...

    Non-Cloudinary URLs are returned unchanged.
    """
    if not url or "cloudinary.com" not in url:
        return url
    if "f_auto,q_auto" in url:
        return url  # already optimised
    try:
        prefix, rest = url.split("/upload/", 1)
        return f"{prefix}/upload/f_auto,q_auto/{rest}"
    except ValueError:
        return url
