"""Correct bounded anchors in the one-shot writing-diagnostics review repair."""

from pathlib import Path

path = Path(".github/scripts/address_writing_diagnostics_review.py")
source = path.read_text(encoding="utf-8")

old_counter = '''    source = replace_once(
        source,
        "          for artifact in release/*.tgz release/*.whl release/inkspan.spdx.json release/SHA256SUMS; do",
        "          for artifact in release/*.tgz release/*.whl release/*.spdx.json release/SHA256SUMS; do",
        "release verification",
    )'''
new_counter = '''    source = replace_count(
        source,
        "          for artifact in release/*.tgz release/*.whl release/inkspan.spdx.json release/SHA256SUMS; do",
        "          for artifact in release/*.tgz release/*.whl release/*.spdx.json release/SHA256SUMS; do",
        2,
        "release verification",
    )'''
if source.count(old_counter) != 1:
    raise SystemExit("review repair counter anchor mismatch")
source = source.replace(old_counter, new_counter)

old_security = '''    new = """    expect(document.querySelector('img[src=\\"x\\"]')).toBeNull();
    expect(
      screen.getByText('<img src=x onerror=alert(1)> explanation'),
    ).toBeVisible();
    expect(screen.queryByText('HOST_CALLBACK_SECRET')).toBeNull();"""'''
new_security = '''    new = """    expect(document.querySelector('img[src=\\"x\\"]')).toBeNull();
    expect(screen.queryByText('HOST_CALLBACK_SECRET')).toBeNull();"""'''
if source.count(old_security) != 1:
    raise SystemExit("review repair security anchor mismatch")
source = source.replace(old_security, new_security)

path.write_text(source, encoding="utf-8")
