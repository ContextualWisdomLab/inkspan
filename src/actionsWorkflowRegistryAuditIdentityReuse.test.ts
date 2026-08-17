import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('Actions workflow registry audit identity reuse', () => {
  it('keeps duplicate active identities for one canonical path unresolved', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-actions-registry-identity-'));
    try {
      const inputPath = join(root, 'input.json');
      writeFileSync(
        inputPath,
        JSON.stringify({
          defaultBranchSha: 'e8109ec2a17de8bd6594487aa12c8c8a93cb2c03',
          observedAt: '2026-08-14T17:42:00.000Z',
          presentWorkflowPaths: ['.github/workflows/ci.yml'],
          pages: [
            {
              page: 1,
              perPage: 100,
              totalCount: 3,
              items: [
                {
                  id: 201,
                  path: '.github/workflows/ci.yml',
                  state: 'active',
                },
                {
                  id: 202,
                  path: '.github/workflows/ci.yml',
                  state: 'active',
                },
                {
                  id: 203,
                  path: '.github/workflows/ci.yml',
                  state: 'disabled_manually',
                },
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
      expect(result.status).toBe(0);
      const evidence = JSON.parse(result.stdout) as {
        workflows: Array<{ id: number; classification: string }>;
      };
      expect(evidence.workflows).toEqual([
        {
          id: 201,
          path: '.github/workflows/ci.yml',
          state: 'active',
          classification: 'unresolved_identity',
        },
        {
          id: 202,
          path: '.github/workflows/ci.yml',
          state: 'active',
          classification: 'unresolved_identity',
        },
        {
          id: 203,
          path: '.github/workflows/ci.yml',
          state: 'disabled_manually',
          classification: 'disabled',
        },
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
