from __future__ import annotations

import json
from pathlib import Path

import pytest

from inkspan_office.cli import main


def test_cli_renders_json_request(tmp_path: Path) -> None:
    source = tmp_path / "request.json"
    output = tmp_path / "result.xlsx"
    source.write_text(
        json.dumps(
            {
                "format": "xlsx",
                "sheets": [{"name": "Data", "rows": [["a", "b"], [1, 2]]}],
            }
        ),
        encoding="utf-8",
    )

    assert main([str(source), str(output)]) == 0
    assert output.read_bytes().startswith(b"PK")


def test_cli_prints_machine_readable_schema(capsys: pytest.CaptureFixture[str]) -> None:
    assert main(["--print-schema"]) == 0
    printed = json.loads(capsys.readouterr().out)
    assert printed["title"] == "Inkspan Office document request"


@pytest.mark.parametrize(
    ("content", "output_name", "message"),
    [
        ("not json", "result.docx", "valid JSON"),
        (json.dumps({"format": "pptx", "slides": []}), "result.pptx", "at least one"),
        (json.dumps({"format": "docx", "blocks": []}), "result.xlsx", "extension"),
    ],
)
def test_cli_reports_contract_errors(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
    content: str,
    output_name: str,
    message: str,
) -> None:
    source = tmp_path / "request.json"
    source.write_text(content, encoding="utf-8")

    with pytest.raises(SystemExit) as exc:
        main([str(source), str(tmp_path / output_name)])

    assert exc.value.code == 2
    assert message in capsys.readouterr().err


def test_cli_requires_paths_unless_printing_schema() -> None:
    with pytest.raises(SystemExit) as exc:
        main([])
    assert exc.value.code == 2
