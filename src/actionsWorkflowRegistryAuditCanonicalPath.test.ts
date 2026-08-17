import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('Actions workflow registry audit canonical paths', () => {
  it('keeps non-canonical repository paths unresolved instead of actionable orphans', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-actions-registry-paths-'));
    try {
      const inputPath = join(root, 'input.json');
      writeFileSync(
        inputPath,
        JSON.stringify({
          defaultBranchSha: 'e8109ec2a17de8bd6594487aa12c8c8a93cb2c03',
          observedAt: '2026-08-14T02:09:41.000Z',
          presentWorkflowPaths: [],
          pages: [
            {
              page: 1,
              perPage: 100,
              totalCount: 3,
              items: [
                {
                  id: 101,
                  path: '.github/workflows/../ci.yml',
                  state: 'active',
                },
                {
                  id: 102,
                  path: '.github/workflows/./ci.yml',
                  state: 'active',
                },
                {
                  id: 103,
                  path: '.github/workflows//ci.yml',
                  state: 'active',
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
        workflows: Array<{ classification: string }>;
      };
      expect(evidence.workflows.map(({ classification }) => classification)).toEqual([
        'unresolved_path',
        'unresolved_path',
        'unresolved_path',
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
