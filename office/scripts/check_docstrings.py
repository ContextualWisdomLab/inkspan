"""Fail CI when a shipped Inkspan Office symbol lacks a docstring."""

from __future__ import annotations

import ast
from collections.abc import Iterable
from pathlib import Path


_DOCUMENTABLE = (ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)


def _python_files(source_root: Path) -> Iterable[Path]:
    """Yield shipped Python modules in deterministic path order."""

    return sorted(source_root.rglob("*.py"))


def _missing_docstrings(source_root: Path) -> list[str]:
    """Return path-qualified module and symbol names missing docstrings."""

    missing: list[str] = []
    for path in _python_files(source_root):
        relative = path.relative_to(source_root)
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(relative))
        if ast.get_docstring(tree, clean=False) is None:
            missing.append(f"{relative}:<module>")
        for node in ast.walk(tree):
            if isinstance(node, _DOCUMENTABLE) and ast.get_docstring(node, clean=False) is None:
                missing.append(f"{relative}:{node.name}@{node.lineno}")
    return missing


def main() -> int:
    """Check the package source tree and return a process-style status code."""

    source_root = Path(__file__).resolve().parents[1] / "src" / "inkspan_office"
    missing = _missing_docstrings(source_root)
    if missing:
        print("Missing docstrings:")
        for item in missing:
            print(f"- {item}")
        return 1
    print("Docstring coverage: 100%")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
