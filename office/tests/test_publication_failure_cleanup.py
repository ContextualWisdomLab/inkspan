from __future__ import annotations

from pathlib import Path

import pytest

import inkspan_office.safe_renderer as safe_renderer
from inkspan_office import write_office_document


def test_write_failure_removes_partial_temporary_output(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    output = tmp_path / "customer-private-output.docx"
    temporary = tmp_path / ".customer-private-output.docx.partial.tmp"

    class FailingTemporaryFile:
        name = str(temporary)

        def __enter__(self) -> FailingTemporaryFile:
            self.handle = temporary.open("wb")
            return self

        def write(self, data: bytes) -> int:
            self.handle.write(data[:32])
            self.handle.flush()
            raise OSError("simulated partial publication failure")

        def __exit__(
            self,
            exc_type: object,
            exc: object,
            traceback: object,
        ) -> None:
            self.handle.close()

    monkeypatch.setattr(
        safe_renderer,
        "NamedTemporaryFile",
        lambda **_kwargs: FailingTemporaryFile(),
    )
    payload = {
        "format": "docx",
        "blocks": [{"type": "paragraph", "text": "confidential document"}],
    }

    with pytest.raises(OSError, match=r"^output could not be written$"):
        write_office_document(payload, output)

    assert not output.exists()
    assert not temporary.exists()


def test_temporary_creation_failure_is_redacted_without_cleanup_attempt(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    output = tmp_path / "customer-private-output.docx"

    def fail_temporary_creation(**_kwargs: object) -> object:
        raise OSError("private temporary-file creation detail")

    monkeypatch.setattr(safe_renderer, "NamedTemporaryFile", fail_temporary_creation)
    payload = {
        "format": "docx",
        "blocks": [{"type": "paragraph", "text": "confidential document"}],
    }

    with pytest.raises(OSError, match=r"^output could not be written$") as error:
        write_office_document(payload, output)

    assert "private temporary-file creation detail" not in str(error.value)
    assert not output.exists()
