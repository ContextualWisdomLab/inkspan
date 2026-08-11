"""Regression coverage for DOCX inline-PNG pre-decode resource accounting."""

from __future__ import annotations

import pytest

from inkspan_office import OfficeDocumentError, render_office_document

_DATA_URL_PREFIX = "data:image/png;base64,"
_MAX_IMAGE_BYTES = 10 * 1024 * 1024
_MAX_BASE64_CHARACTERS = ((_MAX_IMAGE_BYTES + 2) // 3) * 4


class _RejectPayloadSlice(str):
    """Fail if production copies the oversized caller-controlled payload suffix."""

    def __getitem__(self, key: object) -> str:
        if isinstance(key, slice) and key.start == len(_DATA_URL_PREFIX):
            raise AssertionError("oversized PNG payload was sliced before rejection")
        return super().__getitem__(key)  # type: ignore[no-any-return]


def test_oversized_png_is_rejected_before_payload_suffix_slice() -> None:
    """A provably oversized data URL must fail before copying its payload suffix."""

    source = _RejectPayloadSlice(
        _DATA_URL_PREFIX + "A" * (_MAX_BASE64_CHARACTERS + 1)
    )
    payload = {
        "format": "docx",
        "blocks": [
            {
                "type": "image",
                "source": source,
                "alt_text": "bounded figure",
                "width_px": 96,
            }
        ],
    }

    with pytest.raises(OfficeDocumentError, match="PNG payload exceeds"):
        render_office_document(payload)
