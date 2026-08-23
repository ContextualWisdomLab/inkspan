import { spawnSync } from 'node:child_process';
import {
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const script = resolve(process.cwd(), 'benchmarks/summarize-samples.mjs');
const SOURCE_COMMIT_SHA = 'a'.repeat(40);
const ARTIFACT_SHA256 = 'b'.repeat(64);

function writeValidInput(path: string): void {
  writeFileSync(
    path,
    `${JSON.stringify({
      contractVersion: 1,
      benchmarkId: 'markdown-serialization-large',
      unit: 'ms',
      sourceCommitSha: SOURCE_COMMIT_SHA,
      artifactSha256: ARTIFACT_SHA256,
      documentProfile: 'large',
      runtimeId: 'node-22.18.0',
      referenceHardwareId: 'github-actions-ubuntu-24.04-x64',
      samples: [1, 2, 3],
    })}\n`,
    'utf8',
  );
}

describe('benchmark summary output contract', () => {
  it('rejects an invalid second destination before publishing the first summary', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-benchmark-output-'));
    const input = join(root, 'samples.json');
    const output = join(root, 'output');
    const summaryJson = join(output, 'summary.json');
    const summaryText = join(output, 'summary.txt');
    try {
      writeValidInput(input);
      mkdirSync(summaryText, { recursive: true });

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
        'Benchmark summary output paths must be regular files.',
      );
      expect(existsSync(summaryJson)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects a dangling summary symlink before it can create the symlink target', () => {
    if (process.platform === 'win32') return;

    const root = mkdtempSync(join(tmpdir(), 'inkspan-benchmark-output-symlink-'));
    const input = join(root, 'samples.json');
    const output = join(root, 'output');
    const summaryJson = join(output, 'summary.json');
    const escapedTarget = join(root, 'escaped-summary.json');
    try {
      writeValidInput(input);
      mkdirSync(output, { recursive: true });
      symlinkSync(escapedTarget, summaryJson);

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
        'Benchmark summary output paths must be regular files.',
      );
      expect(existsSync(escapedTarget)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects two output paths that alias the same regular file before publication', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-benchmark-output-alias-'));
    const input = join(root, 'samples.json');
    const output = join(root, 'output');
    const summaryJson = join(output, 'summary.json');
    const summaryText = join(output, 'summary.txt');
    try {
      writeValidInput(input);
      mkdirSync(output, { recursive: true });
      writeFileSync(summaryJson, 'sentinel', 'utf8');
      linkSync(summaryJson, summaryText);

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
        'Benchmark summary outputs must be distinct files.',
      );
      expect(readFileSync(summaryJson, 'utf8')).toBe('sentinel');
      expect(readFileSync(summaryText, 'utf8')).toBe('sentinel');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed on a named-pipe sample input instead of blocking before regular-file validation', () => {
    if (process.platform === 'win32') return;

    const root = mkdtempSync(join(tmpdir(), 'inkspan-benchmark-input-fifo-'));
    const input = join(root, 'samples.pipe');
    const output = join(root, 'output');
    try {
      const mkfifo = spawnSync('mkfifo', [input], { encoding: 'utf8' });
      expect(mkfifo.status).toBe(0);

      const result = spawnSync(
        process.execPath,
        [script, '--input', input, '--output', output],
        {
          cwd: process.cwd(),
          encoding: 'utf8',
          timeout: 1000,
        },
      );

      expect(result.error).toBeUndefined();
      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr.trim()).toBe(
        'Benchmark sample input must be a regular file.',
      );
      expect(existsSync(join(output, 'summary.json'))).toBe(false);
      expect(existsSync(join(output, 'summary.txt'))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('redacts filesystem details when the output directory cannot be prepared', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-benchmark-output-privacy-'));
    const input = join(root, 'samples.json');
    const privateSentinel = 'private-summary-output-sentinel-must-not-leak';
    const blockedParent = join(root, privateSentinel);
    const output = join(blockedParent, 'output');
    try {
      writeValidInput(input);
      writeFileSync(blockedParent, 'not a directory', 'utf8');

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
        'Benchmark summary output directory could not be prepared.',
      );
      expect(result.stderr).not.toContain(privateSentinel);
      expect(existsSync(join(output, 'summary.json'))).toBe(false);
      expect(existsSync(join(output, 'summary.txt'))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
