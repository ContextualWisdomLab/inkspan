import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const measurementScript = resolve(
  process.cwd(),
  'benchmarks/measure-revision-evidence.mjs',
);

describe('revision benchmark input-path privacy contract', () => {
  it('redacts filesystem details when input inspection crosses a non-directory', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-revision-input-path-'));
    const privateSentinel = 'tenant-private-revision-input-parent';
    const blockedParent = join(root, privateSentinel);
    const input = join(blockedParent, 'document-envelope.json');
    const output = join(root, 'samples.json');

    try {
      writeFileSync(blockedParent, 'not a directory', 'utf8');

      const result = spawnSync(
        process.execPath,
        [
          measurementScript,
          '--input',
          input,
          '--module',
          join(root, 'unused-module.mjs'),
          '--profile',
          'small',
          '--samples',
          '1',
          '--source-commit-sha',
          'a'.repeat(40),
          '--artifact-sha256',
          'b'.repeat(64),
          '--runtime-id',
          'node-22.18.0',
          '--reference-hardware-id',
          'github-actions-ubuntu-24.04-x64',
          '--output',
          output,
        ],
        { cwd: process.cwd(), encoding: 'utf8' },
      );

      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr.trim()).toBe(
        'Revision benchmark input must be a regular non-symlink file.',
      );
      expect(result.stderr).not.toContain(privateSentinel);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
