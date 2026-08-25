import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const repositoryRoot = process.cwd();
const suitePath = resolve(repositoryRoot, 'benchmarks/run-current-suite.mjs');
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function sha256(source: string): string {
  return createHash('sha256').update(source).digest('hex');
}

describe('benchmark suite existing-output atomicity', () => {
  it('rejects an existing evidence directory before mutating prior evidence', () => {
    const directory = mkdtempSync(join(tmpdir(), 'inkspan-suite-existing-output-'));
    temporaryDirectories.push(directory);
    const markdownInputPath = join(directory, 'input.md');
    const revisionInputPath = join(directory, 'document-envelope.json');
    const markdownModulePath = join(directory, 'markdown.mjs');
    const revisionModulePath = join(directory, 'revision.mjs');
    const outputDirectory = join(directory, 'evidence');
    const priorEvidencePath = join(outputDirectory, 'accepted-evidence.json');
    const markdownModuleSource =
      "export function markdownToHtml(source) { return `<p>${source}</p>`; }\n";
    const revisionModuleSource =
      "export async function createDocumentEnvelopeRevisionEvidenceBytes() { throw new Error('private downstream failure'); }\n";

    writeFileSync(markdownInputPath, '# Existing evidence must stay immutable\n', 'utf8');
    writeFileSync(
      revisionInputPath,
      '{"contractVersion":1,"mode":"markdown","document":"# Existing evidence must stay immutable"}\n',
      'utf8',
    );
    writeFileSync(markdownModulePath, markdownModuleSource, 'utf8');
    writeFileSync(revisionModulePath, revisionModuleSource, 'utf8');
    mkdirSync(outputDirectory);
    writeFileSync(priorEvidencePath, '{"status":"accepted"}\n', 'utf8');

    const result = spawnSync(
      process.execPath,
      [
        suitePath,
        '--input',
        markdownInputPath,
        '--module',
        markdownModulePath,
        '--revision-input',
        revisionInputPath,
        '--revision-module',
        revisionModulePath,
        '--profile',
        'small',
        '--samples',
        '1',
        '--source-commit-sha',
        'a'.repeat(40),
        '--artifact-sha256',
        sha256(markdownModuleSource),
        '--revision-artifact-sha256',
        sha256(revisionModuleSource),
        '--runtime-id',
        'node-22.0.0',
        '--reference-hardware-id',
        `refhw-sha256-${'b'.repeat(64)}`,
        '--output',
        outputDirectory,
      ],
      {
        cwd: repositoryRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 10_000,
      },
    );

    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(
      'Benchmark suite output directory must not already exist.\n',
    );
    expect(readFileSync(priorEvidencePath, 'utf8')).toBe(
      '{"status":"accepted"}\n',
    );
    expect(existsSync(join(outputDirectory, 'markdown'))).toBe(false);
    expect(existsSync(join(outputDirectory, 'revision'))).toBe(false);
  });
});
