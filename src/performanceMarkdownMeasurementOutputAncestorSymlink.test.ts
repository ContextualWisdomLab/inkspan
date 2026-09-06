import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
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

const script = resolve(process.cwd(), 'benchmarks/measure-markdown.mjs');

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

describe('Markdown benchmark output path ancestry', () => {
  it('fails closed before writing beneath a symlinked output ancestor', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-markdown-output-ancestor-'));
    const input = join(root, 'document.md');
    const modulePath = join(root, 'packed-markdown.mjs');
    const outside = join(root, 'outside-target');
    const alias = join(root, 'aliased-parent');
    const output = join(alias, 'nested-output', 'samples.json');
    try {
      writeFileSync(input, '# Synthetic\n', 'utf8');
      writeFileSync(
        modulePath,
        'export function markdownToHtml(source) { return `<p>${source.length}</p>`; }\n',
        'utf8',
      );
      mkdirSync(outside);
      symlinkSync(outside, alias, process.platform === 'win32' ? 'junction' : 'dir');

      const result = spawnSync(
        process.execPath,
        [
          script,
          '--input',
          input,
          '--module',
          modulePath,
          '--profile',
          'large',
          '--samples',
          '1',
          '--source-commit-sha',
          'a'.repeat(40),
          '--artifact-sha256',
          sha256(modulePath),
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
        'Markdown benchmark output directory must be a non-symlink directory.',
      );
      expect(existsSync(join(outside, 'nested-output', 'samples.json'))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
