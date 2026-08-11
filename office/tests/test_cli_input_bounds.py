from __future__ import annotations

import io
import json
from pathlib import Path

import pytest

import inkspan_office.cli as cli_module
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


def test_cli_rejects_oversized_request_after_only_one_boundary_byte(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    source = tmp_path / "request.json"
    output = tmp_path / "result.docx"
    requested_sizes: list[int] = []

    class ObservedBytesIO(io.BytesIO):
        def read(self, size: int = -1) -> bytes:
            requested_sizes.append(size)
            return super().read(size)

    def bounded_source_open(
        _path: Path,
        mode: str = "r",
        *_args: object,
        **_kwargs: object,
    ) -> ObservedBytesIO:
        assert mode == "rb"
        return ObservedBytesIO(b'{"private":"do-not-echo"}')

    monkeypatch.setattr(cli_module, "_MAX_CLI_REQUEST_BYTES", 4)
    monkeypatch.setattr(Path, "open", bounded_source_open)

    with pytest.raises(SystemExit) as exc:
        main([str(source), str(output)])

    assert exc.value.code == 2
    assert requested_sizes == [5]
    error = capsys.readouterr().err
    assert "supported CLI request size" in error
    assert "do-not-echo" not in error


def test_cli_rejects_invalid_utf8_without_echoing_request_bytes(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    source = tmp_path / "request.json"
    output = tmp_path / "result.docx"
    source.write_bytes(b"\xffprivate")

    with pytest.raises(SystemExit) as exc:
        main([str(source), str(output)])

    assert exc.value.code == 2
    error = capsys.readouterr().err
    assert "input must contain valid UTF-8" in error
    assert "private" not in error
