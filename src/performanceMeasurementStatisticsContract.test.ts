import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  truncateSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

interface BenchmarkSummary {
  readonly contractVersion: 1;
  readonly benchmarkId: string;
  readonly unit: string;
  readonly sourceCommitSha: string;
  readonly artifactSha256: string;
  readonly documentProfile: 'small' | 'medium' | 'large' | 'stress';
  readonly runtimeId: string;
  readonly referenceHardwareId: string;
  readonly sampleCount: number;
  readonly percentileMethod: 'nearest-rank';
  readonly minimum: number;
  readonly p50: number;
  readonly p75: number;
  readonly p95: number;
  readonly maximum: number;
}

const script = resolve(process.cwd(), 'benchmarks/summarize-samples.mjs');
const SOURCE_COMMIT_SHA = 'a'.repeat(40);
const ARTIFACT_SHA256 = 'b'.repeat(64);

function writeInput(path: string, samples: readonly number[]): void {
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        contractVersion: 1,
        benchmarkId: 'markdown-serialization-large',
        unit: 'ms',
        sourceCommitSha: SOURCE_COMMIT_SHA,
        artifactSha256: ARTIFACT_SHA256,
        documentProfile: 'large',
        runtimeId: 'node-22.18.0',
        referenceHardwareId: 'github-actions-ubuntu-24.04-x64',
        samples,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}

function runSummary(inputPath: string, outputDirectory: string): BenchmarkSummary {
  execFileSync(
    process.execPath,
    [script, '--input', inputPath, '--output', outputDirectory],
    {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  return JSON.parse(
    readFileSync(join(outputDirectory, 'summary.json'), 'utf8'),
  ) as BenchmarkSummary;
}

describe('deterministic benchmark sample statistics', () => {
  it('writes reproducible nearest-rank JSON and human-readable summaries with provenance metadata', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-benchmark-summary-'));
    const input = join(root, 'samples.json');
    const first = join(root, 'first');
    const second = join(root, 'second');
    try {
      writeInput(input, [20, 10, 40, 30, 50]);

      const firstSummary = runSummary(input, first);
      const secondSummary = runSummary(input, second);
      expect(firstSummary).toEqual(secondSummary);
      expect(firstSummary).toEqual({
        contractVersion: 1,
        benchmarkId: 'markdown-serialization-large',
        unit: 'ms',
        sourceCommitSha: SOURCE_COMMIT_SHA,
        artifactSha256: ARTIFACT_SHA256,
        documentProfile: 'large',
        runtimeId: 'node-22.18.0',
        referenceHardwareId: 'github-actions-ubuntu-24.04-x64',
        sampleCount: 5,
        percentileMethod: 'nearest-rank',
        minimum: 10,
        p50: 30,
        p75: 40,
        p95: 50,
        maximum: 50,
      });

      const expectedText = [
        'benchmark=markdown-serialization-large',
        'unit=ms',
        `source_commit_sha=${SOURCE_COMMIT_SHA}`,
        `artifact_sha256=${ARTIFACT_SHA256}`,
        'document_profile=large',
        'runtime_id=node-22.18.0',
        'reference_hardware_id=github-actions-ubuntu-24.04-x64',
        'samples=5',
        'percentile_method=nearest-rank',
        'minimum=10',
        'p50=30',
        'p75=40',
        'p95=50',
        'maximum=50',
        '',
      ].join('\n');
      expect(readFileSync(join(first, 'summary.txt'), 'utf8')).toBe(expectedText);
      expect(readFileSync(join(second, 'summary.txt'), 'utf8')).toBe(expectedText);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when immutable provenance metadata is missing', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-benchmark-summary-metadata-'));
    const input = join(root, 'samples.json');
    const output = join(root, 'output');
    try {
      writeFileSync(
        input,
        `${JSON.stringify({
          contractVersion: 1,
          benchmarkId: 'markdown-serialization-large',
          unit: 'ms',
          samples: [1, 2, 3],
        })}\n`,
        'utf8',
      );
      const result = spawnSync(
        process.execPath,
        [script, '--input', input, '--output', output],
        {
          cwd: process.cwd(),
          encoding: 'utf8',
        },
      );

      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr.trim()).toBe(
        'Benchmark sourceCommitSha must be a lowercase 40-character commit SHA.',
      );
      expect(existsSync(join(output, 'summary.json'))).toBe(false);
      expect(existsSync(join(output, 'summary.txt'))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed on invalid measurement samples without coercion', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-benchmark-summary-invalid-'));
    const input = join(root, 'samples.json');
    const output = join(root, 'output');
    try {
      writeInput(input, [1, -1, 3]);
      const result = spawnSync(
        process.execPath,
        [script, '--input', input, '--output', output],
        {
          cwd: process.cwd(),
          encoding: 'utf8',
        },
      );

      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr.trim()).toBe(
        'Benchmark samples must be finite non-negative numbers.',
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects obviously oversized sample input before whole-file reads', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-benchmark-summary-size-'));
    const input = join(root, 'samples.json');
    const output = join(root, 'output');
    const preload = join(root, 'reject-whole-file-read.mjs');
    try {
      writeFileSync(input, '', 'utf8');
      truncateSync(input, 16 * 1024 * 1024 + 1);
      writeFileSync(
        preload,
        `import fs from 'node:fs';\nimport { syncBuiltinESMExports } from 'node:module';\nfs.readFileSync = () => { throw new Error('benchmark whole-file read sentinel'); };\nsyncBuiltinESMExports();\n`,
        'utf8',
      );

      const result = spawnSync(
        process.execPath,
        [
          '--import',
          pathToFileURL(preload).href,
          script,
          '--input',
          input,
          '--output',
          output,
        ],
        {
          cwd: process.cwd(),
          encoding: 'utf8',
        },
      );

      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr.trim()).toBe(
        'Benchmark sample input exceeds the supported size.',
      );
      expect(result.stderr).not.toContain('benchmark whole-file read sentinel');
      expect(existsSync(join(output, 'summary.json'))).toBe(false);
      expect(existsSync(join(output, 'summary.txt'))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('refuses to overwrite the measurement input with generated evidence', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-benchmark-summary-alias-'));
    const input = join(root, 'summary.json');
    const output = root;
    try {
      writeInput(input, [10, 20, 30]);
      const originalInput = readFileSync(input, 'utf8');
      const result = spawnSync(
        process.execPath,
        [script, '--input', input, '--output', output],
        {
          cwd: process.cwd(),
          encoding: 'utf8',
        },
      );

      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr.trim()).toBe(
        'Benchmark output must not overwrite the sample input.',
      );
      expect(readFileSync(input, 'utf8')).toBe(originalInput);
      expect(existsSync(join(root, 'summary.txt'))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('refuses a hard-linked output alias without mutating source evidence', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-benchmark-summary-hardlink-'));
    const input = join(root, 'samples.json');
    const output = join(root, 'output');
    const summaryJson = join(output, 'summary.json');
    try {
      writeInput(input, [10, 20, 30]);
      mkdirSync(output, { recursive: true });
      linkSync(input, summaryJson);
      const originalInput = readFileSync(input, 'utf8');

      const result = spawnSync(
        process.execPath,
        [script, '--input', input, '--output', output],
        {
          cwd: process.cwd(),
          encoding: 'utf8',
        },
      );

      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr.trim()).toBe(
        'Benchmark output must not overwrite the sample input.',
      );
      expect(readFileSync(input, 'utf8')).toBe(originalInput);
      expect(existsSync(join(output, 'summary.txt'))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed before writing summaries through a symlink output directory', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-benchmark-summary-symlink-'));
    const input = join(root, 'samples.json');
    const target = join(root, 'outside-target');
    const output = join(root, 'output-link');
    try {
      writeInput(input, [10, 20, 30]);
      mkdirSync(target);
      symlinkSync(target, output, process.platform === 'win32' ? 'junction' : 'dir');

      const result = spawnSync(
        process.execPath,
        [script, '--input', input, '--output', output],
        {
          cwd: process.cwd(),
          encoding: 'utf8',
        },
      );

      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr.trim()).toBe(
        'Benchmark summary output directory must be a non-symlink directory.',
      );
      expect(existsSync(join(target, 'summary.json'))).toBe(false);
      expect(existsSync(join(target, 'summary.txt'))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
