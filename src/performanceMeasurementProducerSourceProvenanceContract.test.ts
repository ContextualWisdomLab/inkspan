import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = process.cwd();
const markdownMeasurementScript = resolve(
  repositoryRoot,
  'benchmarks/measure-markdown.mjs',
);
const revisionMeasurementScript = resolve(
  repositoryRoot,
  'benchmarks/measure-revision-evidence.mjs',
);
const currentSourceCommitSha = execFileSync(
  'git',
  ['rev-parse', '--verify', 'HEAD'],
  {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  },
).trim();
const mismatchedSourceCommitSha =
  currentSourceCommitSha === 'f'.repeat(40) ? 'e'.repeat(40) : 'f'.repeat(40);
const activeRuntimeId = `node-${process.versions.node}`;
const mismatchedRuntimeId =
  activeRuntimeId === 'node-99.99.99' ? 'node-98.98.98' : 'node-99.99.99';
const referenceHardwareId = `refhw-sha256-${'b'.repeat(64)}`;

function sha256(source: string): string {
  return createHash('sha256').update(source).digest('hex');
}

function markdownInvocation(
  root: string,
  sourceCommitSha: string,
  runtimeId: string,
): { result: ReturnType<typeof spawnSync>; output: string } {
  const input = join(root, 'document.md');
  const modulePath = join(root, 'markdown.mjs');
  const output = join(root, 'markdown-samples.json');
  const moduleSource =
    'export function markdownToHtml(source) { return `<p>${source}</p>`; }\n';
  writeFileSync(input, '# Provenance fixture\n', 'utf8');
  writeFileSync(modulePath, moduleSource, 'utf8');

  const result = spawnSync(
    process.execPath,
    [
      markdownMeasurementScript,
      '--input',
      input,
      '--module',
      modulePath,
      '--profile',
      'small',
      '--samples',
      '1',
      '--source-commit-sha',
      sourceCommitSha,
      '--artifact-sha256',
      sha256(moduleSource),
      '--runtime-id',
      runtimeId,
      '--reference-hardware-id',
      referenceHardwareId,
      '--output',
      output,
    ],
    {
      cwd: repositoryRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  return { result, output };
}

function revisionInvocation(
  root: string,
  sourceCommitSha: string,
  runtimeId: string,
): { result: ReturnType<typeof spawnSync>; output: string } {
  const input = join(root, 'document-envelope.json');
  const modulePath = join(root, 'revision.mjs');
  const output = join(root, 'revision-samples.json');
  const moduleSource = `export async function createDocumentEnvelopeRevisionEvidenceBytes() { return { revision: { digestHex: '${'c'.repeat(64)}' } }; }\n`;
  writeFileSync(
    input,
    '{"contractVersion":1,"mode":"markdown","document":"# Provenance fixture"}\n',
    'utf8',
  );
  writeFileSync(modulePath, moduleSource, 'utf8');

  const result = spawnSync(
    process.execPath,
    [
      revisionMeasurementScript,
      '--input',
      input,
      '--module',
      modulePath,
      '--profile',
      'small',
      '--samples',
      '1',
      '--source-commit-sha',
      sourceCommitSha,
      '--artifact-sha256',
      sha256(moduleSource),
      '--runtime-id',
      runtimeId,
      '--reference-hardware-id',
      referenceHardwareId,
      '--output',
      output,
    ],
    {
      cwd: repositoryRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  return { result, output };
}

describe('direct benchmark producer source/runtime provenance', () => {
  it.each([
    ['Markdown', markdownInvocation],
    ['revision', revisionInvocation],
  ] as const)(
    'rejects a caller-supplied source SHA that is not the checked-out HEAD for %s evidence',
    (_label, invoke) => {
      const root = mkdtempSync(join(tmpdir(), 'inkspan-producer-source-'));
      try {
        const { result, output } = invoke(
          root,
          mismatchedSourceCommitSha,
          activeRuntimeId,
        );
        expect(result.status).toBe(1);
        expect(result.stdout).toBe('');
        expect(result.stderr.trim()).toBe(
          'Benchmark measurement source commit does not match checked-out HEAD.',
        );
        expect(existsSync(output)).toBe(false);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
  );

  it.each([
    ['Markdown', markdownInvocation],
    ['revision', revisionInvocation],
  ] as const)(
    'rejects a caller-supplied runtime ID that is not the active Node runtime for %s evidence',
    (_label, invoke) => {
      const root = mkdtempSync(join(tmpdir(), 'inkspan-producer-runtime-'));
      try {
        const { result, output } = invoke(
          root,
          currentSourceCommitSha,
          mismatchedRuntimeId,
        );
        expect(result.status).toBe(1);
        expect(result.stdout).toBe('');
        expect(result.stderr.trim()).toBe(
          'Benchmark measurement runtime ID must match the active Node runtime.',
        );
        expect(existsSync(output)).toBe(false);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
  );
});
