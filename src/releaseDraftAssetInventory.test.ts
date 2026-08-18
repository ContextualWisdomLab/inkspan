import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/** Read one authoritative repository file as UTF-8 text. */
function repositoryFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const workflow = repositoryFile('.github/workflows/release.yml');

interface ReleaseAssetFixture {
  name: string;
  state: string;
  digest: string;
}

interface ReleaseFixture {
  tag_name: string;
  draft: boolean;
  assets: ReleaseAssetFixture[];
}

/** Extract the exact Linux shell body used to validate a draft release. */
function releaseInventoryScript(): string {
  const inventoryIndex = workflow.indexOf(
    '- name: Verify exact draft release asset inventory',
  );
  const publishIndex = workflow.indexOf(
    '- name: Publish immutable GitHub release',
    inventoryIndex,
  );
  if (inventoryIndex < 0 || publishIndex < 0) {
    throw new Error('Release inventory or publication step is missing.');
  }

  const inventoryStep = workflow.slice(inventoryIndex, publishIndex);
  const runMarker = '        run: |\n';
  const runIndex = inventoryStep.indexOf(runMarker);
  if (runIndex < 0) {
    throw new Error('Release inventory step has no shell body.');
  }

  return inventoryStep
    .slice(runIndex + runMarker.length)
    .split('\n')
    .map((line) => (line.startsWith('          ') ? line.slice(10) : line))
    .join('\n')
    .trimEnd();
}

/** Return a GitHub-compatible SHA-256 asset digest for deterministic fixtures. */
function releaseDigest(content: string): string {
  return `sha256:${createHash('sha256').update(content).digest('hex')}`;
}

/** Execute the exact release inventory shell with a local fake GitHub API. */
function runReleaseInventory(
  mutate?: (pages: ReleaseFixture[][]) => void,
): { status: number | null; stdout: string; stderr: string } {
  const root = mkdtempSync(join(tmpdir(), 'inkspan-release-inventory-'));
  try {
    const releaseDirectory = join(root, 'release');
    const binDirectory = join(root, 'bin');
    mkdirSync(releaseDirectory);
    mkdirSync(binDirectory);

    const localFiles = {
      'inkspan.tgz': 'npm-package',
      'inkspan_office.whl': 'office-wheel',
      'inkspan.spdx.json': '{"spdxVersion":"SPDX-2.3","packages":[]}',
      SHA256SUMS: 'checksums',
    } as const;
    for (const [name, content] of Object.entries(localFiles)) {
      writeFileSync(join(releaseDirectory, name), content);
    }

    const release: ReleaseFixture = {
      tag_name: 'v0.6.0',
      draft: true,
      assets: Object.entries(localFiles).map(([name, content]) => ({
        name,
        state: 'uploaded',
        digest: releaseDigest(content),
      })),
    };
    const pages: ReleaseFixture[][] = [[release]];
    mutate?.(pages);

    const fixturePath = join(root, 'release-pages.json');
    writeFileSync(fixturePath, JSON.stringify(pages));

    const fakeGhPath = join(binDirectory, 'gh');
    writeFileSync(
      fakeGhPath,
      [
        '#!/usr/bin/env bash',
        'set -euo pipefail',
        'if [[ "${1:-}" != "api" ]]; then',
        '  echo "unsupported gh command" >&2',
        '  exit 64',
        'fi',
        'cat "$INKSPAN_RELEASE_FIXTURE"',
        '',
      ].join('\n'),
    );
    chmodSync(fakeGhPath, 0o755);

    const result = spawnSync('bash', ['-c', releaseInventoryScript()], {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${binDirectory}:${process.env.PATH ?? ''}`,
        GITHUB_REF_NAME: 'v0.6.0',
        GITHUB_REPOSITORY: 'ContextualWisdomLab/inkspan',
        INKSPAN_RELEASE_FIXTURE: fixturePath,
      },
    });
    return {
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe('release draft asset inventory contract', () => {
  it('rejects an unexpected local artifact before attestation or upload', () => {
    const localValidationIndex = workflow.indexOf(
      '- name: Verify bounded local release artifact set',
    );
    const attestIndex = workflow.indexOf('- name: Attest release artifacts');
    const uploadIndex = workflow.indexOf('gh release upload "$GITHUB_REF_NAME"');

    expect(localValidationIndex).toBeGreaterThan(-1);
    expect(attestIndex).toBeGreaterThan(localValidationIndex);
    expect(uploadIndex).toBeGreaterThan(attestIndex);

    const localValidationStep = workflow.slice(
      localValidationIndex,
      attestIndex,
    );
    expect(localValidationStep).toContain('expected_asset_count=4');
    expect(localValidationStep).toContain('*.tgz');
    expect(localValidationStep).toContain('*.whl');
    expect(localValidationStep).toContain('inkspan.spdx.json');
    expect(localValidationStep).toContain('SHA256SUMS');
    expect(localValidationStep).toContain(
      'Unexpected local release artifact set',
    );
  });

  it('validates the exact uploaded draft inventory before publishing', () => {
    const uploadIndex = workflow.indexOf('gh release upload "$GITHUB_REF_NAME"');
    const inventoryIndex = workflow.indexOf(
      '- name: Verify exact draft release asset inventory',
    );
    const publishIndex = workflow.indexOf(
      'gh release edit "$GITHUB_REF_NAME"',
    );

    expect(uploadIndex).toBeGreaterThan(-1);
    expect(inventoryIndex).toBeGreaterThan(uploadIndex);
    expect(publishIndex).toBeGreaterThan(inventoryIndex);

    const inventoryStep = workflow.slice(inventoryIndex, publishIndex);
    expect(inventoryStep).toContain('gh api');
    expect(inventoryStep).toContain('--paginate');
    expect(inventoryStep).toContain('--slurp');
    expect(inventoryStep).toContain(
      'repos/$GITHUB_REPOSITORY/releases?per_page=100',
    );
    expect(inventoryStep).toContain('select(.tag_name == $tag)');
    expect(inventoryStep).not.toContain(
      'releases/tags/$GITHUB_REF_NAME',
    );
    expect(inventoryStep).toContain('Expected exactly one draft release for tag');
    expect(inventoryStep).toContain("release_state='.draft'");
    expect(inventoryStep).toContain("asset_state='.assets[].state'");
    expect(inventoryStep).toContain("asset_digest='.assets[].digest'");
    expect(inventoryStep).toContain('sha256sum --');
    expect(inventoryStep).toContain('Unexpected draft release asset inventory');
    expect(inventoryStep).toContain('Draft release asset digest mismatch');
  });

  it('admits only the expected npm, wheel, SBOM, and checksum artifact set', () => {
    const inventoryIndex = workflow.indexOf(
      '- name: Verify exact draft release asset inventory',
    );
    const publishIndex = workflow.indexOf(
      'gh release edit "$GITHUB_REF_NAME"',
    );
    const inventoryStep = workflow.slice(inventoryIndex, publishIndex);

    expect(inventoryStep).toContain('expected_asset_count=4');
    expect(inventoryStep).toContain('*.tgz');
    expect(inventoryStep).toContain('*.whl');
    expect(inventoryStep).toContain('inkspan.spdx.json');
    expect(inventoryStep).toContain('SHA256SUMS');
    expect(inventoryStep).toContain('Unexpected local release artifact set');
    expect(inventoryStep).toContain("asset_name='.assets[].name'");
  });

  it('documents fail-closed stale-draft handling and provenance scope', () => {
    const releaseSecurity = repositoryFile('docs/release-security.md');
    const changelog = repositoryFile('CHANGELOG.md');

    expect(releaseSecurity).toContain('exact draft asset inventory');
    expect(releaseSecurity).toContain('unexpected stale asset');
    expect(releaseSecurity).toContain('before the draft is published');
    expect(releaseSecurity).toContain('sha256:');
    expect(releaseSecurity).toContain('List releases');
    expect(changelog).toContain('draft release asset inventory');
  });
});

if (process.platform === 'linux') {
  describe('release draft asset inventory Linux execution', () => {
    it('accepts only the exact uploaded draft and matching digests', () => {
      const result = runReleaseInventory();

      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
    });

    it('fails closed when a stale remote asset remains attached', () => {
      const result = runReleaseInventory((pages) => {
        pages[0]![0]!.assets.push({
          name: 'stale.zip',
          state: 'uploaded',
          digest: `sha256:${'0'.repeat(64)}`,
        });
      });

      expect(result.status).toBe(1);
      expect(result.stdout).toContain('Unexpected draft release asset inventory');
    });

    it('fails closed when GitHub reports a different asset digest', () => {
      const result = runReleaseInventory((pages) => {
        pages[0]![0]!.assets[0]!.digest = `sha256:${'0'.repeat(64)}`;
      });

      expect(result.status).toBe(1);
      expect(result.stdout).toContain('Draft release asset digest mismatch');
    });

    it('fails closed when any remote asset is not fully uploaded', () => {
      const result = runReleaseInventory((pages) => {
        pages[0]![0]!.assets[0]!.state = 'new';
      });

      expect(result.status).toBe(1);
      expect(result.stdout).toContain('not fully uploaded');
    });

    it('fails closed if the selected release is no longer a draft', () => {
      const result = runReleaseInventory((pages) => {
        pages[0]![0]!.draft = false;
      });

      expect(result.status).toBe(1);
      expect(result.stdout).toContain('Release must remain a draft');
    });
  });
}
