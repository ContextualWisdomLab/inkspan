import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('Actions workflow registry audit branch binding', () => {
  it('fails closed when the default branch moves during snapshot collection', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-actions-registry-branch-'));
    try {
      const inputPath = join(root, 'input.json');
      writeFileSync(
        inputPath,
        JSON.stringify({
          defaultBranchSha: 'a430b1c153702de3b6439def801732d7453b4940',
          defaultBranchShaAfter: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
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
        }),
        'utf8',
      );

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
      expect(result.stderr).toContain('default branch moved during observation');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
