from __future__ import annotations

from io import BytesIO

from docx import Document

from inkspan_office import render_office_document


def test_omitted_page_layout_preserves_python_docx_default_section() -> None:
    """Prove omission keeps the pre-existing template/default page setup untouched."""

    rendered = render_office_document(
        {
            "format": "docx",
            "blocks": [{"type": "paragraph", "text": "Default layout"}],
        }
    )

    actual = Document(BytesIO(rendered.data)).sections[0]
    expected = Document().sections[0]

    assert actual.orientation == expected.orientation
    assert actual.page_width == expected.page_width
    assert actual.page_height == expected.page_height
    assert actual.top_margin == expected.top_margin
    assert actual.right_margin == expected.right_margin
    assert actual.bottom_margin == expected.bottom_margin
    assert actual.left_margin == expected.left_margin
