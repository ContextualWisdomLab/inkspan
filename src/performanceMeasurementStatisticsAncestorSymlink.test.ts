import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const script = resolve(process.cwd(), 'benchmarks/summarize-samples.mjs');

function writeInput(path: string): void {
  writeFileSync(
    path,
    `${JSON.stringify({
      contractVersion: 1,
      benchmarkId: 'markdown-serialization-large',
      unit: 'ms',
      sourceCommitSha: 'a'.repeat(40),
      artifactSha256: 'b'.repeat(64),
      documentProfile: 'large',
      runtimeId: 'node-22.18.0',
      referenceHardwareId: 'github-actions-ubuntu-24.04-x64',
      samples: [10, 20, 30],
    })}\n`,
    'utf8',
  );
}

describe('benchmark summary output path ancestry', () => {
  it('fails closed before writing through a symlinked output ancestor', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-benchmark-summary-ancestor-'));
    const input = join(root, 'samples.json');
    const outside = join(root, 'outside-target');
    const alias = join(root, 'aliased-parent');
    const output = join(alias, 'nested-output');
    try {
      writeInput(input);
      mkdirSync(outside);
      symlinkSync(outside, alias, process.platform === 'win32' ? 'junction' : 'dir');

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
      expect(existsSync(join(outside, 'nested-output', 'summary.json'))).toBe(false);
      expect(existsSync(join(outside, 'nested-output', 'summary.txt'))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
