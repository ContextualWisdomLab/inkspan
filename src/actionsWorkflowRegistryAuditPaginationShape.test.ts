import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

function workflow(id: number) {
  return {
    id,
    path: `.github/workflows/workflow-${id}.yml`,
    state: 'active',
  };
}

describe('Actions workflow registry audit pagination shape', () => {
  it('fails closed when a non-final page is short even if later items fill the advertised total', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-actions-registry-pages-'));
    try {
      const inputPath = join(root, 'input.json');
      writeFileSync(
        inputPath,
        JSON.stringify({
          defaultBranchSha: 'a430b1c153702de3b6439def801732d7453b4940',
          observedAt: '2026-08-12T11:42:20.000Z',
          presentWorkflowPaths: [],
          pages: [
            {
              page: 1,
              perPage: 100,
              totalCount: 101,
              items: [workflow(1)],
            },
            {
              page: 2,
              perPage: 100,
              totalCount: 101,
              items: Array.from({ length: 100 }, (_, index) => workflow(index + 2)),
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
      expect(result.stderr).toContain('workflow registry pagination is incomplete');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
