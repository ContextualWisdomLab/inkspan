import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const script = resolve(process.cwd(), 'benchmarks/compare-summaries.mjs');
const SOURCE_COMMIT_SHA = 'a'.repeat(40);
const ARTIFACT_SHA256 = 'b'.repeat(64);
const CURRENT_ARTIFACT_SHA256 = 'c'.repeat(64);

type SummaryOverrides = Partial<{
  contractVersion: number;
  benchmarkId: string;
  unit: string;
  sourceCommitSha: string;
  artifactSha256: string;
  inputSha256: string;
  resultingInputSha256: string;
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
    ...(overrides.contractVersion === 3 ? {
      inputSha256: 'd'.repeat(64),
      ...(overrides.benchmarkId?.startsWith('transition-changed-evidence-')
        ? { resultingInputSha256: 'e'.repeat(64) } : {}),
    } : {}),
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
  it.each([
    ['editor-input-large', 1], ['editor-input-large', 2],
    ['transition-changed-evidence-large', 1], ['transition-changed-evidence-large', 2],
    ['editor-input-large', 3], ['transition-changed-evidence-large', 3],
  ] as const)(
    'compares exact-context %s generation %i evidence with an explicit tolerance', (benchmarkId, contractVersion) => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-benchmark-compare-pass-'));
    try {
      const result = runComparison(
        root,
        summary({ benchmarkId, contractVersion }),
        summary({ benchmarkId, contractVersion, artifactSha256: CURRENT_ARTIFACT_SHA256, p95: 104 }),
        '5',
      );

      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      expect(JSON.parse(result.stdout)).toEqual({
        contractVersion,
        benchmarkId,
        unit: 'ms',
        ...(contractVersion === 3 ? {
          inputSha256: 'd'.repeat(64),
          ...(benchmarkId.startsWith('transition-changed-evidence-')
            ? { resultingInputSha256: 'e'.repeat(64) } : {}),
        } : {}),
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

  it.each([[1, 2], [2, 1], [2, 3], [3, 2], [1, 3], [3, 1]])('rejects generation %i versus %i even with a generous tolerance', (baselineVersion, currentVersion) => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-benchmark-compare-generation-'));
    try {
      const result = runComparison(root,
        summary({ contractVersion: baselineVersion }),
        summary({ contractVersion: currentVersion, artifactSha256: CURRENT_ARTIFACT_SHA256 }), '100');
      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr.trim()).toBe('Benchmark summaries are not comparable: contractVersion differs.');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each(['inputSha256', 'resultingInputSha256'] as const)('rejects a changed %s before reporting a speedup', (field) => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-benchmark-compare-input-'));
    try {
      const baseline = summary({ contractVersion: 3, benchmarkId: 'transition-changed-evidence-large' });
      const current = { ...baseline, artifactSha256: CURRENT_ARTIFACT_SHA256, [field]: 'f'.repeat(64), p95: 90 };
      const result = runComparison(root, baseline, current, '100');
      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr.trim()).toBe(`Benchmark summaries are not comparable: ${field} differs.`);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each([
    { contractVersion: 3, inputSha256: undefined },
    { contractVersion: 3, inputSha256: 'private-path' },
    { contractVersion: 3, inputSha256: 'A'.repeat(64) },
    { contractVersion: 3, resultingInputSha256: 'e'.repeat(64) },
    { contractVersion: 2, inputSha256: 'd'.repeat(64) },
    { contractVersion: 3, benchmarkId: 'transition-changed-evidence-large', resultingInputSha256: undefined },
    { contractVersion: 3, benchmarkId: 'transition-changed-evidence-large', resultingInputSha256: 'd'.repeat(64) },
  ])('rejects invalid input identity metadata %j', (overrides) => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-benchmark-compare-input-invalid-'));
    try {
      const result = runComparison(root, summary(overrides), summary({ ...overrides, artifactSha256: CURRENT_ARTIFACT_SHA256 }), '100');
      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr).not.toContain('private-path');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects comparisons between changed and unchanged transition scenarios', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-transition-compare-'));
    try {
      const result = runComparison(root,
        summary({ benchmarkId: 'transition-evidence-large' }),
        summary({ benchmarkId: 'transition-changed-evidence-large', artifactSha256: CURRENT_ARTIFACT_SHA256 }), '5');
      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr.trim()).toBe('Benchmark summaries are not comparable: benchmarkId differs.');
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

  it('rejects symlinked summary inputs instead of comparing mutable aliases', () => {
    if (process.platform === 'win32') return;

    const root = mkdtempSync(join(tmpdir(), 'inkspan-benchmark-compare-symlink-'));
    const baselineTargetPath = join(root, 'baseline-target.json');
    const baselinePath = join(root, 'baseline-link.json');
    const currentPath = join(root, 'current.json');
    try {
      writeFileSync(baselineTargetPath, `${JSON.stringify(summary())}\n`, 'utf8');
      symlinkSync(baselineTargetPath, baselinePath);
      writeFileSync(
        currentPath,
        `${JSON.stringify(summary({ artifactSha256: CURRENT_ARTIFACT_SHA256 }))}\n`,
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

      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr.trim()).toBe(
        'Benchmark summary input must be a regular non-symlink file.',
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('redacts a summary input path when a parent component is not a directory', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-benchmark-compare-path-privacy-'));
    try {
      const privateMarker = 'tenant-private-performance-baseline-parent';
      const privateParentPath = join(root, privateMarker);
      const baselinePath = join(privateParentPath, 'baseline.json');
      const currentPath = join(root, 'current.json');
      writeFileSync(privateParentPath, 'not-a-directory', 'utf8');
      writeFileSync(
        currentPath,
        `${JSON.stringify(summary({ artifactSha256: CURRENT_ARTIFACT_SHA256 }))}\n`,
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

      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr.trim()).toBe(
        'Benchmark summary input must be a regular file.',
      );
      expect(result.stderr).not.toContain(privateMarker);
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
