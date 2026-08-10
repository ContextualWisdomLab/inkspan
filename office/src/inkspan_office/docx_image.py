"""Validate and append bounded informative PNG figures to DOCX documents."""

from __future__ import annotations

import base64
import binascii
from collections.abc import Mapping
from io import BytesIO
from typing import Any

from docx.shared import Emu

_DATA_URL_PREFIX = "data:image/png;base64,"
_PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
_PNG_IHDR_LENGTH = 13
_MAX_IMAGE_BYTES = 10 * 1024 * 1024
_MAX_IMAGE_DIMENSION = 10_000
_MAX_IMAGE_PIXELS = 40_000_000
_MAX_ALT_TEXT_LENGTH = 1_000
_MAX_WIDTH_PX = 2_400
_MAX_BASE64_CHARACTERS = ((_MAX_IMAGE_BYTES + 2) // 3) * 4
_EMUS_PER_CSS_PIXEL = 9_525


class DocxImageContractError(ValueError):
    """Raised when an inline DOCX image violates the bounded image contract."""


def add_docx_inline_png(document: Any, block: Mapping[str, Any], path: str) -> None:
    """Validate one informative PNG block and append it as an inline Word picture."""

    source = _required_string(block, "source", path)
    alt_text = _required_string(block, "alt_text", path)
    if len(alt_text) > _MAX_ALT_TEXT_LENGTH:
        raise DocxImageContractError(
            f"{path}.alt_text must contain at most {_MAX_ALT_TEXT_LENGTH} characters"
        )
    width_px = _required_integer(block, "width_px", path, 1, _MAX_WIDTH_PX)
    image_bytes = _decode_inline_png(source, path)
    width, height = _png_dimensions(image_bytes, path)
    if width > _MAX_IMAGE_DIMENSION or height > _MAX_IMAGE_DIMENSION:
        raise DocxImageContractError(
            f"{path}.source PNG dimensions exceed the supported image boundary"
        )
    if width * height > _MAX_IMAGE_PIXELS:
        raise DocxImageContractError(
            f"{path}.source PNG pixel count exceeds the supported image boundary"
        )

    try:
        inline_shape = document.add_picture(
            BytesIO(image_bytes),
            width=Emu(width_px * _EMUS_PER_CSS_PIXEL),
        )
    except Exception as exc:
        raise DocxImageContractError(
            f"{path}.source must contain a supported PNG image"
        ) from exc
    inline_shape._inline.docPr.set("descr", alt_text)  # type: ignore[attr-defined]


def _decode_inline_png(source: str, path: str) -> bytes:
    """Decode one exact RFC-2397-style PNG data URL without accepting variants."""

    if not source.startswith(_DATA_URL_PREFIX):
        raise DocxImageContractError(
            f"{path}.source must be an inline data:image/png;base64 URL"
        )
    encoded = source[len(_DATA_URL_PREFIX) :]
    if not encoded or len(encoded) > _MAX_BASE64_CHARACTERS:
        raise DocxImageContractError(
            f"{path}.source PNG payload exceeds the supported image boundary"
        )
    try:
        image_bytes = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise DocxImageContractError(
            f"{path}.source must contain strict base64 PNG data"
        ) from exc
    if not image_bytes or len(image_bytes) > _MAX_IMAGE_BYTES:
        raise DocxImageContractError(
            f"{path}.source PNG payload exceeds the supported image boundary"
        )
    return image_bytes


def _png_dimensions(image_bytes: bytes, path: str) -> tuple[int, int]:
    """Read bounded PNG IHDR dimensions without decoding raster pixel content."""

    if (
        len(image_bytes) < 24
        or image_bytes[:8] != _PNG_SIGNATURE
        or int.from_bytes(image_bytes[8:12], "big") != _PNG_IHDR_LENGTH
        or image_bytes[12:16] != b"IHDR"
    ):
        raise DocxImageContractError(
            f"{path}.source must contain a supported PNG image"
        )
    width = int.from_bytes(image_bytes[16:20], "big")
    height = int.from_bytes(image_bytes[20:24], "big")
    if width == 0 or height == 0:
        raise DocxImageContractError(
            f"{path}.source PNG dimensions must be positive"
        )
    return width, height


def _required_string(block: Mapping[str, Any], key: str, path: str) -> str:
    """Return one required non-empty string without reflecting its value in errors."""

    if key not in block:
        raise DocxImageContractError(f"{path}.{key} is required")
    value = block[key]
    if not isinstance(value, str):
        raise DocxImageContractError(f"{path}.{key} must be a string")
    if not value.strip():
        raise DocxImageContractError(f"{path}.{key} must not be empty")
    return value


def _required_integer(
    block: Mapping[str, Any],
    key: str,
    path: str,
    minimum: int,
    maximum: int,
) -> int:
    """Return one required non-boolean integer inside an inclusive range."""

    if key not in block:
        raise DocxImageContractError(f"{path}.{key} is required")
    value = block[key]
    if not isinstance(value, int) or isinstance(value, bool):
        raise DocxImageContractError(f"{path}.{key} must be an integer")
    if value < minimum or value > maximum:
        raise DocxImageContractError(
            f"{path}.{key} must be between {minimum} and {maximum}"
        )
    return value
