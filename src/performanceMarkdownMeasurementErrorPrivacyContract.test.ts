import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
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

function runMeasurement(
  moduleSource: string,
  outputForRoot: (root: string) => string = (root) => join(root, 'samples.json'),
) {
  const root = mkdtempSync(join(tmpdir(), 'inkspan-markdown-error-privacy-'));
  const input = join(root, 'document.md');
  const modulePath = join(root, 'measured.mjs');
  const output = outputForRoot(root);
  writeFileSync(input, '# Public benchmark fixture\n', 'utf8');
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

  return { root, output, result };
}

describe('Markdown measurement error privacy contract', () => {
  it('redacts exceptions raised while loading the measured module', () => {
    const privateSentinel = 'private-import-sentinel-must-not-leak';
    const moduleSource = `throw new Error('${privateSentinel}');\nexport function markdownToHtml(value) { return value; }\n`;
    const { root, output, result } = runMeasurement(moduleSource);
    try {
      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr.trim()).toBe(
        'Measured Markdown module could not be loaded.',
      );
      expect(result.stderr).not.toContain(privateSentinel);
      expect(existsSync(output)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('redacts exceptions raised by the measured serializer', () => {
    const privateSentinel = 'private-serializer-sentinel-must-not-leak';
    const moduleSource = `export function markdownToHtml() { throw new Error('${privateSentinel}'); }\n`;
    const { root, output, result } = runMeasurement(moduleSource);
    try {
      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr.trim()).toBe(
        'Measured markdownToHtml() execution failed.',
      );
      expect(result.stderr).not.toContain(privateSentinel);
      expect(existsSync(output)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('redacts filesystem details when output path traversal fails', () => {
    const privateSentinel = 'private-output-sentinel-must-not-leak';
    const moduleSource =
      'export function markdownToHtml(value) { return value; }\n';
    const { root, output, result } = runMeasurement(moduleSource, (testRoot) => {
      const blockedParent = join(testRoot, privateSentinel);
      writeFileSync(blockedParent, 'not a directory', 'utf8');
      return join(blockedParent, 'samples.json');
    });
    try {
      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr.trim()).toBe(
        'Markdown benchmark output path could not be inspected.',
      );
      expect(result.stderr).not.toContain(privateSentinel);
      expect(existsSync(output)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
