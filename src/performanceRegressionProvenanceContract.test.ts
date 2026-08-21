import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const script = resolve(process.cwd(), 'benchmarks/compare-summaries.mjs');

function summary(sourceCommitSha: string, artifactSha256: string) {
  return {
    contractVersion: 1,
    benchmarkId: 'editor-input-large',
    unit: 'ms',
    sourceCommitSha,
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

describe('benchmark regression provenance contract', () => {
  it('binds each comparison receipt to both exact measured artifacts and the shared context', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-benchmark-provenance-'));
    try {
      const baselinePath = join(root, 'baseline.json');
      const currentPath = join(root, 'current.json');
      const baselineSourceCommitSha = 'a'.repeat(40);
      const currentSourceCommitSha = 'c'.repeat(40);
      const baselineArtifactSha256 = 'b'.repeat(64);
      const currentArtifactSha256 = 'd'.repeat(64);
      writeFileSync(
        baselinePath,
        `${JSON.stringify(summary(baselineSourceCommitSha, baselineArtifactSha256))}\n`,
        'utf8',
      );
      writeFileSync(
        currentPath,
        `${JSON.stringify(summary(currentSourceCommitSha, currentArtifactSha256))}\n`,
        'utf8',
      );

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

      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      expect(JSON.parse(result.stdout)).toEqual({
        contractVersion: 1,
        benchmarkId: 'editor-input-large',
        unit: 'ms',
        documentProfile: 'large',
        runtimeId: 'chromium-1.62.0',
        referenceHardwareId: 'github-actions-ubuntu-24.04-x64',
        sampleCount: 20,
        percentileMethod: 'nearest-rank',
        metric: 'p95',
        baselineSourceCommitSha,
        baselineArtifactSha256,
        currentSourceCommitSha,
        currentArtifactSha256,
        baselineValue: 100,
        currentValue: 100,
        maxRegressionPercent: 5,
        regressionPercent: 0,
        passed: true,
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
