"""Validate and append bounded rich-text run paragraphs to DOCX documents."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

_MAX_RICH_RUNS = 1_024
_ALLOWED_RUN_FIELDS = frozenset({"text", "bold", "italic", "underline"})


class DocxRichTextContractError(ValueError):
    """Raised when a DOCX rich-text paragraph violates its bounded contract."""


def add_docx_rich_paragraph(
    document: Any,
    block: Mapping[str, Any],
    path: str,
) -> None:
    """Append one validated rich paragraph with explicit emphasis-only run formatting."""

    runs = _required_run_array(block, path)
    paragraph = document.add_paragraph()
    for index, raw_run in enumerate(runs):
        run_path = f"{path}.runs[{index}]"
        run_spec = _run_mapping(raw_run, run_path)
        unexpected = sorted(set(run_spec) - _ALLOWED_RUN_FIELDS)
        if unexpected:
            label = "field" if len(unexpected) == 1 else "fields"
            raise DocxRichTextContractError(
                f"{run_path} has unexpected {label}: {', '.join(unexpected)}"
            )
        if "text" not in run_spec:
            raise DocxRichTextContractError(f"{run_path}.text is required")
        text = run_spec["text"]
        if not isinstance(text, str):
            raise DocxRichTextContractError(f"{run_path}.text must be a string")
        if text == "":
            raise DocxRichTextContractError(f"{run_path}.text must not be empty")

        run = paragraph.add_run(text)
        if "bold" in run_spec:
            run.bold = _strict_boolean(run_spec["bold"], f"{run_path}.bold")
        if "italic" in run_spec:
            run.italic = _strict_boolean(run_spec["italic"], f"{run_path}.italic")
        if "underline" in run_spec:
            run.underline = _strict_boolean(
                run_spec["underline"], f"{run_path}.underline"
            )


def _required_run_array(block: Mapping[str, Any], path: str) -> list[Any]:
    """Return one bounded non-empty run array without accepting string-like sequences."""

    if "runs" not in block:
        raise DocxRichTextContractError(f"{path}.runs is required")
    value = block["runs"]
    if not isinstance(value, Sequence) or isinstance(value, (str, bytes, bytearray)):
        raise DocxRichTextContractError(f"{path}.runs must be an array")
    runs = list(value)
    if not runs:
        raise DocxRichTextContractError(f"{path}.runs must contain at least one run")
    if len(runs) > _MAX_RICH_RUNS:
        raise DocxRichTextContractError(
            f"{path}.runs must contain at most {_MAX_RICH_RUNS} runs"
        )
    return runs


def _run_mapping(value: Any, path: str) -> Mapping[str, Any]:
    """Return one string-keyed run object or raise a bounded public error."""

    if not isinstance(value, Mapping):
        raise DocxRichTextContractError(f"{path} must be an object")
    if any(not isinstance(key, str) for key in value):
        raise DocxRichTextContractError(f"{path} object keys must be strings")
    return value


def _strict_boolean(value: Any, path: str) -> bool:
    """Return one strict JSON boolean and reject integer truthiness."""

    if not isinstance(value, bool):
        raise DocxRichTextContractError(f"{path} must be a boolean")
    return value
