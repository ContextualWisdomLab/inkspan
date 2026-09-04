from __future__ import annotations

import pytest

import inkspan_office.safe_renderer as safe_renderer
from inkspan_office import OfficeDocumentError


def test_invalid_page_layout_is_rejected_before_content_render(monkeypatch: pytest.MonkeyPatch) -> None:
    """Reject a known-invalid layout before building the complete DOCX body."""

    def unexpected_render(_payload: object) -> object:
        raise AssertionError("content renderer must not run for an invalid page layout")

    monkeypatch.setattr(
        safe_renderer._renderer,
        "render_office_document",
        unexpected_render,
    )

    with pytest.raises(
        OfficeDocumentError,
        match=r"page_layout\.margins_mm\.top must be between 0 and 100",
    ):
        safe_renderer.render_office_document(
            {
                "format": "docx",
                "page_layout": {
                    "paper_size": "a4",
                    "orientation": "portrait",
                    "margins_mm": {
                        "top": -1,
                        "right": 10,
                        "bottom": 10,
                        "left": 10,
                    },
                },
                "blocks": [{"type": "paragraph", "text": "must not render"}],
            }
        )
