import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const script = resolve(process.cwd(), 'benchmarks/measure-markdown.mjs');
const SOURCE_COMMIT_SHA = 'a'.repeat(40);
const RUNTIME_ID = 'node-22.18.0';
const REFERENCE_HARDWARE_ID = 'github-actions-ubuntu-24.04-x64';

describe('Markdown measurement module path error privacy contract', () => {
  it('redacts private filesystem details when module path traversal fails', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-markdown-module-privacy-'));
    const privateSentinel = 'private-module-sentinel-must-not-leak';
    const input = join(root, 'document.md');
    const blockedParent = join(root, privateSentinel);
    const modulePath = join(blockedParent, 'measured.mjs');
    const output = join(root, 'samples.json');

    writeFileSync(input, '# bounded\n', 'utf8');
    writeFileSync(blockedParent, 'not a directory', 'utf8');

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
        '0'.repeat(64),
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
        'Measured Markdown module must be a local regular file.',
      );
      expect(result.stderr).not.toContain(privateSentinel);
      expect(existsSync(output)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
