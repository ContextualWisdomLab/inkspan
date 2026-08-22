import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const script = resolve(process.cwd(), 'benchmarks/compare-summaries.mjs');
const SOURCE_COMMIT_SHA = 'a'.repeat(40);
const ARTIFACT_SHA256 = 'b'.repeat(64);
const CURRENT_ARTIFACT_SHA256 = 'c'.repeat(64);

type SummaryOverrides = Partial<{
  benchmarkId: string;
  unit: string;
  sourceCommitSha: string;
  artifactSha256: string;
  documentProfile: string;
  runtimeId: string;
  referenceHardwareId: string;
  sampleCount: number;
  percentileMethod: string;
  minimum: number;
  p50: number;
  p75: number;
  p95: number;
  maximum: number;
}>;

function summary(overrides: SummaryOverrides = {}) {
  return {
    contractVersion: 1,
    benchmarkId: 'editor-input-large',
    unit: 'ms',
    sourceCommitSha: SOURCE_COMMIT_SHA,
    artifactSha256: ARTIFACT_SHA256,
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
    ...overrides,
  };
}

function runComparison(
  root: string,
  baseline: ReturnType<typeof summary>,
  current: ReturnType<typeof summary>,
  tolerancePercent: string,
) {
  const baselinePath = join(root, 'baseline.json');
  const currentPath = join(root, 'current.json');
  writeFileSync(baselinePath, `${JSON.stringify(baseline)}\n`, 'utf8');
  writeFileSync(currentPath, `${JSON.stringify(current)}\n`, 'utf8');
  return spawnSync(
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
      tolerancePercent,
    ],
    { cwd: process.cwd(), encoding: 'utf8' },
  );
}

describe('benchmark regression comparator contract', () => {
  it('passes only when a current exact-context metric stays within an explicit tolerance', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-benchmark-compare-pass-'));
    try {
      const result = runComparison(
        root,
        summary(),
        summary({ artifactSha256: CURRENT_ARTIFACT_SHA256, p95: 104 }),
        '5',
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
        baselineSourceCommitSha: SOURCE_COMMIT_SHA,
        baselineArtifactSha256: ARTIFACT_SHA256,
        currentSourceCommitSha: SOURCE_COMMIT_SHA,
        currentArtifactSha256: CURRENT_ARTIFACT_SHA256,
        baselineValue: 100,
        currentValue: 104,
        maxRegressionPercent: 5,
        regressionPercent: 4,
        passed: true,
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails a material unapproved regression without hiding the measured receipt', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-benchmark-compare-fail-'));
    try {
      const result = runComparison(
        root,
        summary(),
        summary({ artifactSha256: CURRENT_ARTIFACT_SHA256, p95: 106 }),
        '5',
      );

      expect(result.status).toBe(1);
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
        baselineSourceCommitSha: SOURCE_COMMIT_SHA,
        baselineArtifactSha256: ARTIFACT_SHA256,
        currentSourceCommitSha: SOURCE_COMMIT_SHA,
        currentArtifactSha256: CURRENT_ARTIFACT_SHA256,
        baselineValue: 100,
        currentValue: 106,
        maxRegressionPercent: 5,
        regressionPercent: 6,
        passed: false,
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects incomparable runtime or hardware evidence instead of laundering it through a tolerance', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-benchmark-compare-context-'));
    try {
      const result = runComparison(
        root,
        summary(),
        summary({ referenceHardwareId: 'github-actions-ubuntu-22.04-x64' }),
        '5',
      );

      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr.trim()).toBe(
        'Benchmark summaries are not comparable: referenceHardwareId differs.',
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects private-looking units at the direct summary-comparison boundary', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-benchmark-compare-unit-'));
    try {
      const result = runComparison(
        root,
        summary({ unit: 'tenant-acme' }),
        summary({ artifactSha256: CURRENT_ARTIFACT_SHA256, unit: 'tenant-acme' }),
        '5',
      );

      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr.trim()).toBe('Benchmark summary unit is invalid.');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('requires an explicit finite non-negative regression tolerance', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-benchmark-compare-tolerance-'));
    try {
      const result = runComparison(root, summary(), summary(), '-1');

      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr.trim()).toBe(
        'Benchmark max regression percent must be a finite non-negative number.',
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed on a named-pipe summary instead of blocking before regular-file validation', () => {
    if (process.platform === 'win32') return;

    const root = mkdtempSync(join(tmpdir(), 'inkspan-benchmark-compare-fifo-'));
    const baselinePath = join(root, 'baseline.pipe');
    const currentPath = join(root, 'current.json');
    try {
      const mkfifo = spawnSync('mkfifo', [baselinePath], { encoding: 'utf8' });
      expect(mkfifo.status).toBe(0);
      writeFileSync(currentPath, `${JSON.stringify(summary())}\n`, 'utf8');

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
        { cwd: process.cwd(), encoding: 'utf8', timeout: 1000 },
      );

      expect(result.error).toBeUndefined();
      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr.trim()).toBe(
        'Benchmark summary input must be a regular file.',
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
