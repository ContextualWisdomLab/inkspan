"""Contract tests for deterministic rich-text runs in DOCX paragraphs."""

from __future__ import annotations

from io import BytesIO

import pytest
from docx import Document

from inkspan_office import OfficeDocumentError, load_schema, render_office_document


def test_docx_contract_preserves_explicit_rich_text_runs() -> None:
    """The public schema and renderer must preserve run text and emphasis in order."""

    schema = load_schema()
    rich_branches = [
        branch
        for branch in schema["$defs"]["docxBlock"]["oneOf"]
        if branch.get("properties", {}).get("type", {}).get("const")
        == "rich_paragraph"
    ]
    assert len(rich_branches) == 1

    rendered = render_office_document(
        {
            "format": "docx",
            "blocks": [
                {
                    "type": "rich_paragraph",
                    "runs": [
                        {"text": "Retention ", "bold": True},
                        {"text": "improved", "italic": True},
                        {"text": " year over year.", "underline": True},
                        {
                            "text": " 검증",
                            "bold": True,
                            "italic": True,
                            "underline": True,
                        },
                    ],
                }
            ],
        }
    )

    document = Document(BytesIO(rendered.data))
    paragraph = document.paragraphs[0]
    assert [run.text for run in paragraph.runs] == [
        "Retention ",
        "improved",
        " year over year.",
        " 검증",
    ]
    assert [(run.bold, run.italic, run.underline) for run in paragraph.runs] == [
        (True, None, None),
        (None, True, None),
        (None, None, True),
        (True, True, True),
    ]


def test_docx_rich_paragraph_rejects_empty_run_collection() -> None:
    """Runtime validation must reject a rich paragraph that contains no runs."""

    with pytest.raises(
        OfficeDocumentError,
        match=r"blocks\[0\]\.runs must contain at least one run",
    ):
        render_office_document(
            {
                "format": "docx",
                "blocks": [{"type": "rich_paragraph", "runs": []}],
            }
        )


def test_docx_rich_paragraph_rejects_runtime_run_overflow() -> None:
    """Runtime validation must retain a finite defense-in-depth run ceiling."""

    with pytest.raises(
        OfficeDocumentError,
        match=r"blocks\[0\]\.runs must contain at most 4096 runs",
    ):
        render_office_document(
            {
                "format": "docx",
                "blocks": [
                    {
                        "type": "rich_paragraph",
                        "runs": [{"text": "x"}] * 4097,
                    }
                ],
            }
        )
