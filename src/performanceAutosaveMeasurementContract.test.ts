import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = process.cwd();
const measurementScript = resolve(
  repositoryRoot,
  'benchmarks/measure-autosave.mjs',
);
const sourceCommitSha = execFileSync(
  'git',
  ['rev-parse', '--verify', 'HEAD'],
  {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  },
).trim();
const runtimeId = `node-${process.versions.node}`;
const referenceHardwareId = `refhw-sha256-${'a'.repeat(64)}`;

function sha256(source: string): string {
  return createHash('sha256').update(source).digest('hex');
}

describe('autosave enqueue performance measurement', () => {
  it('emits the canonical summarizable sample contract without persisting document content', () => {
    const directory = mkdtempSync(join(tmpdir(), 'inkspan-autosave-measure-'));
    const modulePath = join(directory, 'autosave.mjs');
    const revisionModulePath = join(directory, 'revision.mjs');
    const inputPath = join(directory, 'document-envelope.json');
    const outputPath = join(directory, 'samples.json');
    const moduleSource = [
      'export function createDocumentAutosaveQueue(options) {',
      '  return Object.freeze({',
      '    async enqueue(evidence) {',
      "      if (evidence.envelope.documentJson.content[0].content[0].text !== 'profile-bound synthetic input') throw new Error('wrong profile input');",
      '      const result = await options.save(evidence);',
      "      if (result?.status !== 'saved') throw new Error('save failed');",
      '      return Object.freeze({',
      "        status: 'saved',",
      '        strongEntityTag: evidence.revision.strongEntityTag,',
      '      });',
      '    },',
      '    resume() { return false; },',
      '    async flush() { return Object.freeze({ state: \'idle\' }); },',
      '    async close() { return Object.freeze({ state: \'closed\' }); },',
      '    getSnapshot() { return Object.freeze({ state: \'idle\' }); },',
      '  });',
      '}',
      '',
    ].join('\n');
    const revisionModuleSource = [
      "import { createHash } from 'node:crypto';",
      'function freeze(value) { if (value && typeof value === \'object\') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } return value; }',
      'export async function createDocumentEnvelopeRevisionEvidenceBytes(source) {',
      "  const envelope = freeze(JSON.parse(Buffer.from(source).toString('utf8')));",
      "  const digestHex = createHash('sha256').update(source).digest('hex');",
      '  return Object.freeze({ envelope, revision: Object.freeze({ algorithm: \'SHA-256\', digestHex, strongEntityTag: `"sha256-${digestHex}"` }) });',
      '}',
      '',
    ].join('\n');

    try {
      writeFileSync(modulePath, moduleSource, 'utf8');
      writeFileSync(revisionModulePath, revisionModuleSource, 'utf8');
      writeFileSync(
        inputPath,
        '{"schemaId":"https://inkspan.io/schemas/document-envelope/v1","schemaVersion":1,"documentJson":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"profile-bound synthetic input"}]}]}}\n',
        'utf8',
      );

      const result = spawnSync(
        process.execPath,
        [
          measurementScript,
          '--input',
          inputPath,
          '--revision-module',
          revisionModulePath,
          '--revision-artifact-sha256',
          sha256(revisionModuleSource),
          '--module',
          modulePath,
          '--profile',
          'small',
          '--samples',
          '2',
          '--source-commit-sha',
          sourceCommitSha,
          '--artifact-sha256',
          sha256(moduleSource),
          '--runtime-id',
          runtimeId,
          '--reference-hardware-id',
          referenceHardwareId,
          '--output',
          outputPath,
        ],
        {
          cwd: repositoryRoot,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: 10_000,
        },
      );

      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');

      const outputText = readFileSync(outputPath, 'utf8');
      const evidence = JSON.parse(outputText) as {
        contractVersion?: unknown;
        benchmarkId?: unknown;
        unit?: unknown;
        sourceCommitSha?: unknown;
        artifactSha256?: unknown;
        documentProfile?: unknown;
        runtimeId?: unknown;
        referenceHardwareId?: unknown;
        samples?: unknown[];
      };
      expect(evidence).toMatchObject({
        contractVersion: 1,
        benchmarkId: 'autosave-enqueue-small',
        unit: 'ms',
        sourceCommitSha,
        artifactSha256: sha256(moduleSource),
        documentProfile: 'small',
        runtimeId,
        referenceHardwareId,
      });
      expect(Object.keys(evidence).sort()).toEqual(
        [
          'artifactSha256',
          'benchmarkId',
          'contractVersion',
          'documentProfile',
          'referenceHardwareId',
          'runtimeId',
          'samples',
          'sourceCommitSha',
          'unit',
        ].sort(),
      );
      expect(evidence.samples).toHaveLength(2);
      expect(
        evidence.samples?.every(
          (sample) =>
            typeof sample === 'number' && Number.isFinite(sample) && sample >= 0,
        ),
      ).toBe(true);
      expect(outputText).not.toContain('Synthetic autosave benchmark document');
      expect(outputText).not.toContain(modulePath);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }, 20_000);

  it('measures active-revision coalescing without starting a second save', () => {
    const directory = mkdtempSync(join(tmpdir(), 'inkspan-autosave-coalescing-'));
    const modulePath = join(directory, 'autosave.mjs');
    const outputPath = join(directory, 'samples.json');
    const moduleSource = `export function createDocumentAutosaveQueue(options) {
  let active;
  return {
    enqueue(evidence) {
      if (active) return active;
      active = Promise.resolve(options.save(evidence)).then(() => ({ status: 'saved' }));
      return active;
    },
    async close() {},
  };
}\n`;
    try {
      writeFileSync(modulePath, moduleSource, 'utf8');
      const args = [
        measurementScript,
        '--module', modulePath,
        '--profile', 'small',
        '--samples', '2',
        '--source-commit-sha', sourceCommitSha,
        '--artifact-sha256', sha256(moduleSource),
        '--runtime-id', runtimeId,
        '--reference-hardware-id', referenceHardwareId,
        '--operation', 'coalescing',
        '--output', outputPath,
      ];

      const result = spawnSync(process.execPath, args, {
        cwd: repositoryRoot,
        encoding: 'utf8',
      });

      expect(result.status).toBe(0);
      expect(JSON.parse(readFileSync(outputPath, 'utf8'))).toMatchObject({
        benchmarkId: 'autosave-coalescing-small',
        samples: [expect.any(Number), expect.any(Number)],
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
