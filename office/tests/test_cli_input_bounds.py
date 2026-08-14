from __future__ import annotations

import io
import json
from pathlib import Path

import pytest

import inkspan_office.cli as cli_module
from inkspan_office.cli import main


def _write_valid_request(source: Path) -> None:
    """Write one minimal valid DOCX request for CLI boundary tests."""

    source.write_bytes(
        json.dumps(
            {
                "format": "docx",
                "blocks": [{"type": "paragraph", "text": "bounded"}],
            }
        ).encode("utf-8")
    )


def test_cli_request_ingress_avoids_unbounded_path_read_text(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    source = tmp_path / "request.json"
    output = tmp_path / "result.docx"
    _write_valid_request(source)

    def reject_unbounded_read(*_args: object, **_kwargs: object) -> str:
        raise AssertionError("CLI request ingestion used Path.read_text")

    monkeypatch.setattr(Path, "read_text", reject_unbounded_read)

    assert main([str(source), str(output)]) == 0
    assert output.read_bytes().startswith(b"PK")


def test_cli_help_documents_request_byte_ceiling(
    capsys: pytest.CaptureFixture[str],
) -> None:
    with pytest.raises(SystemExit) as exc:
        main(["--help"])

    assert exc.value.code == 0
    help_text = capsys.readouterr().out
    assert "JSON request path" in help_text
    assert "64 MiB" in help_text


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


@pytest.mark.parametrize("constant", ["NaN", "Infinity", "-Infinity"])
def test_cli_rejects_nonstandard_json_numeric_constants_before_render(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    constant: str,
) -> None:
    source = tmp_path / "request.json"
    output = tmp_path / "result.docx"
    source.write_text(
        f'{{"format":"xlsx","sheets":[{{"name":"Sheet1","rows":[[{constant}]]}}]}}',
        encoding="utf-8",
    )

    def reject_renderer_call(*_args: object, **_kwargs: object) -> Path:
        raise AssertionError("CLI passed non-standard JSON to the Office renderer")

    monkeypatch.setattr(cli_module, "write_office_document", reject_renderer_call)

    with pytest.raises(SystemExit) as exc:
        main([str(source), str(output)])

    assert exc.value.code == 2
    error = capsys.readouterr().err
    assert "strict JSON" in error
    assert constant not in error


def test_cli_rejects_excessive_json_nesting_before_materialization(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    source = tmp_path / "request.json"
    output = tmp_path / "result.docx"
    source.write_text("[[[[[0]]]]]", encoding="utf-8")

    monkeypatch.setattr(cli_module, "_MAX_CLI_JSON_NESTING_DEPTH", 4, raising=False)

    def reject_json_materialization(*_args: object, **_kwargs: object) -> object:
        raise AssertionError("CLI materialized JSON beyond the nesting ceiling")

    monkeypatch.setattr(cli_module.json, "loads", reject_json_materialization)

    with pytest.raises(SystemExit) as exc:
        main([str(source), str(output)])

    assert exc.value.code == 2
    error = capsys.readouterr().err
    assert "JSON nesting depth" in error


def test_cli_json_nesting_preflight_ignores_delimiters_inside_strings(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    source = tmp_path / "request.json"
    output = tmp_path / "result.docx"
    payload = {
        "format": "docx",
        "blocks": [{"type": "paragraph", "text": '"[[[[{{{{]]]]}}}}'}],
    }
    source.write_text(json.dumps(payload), encoding="utf-8")

    monkeypatch.setattr(cli_module, "_MAX_CLI_JSON_NESTING_DEPTH", 3, raising=False)

    assert main([str(source), str(output)]) == 0
    assert output.read_bytes().startswith(b"PK")


def test_cli_redacts_missing_input_path(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    private_marker = "confidential_customer_input"
    source = tmp_path / f"{private_marker}.json"
    output = tmp_path / "result.docx"

    with pytest.raises(SystemExit) as exc:
        main([str(source), str(output)])

    assert exc.value.code == 2
    error = capsys.readouterr().err
    assert "input could not be read" in error
    assert private_marker not in error


def test_cli_redacts_existing_output_path(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    private_marker = "confidential_customer_output"
    source = tmp_path / "request.json"
    output = tmp_path / f"{private_marker}.docx"
    _write_valid_request(source)
    output.write_bytes(b"existing")

    with pytest.raises(SystemExit) as exc:
        main([str(source), str(output)])

    assert exc.value.code == 2
    error = capsys.readouterr().err
    assert "output already exists" in error
    assert private_marker not in error


def test_cli_redacts_other_output_filesystem_failures(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    private_marker = "confidential_output_device"
    source = tmp_path / "request.json"
    output = tmp_path / f"{private_marker}.docx"
    _write_valid_request(source)

    def reject_output(*_args: object, **_kwargs: object) -> Path:
        raise OSError(f"private output path: {output}")

    monkeypatch.setattr(cli_module, "write_office_document", reject_output)

    with pytest.raises(SystemExit) as exc:
        main([str(source), str(output)])

    assert exc.value.code == 2
    error = capsys.readouterr().err
    assert "output could not be written" in error
    assert private_marker not in error


def test_cli_reports_committed_output_cleanup_failure_without_reflecting_detail(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    private_marker = "confidential_committed_cleanup"
    source = tmp_path / "request.json"
    output = tmp_path / f"{private_marker}.docx"
    _write_valid_request(source)

    class CommittedOutputError(OSError):
        output_committed = True

    def fail_committed_cleanup(*_args: object, **_kwargs: object) -> Path:
        raise CommittedOutputError(f"private output cleanup: {output}")

    monkeypatch.setattr(cli_module, "write_office_document", fail_committed_cleanup)

    with pytest.raises(SystemExit) as exc:
        main([str(source), str(output)])

    assert exc.value.code == 2
    error = capsys.readouterr().err
    assert "output was written but temporary cleanup failed" in error
    assert private_marker not in error


def test_cli_redacts_invalid_input_path_value_error(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    private_marker = "confidential_embedded_null_input"
    source = tmp_path / f"{private_marker}\0.json"
    output = tmp_path / "result.docx"

    with pytest.raises(SystemExit) as exc:
        main([str(source), str(output)])

    assert exc.value.code == 2
    error = capsys.readouterr().err
    assert "input could not be read" in error
    assert private_marker not in error
