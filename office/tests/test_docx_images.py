"""Contract tests for strict inline raster figures in DOCX output."""

from __future__ import annotations

from io import BytesIO

from docx import Document

from inkspan_office import load_schema, render_office_document


_PNG_DATA_URI = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlXkWQAAAAASUVORK5CYII="
)


def test_docx_contract_accepts_one_strict_inline_png_figure() -> None:
    """A valid image block must survive the public schema and DOCX renderer."""

    schema = load_schema()
    image_branches = [
        branch
        for branch in schema["$defs"]["docxBlock"]["oneOf"]
        if branch.get("properties", {}).get("type", {}).get("const") == "image"
    ]
    assert len(image_branches) == 1

    rendered = render_office_document(
        {
            "format": "docx",
            "blocks": [
                {
                    "type": "image",
                    "source": _PNG_DATA_URI,
                    "alt_text": "One-pixel integrity fixture",
                    "width_px": 96,
                }
            ],
        }
    )

    document = Document(BytesIO(rendered.data))
    assert len(document.inline_shapes) == 1
    assert document.inline_shapes[0].width > 0
    assert document.inline_shapes[0].height > 0
