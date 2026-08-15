from __future__ import annotations

from pathlib import Path

import pytest

import inkspan_office.cli as cli_module
from inkspan_office.cli import main


@pytest.mark.parametrize(
    "request_text",
    [
        '{"format":"docx","private_customer_marker":1,"private_customer_marker":2,"blocks":[]}',
        '{"format":"docx","blocks":[{"type":"paragraph","private_nested_marker":1,"private_nested_marker":2,"text":"safe"}]}',
    ],
)
def test_cli_rejects_duplicate_json_object_names_before_render(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    request_text: str,
) -> None:
    source = tmp_path / "request.json"
    output = tmp_path / "result.docx"
    source.write_text(request_text, encoding="utf-8")

    def reject_renderer_call(*_args: object, **_kwargs: object) -> Path:
        raise AssertionError("CLI reached the renderer with duplicate JSON object names")

    monkeypatch.setattr(cli_module, "write_office_document", reject_renderer_call)

    with pytest.raises(SystemExit) as exc:
        main([str(source), str(output)])

    assert exc.value.code == 2
    error = capsys.readouterr().err
    assert "duplicate object names" in error
    assert "private_customer_marker" not in error
    assert "private_nested_marker" not in error
