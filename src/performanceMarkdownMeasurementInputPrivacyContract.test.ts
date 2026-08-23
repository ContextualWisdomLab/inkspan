import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const script = resolve(process.cwd(), 'benchmarks/measure-markdown.mjs');
const SOURCE_COMMIT_SHA = 'a'.repeat(40);
const RUNTIME_ID = 'node-22.18.0';
const REFERENCE_HARDWARE_ID = 'github-actions-ubuntu-24.04-x64';

function sha256(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

describe('Markdown measurement input error privacy contract', () => {
  it('redacts private filesystem details when input traversal fails', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-markdown-input-privacy-'));
    const privateSentinel = 'private-input-sentinel-must-not-leak';
    const blockedParent = join(root, privateSentinel);
    const input = join(blockedParent, 'document.md');
    const modulePath = join(root, 'measured.mjs');
    const output = join(root, 'samples.json');
    const moduleSource =
      'export function markdownToHtml(value) { return value; }\n';

    writeFileSync(blockedParent, 'not a directory', 'utf8');
    writeFileSync(modulePath, moduleSource, 'utf8');

    const result = spawnSync(
      process.execPath,
      [
        script,
        '--input',
        input,
        '--module',
        modulePath,
        '--profile',
        'small',
        '--samples',
        '1',
        '--source-commit-sha',
        SOURCE_COMMIT_SHA,
        '--artifact-sha256',
        sha256(moduleSource),
        '--runtime-id',
        RUNTIME_ID,
        '--reference-hardware-id',
        REFERENCE_HARDWARE_ID,
        '--output',
        output,
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      },
    );

    try {
      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr.trim()).toBe(
        'Markdown benchmark input must be a regular non-symlink file.',
      );
      expect(result.stderr).not.toContain(privateSentinel);
      expect(existsSync(output)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
