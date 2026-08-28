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
  it('measures deterministic queue admission without persisting document content', () => {
    const directory = mkdtempSync(join(tmpdir(), 'inkspan-autosave-measure-'));
    const modulePath = join(directory, 'autosave.mjs');
    const outputPath = join(directory, 'samples.json');
    const moduleSource = [
      'export function createDocumentAutosaveQueue(options) {',
      '  return Object.freeze({',
      '    async enqueue(evidence) {',
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

    try {
      writeFileSync(modulePath, moduleSource, 'utf8');

      const result = spawnSync(
        process.execPath,
        [
          measurementScript,
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
        benchmarkId?: unknown;
        unit?: unknown;
        documentProfile?: unknown;
        operation?: unknown;
        samples?: unknown[];
        provenance?: Record<string, unknown>;
      };
      expect(evidence).toMatchObject({
        benchmarkId: 'autosave-enqueue-small',
        unit: 'ms',
        documentProfile: 'small',
        operation: 'autosave-enqueue',
        provenance: {
          sourceCommitSha,
          artifactSha256: sha256(moduleSource),
          runtimeId,
          referenceHardwareId,
        },
      });
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
});
