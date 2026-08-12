"""Correct the one-shot repair script's repeated release verification anchor."""

from pathlib import Path

path = Path(".github/scripts/address_writing_diagnostics_review.py")
source = path.read_text(encoding="utf-8")
old = '''    source = replace_once(
        source,
        "          for artifact in release/*.tgz release/*.whl release/inkspan.spdx.json release/SHA256SUMS; do",
        "          for artifact in release/*.tgz release/*.whl release/*.spdx.json release/SHA256SUMS; do",
        "release verification",
    )'''
new = '''    source = replace_count(
        source,
        "          for artifact in release/*.tgz release/*.whl release/inkspan.spdx.json release/SHA256SUMS; do",
        "          for artifact in release/*.tgz release/*.whl release/*.spdx.json release/SHA256SUMS; do",
        2,
        "release verification",
    )'''
if source.count(old) != 1:
    raise SystemExit("review repair counter anchor mismatch")
path.write_text(source.replace(old, new), encoding="utf-8")
