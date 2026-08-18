"""Public safety facade for deterministic Office document rendering."""

from __future__ import annotations

import os
import re
from collections.abc import Mapping, Sequence
from io import BytesIO
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any
from zipfile import ZipFile, ZipInfo

from openpyxl.utils import column_index_from_string

from . import renderer as _renderer

OfficeDocumentError = _renderer.OfficeDocumentError
RenderedOfficeDocument = _renderer.RenderedOfficeDocument

_INVALID_XML_CHARACTER = re.compile(
    r"[\x00-\x08\x0B\x0C\x0E-\x1F\uD800-\uDFFF\uFFFE\uFFFF]"
)
_EXCEL_COORDINATE = re.compile(r"^([A-Za-z]{1,3})([1-9][0-9]{0,6})$")
_CORE_TIMESTAMP = re.compile(
    rb"(<dcterms:(?:created|modified)\b[^>]*>)[^<]*(</dcterms:(?:created|modified)>)"
)
_EXCEL_MAX_ROWS = 1_048_576
_EXCEL_MAX_COLUMNS = 16_384
_EXCEL_MAX_TEXT_LENGTH = 32_767
_EXCEL_MAX_SIGNIFICANT_DIGITS = 15
_DOCX_MAX_RICH_RUNS = 4_096
_MAX_CONTAINER_DEPTH = 128
_CANONICAL_ZIP_TIMESTAMP = (1980, 1, 1, 0, 0, 0)
_CANONICAL_CORE_TIMESTAMP = b"1980-01-01T00:00:00Z"
_DIAGNOSTIC_SCHEMA_KEYS = frozenset(
    {
        "alignment",
        "alt_text",
        "author",
        "auto_filter",
        "blocks",
        "bold",
        "bullets",
        "format",
        "freeze_panes",
        "header_row",
        "headers",
        "href",
        "italic",
        "items",
        "level",
        "name",
        "ordered",
        "rows",
        "runs",
        "sheets",
        "slides",
        "source",
        "subject",
        "subtitle",
        "text",
        "title",
        "type",
        "underline",
        "width_px",
    }
)


def load_schema() -> dict[str, Any]:
    """Load the bundled machine-readable Office request contract."""

    return _renderer.load_schema()


def render_office_document(payload: Mapping[str, Any]) -> RenderedOfficeDocument:
    """Validate safety invariants and return canonical deterministic OOXML."""

    _validate_request(payload)
    rendered = _renderer.render_office_document(payload)
    return RenderedOfficeDocument(
        rendered.format,
        rendered.extension,
        rendered.content_type,
        _canonicalize_ooxml(rendered.data),
    )


def write_office_document(
    payload: Mapping[str, Any],
    output_path: str | Path,
    *,
    overwrite: bool = False,
) -> Path:
    """Render and atomically publish an Office file without overwrite races."""

    if type(overwrite) is not bool:
        raise TypeError("overwrite must be a boolean")

    rendered = render_office_document(payload)
    path = Path(output_path)
    if path.suffix.lower() != rendered.extension:
        raise OfficeDocumentError(f"output extension must be {rendered.extension}")
    try:
        output_exists = path.exists()
    except (OSError, ValueError) as exc:
        raise OSError("output could not be written") from exc
    if output_exists and not overwrite:
        raise FileExistsError("output already exists")

    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary_handle = NamedTemporaryFile(
            mode="wb",
            prefix=".inkspan-office-",
            suffix=".tmp",
            dir=path.parent,
            delete=False,
        )
    except (OSError, ValueError) as exc:
        raise OSError("output could not be written") from exc

    temporary = Path(temporary_handle.name)
    try:
        try:
            with temporary_handle as handle:
                handle.write(rendered.data)
        except OSError as exc:
            raise OSError("output could not be written") from exc

        if overwrite:
            try:
                temporary.replace(path)
            except (OSError, ValueError) as exc:
                raise OSError("output could not be written") from exc
        else:
            try:
                os.link(temporary, path)
            except FileExistsError as exc:
                raise FileExistsError("output already exists") from exc
            except (OSError, ValueError) as exc:
                raise OSError("output could not be written") from exc
    except BaseException:
        try:
            temporary.unlink(missing_ok=True)
        except OSError:
            pass
        raise

    try:
        temporary.unlink(missing_ok=True)
    except OSError as exc:
        raise OSError("output was written but temporary cleanup failed") from exc
    return path


def _canonicalize_ooxml(data: bytes) -> bytes:
    """Normalize volatile ZIP and core-property timestamps in an OOXML package."""

    output = BytesIO()
    with ZipFile(BytesIO(data), "r") as source, ZipFile(output, "w") as target:
        for source_info in sorted(source.infolist(), key=lambda item: item.filename):
            content = source.read(source_info.filename)
            if source_info.filename == "docProps/core.xml":
                content = _normalize_core_properties(content)
            target_info = ZipInfo(source_info.filename, _CANONICAL_ZIP_TIMESTAMP)
            target_info.compress_type = source_info.compress_type
            target_info.external_attr = source_info.external_attr
            target_info.internal_attr = source_info.internal_attr
            target_info.create_system = source_info.create_system
            target_info.comment = source_info.comment
            target.writestr(target_info, content)
        target.comment = source.comment
    return output.getvalue()


def _normalize_core_properties(content: bytes) -> bytes:
    """Replace generated OOXML creation and modification times with a constant."""

    return _CORE_TIMESTAMP.sub(
        lambda match: match.group(1) + _CANONICAL_CORE_TIMESTAMP + match.group(2),
        content,
    )


def _validate_request(payload: Any) -> None:
    """Apply cross-format text safety and bounded format-specific validation."""

    if isinstance(payload, Mapping):
        format_name = payload.get("format")
        if format_name == "xlsx":
            _validate_xlsx(payload)
        elif format_name == "docx":
            _validate_docx_rich_run_counts(payload)
    _validate_xml_tree(payload, "payload", set())


def _validate_docx_rich_run_counts(payload: Mapping[str, Any]) -> None:
    """Reject impossible rich-run sequences before recursive safety traversal."""

    blocks = payload.get("blocks")
    if not isinstance(blocks, Sequence) or isinstance(blocks, (str, bytes, bytearray)):
        return
    for block_index, block in enumerate(blocks):
        if not isinstance(block, Mapping) or block.get("type") != "rich_paragraph":
            continue
        runs = block.get("runs")
        if not isinstance(runs, Sequence) or isinstance(runs, (str, bytes, bytearray)):
            continue
        if len(runs) > _DOCX_MAX_RICH_RUNS:
            raise OfficeDocumentError(
                f"blocks[{block_index}].runs must contain at most {_DOCX_MAX_RICH_RUNS} runs"
            )


def _validate_xml_tree(
    value: Any,
    path: str,
    active: set[int],
    depth: int = 0,
) -> None:
    """Reject XML-invalid text while detecting cyclic non-JSON containers."""

    if depth > _MAX_CONTAINER_DEPTH:
        raise OfficeDocumentError(
            f"{path} exceeds the maximum JSON nesting depth of {_MAX_CONTAINER_DEPTH}"
        )
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
                child_path = (
                    f"{path}.{key}"
                    if isinstance(key, str) and key in _DIAGNOSTIC_SCHEMA_KEYS
                    else path
                )
                _validate_xml_tree(child, child_path, active, depth + 1)
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
                _validate_xml_tree(child, f"{path}[{index}]", active, depth + 1)
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
        path = f"sheets[{sheet_index}]"
        _validate_sheet_name_compatibility(sheet.get("name"), path)
        freeze_panes = sheet.get("freeze_panes")
        if isinstance(freeze_panes, str):
            _validate_freeze_panes(freeze_panes, f"{path}.freeze_panes")
        rows = sheet.get("rows")
        if not isinstance(rows, Sequence) or isinstance(rows, (str, bytes, bytearray)):
            continue
        if len(rows) > _EXCEL_MAX_ROWS:
            raise OfficeDocumentError(
                f"{path}.rows must contain at most {_EXCEL_MAX_ROWS} rows"
            )
        for row_index, row in enumerate(rows):
            if not isinstance(row, Sequence) or isinstance(row, (str, bytes, bytearray)):
                continue
            if len(row) > _EXCEL_MAX_COLUMNS:
                raise OfficeDocumentError(
                    f"{path}.rows[{row_index}] must contain at most "
                    f"{_EXCEL_MAX_COLUMNS} columns"
                )
            for column_index, value in enumerate(row):
                _validate_excel_cell(
                    value,
                    f"{path}.rows[{row_index}][{column_index}]",
                )


def _validate_sheet_name_compatibility(value: Any, path: str) -> None:
    """Reject worksheet names that Excel itself reserves or cannot enter."""

    if not isinstance(value, str):
        return
    if (
        value.startswith("'")
        or value.endswith("'")
        or value.casefold() == "history"
    ):
        raise OfficeDocumentError(f"{path}.name is invalid for Excel")


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
        try:
            floating_value = float(value)
        except OverflowError as exc:
            raise OfficeDocumentError(
                f"{path} integer must be exactly representable by Excel's "
                f"{_EXCEL_MAX_SIGNIFICANT_DIGITS} significant-digit numeric model"
            ) from exc
        significant_digits = len(str(abs(value)).rstrip("0"))
        if (
            int(floating_value) != value
            or significant_digits > _EXCEL_MAX_SIGNIFICANT_DIGITS
        ):
            raise OfficeDocumentError(
                f"{path} integer must be exactly representable by Excel's "
                f"{_EXCEL_MAX_SIGNIFICANT_DIGITS} significant-digit numeric model"
            )
