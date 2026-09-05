import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  linkSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
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
  operation?: 'transition' | 'transition-changed' | 'canonicalization',
  resultingInput?: string,
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
    ...(operation === undefined ? [] : ['--operation', operation]),
    ...(resultingInput === undefined ? [] : ['--resulting-input', resultingInput]),
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

  it('measures transition evidence through the same packed module boundary', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-transition-measurement-'));
    const input = join(root, 'large.json');
    const modulePath = join(root, 'packed-revision-evidence.mjs');
    const samplesPath = join(root, 'samples.json');
    try {
      writeSyntheticEnvelope(input);
      writeFileSync(
        modulePath,
        `const revision = { digestHex: '${'d'.repeat(64)}' };
export async function createDocumentEnvelopeTransitionEvidenceBytes() { return { previousRevision: revision, resultingRevision: revision, changed: false }; }\n`,
        'utf8',
      );

      execFileSync(
        process.execPath,
        argumentsFor(input, modulePath, samplesPath, 'transition'),
        { cwd: repositoryRoot, stdio: ['ignore', 'pipe', 'pipe'] },
      );

      expect(JSON.parse(readFileSync(samplesPath, 'utf8'))).toMatchObject({
        benchmarkId: 'transition-evidence-large',
        artifactSha256: fileSha256(modulePath),
        samples: expect.any(Array),
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each([
    { operation: 'transition-changed', changed: true, equalDigests: false, valid: true },
    { operation: 'transition-changed', changed: false, equalDigests: true, valid: false },
    { operation: 'transition-changed', changed: true, equalDigests: true, valid: false },
    { operation: 'transition-changed', changed: false, equalDigests: false, valid: false },
    { operation: 'transition', changed: true, equalDigests: false, valid: false },
    { operation: 'transition', changed: false, equalDigests: false, valid: false },
  ] as const)('checks the $operation scenario oracle ($changed, $equalDigests)', ({
    operation, changed, equalDigests, valid,
  }) => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-changed-transition-'));
    const input = join(root, 'previous.json');
    const resultingInput = join(root, 'resulting.json');
    const modulePath = join(root, 'revision.mjs');
    const samplesPath = join(root, 'samples.json');
    try {
      writeSyntheticEnvelope(input);
      writeFileSync(resultingInput, readFileSync(input, 'utf8').replace(
        'Synthetic benchmark content', 'Synthetic benchmark content with an edit',
      ));
      writeFileSync(modulePath, `
export async function createDocumentEnvelopeTransitionEvidenceBytes(previous, resulting) {
  if (previous.toString() !== ${JSON.stringify(readFileSync(input, 'utf8'))}) throw new Error('wrong previous source');
  if (resulting.toString() !== ${JSON.stringify(readFileSync(operation === 'transition' ? input : resultingInput, 'utf8'))}) throw new Error('wrong resulting source');
  return { previousRevision: { digestHex: '${'a'.repeat(64)}' }, resultingRevision: { digestHex: '${(equalDigests ? 'a' : 'b').repeat(64)}' }, changed: ${changed} };
}
`);
      const result = spawnSync(process.execPath, argumentsFor(
        input, modulePath, samplesPath, operation,
        operation === 'transition-changed' ? resultingInput : undefined,
      ), { cwd: repositoryRoot, encoding: 'utf8' });
      expect(result.status).toBe(valid ? 0 : 1);
      expect(result.stdout).toBe('');
      expect(existsSync(samplesPath)).toBe(valid);
      if (valid) {
        const output = readFileSync(samplesPath, 'utf8');
        expect(JSON.parse(output)).toMatchObject({
          benchmarkId: 'transition-changed-evidence-large',
          samples: expect.any(Array),
        });
        expect(JSON.parse(output).samples).toHaveLength(3);
        expect(output).not.toContain('Synthetic benchmark content');
        expect(output).not.toContain(root);
        execFileSync(process.execPath, [summaryScript, '--input', samplesPath,
          '--output', join(root, 'summary')], { stdio: 'pipe' });
      } else {
        expect(result.stderr.trim()).toBe('Measured revision-evidence result is invalid.');
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each(['missing', 'symlink', 'identical', 'overwrite', 'hardlink'] as const)(
    'rejects a %s resulting input without publishing samples or changing input',
    (scenario) => {
      const root = mkdtempSync(join(tmpdir(), 'inkspan-resulting-input-'));
      const input = join(root, 'previous.json');
      const resultingInput = join(root, 'private-resulting.json');
      const modulePath = join(root, 'revision.mjs');
      let samplesPath = join(root, 'samples.json');
      try {
        writeSyntheticEnvelope(input);
        writeFileSync(modulePath, 'throw new Error("module must not execute");');
        if (scenario === 'symlink') symlinkSync(input, resultingInput);
        else if (scenario !== 'missing') {
          writeFileSync(resultingInput, scenario === 'identical'
            ? readFileSync(input) : 'private resulting source');
        }
        if (scenario === 'overwrite') samplesPath = resultingInput;
        if (scenario === 'hardlink') linkSync(resultingInput, samplesPath);
        const result = spawnSync(process.execPath, argumentsFor(
          input, modulePath, samplesPath, 'transition-changed', resultingInput,
        ), { cwd: repositoryRoot, encoding: 'utf8' });
        expect(result.status).toBe(1);
        expect(result.stdout).toBe('');
        expect(result.stderr.trim()).toBe(
          scenario === 'identical'
            ? 'Changed-transition benchmark inputs must differ.'
            : scenario === 'overwrite' || scenario === 'hardlink'
              ? 'Revision benchmark output must not overwrite its input.'
              : 'Revision benchmark input must be a regular non-symlink file.',
        );
        expect(result.stderr).not.toContain(root);
        if (scenario === 'overwrite' || scenario === 'hardlink') {
          expect(readFileSync(resultingInput, 'utf8')).toBe('private resulting source');
        } else expect(existsSync(samplesPath)).toBe(false);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
  );

  it.each(['transition-changed', 'transition', 'canonicalization', undefined] as const)(
    'requires a resulting input only for changed transitions (%s)', (operation) => {
      const root = mkdtempSync(join(tmpdir(), 'inkspan-transition-arguments-'));
      const input = join(root, 'input.json');
      const modulePath = join(root, 'revision.mjs');
      const output = join(root, 'samples.json');
      try {
        writeFileSync(modulePath, 'throw new Error("must not execute");');
        const result = spawnSync(process.execPath, argumentsFor(
          input, modulePath, output, operation,
          operation === 'transition-changed' ? undefined : input,
        ), { encoding: 'utf8' });
        expect(result.status).toBe(1);
        expect(result.stderr.trim()).toBe(operation === undefined
          ? 'Usage: node benchmarks/measure-revision-evidence.mjs --input <document-envelope.json> --module <packed-revision-evidence-module> --profile <small|medium|large|stress> --samples <count> --source-commit-sha <sha> --artifact-sha256 <sha256> --runtime-id <runtime> --reference-hardware-id <hardware> --output <samples.json>'
          : 'Only changed-transition measurement requires a resulting input.');
        expect(existsSync(output)).toBe(false);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
  );

  it('isolates strict envelope canonicalization from digest-provider cost', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-canonicalization-measurement-'));
    const input = join(root, 'large.json');
    const modulePath = join(root, 'packed-revision-evidence.mjs');
    const samplesPath = join(root, 'samples.json');
    try {
      writeSyntheticEnvelope(input);
      writeFileSync(
        modulePath,
        `export async function createDocumentEnvelopeRevisionEvidenceBytes(source, limits, provider) {
  const digest = await provider.digest('SHA-256', source);
  return { revision: { digestHex: Buffer.from(digest).toString('hex') } };
}\n`,
        'utf8',
      );

      execFileSync(
        process.execPath,
        argumentsFor(input, modulePath, samplesPath, 'canonicalization'),
        { cwd: repositoryRoot, stdio: ['ignore', 'pipe', 'pipe'] },
      );

      expect(JSON.parse(readFileSync(samplesPath, 'utf8'))).toMatchObject({
        benchmarkId: 'envelope-canonicalization-large',
        artifactSha256: fileSha256(modulePath),
        samples: expect.any(Array),
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

  it('redacts hostile transition-result accessors before publishing output', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-transition-result-'));
    const input = join(root, 'large.json');
    const modulePath = join(root, 'packed-revision-evidence.mjs');
    const samplesPath = join(root, 'samples.json');
    const privateSentinel = 'tenant-private-transition-result-sentinel';
    try {
      writeSyntheticEnvelope(input);
      writeFileSync(
        modulePath,
        `export async function createDocumentEnvelopeTransitionEvidenceBytes() { const revision = new Proxy({}, { get() { throw new Error('${privateSentinel}'); } }); return { previousRevision: revision, resultingRevision: revision, changed: false }; }\n`,
        'utf8',
      );

      const result = spawnSync(
        process.execPath,
        argumentsFor(input, modulePath, samplesPath, 'transition'),
        { cwd: repositoryRoot, encoding: 'utf8' },
      );

      expect(result.status).toBe(1);
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
