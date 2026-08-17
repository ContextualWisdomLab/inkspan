"""Apply the bounded deterministic page-layout contract to one DOCX package."""

from __future__ import annotations

from collections.abc import Mapping
from io import BytesIO
from typing import Any

from docx import Document
from docx.enum.section import WD_ORIENT
from docx.shared import Inches, Mm

from .renderer import OfficeDocumentError

_ALLOWED_PAPER_SIZES = {"a4", "letter"}
_ALLOWED_ORIENTATIONS = {"portrait", "landscape"}
_MARGIN_NAMES = ("top", "right", "bottom", "left")


def normalize_docx_page_layout(value: Any) -> dict[str, object]:
    """Validate and detach one bounded page-layout value before DOCX rendering."""

    try:
        return _normalize_docx_page_layout(value)
    except OfficeDocumentError:
        raise
    except Exception:
        raise OfficeDocumentError("page_layout is invalid") from None


def _normalize_docx_page_layout(value: Any) -> dict[str, object]:
    """Validate one page-layout mapping after entering the redaction boundary."""

    layout = _mapping(value, "page_layout")
    _reject_unknown(
        layout,
        {"paper_size", "orientation", "margins_mm"},
        "page_layout",
    )
    paper_size = _enum_string(
        _require(layout, "paper_size", "page_layout"),
        "page_layout.paper_size",
        _ALLOWED_PAPER_SIZES,
    )
    orientation = _enum_string(
        _require(layout, "orientation", "page_layout"),
        "page_layout.orientation",
        _ALLOWED_ORIENTATIONS,
    )
    margins = _mapping(
        _require(layout, "margins_mm", "page_layout"),
        "page_layout.margins_mm",
    )
    _reject_unknown(margins, set(_MARGIN_NAMES), "page_layout.margins_mm")
    normalized_margins = {
        name: _bounded_integer(
            _require(margins, name, "page_layout.margins_mm"),
            f"page_layout.margins_mm.{name}",
            minimum=0,
            maximum=100,
        )
        for name in _MARGIN_NAMES
    }
    return {
        "paper_size": paper_size,
        "orientation": orientation,
        "margins_mm": normalized_margins,
    }


def apply_docx_page_layout(data: bytes, value: Any) -> bytes:
    """Return DOCX bytes with one validated page layout applied to its sole section."""

    layout = normalize_docx_page_layout(value)
    paper_size = layout["paper_size"]
    orientation = layout["orientation"]
    normalized_margins = layout["margins_mm"]
    assert isinstance(paper_size, str)
    assert isinstance(orientation, str)
    assert isinstance(normalized_margins, dict)

    document = Document(BytesIO(data))
    if len(document.sections) != 1:
        raise OfficeDocumentError("page_layout requires exactly one DOCX section")
    section = document.sections[0]
    portrait_width, portrait_height = _paper_dimensions(paper_size)
    if orientation == "landscape":
        section.orientation = WD_ORIENT.LANDSCAPE
        section.page_width = portrait_height
        section.page_height = portrait_width
    else:
        section.orientation = WD_ORIENT.PORTRAIT
        section.page_width = portrait_width
        section.page_height = portrait_height

    section.top_margin = Mm(normalized_margins["top"])
    section.right_margin = Mm(normalized_margins["right"])
    section.bottom_margin = Mm(normalized_margins["bottom"])
    section.left_margin = Mm(normalized_margins["left"])

    output = BytesIO()
    document.save(output)
    return output.getvalue()


def _paper_dimensions(paper_size: str) -> tuple[int, int]:
    """Return portrait page width and height for one supported paper size."""

    if paper_size == "a4":
        return Mm(210), Mm(297)
    return Inches(8.5), Inches(11)


def _mapping(value: Any, path: str) -> Mapping[str, Any]:
    """Validate a mapping container used by the page-layout contract."""

    if not isinstance(value, Mapping):
        raise OfficeDocumentError(f"{path} must be an object")
    return value


def _require(mapping: Mapping[str, Any], key: str, path: str) -> Any:
    """Return one required field or raise a path-qualified contract error."""

    if key not in mapping:
        raise OfficeDocumentError(f"{path}.{key} is required")
    return mapping[key]


def _reject_unknown(mapping: Mapping[str, Any], allowed: set[str], path: str) -> None:
    """Bound key scanning while rejecting undeclared page-layout fields."""

    unexpected_count = 0
    seen: set[str] = set()
    for key in mapping:
        if not isinstance(key, str):
            raise OfficeDocumentError(f"{path} object keys must be strings")
        if key in seen:
            raise OfficeDocumentError(f"{path} has unexpected fields")
        seen.add(key)
        if key not in allowed:
            unexpected_count += 1
            if unexpected_count == 2:
                raise OfficeDocumentError(f"{path} has unexpected fields")
    if unexpected_count == 1:
        raise OfficeDocumentError(f"{path} has unexpected field")


def _enum_string(value: Any, path: str, allowed: set[str]) -> str:
    """Validate one exact lower-case string enumeration value."""

    if not isinstance(value, str):
        raise OfficeDocumentError(f"{path} must be a string")
    if value not in allowed:
        options = ", ".join(sorted(allowed))
        raise OfficeDocumentError(f"{path} must be one of: {options}")
    return value


def _bounded_integer(
    value: Any,
    path: str,
    *,
    minimum: int,
    maximum: int,
) -> int:
    """Validate one non-boolean integer inside an inclusive page-layout bound."""

    if not isinstance(value, int) or isinstance(value, bool):
        raise OfficeDocumentError(f"{path} must be an integer")
    if value < minimum or value > maximum:
        raise OfficeDocumentError(f"{path} must be between {minimum} and {maximum}")
    return value
