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
    temporary = tmp_path / ".inkspan-office-partial.tmp"

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
    assert observed_prefix == ".inkspan-office-"


def test_overwrite_replace_failure_is_redacted_and_preserves_existing_output(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    output = tmp_path / "customer-private-output.docx"
    output.write_bytes(b"existing")
    real_replace = Path.replace

    def fail_output_replace(self: Path, target: str | Path) -> Path:
        if Path(target) == output and self.name.startswith(".inkspan-office-"):
            raise OSError("private replacement failure detail")
        return real_replace(self, target)

    monkeypatch.setattr(Path, "replace", fail_output_replace)

    with pytest.raises(OSError, match=r"^output could not be written$") as error:
        write_office_document(_docx_payload(), output, overwrite=True)

    assert "private replacement failure detail" not in str(error.value)
    assert output.read_bytes() == b"existing"
    assert list(tmp_path.glob(".inkspan-office-*.tmp")) == []


def test_cleanup_failure_reports_committed_output_without_reflecting_private_detail(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    output = tmp_path / "customer-private-output.docx"
    real_unlink = Path.unlink

    def fail_temporary_cleanup(self: Path, missing_ok: bool = False) -> None:
        if self.name.startswith(".inkspan-office-") and self.suffix == ".tmp":
            raise OSError("private cleanup failure detail")
        real_unlink(self, missing_ok=missing_ok)

    monkeypatch.setattr(Path, "unlink", fail_temporary_cleanup)

    with pytest.raises(
        OSError,
        match=r"^output was written but temporary cleanup failed$",
    ) as error:
        write_office_document(_docx_payload(), output)

    assert "private cleanup failure detail" not in str(error.value)
    assert output.exists()
    temporary_files = list(tmp_path.glob(".inkspan-office-*.tmp"))
    assert len(temporary_files) == 1
    for temporary in temporary_files:
        real_unlink(temporary)


def test_invalid_output_path_uses_stable_redacted_publication_error(
    tmp_path: Path,
) -> None:
    private_marker = "confidential_embedded_null_output"
    output = tmp_path / f"{private_marker}\0.docx"

    with pytest.raises(OSError, match=r"^output could not be written$") as error:
        write_office_document(_docx_payload(), output)

    assert private_marker not in str(error.value)
    assert list(tmp_path.glob(".inkspan-office-*.tmp")) == []


@pytest.mark.parametrize("invalid_overwrite", ["false", 1])
def test_non_boolean_overwrite_cannot_replace_existing_output(
    tmp_path: Path,
    invalid_overwrite: object,
) -> None:
    output = tmp_path / "customer-private-output.docx"
    existing = b"existing-private-document"
    output.write_bytes(existing)

    try:
        write_office_document(
            _docx_payload(),
            output,
            overwrite=invalid_overwrite,  # type: ignore[arg-type]
        )
    except TypeError as exc:
        assert str(exc) == "overwrite must be a boolean"
    else:
        assert output.read_bytes() == existing, (
            "a truthy non-boolean overwrite control replaced the existing output"
        )
        pytest.fail("a non-boolean overwrite control was accepted")

    assert output.read_bytes() == existing
    assert list(tmp_path.glob(".inkspan-office-*.tmp")) == []


def test_non_boolean_overwrite_is_rejected_before_rendering(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    render_called = False

    def unexpected_render(_payload: object) -> object:
        nonlocal render_called
        render_called = True
        pytest.fail("rendering started before overwrite validation")

    monkeypatch.setattr(safe_renderer, "render_office_document", unexpected_render)

    with pytest.raises(TypeError, match=r"^overwrite must be a boolean$"):
        write_office_document(
            _docx_payload(),
            tmp_path / "output.docx",
            overwrite="false",  # type: ignore[arg-type]
        )

    assert not render_called
