import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const script = resolve(process.cwd(), 'benchmarks/compare-summaries.mjs');

function summary(measurement: number, digestCharacter: string) {
  return {
    contractVersion: 1,
    benchmarkId: 'markdown-serialization-large',
    unit: 'ms',
    sourceCommitSha: digestCharacter.repeat(40),
    artifactSha256: digestCharacter.repeat(64),
    documentProfile: 'large',
    runtimeId: 'node-22.18.0',
    referenceHardwareId: 'github-actions-ubuntu-24.04-x64',
    sampleCount: 1,
    percentileMethod: 'nearest-rank',
    minimum: measurement,
    p50: measurement,
    p75: measurement,
    p95: measurement,
    maximum: measurement,
  };
}

describe('benchmark regression comparator overflow contract', () => {
  it('fails closed instead of serializing an overflowing regression percentage as JSON null', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-benchmark-overflow-'));
    const baseline = join(root, 'baseline.json');
    const current = join(root, 'current.json');
    try {
      writeFileSync(
        baseline,
        `${JSON.stringify(summary(1e-308, 'a'))}\n`,
        'utf8',
      );
      writeFileSync(
        current,
        `${JSON.stringify(summary(1e308, 'b'))}\n`,
        'utf8',
      );

      const result = spawnSync(
        process.execPath,
        [
          script,
          '--baseline',
          baseline,
          '--current',
          current,
          '--metric',
          'p95',
          '--max-regression-percent',
          '10',
        ],
        { cwd: process.cwd(), encoding: 'utf8' },
      );

      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr.trim()).toBe(
        'Benchmark regression percent is not finite for the supplied measurements.',
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
