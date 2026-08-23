import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const script = resolve(process.cwd(), 'benchmarks/compare-summaries.mjs');

function summary(artifactSha256: string) {
  return {
    contractVersion: 1,
    benchmarkId: 'editor-input-small',
    unit: 'ms',
    sourceCommitSha: 'a'.repeat(40),
    artifactSha256,
    documentProfile: 'large',
    runtimeId: 'chromium-1.62.0',
    referenceHardwareId: 'github-actions-ubuntu-24.04-x64',
    sampleCount: 20,
    percentileMethod: 'nearest-rank',
    minimum: 70,
    p50: 80,
    p75: 90,
    p95: 100,
    maximum: 110,
  };
}

describe('benchmark regression profile consistency contract', () => {
  it('rejects summaries whose benchmarkId profile disagrees with documentProfile', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-benchmark-profile-'));
    const baselinePath = join(root, 'baseline.json');
    const currentPath = join(root, 'current.json');

    try {
      writeFileSync(baselinePath, `${JSON.stringify(summary('b'.repeat(64)))}\n`, 'utf8');
      writeFileSync(currentPath, `${JSON.stringify(summary('c'.repeat(64)))}\n`, 'utf8');

      const result = spawnSync(
        process.execPath,
        [
          script,
          '--baseline',
          baselinePath,
          '--current',
          currentPath,
          '--metric',
          'p95',
          '--max-regression-percent',
          '5',
        ],
        { cwd: process.cwd(), encoding: 'utf8' },
      );

      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr.trim()).toBe(
        'Benchmark summary profile must match documentProfile.',
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
