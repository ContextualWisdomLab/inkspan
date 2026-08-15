from __future__ import annotations

import json
import os
import threading
from pathlib import Path

import pytest

from inkspan_office.cli import main


def test_cli_rejects_non_regular_input_swapped_after_path_preflight(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """Reject a FIFO substituted after the path-level regular-file check."""

    if not hasattr(os, "mkfifo") or not hasattr(os, "O_NONBLOCK"):
        pytest.skip("POSIX FIFO support is unavailable")

    source = tmp_path / "request.json"
    output = tmp_path / "result.docx"
    request = json.dumps(
        {
            "format": "docx",
            "blocks": [{"type": "paragraph", "text": "raced FIFO"}],
        }
    ).encode("utf-8")
    source.write_bytes(request)

    original_is_file = Path.is_file
    writer_errors: list[BaseException] = []
    writer: threading.Thread | None = None

    def write_fifo_request() -> None:
        try:
            with source.open("wb", buffering=0) as stream:
                stream.write(request)
        except BaseException as exc:  # pragma: no cover - surfaced below
            writer_errors.append(exc)

    def swap_after_regular_file_stat(path: Path) -> bool:
        nonlocal writer
        if path == source and writer is None:
            assert original_is_file(path)
            path.unlink()
            os.mkfifo(path)
            writer = threading.Thread(target=write_fifo_request, daemon=True)
            writer.start()
            return True
        return original_is_file(path)

    monkeypatch.setattr(Path, "is_file", swap_after_regular_file_stat)

    try:
        with pytest.raises(SystemExit) as exc:
            main([str(source), str(output)])

        assert exc.value.code == 2
        error = capsys.readouterr().err
        assert "input could not be read" in error
        assert not output.exists()
    finally:
        if writer is not None:
            if writer.is_alive():
                rescue_fd = os.open(source, os.O_RDONLY | os.O_NONBLOCK)
                try:
                    writer.join(timeout=2)
                finally:
                    os.close(rescue_fd)
            else:
                writer.join(timeout=2)

    assert writer is not None
    assert not writer.is_alive()
    assert writer_errors == []
