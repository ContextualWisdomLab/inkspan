"""Contract tests for strict informative inline PNG figures in DOCX output."""

from __future__ import annotations

import base64
from io import BytesIO
from pathlib import Path
from zipfile import ZipFile

import pytest
from docx import Document

from inkspan_office import (
    OfficeDocumentError,
    load_schema,
    render_office_document,
    write_office_document,
)


_PNG_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlXkWQAAAAASUVORK5CYII="
)
_PNG_DATA_URI = "data:image/png;base64," + base64.b64encode(_PNG_BYTES).decode("ascii")
_MAX_IMAGE_BYTES = 10 * 1024 * 1024
_MAX_BASE64_CHARACTERS = ((_MAX_IMAGE_BYTES + 2) // 3) * 4


def _png_header(width: int, height: int) -> bytes:
    """Build the bounded PNG signature and IHDR prefix used for failure fixtures."""

    return (
        b"\x89PNG\r\n\x1a\n"
        + (13).to_bytes(4, "big")
        + b"IHDR"
        + width.to_bytes(4, "big")
        + height.to_bytes(4, "big")
    )


def _data_uri(payload: bytes) -> str:
    """Encode deterministic test bytes as the exact supported inline PNG URL form."""

    return "data:image/png;base64," + base64.b64encode(payload).decode("ascii")


def _request(**overrides: object) -> dict[str, object]:
    """Build one valid informative-image request with selected field overrides."""

    image: dict[str, object] = {
        "type": "image",
        "source": _PNG_DATA_URI,
        "alt_text": "One-pixel integrity fixture",
        "width_px": 96,
    }
    image.update(overrides)
    return {"format": "docx", "blocks": [image]}


def test_docx_contract_accepts_one_strict_inline_png_figure() -> None:
    """A valid image block must survive schema, renderer, and OOXML package inspection."""

    schema = load_schema()
    image_branches = [
        branch
        for branch in schema["$defs"]["docxBlock"]["oneOf"]
        if branch.get("properties", {}).get("type", {}).get("const") == "image"
    ]
    assert len(image_branches) == 1
    image_schema = image_branches[0]
    assert image_schema["required"] == ["type", "source", "alt_text", "width_px"]
    assert image_schema["additionalProperties"] is False
    assert image_schema["properties"]["source"]["pattern"].startswith(
        "^data:image/png;base64,"
    )

    rendered = render_office_document(_request())
    repeated = render_office_document(_request())
    assert repeated.data == rendered.data

    document = Document(BytesIO(rendered.data))
    assert len(document.inline_shapes) == 1
    shape = document.inline_shapes[0]
    assert shape.width > 0
    assert shape.height > 0
    assert shape.width == 96 * 9_525
    assert shape.height == 96 * 9_525

    with ZipFile(BytesIO(rendered.data), "r") as package:
        image_parts = [name for name in package.namelist() if name.startswith("word/media/")]
        assert len(image_parts) == 1
        assert package.read(image_parts[0]) == _PNG_BYTES
        document_xml = package.read("word/document.xml").decode("utf-8")
        assert 'descr="One-pixel integrity fixture"' in document_xml


def test_docx_image_rejects_unknown_and_decorative_fields() -> None:
    """P0 must reject undeclared or fake decorative-image semantics."""

    with pytest.raises(OfficeDocumentError, match="blocks\\[0\\] has unexpected field"):
        render_office_document(_request(decorative=True))


def test_docx_image_requires_source_alt_text_and_width() -> None:
    """Every informative figure must declare source, accessible text, and explicit width."""

    for missing in ("source", "alt_text", "width_px"):
        request = _request()
        del request["blocks"][0][missing]  # type: ignore[index]
        with pytest.raises(OfficeDocumentError, match=rf"{missing} is required"):
            render_office_document(request)

    with pytest.raises(OfficeDocumentError, match="source must be a string"):
        render_office_document(_request(source=123))
    with pytest.raises(OfficeDocumentError, match="alt_text must be a string"):
        render_office_document(_request(alt_text=123))
    with pytest.raises(OfficeDocumentError, match="alt_text must not be empty"):
        render_office_document(_request(alt_text=" \t"))
    with pytest.raises(OfficeDocumentError, match="at most 1000"):
        render_office_document(_request(alt_text="a" * 1001))
    with pytest.raises(OfficeDocumentError, match="width_px must be an integer"):
        render_office_document(_request(width_px=True))
    with pytest.raises(OfficeDocumentError, match="between 1 and 2400"):
        render_office_document(_request(width_px=0))
    with pytest.raises(OfficeDocumentError, match="between 1 and 2400"):
        render_office_document(_request(width_px=2401))


def test_docx_image_rejects_non_png_and_non_strict_data_urls() -> None:
    """The P0 image boundary must not acquire path, remote, SVG, JPEG, or loose data-URL input."""

    invalid_sources = [
        "https://example.invalid/figure.png",
        "file:///tmp/figure.png",
        "data:image/jpeg;base64,AA==",
        "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
        "data:image/png;charset=utf-8;base64,AA==",
        "data:image/png,%89PNG",
    ]
    for source in invalid_sources:
        with pytest.raises(OfficeDocumentError, match="inline data:image/png;base64 URL"):
            render_office_document(_request(source=source))

    with pytest.raises(OfficeDocumentError, match="PNG payload exceeds"):
        render_office_document(_request(source="data:image/png;base64,"))
    with pytest.raises(OfficeDocumentError, match="strict base64 PNG data"):
        render_office_document(_request(source="data:image/png;base64,not base64!"))


def test_docx_image_enforces_encoded_and_decoded_byte_budgets() -> None:
    """Both the pre-decode character ceiling and exact decoded-byte ceiling must fail closed."""

    too_many_encoded_characters = (
        "data:image/png;base64," + "A" * (_MAX_BASE64_CHARACTERS + 1)
    )
    with pytest.raises(OfficeDocumentError, match="PNG payload exceeds"):
        render_office_document(_request(source=too_many_encoded_characters))

    # 10 MiB is congruent to 1 modulo 3, so 10 MiB + 1 byte has the same
    # base64 character length as the allowed maximum and reaches the exact
    # post-decode byte guard instead of the cheaper encoded-length guard.
    one_byte_over_decoded_limit = b"x" * (_MAX_IMAGE_BYTES + 1)
    assert len(base64.b64encode(one_byte_over_decoded_limit)) == _MAX_BASE64_CHARACTERS
    with pytest.raises(OfficeDocumentError, match="PNG payload exceeds"):
        render_office_document(_request(source=_data_uri(one_byte_over_decoded_limit)))


def test_docx_image_rejects_malformed_and_unsafe_png_dimensions() -> None:
    """PNG signature, IHDR, positive bounds, dimensions, and pixels must fail closed."""

    malformed = [
        b"not a png",
        b"\x89PNG\r\n\x1a\n" + (12).to_bytes(4, "big") + b"IHDR" + b"\x00" * 8,
        b"\x89PNG\r\n\x1a\n" + (13).to_bytes(4, "big") + b"NOPE" + b"\x00" * 8,
    ]
    for payload in malformed:
        with pytest.raises(OfficeDocumentError, match="supported PNG image"):
            render_office_document(_request(source=_data_uri(payload)))

    with pytest.raises(OfficeDocumentError, match="dimensions must be positive"):
        render_office_document(_request(source=_data_uri(_png_header(0, 1))))
    with pytest.raises(OfficeDocumentError, match="dimensions exceed"):
        render_office_document(_request(source=_data_uri(_png_header(10_001, 1))))
    with pytest.raises(OfficeDocumentError, match="pixel count exceeds"):
        render_office_document(_request(source=_data_uri(_png_header(8_000, 8_000))))

    # The bounded header can be structurally plausible while the actual image is
    # incomplete. The third-party parser must remain behind the same redacted
    # public error boundary rather than leaking its parser exception.
    with pytest.raises(OfficeDocumentError, match="supported PNG image"):
        render_office_document(_request(source=_data_uri(_png_header(1, 1))))


def test_docx_image_errors_do_not_reflect_source_and_failed_write_publishes_nothing(
    tmp_path: Path,
) -> None:
    """Image failures must be redacted and must not publish a partial DOCX artifact."""

    secret_source = "data:image/png;base64,customer-secret-not-base64"
    output = tmp_path / "report.docx"
    with pytest.raises(OfficeDocumentError) as captured:
        write_office_document(_request(source=secret_source), output)
    assert secret_source not in str(captured.value)
    assert "customer-secret" not in str(captured.value)
    assert not output.exists()
