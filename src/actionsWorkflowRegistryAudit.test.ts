import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

const temporaryRoots: string[] = [];

interface WorkflowFixture {
  readonly defaultBranchSha: string;
  readonly observedAt: string;
  readonly presentWorkflowPaths: readonly string[];
  readonly ownedActiveRepairPaths?: readonly string[];
  readonly pages: readonly {
    readonly page: number;
    readonly perPage: number;
    readonly totalCount: number;
    readonly items: readonly {
      readonly id: number;
      readonly path: string;
      readonly state: string;
    }[];
  }[];
}

function runAudit(fixture: WorkflowFixture) {
  const root = mkdtempSync(join(tmpdir(), 'inkspan-actions-registry-audit-'));
  temporaryRoots.push(root);
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
}

function baseFixture(): WorkflowFixture {
  return {
    defaultBranchSha: 'a430b1c153702de3b6439def801732d7453b4940',
    observedAt: '2026-08-12T11:42:20.000Z',
    presentWorkflowPaths: [
      '.github/workflows/ci.yml',
      '.github/workflows/release.yml',
    ],
    ownedActiveRepairPaths: ['.github/workflows/current-once.yml'],
    pages: [
      {
        page: 1,
        perPage: 100,
        totalCount: 5,
        items: [
          { id: 1, path: '.github/workflows/ci.yml', state: 'active' },
          { id: 2, path: '.github/workflows/release.yml', state: 'active' },
          {
            id: 3,
            path: '.github/workflows/historical-finalizer.yml',
            state: 'active',
          },
          {
            id: 4,
            path: '.github/workflows/current-once.yml',
            state: 'active',
          },
          {
            id: 5,
            path: 'dynamic/dependabot/dependabot-updates',
            state: 'active',
          },
        ],
      },
    ],
  };
}

afterEach(() => {
  while (temporaryRoots.length > 0) {
    rmSync(temporaryRoots.pop()!, { recursive: true, force: true });
  }
});

describe('Actions workflow registry audit', () => {
  it('classifies source-backed, orphaned, explicitly owned repair, and GitHub dynamic identities without name heuristics', () => {
    const result = runAudit(baseFixture());

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    const evidence = JSON.parse(result.stdout) as {
      defaultBranchSha: string;
      observedAt: string;
      complete: boolean;
      paginationReceipts: Array<{
        page: number;
        itemCount: number;
        totalCount: number;
      }>;
      workflows: Array<{
        id: number;
        path: string;
        state: string;
        classification: string;
      }>;
    };
    expect(evidence.defaultBranchSha).toBe(
      'a430b1c153702de3b6439def801732d7453b4940',
    );
    expect(evidence.observedAt).toBe('2026-08-12T11:42:20.000Z');
    expect(evidence.complete).toBe(true);
    expect(evidence.paginationReceipts).toEqual([
      { page: 1, itemCount: 5, totalCount: 5 },
    ]);
    expect(evidence.workflows).toEqual([
      {
        id: 1,
        path: '.github/workflows/ci.yml',
        state: 'active',
        classification: 'present',
      },
      {
        id: 2,
        path: '.github/workflows/release.yml',
        state: 'active',
        classification: 'present',
      },
      {
        id: 3,
        path: '.github/workflows/historical-finalizer.yml',
        state: 'active',
        classification: 'active_orphan',
      },
      {
        id: 4,
        path: '.github/workflows/current-once.yml',
        state: 'active',
        classification: 'owned_active_repair',
      },
      {
        id: 5,
        path: 'dynamic/dependabot/dependabot-updates',
        state: 'active',
        classification: 'github_dynamic',
      },
    ]);
  });

  it('fails closed when pagination does not account for the advertised registry total', () => {
    const fixture = baseFixture();
    const result = runAudit({
      ...fixture,
      pages: [
        {
          ...fixture.pages[0],
          totalCount: 6,
        },
      ],
    });

    expect(result.status).not.toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('workflow registry pagination is incomplete');
  });

  it('rejects an oversized fixture before whole-file materialization', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-actions-registry-audit-'));
    temporaryRoots.push(root);
    const inputPath = join(root, 'oversized-input.json');
    const preloadPath = join(root, 'guard-read-file-sync.cjs');
    writeFileSync(inputPath, Buffer.alloc(1024 * 1024 + 1, 0x20));
    writeFileSync(
      preloadPath,
      [
        "const fs = require('node:fs');",
        "const { syncBuiltinESMExports } = require('node:module');",
        'const originalReadFileSync = fs.readFileSync;',
        'fs.readFileSync = function guardedReadFileSync(path, ...args) {',
        "  if (String(path) === process.env.INKSPAN_GUARDED_INPUT) throw new Error('whole-file fixture materialization reached');",
        '  return originalReadFileSync.call(this, path, ...args);',
        '};',
        'syncBuiltinESMExports();',
      ].join('\n'),
      'utf8',
    );

    const nodeOptions = [
      process.env.NODE_OPTIONS,
      `--require=${preloadPath}`,
    ]
      .filter((value): value is string => Boolean(value))
      .join(' ');
    const result = spawnSync(
      process.execPath,
      [resolve('scripts/audit-actions-workflow-registry.mjs'), '--input', inputPath],
      {
        cwd: resolve('.'),
        encoding: 'utf8',
        timeout: 10_000,
        env: {
          ...process.env,
          INKSPAN_GUARDED_INPUT: inputPath,
          NODE_OPTIONS: nodeOptions,
        },
      },
    );

    expect(result.status).not.toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('input size is outside the supported bound');
    expect(result.stderr).not.toContain('whole-file fixture materialization reached');
  });

  it('does not silently treat path case or percent-encoding drift as an orphan match', () => {
    const fixture = baseFixture();
    const result = runAudit({
      ...fixture,
      pages: [
        {
          page: 1,
          perPage: 100,
          totalCount: 2,
          items: [
            { id: 8, path: '.github/workflows/CI.yml', state: 'active' },
            {
              id: 9,
              path: '.github/workflows%2Frelease.yml',
              state: 'active',
            },
          ],
        },
      ],
    });

    expect(result.status).toBe(0);
    const workflows = (
      JSON.parse(result.stdout) as {
        workflows: Array<{
          id: number;
          path: string;
          state: string;
          classification: string;
        }>;
      }
    ).workflows;
    expect(workflows).toEqual([
      {
        id: 8,
        path: '.github/workflows/CI.yml',
        state: 'active',
        classification: 'path_mismatch',
      },
      {
        id: 9,
        path: '.github/workflows%2Frelease.yml',
        state: 'active',
        classification: 'unresolved_path',
      },
    ]);
  });
});
