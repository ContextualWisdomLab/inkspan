import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const cases = [
  {
    name: 'Markdown',
    script: 'benchmarks/measure-markdown.mjs',
    expectedError: 'Markdown benchmark input must be a regular non-symlink file.',
  },
  {
    name: 'revision',
    script: 'benchmarks/measure-revision-evidence.mjs',
    expectedError: 'Revision benchmark input must be a regular non-symlink file.',
  },
] as const;

describe('benchmark existing-output path privacy contract', () => {
  for (const testCase of cases) {
    it(`redacts ${testCase.name} input paths before existing-output alias checks`, () => {
      const root = mkdtempSync(join(tmpdir(), 'inkspan-benchmark-alias-path-'));
      const privateSentinel = `tenant-private-${testCase.name.toLowerCase()}-input-parent`;
      const blockedParent = join(root, privateSentinel);
      const input = join(blockedParent, 'document-input');
      const output = join(root, 'samples.json');

      try {
        writeFileSync(blockedParent, 'not a directory', 'utf8');
        writeFileSync(output, '{}\n', 'utf8');

        const result = spawnSync(
          process.execPath,
          [
            resolve(process.cwd(), testCase.script),
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
        expect(result.stderr.trim()).toBe(testCase.expectedError);
        expect(result.stderr).not.toContain(privateSentinel);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  }
});
