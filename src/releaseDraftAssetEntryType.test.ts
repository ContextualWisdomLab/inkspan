import { spawnSync } from 'node:child_process';
import {
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

/** Extract the exact Linux shell body that validates local release entries. */
function localReleaseInventoryScript(): string {
  const validationIndex = workflow.indexOf(
    '- name: Verify bounded local release artifact set',
  );
  const attestIndex = workflow.indexOf(
    '- name: Attest release artifacts',
    validationIndex,
  );
  if (validationIndex < 0 || attestIndex < 0) {
    throw new Error('Local release validation or attestation step is missing.');
  }

  const validationStep = workflow.slice(validationIndex, attestIndex);
  const runMarker = '        run: |\n';
  const runIndex = validationStep.indexOf(runMarker);
  if (runIndex < 0) {
    throw new Error('Local release validation step has no shell body.');
  }

  return validationStep
    .slice(runIndex + runMarker.length)
    .split('\n')
    .map((line) => (line.startsWith('          ') ? line.slice(10) : line))
    .join('\n')
    .trimEnd();
}

/** Execute the exact local release-entry validation with deterministic files. */
function runLocalReleaseInventory(
  mutate?: (releaseDirectory: string) => void,
): { status: number | null; stdout: string; stderr: string } {
  const root = mkdtempSync(join(tmpdir(), 'inkspan-local-release-inventory-'));
  try {
    const releaseDirectory = join(root, 'release');
    mkdirSync(releaseDirectory);
    writeFileSync(join(releaseDirectory, 'inkspan.tgz'), 'npm-package');
    writeFileSync(join(releaseDirectory, 'inkspan_office.whl'), 'office-wheel');
    writeFileSync(
      join(releaseDirectory, 'inkspan.spdx.json'),
      '{"spdxVersion":"SPDX-2.3","packages":[]}',
    );
    writeFileSync(join(releaseDirectory, 'SHA256SUMS'), 'checksums');
    mutate?.(releaseDirectory);

    const result = spawnSync('bash', ['-c', localReleaseInventoryScript()], {
      cwd: root,
      encoding: 'utf8',
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

describe('local release artifact entry-type boundary', () => {
  it('accepts exactly the four expected regular release files', () => {
    if (process.platform !== 'linux') return;

    const result = runLocalReleaseInventory();

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
  });

  it('fails closed before attestation when an unexpected directory is present', () => {
    if (process.platform !== 'linux') return;

    const result = runLocalReleaseInventory((releaseDirectory) => {
      mkdirSync(join(releaseDirectory, 'stale-directory'));
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Unexpected local release artifact set');
  });
});
