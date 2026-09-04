import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const DEFAULT_BRANCH_SHA = 'e8109ec2a17de8bd6594487aa12c8c8a93cb2c03';
const REPAIR_HEAD_SHA = '6b54294c360c77916f9956837a41cea3833adcbe';
const REPAIR_PATH = '.github/workflows/current-once.yml';

function runAudit(fixture: unknown) {
  const root = mkdtempSync(join(tmpdir(), 'inkspan-actions-registry-repair-owner-'));
  try {
    const inputPath = join(root, 'input.json');
    writeFileSync(inputPath, JSON.stringify(fixture), 'utf8');
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
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function baseFixture() {
  return {
    defaultBranchSha: DEFAULT_BRANCH_SHA,
    observedAt: '2026-08-14T18:00:00.000Z',
    presentWorkflowPaths: ['.github/workflows/ci.yml'],
    pages: [
      {
        page: 1,
        perPage: 100,
        totalCount: 1,
        items: [{ id: 501, path: REPAIR_PATH, state: 'active' }],
      },
    ],
  };
}

describe('Actions workflow registry repair ownership evidence', () => {
  it('rejects path-only repair exemptions that are not bound to an exact active PR head', () => {
    const result = runAudit({
      ...baseFixture(),
      ownedActiveRepairPaths: [REPAIR_PATH],
    });

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('invalid top-level contract');
  });

  it('retains exact PR and head identity for a validated active repair exemption', () => {
    const result = runAudit({
      ...baseFixture(),
      ownedActiveRepairs: [
        {
          path: REPAIR_PATH,
          prNumber: 279,
          headSha: REPAIR_HEAD_SHA,
        },
      ],
    });

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    const evidence = JSON.parse(result.stdout) as {
      workflows: Array<{
        classification: string;
        repairOwner?: { prNumber: number; headSha: string };
      }>;
    };
    expect(evidence.workflows).toEqual([
      expect.objectContaining({
        classification: 'owned_active_repair',
        repairOwner: { prNumber: 279, headSha: REPAIR_HEAD_SHA },
      }),
    ]);
  });
});
