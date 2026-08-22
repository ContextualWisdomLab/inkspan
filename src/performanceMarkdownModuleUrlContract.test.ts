import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const measurementScript = resolve(
  process.cwd(),
  'benchmarks/measure-markdown.mjs',
);

describe('Markdown measurement module URL authority', () => {
  it('rejects file URLs with a non-local host before loading the measured module', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-markdown-module-url-'));
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
      const artifactSha256 = createHash('sha256')
        .update(readFileSync(modulePath))
        .digest('hex');
      const nonLocalFileUrl = pathToFileURL(modulePath);
      nonLocalFileUrl.hostname = 'example.invalid';

      const result = spawnSync(
        process.execPath,
        [
          measurementScript,
          '--input',
          input,
          '--module',
          nonLocalFileUrl.href,
          '--profile',
          'large',
          '--samples',
          '1',
          '--source-commit-sha',
          'a'.repeat(40),
          '--artifact-sha256',
          artifactSha256,
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
        'Measured Markdown module must be a local regular file.',
      );
      expect(existsSync(output)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
