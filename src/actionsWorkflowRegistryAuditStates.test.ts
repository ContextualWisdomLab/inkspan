import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

const temporaryRoots: string[] = [];

function runAudit(state: string) {
  const root = mkdtempSync(join(tmpdir(), 'inkspan-actions-registry-state-'));
  temporaryRoots.push(root);
  const inputPath = join(root, 'input.json');
  writeFileSync(
    inputPath,
    JSON.stringify({
      defaultBranchSha: 'a430b1c153702de3b6439def801732d7453b4940',
      observedAt: '2026-08-12T13:26:00.000Z',
      presentWorkflowPaths: ['.github/workflows/ci.yml'],
      pages: [
        {
          page: 1,
          perPage: 100,
          totalCount: 1,
          items: [{ id: 1, path: '.github/workflows/ci.yml', state }],
        },
      ],
    }),
    'utf8',
  );

  return spawnSync(
    process.execPath,
    [resolve('scripts/audit-actions-workflow-registry.mjs'), '--input', inputPath],
    {
      cwd: resolve('.'),
      encoding: 'utf8',
      timeout: 10_000,
      env: process.env,
    },
  );
}

afterEach(() => {
  while (temporaryRoots.length > 0) {
    rmSync(temporaryRoots.pop()!, { recursive: true, force: true });
  }
});

describe('Actions workflow registry state boundary', () => {
  it('accepts the documented inactive workflow states as non-active evidence', () => {
    for (const state of [
      'deleted',
      'disabled_fork',
      'disabled_inactivity',
      'disabled_manually',
    ]) {
      const result = runAudit(state);
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        workflows: [{ state, classification: 'disabled' }],
      });
    }
  });

  it('fails closed instead of treating an undocumented workflow state as disabled', () => {
    const result = runAudit('suspended_future_state');

    expect(result.status).not.toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('workflow registry item is invalid');
  });
});
