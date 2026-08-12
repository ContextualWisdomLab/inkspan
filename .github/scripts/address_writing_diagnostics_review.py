"""Apply the bounded review fixes for writing-diagnostics assurance PR #285."""

from __future__ import annotations

import json
from pathlib import Path


def replace_once(source: str, old: str, new: str, label: str) -> str:
    """Replace one exact reviewed anchor or fail closed on branch drift."""
    occurrence_count = source.count(old)
    if occurrence_count != 1:
        raise SystemExit(
            f"{label} anchor mismatch: expected 1 occurrence, found {occurrence_count}"
        )
    return source.replace(old, new)


def replace_count(
    source: str,
    old: str,
    new: str,
    expected_count: int,
    label: str,
) -> str:
    """Replace an exact number of repeated reviewed anchors or fail closed."""
    occurrence_count = source.count(old)
    if occurrence_count != expected_count:
        raise SystemExit(
            f"{label} anchor mismatch: expected {expected_count}, "
            f"found {occurrence_count}"
        )
    return source.replace(old, new)


def update_security_test() -> None:
    """Make the hostile-HTML assertion match the actual image payload."""
    path = Path("src/components/writingDiagnosticsSecurity.test.tsx")
    source = path.read_text(encoding="utf-8")
    old = """    expect(document.querySelector('script[src=\"x\"]')).toBeNull();
    expect(screen.queryByText('HOST_CALLBACK_SECRET')).toBeNull();"""
    new = """    expect(document.querySelector('img[src=\"x\"]')).toBeNull();
    expect(
      screen.getByText('<img src=x onerror=alert(1)> explanation'),
    ).toBeVisible();
    expect(screen.queryByText('HOST_CALLBACK_SECRET')).toBeNull();"""
    path.write_text(
        replace_once(source, old, new, "security assertion"),
        encoding="utf-8",
    )


def update_browser_manifest() -> None:
    """Declare the React modules imported directly by the isolated harness."""
    path = Path("tests/browser/package.json")
    package = json.loads(path.read_text(encoding="utf-8"))
    development = package.setdefault("devDependencies", {})
    development["react"] = "18.3.1"
    development["react-dom"] = "18.3.1"
    package["devDependencies"] = dict(sorted(development.items()))
    path.write_text(
        json.dumps(package, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def update_release_workflow() -> None:
    """Generate, validate, attach, and publish one SBOM per exact package."""
    path = Path(".github/workflows/release.yml")
    source = path.read_text(encoding="utf-8")

    old_sbom = """      - name: Generate release SBOM
        run: |
          set -euo pipefail
          syft scan dir:. -o spdx-json > release/inkspan.spdx.json
      - name: Validate release SBOM
        run: |
          set -euo pipefail
          node <<'NODE'
          const { readFileSync, statSync } = require('node:fs');

          const sbomPath = 'release/inkspan.spdx.json';
          const sbom = JSON.parse(readFileSync(sbomPath, 'utf8'));
          const packageMetadata = JSON.parse(readFileSync('package.json', 'utf8'));
          const officeMetadata = readFileSync('office/pyproject.toml', 'utf8');
          if (statSync(sbomPath).size > 16 * 1024 * 1024) {
            throw new Error('Release SBOM exceeds the 16 MiB actions/attest input limit.');
          }
          if (sbom.spdxVersion !== 'SPDX-2.3') {
            throw new Error(`Release SBOM must be SPDX-2.3; found ${sbom.spdxVersion ?? 'missing'}.`);
          }
          if (!Array.isArray(sbom.packages) || sbom.packages.length === 0) {
            throw new Error('Release SBOM package inventory must not be empty.');
          }
          const sbomPackageNames = new Set(sbom.packages.map((pkg) => pkg.name));
          if (packageMetadata.name !== '@contextualwisdomlab/cwl-editor') {
            throw new Error('Release source has an unexpected editor package identity.');
          }
          if (!/^name\\s*=\\s*["']inkspan-office["']\\s*$/m.test(officeMetadata)) {
            throw new Error('Release source has an unexpected Office package identity.');
          }
          if (!sbomPackageNames.has(packageMetadata.name)) {
            throw new Error('Release SBOM inventory must include the editor package identity.');
          }
          if (!sbomPackageNames.has('inkspan-office')) {
            throw new Error('Release SBOM inventory must include the Office package identity.');
          }
          NODE
"""
    new_sbom = """      - name: Generate artifact-specific release SBOMs
        run: |
          set -euo pipefail
          mapfile -t npm_assets < <(
            find release -maxdepth 1 -type f -name '*.tgz' -printf '%f\\n' | LC_ALL=C sort
          )
          mapfile -t wheel_assets < <(
            find release -maxdepth 1 -type f -name '*.whl' -printf '%f\\n' | LC_ALL=C sort
          )
          if [[ ${#npm_assets[@]} -ne 1 || ${#wheel_assets[@]} -ne 1 ]]; then
            echo "::error::SBOM generation requires exactly one npm archive and one wheel."
            exit 1
          fi
          syft scan "release/${npm_assets[0]}" -o spdx-json > release/editor-package.spdx.json
          syft scan "release/${wheel_assets[0]}" -o spdx-json > release/office-package.spdx.json
      - name: Validate artifact-specific SBOM relationships
        run: |
          set -euo pipefail
          node <<'NODE'
          const { readFileSync, statSync } = require('node:fs');

          const specifications = [
            {
              sbomPath: 'release/editor-package.spdx.json',
              expectedName: '@contextualwisdomlab/cwl-editor',
              forbiddenName: 'inkspan-office',
            },
            {
              sbomPath: 'release/office-package.spdx.json',
              expectedName: 'inkspan-office',
              forbiddenName: '@contextualwisdomlab/cwl-editor',
            },
          ];

          function describedElementIds(sbom) {
            const described = new Set(
              Array.isArray(sbom.documentDescribes) ? sbom.documentDescribes : [],
            );
            for (const relationship of sbom.relationships ?? []) {
              if (relationship.relationshipType === 'DESCRIBES') {
                described.add(relationship.relatedSpdxElement);
              } else if (relationship.relationshipType === 'DESCRIBED_BY') {
                described.add(relationship.spdxElementId);
              }
            }
            return described;
          }

          for (const specification of specifications) {
            const sbom = JSON.parse(readFileSync(specification.sbomPath, 'utf8'));
            if (statSync(specification.sbomPath).size > 16 * 1024 * 1024) {
              throw new Error(`${specification.sbomPath} exceeds the 16 MiB attest input limit.`);
            }
            if (sbom.spdxVersion !== 'SPDX-2.3') {
              throw new Error(`${specification.sbomPath} must be SPDX-2.3.`);
            }
            if (!Array.isArray(sbom.packages) || sbom.packages.length === 0) {
              throw new Error(`${specification.sbomPath} has no package inventory.`);
            }
            const expectedPackages = sbom.packages.filter(
              (candidate) => candidate.name === specification.expectedName,
            );
            if (expectedPackages.length !== 1) {
              throw new Error(
                `${specification.sbomPath} must contain exactly one ${specification.expectedName} package.`,
              );
            }
            if (
              sbom.packages.some(
                (candidate) => candidate.name === specification.forbiddenName,
              )
            ) {
              throw new Error(
                `${specification.sbomPath} contains the other release package identity.`,
              );
            }
            const described = describedElementIds(sbom);
            if (!described.has(expectedPackages[0].SPDXID)) {
              throw new Error(
                `${specification.sbomPath} does not describe its matching release package.`,
              );
            }
          }
          NODE
"""
    source = replace_once(source, old_sbom, new_sbom, "release SBOM")
    source = replace_once(
        source,
        "          sha256sum -- *.tgz *.whl inkspan.spdx.json > SHA256SUMS",
        "          sha256sum -- *.tgz *.whl *.spdx.json > SHA256SUMS",
        "release checksum",
    )
    source = replace_count(
        source,
        "          expected_asset_count=4",
        "          expected_asset_count=5",
        2,
        "release asset count",
    )

    old_inventory = """            || ! -f release/inkspan.spdx.json \\
            || ! -f release/SHA256SUMS ]]; then
            echo "::error::Unexpected local release artifact set; require exactly one *.tgz, one *.whl, inkspan.spdx.json, and SHA256SUMS."""
    new_inventory = """            || ! -f release/editor-package.spdx.json \\
            || ! -f release/office-package.spdx.json \\
            || ! -f release/SHA256SUMS ]]; then
            echo "::error::Unexpected local release artifact set; require exactly one *.tgz, one *.whl, two matching *.spdx.json files, and SHA256SUMS."""
    source = replace_count(
        source,
        old_inventory,
        new_inventory,
        2,
        "release inventory",
    )

    old_attest = """      - name: Attest release artifacts
        uses: actions/attest@59d89421af93a897026c735860bf21b6eb4f7b26 # v4.1.0
        with:
          subject-path: |
            release/*.tgz
            release/*.whl
            release/inkspan.spdx.json
            release/SHA256SUMS
      - name: Attest release packages with SBOM
        uses: actions/attest@59d89421af93a897026c735860bf21b6eb4f7b26 # v4.1.0
        with:
          subject-path: |
            release/*.tgz
            release/*.whl
          sbom-path: release/inkspan.spdx.json
"""
    new_attest = """      - name: Attest release artifacts
        uses: actions/attest@59d89421af93a897026c735860bf21b6eb4f7b26 # v4.1.0
        with:
          subject-path: |
            release/*.tgz
            release/*.whl
            release/*.spdx.json
            release/SHA256SUMS
      - name: Attest npm package with its exact SBOM
        uses: actions/attest@59d89421af93a897026c735860bf21b6eb4f7b26 # v4.1.0
        with:
          subject-path: release/*.tgz
          sbom-path: release/editor-package.spdx.json
      - name: Attest Office wheel with its exact SBOM
        uses: actions/attest@59d89421af93a897026c735860bf21b6eb4f7b26 # v4.1.0
        with:
          subject-path: release/*.whl
          sbom-path: release/office-package.spdx.json
"""
    source = replace_once(source, old_attest, new_attest, "release attestation")
    source = replace_once(
        source,
        "          for artifact in release/*.tgz release/*.whl release/inkspan.spdx.json release/SHA256SUMS; do",
        "          for artifact in release/*.tgz release/*.whl release/*.spdx.json release/SHA256SUMS; do",
        "release verification",
    )
    path.write_text(source, encoding="utf-8")


def main() -> None:
    """Apply every current, verified review finding in one bounded mutation."""
    update_security_test()
    update_browser_manifest()
    update_release_workflow()


if __name__ == "__main__":
    main()
