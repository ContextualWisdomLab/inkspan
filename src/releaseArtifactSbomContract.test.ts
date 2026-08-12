import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const releaseWorkflow = readFileSync(
  new URL('../.github/workflows/release.yml', import.meta.url),
  'utf8',
);

describe('release artifact SBOM provenance contract', () => {
  it('scans each exact package artifact instead of the source workspace', () => {
    expect(releaseWorkflow).not.toContain('syft scan dir:.');
    expect(releaseWorkflow).toContain(
      'syft scan "release/${npm_assets[0]}" -o spdx-json > release/editor-package.spdx.json',
    );
    expect(releaseWorkflow).toContain(
      'syft scan "release/${wheel_assets[0]}" -o spdx-json > release/office-package.spdx.json',
    );
  });

  it('keeps the two package SBOMs distinct through checksums and bounded release assets', () => {
    expect(releaseWorkflow).toContain(
      'sha256sum -- *.tgz *.whl *.spdx.json > SHA256SUMS',
    );
    expect(releaseWorkflow.match(/expected_asset_count=5/gu)).toHaveLength(2);
    expect(releaseWorkflow).toContain('release/editor-package.spdx.json');
    expect(releaseWorkflow).toContain('release/office-package.spdx.json');
    expect(releaseWorkflow).not.toContain('release/inkspan.spdx.json');
  });

  it('attests each package only with its matching SBOM', () => {
    expect(releaseWorkflow).toContain(
      'subject-path: release/*.tgz\n          sbom-path: release/editor-package.spdx.json',
    );
    expect(releaseWorkflow).toContain(
      'subject-path: release/*.whl\n          sbom-path: release/office-package.spdx.json',
    );
    expect(releaseWorkflow).not.toContain(
      'subject-path: |\n            release/*.tgz\n            release/*.whl\n          sbom-path:',
    );
  });
});
