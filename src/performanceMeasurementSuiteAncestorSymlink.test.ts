import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const script = resolve(process.cwd(), 'benchmarks/run-current-suite.mjs');

describe('benchmark suite output path ancestry', () => {
  it('fails closed before preparing an output beneath a symlinked ancestor', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-benchmark-suite-ancestor-'));
    const outside = join(root, 'outside-target');
    const alias = join(root, 'aliased-parent');
    const output = join(alias, 'nested-output');
    try {
      mkdirSync(outside);
      symlinkSync(outside, alias, process.platform === 'win32' ? 'junction' : 'dir');

      const result = spawnSync(
        process.execPath,
        [
          script,
          '--input',
          join(root, 'unused.md'),
          '--module',
          join(root, 'unused.mjs'),
          '--revision-input',
          join(root, 'unused-envelope.json'),
          '--revision-module',
          join(root, 'unused-revision.mjs'),
          '--profile',
          'large',
          '--samples',
          '1',
          '--source-commit-sha',
          'a'.repeat(40),
          '--artifact-sha256',
          'b'.repeat(64),
          '--revision-artifact-sha256',
          'c'.repeat(64),
          '--runtime-id',
          'node-22.18.0',
          '--reference-hardware-id',
          'github-actions-ubuntu-24.04-x64',
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
        'Benchmark suite output directory must be a non-symlink directory.',
      );
      expect(existsSync(join(outside, 'nested-output'))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
