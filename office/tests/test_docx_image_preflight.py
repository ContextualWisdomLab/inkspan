"""Regression coverage for the DOCX inline-PNG pre-decode resource boundary."""

from __future__ import annotations

import pytest

from inkspan_office import OfficeDocumentError, render_office_document


_DATA_URL_PREFIX = "data:image/png;base64,"
_MAX_IMAGE_BYTES = 10 * 1024 * 1024
_MAX_BASE64_CHARACTERS = ((_MAX_IMAGE_BYTES + 2) // 3) * 4


class _SliceGuardSource(str):
    """Fail if production slices the oversized base64 payload before preflight."""

    def __getitem__(self, key: object) -> str:
        if isinstance(key, slice) and key.start == len(_DATA_URL_PREFIX):
            raise AssertionError("oversized PNG payload was sliced before size preflight")
        return super().__getitem__(key)  # type: ignore[index]


def test_docx_image_rejects_oversized_source_before_payload_slice() -> None:
    """An impossible encoded payload must fail before allocating its suffix copy."""

    source = _SliceGuardSource(
        _DATA_URL_PREFIX + "A" * (_MAX_BASE64_CHARACTERS + 1)
    )
    request = {
        "format": "docx",
        "blocks": [
            {
                "type": "image",
                "source": source,
                "alt_text": "Oversized image fixture",
                "width_px": 96,
            }
        ],
    }

    with pytest.raises(OfficeDocumentError, match="PNG payload exceeds"):
        render_office_document(request)
