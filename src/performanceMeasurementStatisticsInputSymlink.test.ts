import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const script = resolve(process.cwd(), 'benchmarks/summarize-samples.mjs');

function validSamples(): string {
  return `${JSON.stringify({
    contractVersion: 1,
    benchmarkId: 'markdown-serialization-large',
    unit: 'ms',
    sourceCommitSha: 'a'.repeat(40),
    artifactSha256: 'b'.repeat(64),
    documentProfile: 'large',
    runtimeId: 'node-22.18.0',
    referenceHardwareId: 'github-actions-ubuntu-24.04-x64',
    samples: [10, 20, 30],
  })}\n`;
}

describe('benchmark summary sample input file authority', () => {
  it('fails closed instead of following a symlinked sample input', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-summary-input-symlink-'));
    const target = join(root, 'private-samples.json');
    const alias = join(root, 'samples.json');
    const output = join(root, 'summary');
    try {
      writeFileSync(target, validSamples(), 'utf8');
      symlinkSync(target, alias, process.platform === 'win32' ? 'file' : undefined);

      const result = spawnSync(
        process.execPath,
        [script, '--input', alias, '--output', output],
        { cwd: process.cwd(), encoding: 'utf8' },
      );

      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr.trim()).toBe(
        'Benchmark sample input must be a regular non-symlink file.',
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
