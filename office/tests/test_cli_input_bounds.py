from __future__ import annotations

import json
from pathlib import Path

import pytest

from inkspan_office.cli import main


def test_cli_request_ingress_avoids_unbounded_path_read_text(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    source = tmp_path / "request.json"
    output = tmp_path / "result.docx"
    source.write_bytes(
        json.dumps(
            {
                "format": "docx",
                "blocks": [{"type": "paragraph", "text": "bounded"}],
            }
        ).encode("utf-8")
    )

    def reject_unbounded_read(*_args: object, **_kwargs: object) -> str:
        raise AssertionError("CLI request ingestion used Path.read_text")

    monkeypatch.setattr(Path, "read_text", reject_unbounded_read)

    assert main([str(source), str(output)]) == 0
    assert output.read_bytes().startswith(b"PK")
