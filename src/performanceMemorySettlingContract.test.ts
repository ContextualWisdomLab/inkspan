import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const script = resolve(process.cwd(), 'benchmarks/analyze-memory-settling.mjs');
const SOURCE_COMMIT_SHA = 'a'.repeat(40);
const ARTIFACT_SHA256 = 'b'.repeat(64);

type MemoryEvidenceOverrides = Partial<{
  benchmarkId: string;
  sourceCommitSha: string;
  artifactSha256: string;
  documentProfile: string;
  runtimeId: string;
  referenceHardwareId: string;
  warmupSamples: number;
  samples: number[];
}>;

function evidence(overrides: MemoryEvidenceOverrides = {}) {
  return {
    contractVersion: 1,
    benchmarkId: 'editor-lifecycle-retained-memory-large',
    unit: 'bytes',
    sourceCommitSha: SOURCE_COMMIT_SHA,
    artifactSha256: ARTIFACT_SHA256,
    documentProfile: 'large',
    runtimeId: 'node-24.0.0',
    referenceHardwareId: 'github-actions-ubuntu-24.04-x64',
    warmupSamples: 2,
    samples: [900, 920, 1000, 1005, 995, 1010, 1015, 1008, 1012, 1010],
    ...overrides,
  };
}

function runAnalysis(
  root: string,
  input: ReturnType<typeof evidence>,
  maxGrowthBytes: string,
  windowSize = '3',
) {
  const inputPath = join(root, 'memory-evidence.json');
  writeFileSync(inputPath, `${JSON.stringify(input)}\n`, 'utf8');
  return spawnSync(
    process.execPath,
    [
      script,
      '--input',
      inputPath,
      '--window-size',
      windowSize,
      '--max-growth-bytes',
      maxGrowthBytes,
    ],
    { cwd: process.cwd(), encoding: 'utf8' },
  );
}

describe('retained-memory settling evidence contract', () => {
  it('passes bounded settled growth using explicit warmup and comparison windows', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-memory-settling-pass-'));
    try {
      const result = runAnalysis(root, evidence(), '16');

      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      expect(JSON.parse(result.stdout)).toEqual({
        contractVersion: 1,
        benchmarkId: 'editor-lifecycle-retained-memory-large',
        unit: 'bytes',
        sourceCommitSha: SOURCE_COMMIT_SHA,
        artifactSha256: ARTIFACT_SHA256,
        documentProfile: 'large',
        runtimeId: 'node-24.0.0',
        referenceHardwareId: 'github-actions-ubuntu-24.04-x64',
        sampleCount: 10,
        warmupSamples: 2,
        windowSize: 3,
        firstWindowMedianBytes: 1000,
        lastWindowMedianBytes: 1010,
        retainedGrowthBytes: 10,
        maxGrowthBytes: 16,
        passed: true,
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails a retained-memory growth breach while preserving the public receipt', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-memory-settling-fail-'));
    try {
      const result = runAnalysis(
        root,
        evidence({
          samples: [900, 920, 1000, 1005, 995, 1100, 1120, 1110, 1130, 1140],
        }),
        '50',
      );

      expect(result.status).toBe(1);
      expect(result.stderr).toBe('');
      expect(JSON.parse(result.stdout)).toMatchObject({
        firstWindowMedianBytes: 1000,
        lastWindowMedianBytes: 1130,
        retainedGrowthBytes: 130,
        maxGrowthBytes: 50,
        passed: false,
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects evidence that cannot supply two disjoint settled windows', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-memory-settling-short-'));
    try {
      const result = runAnalysis(
        root,
        evidence({ warmupSamples: 2, samples: [900, 920, 1000, 1005, 1010] }),
        '50',
      );

      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr.trim()).toBe(
        'Memory settling evidence requires warmup plus two disjoint comparison windows.',
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects evidence whose benchmark profile disagrees with documentProfile', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-memory-settling-profile-'));
    try {
      const result = runAnalysis(
        root,
        evidence({
          benchmarkId: 'editor-lifecycle-retained-memory-small',
          documentProfile: 'large',
        }),
        '50',
      );

      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr.trim()).toBe(
        'Memory settling evidence benchmark profile must match documentProfile.',
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed before a precision-loss false green from an inexact even-window median', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-memory-settling-precision-'));
    try {
      const maxSafe = Number.MAX_SAFE_INTEGER;
      const result = runAnalysis(
        root,
        evidence({
          warmupSamples: 0,
          samples: [maxSafe - 1, maxSafe - 1, maxSafe - 1, maxSafe],
        }),
        '0.25',
        '2',
      );

      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr.trim()).toBe(
        'Memory settling window median must be exactly representable.',
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
