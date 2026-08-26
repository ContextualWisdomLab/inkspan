import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface BenchmarkSamples {
  readonly contractVersion: 1;
  readonly benchmarkId: string;
  readonly unit: 'ms';
  readonly sourceCommitSha: string;
  readonly artifactSha256: string;
  readonly documentProfile: 'small' | 'medium' | 'large' | 'stress';
  readonly runtimeId: string;
  readonly referenceHardwareId: string;
  readonly samples: number[];
}

const repositoryRoot = process.cwd();
const measurementScript = resolve(
  repositoryRoot,
  'benchmarks/measure-revision-evidence.mjs',
);
const summaryScript = resolve(repositoryRoot, 'benchmarks/summarize-samples.mjs');
const SOURCE_COMMIT_SHA = execFileSync(
  'git',
  ['rev-parse', '--verify', 'HEAD'],
  {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  },
).trim();
const RUNTIME_ID = `node-${process.versions.node}`;
const HARDWARE_ID = 'github-actions-ubuntu-24.04-x64';

function fileSha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function argumentsFor(
  input: string,
  modulePath: string,
  output: string,
): string[] {
  return [
    measurementScript,
    '--input',
    input,
    '--module',
    modulePath,
    '--profile',
    'large',
    '--samples',
    '3',
    '--source-commit-sha',
    SOURCE_COMMIT_SHA,
    '--artifact-sha256',
    fileSha256(modulePath),
    '--runtime-id',
    RUNTIME_ID,
    '--reference-hardware-id',
    HARDWARE_ID,
    '--output',
    output,
  ];
}

function writeSyntheticEnvelope(path: string): void {
  writeFileSync(
    path,
    JSON.stringify({
      schemaId: 'https://inkspan.io/schemas/document-envelope/v1',
      schemaVersion: 1,
      documentJson: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Synthetic benchmark content' }],
          },
        ],
      },
    }),
    'utf8',
  );
}

describe('revision-evidence runtime measurement contract', () => {
  it('writes privacy-safe revision samples consumable by the canonical summarizer', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-revision-measurement-'));
    const input = join(root, 'large.json');
    const modulePath = join(root, 'packed-revision-evidence.mjs');
    const samplesPath = join(root, 'samples.json');
    const summaryDirectory = join(root, 'summary');
    try {
      writeSyntheticEnvelope(input);
      writeFileSync(
        modulePath,
        'export async function createDocumentEnvelopeRevisionEvidenceBytes(source) { return { revision: { digestHex: String(source.byteLength).padStart(64, "0") } }; }\n',
        'utf8',
      );

      execFileSync(process.execPath, argumentsFor(input, modulePath, samplesPath), {
        cwd: repositoryRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const samples = JSON.parse(
        readFileSync(samplesPath, 'utf8'),
      ) as BenchmarkSamples;
      expect(samples).toMatchObject({
        contractVersion: 1,
        benchmarkId: 'revision-evidence-large',
        unit: 'ms',
        sourceCommitSha: SOURCE_COMMIT_SHA,
        artifactSha256: fileSha256(modulePath),
        documentProfile: 'large',
        runtimeId: RUNTIME_ID,
        referenceHardwareId: HARDWARE_ID,
      });
      expect(samples.samples).toHaveLength(3);
      expect(
        samples.samples.every(
          (sample) => Number.isFinite(sample) && sample >= 0,
        ),
      ).toBe(true);
      expect(readFileSync(samplesPath, 'utf8')).not.toContain(
        'Synthetic benchmark content',
      );

      execFileSync(
        process.execPath,
        [summaryScript, '--input', samplesPath, '--output', summaryDirectory],
        { cwd: repositoryRoot, stdio: ['ignore', 'pipe', 'pipe'] },
      );
      expect(
        JSON.parse(readFileSync(join(summaryDirectory, 'summary.json'), 'utf8')),
      ).toMatchObject({
        sampleCount: 3,
        benchmarkId: 'revision-evidence-large',
        unit: 'ms',
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed before output when the measured module lacks the revision API', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-revision-measurement-export-'));
    const input = join(root, 'small.json');
    const modulePath = join(root, 'packed-revision-evidence.mjs');
    const samplesPath = join(root, 'samples.json');
    try {
      writeSyntheticEnvelope(input);
      writeFileSync(modulePath, 'export const other = true;\n', 'utf8');

      const result = spawnSync(
        process.execPath,
        argumentsFor(input, modulePath, samplesPath),
        { cwd: repositoryRoot, encoding: 'utf8' },
      );

      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr.trim()).toBe(
        'Measured revision module must export createDocumentEnvelopeRevisionEvidenceBytes().',
      );
      expect(existsSync(samplesPath)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('redacts hostile revision-result accessors before publishing output', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-revision-measurement-result-'));
    const input = join(root, 'large.json');
    const modulePath = join(root, 'packed-revision-evidence.mjs');
    const samplesPath = join(root, 'samples.json');
    const privateSentinel = 'tenant-private-revision-result-sentinel';
    try {
      writeSyntheticEnvelope(input);
      writeFileSync(
        modulePath,
        `export async function createDocumentEnvelopeRevisionEvidenceBytes() { return new Proxy({}, { get(_target, property) { if (property === 'revision') throw new Error('${privateSentinel}'); return undefined; } }); }\n`,
        'utf8',
      );

      const result = spawnSync(
        process.execPath,
        argumentsFor(input, modulePath, samplesPath),
        { cwd: repositoryRoot, encoding: 'utf8' },
      );

      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr.trim()).toBe(
        'Measured revision-evidence result is invalid.',
      );
      expect(result.stderr).not.toContain(privateSentinel);
      expect(existsSync(samplesPath)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('redacts filesystem details when output path traversal fails', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-revision-measurement-output-'));
    const input = join(root, 'large.json');
    const modulePath = join(root, 'packed-revision-evidence.mjs');
    const privateSentinel = 'private-revision-output-sentinel-must-not-leak';
    const blockedParent = join(root, privateSentinel);
    const samplesPath = join(blockedParent, 'samples.json');
    try {
      writeSyntheticEnvelope(input);
      writeFileSync(
        modulePath,
        'export async function createDocumentEnvelopeRevisionEvidenceBytes(source) { return { revision: { digestHex: String(source.byteLength).padStart(64, "0") } }; }\n',
        'utf8',
      );
      writeFileSync(blockedParent, 'not a directory', 'utf8');

      const result = spawnSync(
        process.execPath,
        argumentsFor(input, modulePath, samplesPath),
        { cwd: repositoryRoot, encoding: 'utf8' },
      );

      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr.trim()).toBe(
        'Revision benchmark output path could not be inspected.',
      );
      expect(result.stderr).not.toContain(privateSentinel);
      expect(existsSync(samplesPath)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('redacts filesystem details when output publication cannot create its directory', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-revision-measurement-publication-'));
    const input = join(root, 'large.json');
    const modulePath = join(root, 'packed-revision-evidence.mjs');
    const privateSentinel = `private-revision-publication-${process.pid}`;
    const samplesPath = join('/sys', privateSentinel, 'samples.json');
    try {
      writeSyntheticEnvelope(input);
      writeFileSync(
        modulePath,
        'export async function createDocumentEnvelopeRevisionEvidenceBytes(source) { return { revision: { digestHex: String(source.byteLength).padStart(64, "0") } }; }\n',
        'utf8',
      );

      const result = spawnSync(
        process.execPath,
        argumentsFor(input, modulePath, samplesPath),
        { cwd: repositoryRoot, encoding: 'utf8' },
      );

      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr.trim()).toBe(
        'Revision benchmark output could not be written.',
      );
      expect(result.stderr).not.toContain(privateSentinel);
      expect(existsSync(samplesPath)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
