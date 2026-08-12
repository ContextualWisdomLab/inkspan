import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

function baseFixture() {
  return {
    defaultBranchSha: 'a430b1c153702de3b6439def801732d7453b4940',
    observedAt: '2026-08-12T11:42:20.000Z',
    presentWorkflowPaths: ['.github/workflows/ci.yml'],
    pages: [
      {
        page: 1,
        perPage: 100,
        totalCount: 1,
        items: [
          { id: 1, path: '.github/workflows/ci.yml', state: 'active' },
        ],
      },
    ],
  };
}

describe('Actions workflow registry audit UTF-8 boundary', () => {
  it('fails closed before JSON parsing when the fixture contains malformed UTF-8', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-actions-registry-utf8-'));
    try {
      const inputPath = join(root, 'input.json');
      const bytes = Buffer.from(JSON.stringify(baseFixture()), 'utf8');
      const needle = Buffer.from('ci.yml', 'utf8');
      const offset = bytes.indexOf(needle);
      expect(offset).toBeGreaterThanOrEqual(0);
      bytes[offset] = 0x80;
      writeFileSync(inputPath, bytes);

      const result = spawnSync(
        process.execPath,
        [resolve('scripts/audit-actions-workflow-registry.mjs'), '--input', inputPath],
        {
          cwd: resolve('.'),
          encoding: 'utf8',
          timeout: 10_000,
          env: process.env,
        },
      );

      expect(result.error).toBeUndefined();
      expect(result.status).not.toBe(0);
      expect(result.stdout).toBe('');
      expect(result.stderr).toContain('input is not valid UTF-8');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
