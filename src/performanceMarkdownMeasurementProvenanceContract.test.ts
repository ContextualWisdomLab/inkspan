import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const measurementScript = resolve(
  process.cwd(),
  'benchmarks/measure-markdown.mjs',
);

describe('Markdown measurement artifact provenance', () => {
  it('rejects caller metadata that does not match the exact measured module bytes', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-markdown-provenance-'));
    const input = join(root, 'large.md');
    const modulePath = join(root, 'packed-markdown.mjs');
    const output = join(root, 'samples.json');
    try {
      writeFileSync(input, '# Synthetic benchmark fixture\n', 'utf8');
      writeFileSync(
        modulePath,
        'export function markdownToHtml(source) { return `<p>${source}</p>`; }\n',
        'utf8',
      );

      const result = spawnSync(
        process.execPath,
        [
          measurementScript,
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
          'f'.repeat(64),
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
        'Markdown benchmark artifact digest does not match the measured module.',
      );
      expect(existsSync(output)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
