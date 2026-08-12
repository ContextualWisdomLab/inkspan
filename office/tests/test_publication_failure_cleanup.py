from __future__ import annotations

from pathlib import Path

import pytest

import inkspan_office.safe_renderer as safe_renderer
from inkspan_office import write_office_document


def _docx_payload() -> dict[str, object]:
    return {
        "format": "docx",
        "blocks": [{"type": "paragraph", "text": "confidential document"}],
    }


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

    with pytest.raises(OSError, match=r"^output could not be written$"):
        write_office_document(_docx_payload(), output)

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

    with pytest.raises(OSError, match=r"^output could not be written$") as error:
        write_office_document(_docx_payload(), output)

    assert "private temporary-file creation detail" not in str(error.value)
    assert not output.exists()


def test_temporary_creation_file_exists_is_not_target_conflict(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    output = tmp_path / "customer-private-output.docx"

    def fail_temporary_creation(**_kwargs: object) -> object:
        raise FileExistsError("private temporary-file creation collision")

    monkeypatch.setattr(safe_renderer, "NamedTemporaryFile", fail_temporary_creation)

    with pytest.raises(OSError, match=r"^output could not be written$") as error:
        write_office_document(_docx_payload(), output)

    assert type(error.value) is OSError
    assert "private temporary-file creation collision" not in str(error.value)
    assert not output.exists()


def test_temporary_publication_name_does_not_reflect_output_basename(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    private_marker = "tenant-741-private-matter"
    output = tmp_path / f"{private_marker}.docx"
    observed_prefix: str | None = None

    def observe_temporary_name(**kwargs: object) -> object:
        nonlocal observed_prefix
        prefix = kwargs.get("prefix")
        observed_prefix = prefix if isinstance(prefix, str) else None
        raise OSError("stop after temporary-name observation")

    monkeypatch.setattr(safe_renderer, "NamedTemporaryFile", observe_temporary_name)

    with pytest.raises(OSError, match=r"^output could not be written$"):
        write_office_document(_docx_payload(), output)

    assert observed_prefix is not None
    assert private_marker not in observed_prefix


def test_overwrite_replace_failure_is_redacted_and_preserves_existing_output(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    output = tmp_path / "customer-private-output.docx"
    output.write_bytes(b"existing")
    real_replace = Path.replace

    def fail_output_replace(self: Path, target: str | Path) -> Path:
        if Path(target) == output and self.name.startswith(f".{output.name}."):
            raise OSError("private replacement failure detail")
        return real_replace(self, target)

    monkeypatch.setattr(Path, "replace", fail_output_replace)

    with pytest.raises(OSError, match=r"^output could not be written$") as error:
        write_office_document(_docx_payload(), output, overwrite=True)

    assert "private replacement failure detail" not in str(error.value)
    assert output.read_bytes() == b"existing"
    assert list(tmp_path.glob(f".{output.name}.*.tmp")) == []


def test_cleanup_failure_is_redacted_after_atomic_publication(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    output = tmp_path / "customer-private-output.docx"
    real_unlink = Path.unlink

    def fail_temporary_cleanup(self: Path, missing_ok: bool = False) -> None:
        if self.name.startswith(f".{output.name}.") and self.suffix == ".tmp":
            raise OSError("private cleanup failure detail")
        real_unlink(self, missing_ok=missing_ok)

    monkeypatch.setattr(Path, "unlink", fail_temporary_cleanup)

    with pytest.raises(OSError, match=r"^output could not be written$") as error:
        write_office_document(_docx_payload(), output)

    assert "private cleanup failure detail" not in str(error.value)
    assert output.exists()
    temporary_files = list(tmp_path.glob(f".{output.name}.*.tmp"))
    assert len(temporary_files) == 1
    for temporary in temporary_files:
        real_unlink(temporary)
