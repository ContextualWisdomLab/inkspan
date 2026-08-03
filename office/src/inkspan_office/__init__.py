"""Deterministic Office document rendering for AI-authored Inkspan payloads."""

from .renderer import (
    OfficeDocumentError,
    RenderedOfficeDocument,
    load_schema,
    render_office_document,
    write_office_document,
)

__all__ = [
    "OfficeDocumentError",
    "RenderedOfficeDocument",
    "load_schema",
    "render_office_document",
    "write_office_document",
]
