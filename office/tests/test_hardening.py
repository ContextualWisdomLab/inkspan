from __future__ import annotations

import os
from io import BytesIO
from pathlib import Path

import pytest
from openpyxl import load_workbook

from inkspan_office import (
    OfficeDocumentError,
    load_schema,
    render_office_document,
    write_office_document,
)


@pytest.mark.parametrize(
    "payload",
    [
        {"format": "docx", "blocks": [{"type": "paragraph", "text": "bad\u0000text"}]},
        {"format": "xlsx", "sheets": [{"name": "Data", "rows": [["bad\u0000text"]]}]},
        {"format": "pptx", "slides": [{"title": "Title", "bullets": ["bad\u0000text"]}]},
    ],
)
def test_rejects_xml_incompatible_text_with_public_error(
    payload: dict[str, object],
) -> None:
    with pytest.raises(OfficeDocumentError, match="XML-incompatible"):
        render_office_document(payload)


@pytest.mark.parametrize(
    "freeze_panes",
    ["A0", "XFE1", "A1048577", "1A", "$A$2"],
)
def test_rejects_invalid_excel_freeze_panes(freeze_panes: str) -> None:
    payload = {
        "format": "xlsx",
        "sheets": [
            {
                "name": "Data",
                "rows": [["x"]],
                "freeze_panes": freeze_panes,
            }
        ],
    }

    with pytest.raises(OfficeDocumentError, match="freeze_panes"):
        render_office_document(payload)


def test_rejects_excel_cell_text_that_would_be_silently_truncated() -> None:
    payload = {
        "format": "xlsx",
        "sheets": [{"name": "Data", "rows": [["x" * 32_768]]}],
    }

    with pytest.raises(OfficeDocumentError, match="32767"):
        render_office_document(payload)


def test_rejects_excel_integer_that_exceeds_exact_precision() -> None:
    payload = {
        "format": "xlsx",
        "sheets": [{"name": "Data", "rows": [[1_234_567_890_123_456]]}],
    }

    with pytest.raises(OfficeDocumentError, match="15 significant"):
        render_office_document(payload)


def test_accepts_large_integer_with_one_significant_digit() -> None:
    payload = {
        "format": "xlsx",
        "sheets": [{"name": "Data", "rows": [[10**15]]}],
    }

    rendered = render_office_document(payload)
    workbook = load_workbook(BytesIO(rendered.data), data_only=False)
    assert workbook["Data"]["A1"].value == 10**15


def test_rejects_excel_rows_beyond_column_limit() -> None:
    payload = {
        "format": "xlsx",
        "sheets": [{"name": "Data", "rows": [[None] * 16_385]}],
    }

    with pytest.raises(OfficeDocumentError, match="16384"):
        render_office_document(payload)


def test_rejects_excel_rows_beyond_worksheet_limit() -> None:
    payload = {
        "format": "xlsx",
        "sheets": [{"name": "Data", "rows": [[]] * 1_048_577}],
    }

    with pytest.raises(OfficeDocumentError, match="1048576"):
        render_office_document(payload)


def test_write_redacts_preexisting_output_path(tmp_path: Path) -> None:
    private_marker = "customer-private-output"
    output = tmp_path / f"{private_marker}.docx"
    output.write_bytes(b"existing")
    payload = {
        "format": "docx",
        "blocks": [{"type": "paragraph", "text": "hello"}],
    }

    with pytest.raises(FileExistsError, match=r"^output already exists$") as caught:
        write_office_document(payload, output)

    assert private_marker not in str(caught.value)


def test_non_overwrite_write_is_race_safe(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    private_marker = "race-private-output"
    output = tmp_path / f"{private_marker}.docx"
    real_link = os.link

    def competing_link(
        source: str | bytes | os.PathLike[str] | os.PathLike[bytes],
        destination: str | bytes | os.PathLike[str] | os.PathLike[bytes],
    ) -> None:
        output.write_text("competitor", encoding="utf-8")
        real_link(source, destination)

    monkeypatch.setattr(os, "link", competing_link)
    payload = {
        "format": "docx",
        "blocks": [{"type": "paragraph", "text": "hello"}],
    }

    with pytest.raises(FileExistsError, match=r"^output already exists$") as caught:
        write_office_document(payload, output)

    assert private_marker not in str(caught.value)
    assert output.read_text(encoding="utf-8") == "competitor"


def test_write_redacts_other_filesystem_errors(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    private_marker = "filesystem-private-output"
    output = tmp_path / f"{private_marker}.docx"

    def failing_link(
        source: str | bytes | os.PathLike[str] | os.PathLike[bytes],
        destination: str | bytes | os.PathLike[str] | os.PathLike[bytes],
    ) -> None:
        raise OSError(f"publication failed for {private_marker}")

    monkeypatch.setattr(os, "link", failing_link)
    payload = {
        "format": "docx",
        "blocks": [{"type": "paragraph", "text": "hello"}],
    }

    with pytest.raises(OSError, match=r"^output could not be written$") as caught:
        write_office_document(payload, output)

    assert private_marker not in str(caught.value)


def test_rejects_cyclic_object_payloads() -> None:
    payload: dict[str, object] = {"format": "docx", "blocks": []}
    payload["cycle"] = payload

    with pytest.raises(OfficeDocumentError, match="cyclic object"):
        render_office_document(payload)


def test_rejects_cyclic_array_payloads() -> None:
    cycle: list[object] = []
    cycle.append(cycle)

    with pytest.raises(OfficeDocumentError, match="cyclic array"):
        render_office_document(cycle)  # type: ignore[arg-type]


def test_rejects_excessive_container_nesting() -> None:
    payload: object = "text"
    for _ in range(130):
        payload = [payload]

    with pytest.raises(OfficeDocumentError, match="nesting depth"):
        render_office_document(payload)  # type: ignore[arg-type]


@pytest.mark.parametrize(
    "payload",
    [
        b"not-json",
        {"format": "xlsx", "sheets": "not-an-array"},
        {"format": "xlsx", "sheets": ["not-an-object"]},
        {"format": "xlsx", "sheets": [{"name": "Data", "rows": "not-an-array"}]},
        {"format": "xlsx", "sheets": [{"name": "Data", "rows": ["not-a-row"]}]},
    ],
)
def test_defers_malformed_shapes_to_the_strict_renderer(payload: object) -> None:
    with pytest.raises(OfficeDocumentError):
        render_office_document(payload)  # type: ignore[arg-type]


def test_schema_exposes_excel_storage_limits() -> None:
    schema = load_schema()
    sheet = schema["$defs"]["sheet"]
    rows = sheet["properties"]["rows"]

    assert rows["maxItems"] == 1_048_576
    assert rows["items"]["maxItems"] == 16_384
    assert rows["items"]["items"]["$ref"] == "#/$defs/excelScalar"
    assert schema["$defs"]["excelScalar"]["oneOf"][0]["maxLength"] == 32_767
    assert sheet["properties"]["freeze_panes"]["pattern"].startswith("^")
