import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  linkSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const markdownScript = resolve(process.cwd(), 'benchmarks/measure-markdown.mjs');
const revisionScript = resolve(
  process.cwd(),
  'benchmarks/measure-revision-evidence.mjs',
);
const sourceCommitSha = 'a'.repeat(40);
const runtimeId = 'node-22.18.0';
const referenceHardwareId = 'github-actions-ubuntu-24.04-x64';

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function commonArguments(
  input: string,
  module: string,
  moduleSha256: string,
  output: string,
): string[] {
  return [
    '--input',
    input,
    '--module',
    module,
    '--profile',
    'small',
    '--samples',
    '1',
    '--source-commit-sha',
    sourceCommitSha,
    '--artifact-sha256',
    moduleSha256,
    '--runtime-id',
    runtimeId,
    '--reference-hardware-id',
    referenceHardwareId,
    '--output',
    output,
  ];
}

function expectOutputPreservedFailure(
  script: string,
  args: string[],
  sentinel: string,
  expectedMessage: string,
): void {
  const originalSentinel = readFileSync(sentinel, 'utf8');
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  expect(result.status).toBe(1);
  expect(result.stdout).toBe('');
  expect(result.stderr.trim()).toBe(expectedMessage);
  expect(readFileSync(sentinel, 'utf8')).toBe(originalSentinel);
}

describe('benchmark producer output immutability', () => {
  it('fails closed before Markdown measurement overwrites an unrelated hard link', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-markdown-hardlink-'));
    const input = join(root, 'document.md');
    const module = join(root, 'markdown-module.mjs');
    const output = join(root, 'samples.json');
    const sentinel = join(root, 'buyer-owned.txt');
    const moduleSource = 'export const markdownToHtml = (source) => `<p>${source}</p>`;\n';

    try {
      writeFileSync(input, '# Hello\n', 'utf8');
      writeFileSync(module, moduleSource, 'utf8');
      writeFileSync(sentinel, 'buyer-owned-content\n', 'utf8');
      linkSync(sentinel, output);

      expectOutputPreservedFailure(
        markdownScript,
        commonArguments(input, module, sha256(moduleSource), output),
        sentinel,
        'Markdown benchmark output must not be multiply linked.',
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed before revision measurement overwrites an unrelated hard link', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-revision-hardlink-'));
    const input = join(root, 'document-envelope.json');
    const module = join(root, 'revision-module.mjs');
    const output = join(root, 'samples.json');
    const sentinel = join(root, 'buyer-owned.txt');
    const moduleSource = [
      'export async function createDocumentEnvelopeRevisionEvidenceBytes(source) {',
      "  return { revision: { digestHex: String(source.byteLength).padStart(64, '0') } };",
      '}',
      '',
    ].join('\n');

    try {
      writeFileSync(input, '{"contractVersion":1}\n', 'utf8');
      writeFileSync(module, moduleSource, 'utf8');
      writeFileSync(sentinel, 'buyer-owned-content\n', 'utf8');
      linkSync(sentinel, output);

      expectOutputPreservedFailure(
        revisionScript,
        commonArguments(input, module, sha256(moduleSource), output),
        sentinel,
        'Revision benchmark output must not be multiply linked.',
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed before Markdown measurement overwrites existing evidence', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-markdown-existing-output-'));
    const input = join(root, 'document.md');
    const module = join(root, 'markdown-module.mjs');
    const output = join(root, 'samples.json');
    const moduleSource = 'export const markdownToHtml = (source) => `<p>${source}</p>`;\n';

    try {
      writeFileSync(input, '# Hello\n', 'utf8');
      writeFileSync(module, moduleSource, 'utf8');
      writeFileSync(output, '{"status":"accepted"}\n', 'utf8');

      expectOutputPreservedFailure(
        markdownScript,
        commonArguments(input, module, sha256(moduleSource), output),
        output,
        'Markdown benchmark output must not already exist.',
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed before revision measurement overwrites existing evidence', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-revision-existing-output-'));
    const input = join(root, 'document-envelope.json');
    const module = join(root, 'revision-module.mjs');
    const output = join(root, 'samples.json');
    const moduleSource = [
      'export async function createDocumentEnvelopeRevisionEvidenceBytes(source) {',
      "  return { revision: { digestHex: String(source.byteLength).padStart(64, '0') } };",
      '}',
      '',
    ].join('\n');

    try {
      writeFileSync(input, '{"contractVersion":1}\n', 'utf8');
      writeFileSync(module, moduleSource, 'utf8');
      writeFileSync(output, '{"status":"accepted"}\n', 'utf8');

      expectOutputPreservedFailure(
        revisionScript,
        commonArguments(input, module, sha256(moduleSource), output),
        output,
        'Revision benchmark output must not already exist.',
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
