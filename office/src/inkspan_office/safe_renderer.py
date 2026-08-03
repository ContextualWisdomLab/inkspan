"""Public safety facade for deterministic Office document rendering."""

from __future__ import annotations

import os
import re
from collections.abc import Mapping, Sequence
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any

from openpyxl.utils import column_index_from_string

from . import renderer as _renderer

OfficeDocumentError = _renderer.OfficeDocumentError
RenderedOfficeDocument = _renderer.RenderedOfficeDocument

_INVALID_XML_CHARACTER = re.compile(
    r"[\x00-\x08\x0B\x0C\x0E-\x1F\uD800-\uDFFF\uFFFE\uFFFF]"
)
_EXCEL_COORDINATE = re.compile(r"^([A-Za-z]{1,3})([1-9][0-9]{0,6})$")
_EXCEL_MAX_ROWS = 1_048_576
_EXCEL_MAX_COLUMNS = 16_384
_EXCEL_MAX_TEXT_LENGTH = 32_767
_EXCEL_MAX_SIGNIFICANT_DIGITS = 15


def load_schema() -> dict[str, Any]:
    """Load the bundled machine-readable Office request contract."""

    return _renderer.load_schema()


def render_office_document(payload: Mapping[str, Any]) -> RenderedOfficeDocument:
    """Validate safety invariants before delegating format-specific rendering."""

    _validate_request(payload)
    return _renderer.render_office_document(payload)


def write_office_document(
    payload: Mapping[str, Any],
    output_path: str | Path,
    *,
    overwrite: bool = False,
) -> Path:
    """Render and atomically publish an Office file without overwrite races."""

    rendered = render_office_document(payload)
    path = Path(output_path)
    if path.suffix.lower() != rendered.extension:
        raise OfficeDocumentError(
            f"output extension must be {rendered.extension}, got {path.suffix or '<none>'}"
        )
    if path.exists() and not overwrite:
        raise FileExistsError(f"output already exists: {path}")

    path.parent.mkdir(parents=True, exist_ok=True)
    with NamedTemporaryFile(
        mode="wb",
        prefix=f".{path.name}.",
        suffix=".tmp",
        dir=path.parent,
        delete=False,
    ) as handle:
        handle.write(rendered.data)
        temporary = Path(handle.name)
    try:
        if overwrite:
            temporary.replace(path)
        else:
            try:
                os.link(temporary, path)
            except FileExistsError as exc:
                raise FileExistsError(f"output already exists: {path}") from exc
    finally:
        temporary.unlink(missing_ok=True)
    return path


def _validate_request(payload: Any) -> None:
    """Apply cross-format text safety and XLSX storage-bound validation."""

    _validate_xml_tree(payload, "payload", set())
    if isinstance(payload, Mapping) and payload.get("format") == "xlsx":
        _validate_xlsx(payload)


def _validate_xml_tree(value: Any, path: str, active: set[int]) -> None:
    """Reject XML-invalid text while detecting cyclic non-JSON containers."""

    if isinstance(value, str):
        _validate_xml_text(value, path)
        return
    if isinstance(value, Mapping):
        identity = id(value)
        if identity in active:
            raise OfficeDocumentError(f"{path} contains a cyclic object reference")
        active.add(identity)
        try:
            for key, child in value.items():
                child_path = f"{path}.{key}" if isinstance(key, str) else path
                _validate_xml_tree(child, child_path, active)
        finally:
            active.remove(identity)
        return
    if isinstance(value, Sequence) and not isinstance(value, (bytes, bytearray)):
        identity = id(value)
        if identity in active:
            raise OfficeDocumentError(f"{path} contains a cyclic array reference")
        active.add(identity)
        try:
            for index, child in enumerate(value):
                _validate_xml_tree(child, f"{path}[{index}]", active)
        finally:
            active.remove(identity)


def _validate_xml_text(value: str, path: str) -> None:
    """Reject characters forbidden by the XML 1.0 character production."""

    match = _INVALID_XML_CHARACTER.search(value)
    if match is not None:
        codepoint = ord(match.group())
        raise OfficeDocumentError(
            f"{path} contains XML-incompatible character U+{codepoint:04X}"
        )


def _validate_xlsx(payload: Mapping[str, Any]) -> None:
    """Reject workbook content that Excel would truncate, round, or misaddress."""

    sheets = payload.get("sheets")
    if not isinstance(sheets, Sequence) or isinstance(sheets, (str, bytes, bytearray)):
        return
    for sheet_index, sheet in enumerate(sheets):
        if not isinstance(sheet, Mapping):
            continue
        freeze_panes = sheet.get("freeze_panes")
        if isinstance(freeze_panes, str):
            _validate_freeze_panes(freeze_panes, f"sheets[{sheet_index}].freeze_panes")
        rows = sheet.get("rows")
        if not isinstance(rows, Sequence) or isinstance(rows, (str, bytes, bytearray)):
            continue
        if len(rows) > _EXCEL_MAX_ROWS:
            raise OfficeDocumentError(
                f"sheets[{sheet_index}].rows must contain at most {_EXCEL_MAX_ROWS} rows"
            )
        for row_index, row in enumerate(rows):
            if not isinstance(row, Sequence) or isinstance(row, (str, bytes, bytearray)):
                continue
            if len(row) > _EXCEL_MAX_COLUMNS:
                raise OfficeDocumentError(
                    f"sheets[{sheet_index}].rows[{row_index}] must contain at most "
                    f"{_EXCEL_MAX_COLUMNS} columns"
                )
            for column_index, value in enumerate(row):
                _validate_excel_cell(
                    value,
                    f"sheets[{sheet_index}].rows[{row_index}][{column_index}]",
                )


def _validate_freeze_panes(value: str, path: str) -> None:
    """Validate a simple A1 freeze-pane coordinate within Excel limits."""

    match = _EXCEL_COORDINATE.fullmatch(value)
    if match is None:
        raise OfficeDocumentError(
            f"{path} must be an A1 cell coordinate within Excel limits"
        )
    column_name, row_number = match.groups()
    if (
        column_index_from_string(column_name) > _EXCEL_MAX_COLUMNS
        or int(row_number) > _EXCEL_MAX_ROWS
    ):
        raise OfficeDocumentError(
            f"{path} must be an A1 cell coordinate within Excel limits"
        )


def _validate_excel_cell(value: Any, path: str) -> None:
    """Prevent Excel text truncation and integer precision loss."""

    if isinstance(value, str) and len(value) > _EXCEL_MAX_TEXT_LENGTH:
        raise OfficeDocumentError(
            f"{path} must contain at most {_EXCEL_MAX_TEXT_LENGTH} characters"
        )
    if isinstance(value, int) and not isinstance(value, bool):
        significant_digits = len(str(abs(value)).rstrip("0"))
        if significant_digits > _EXCEL_MAX_SIGNIFICANT_DIGITS:
            raise OfficeDocumentError(
                f"{path} integer must fit within Excel's "
                f"{_EXCEL_MAX_SIGNIFICANT_DIGITS} significant decimal digits"
            )
