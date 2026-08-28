import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const repositoryRoot = process.cwd();
const suitePath = resolve(repositoryRoot, 'benchmarks/run-current-suite.mjs');
const temporaryDirectories: string[] = [];
const currentSourceCommitSha = execFileSync(
  'git',
  ['rev-parse', '--verify', 'HEAD'],
  {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  },
).trim();
const currentRuntimeId = `node-${process.versions.node}`;

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function benchmarkArguments(
  markdownInputPath: string,
  markdownModulePath: string,
  markdownArtifactSha256: string,
  revisionInputPath: string,
  revisionModulePath: string,
  revisionArtifactSha256: string,
  outputDirectory: string,
  sourceCommitSha = currentSourceCommitSha,
): string[] {
  return [
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
    '2',
    '--source-commit-sha',
    sourceCommitSha,
    '--artifact-sha256',
    markdownArtifactSha256,
    '--revision-artifact-sha256',
    revisionArtifactSha256,
    '--runtime-id',
    currentRuntimeId,
    '--reference-hardware-id',
    `refhw-sha256-${'b'.repeat(64)}`,
    '--output',
    outputDirectory,
  ];
}

function writeBenchmarkInputs(directory: string): {
  markdownArtifactSha256: string;
  markdownInputPath: string;
  markdownModulePath: string;
  revisionArtifactSha256: string;
  revisionInputPath: string;
  revisionModulePath: string;
} {
  const markdownInputPath = join(directory, 'input.md');
  const markdownModulePath = join(directory, 'markdown-measured.mjs');
  const markdownModuleSource =
    "export function markdownToHtml(source) { return `<p>${source}</p>`; }\n";
  const revisionInputPath = join(directory, 'document-envelope.json');
  const revisionModulePath = join(directory, 'revision-measured.mjs');
  const revisionModuleSource = `export async function createDocumentEnvelopeRevisionEvidenceBytes() { return { revision: { digestHex: '${'c'.repeat(64)}' } }; }\n`;

  writeFileSync(markdownInputPath, '# Buyer benchmark\n', 'utf8');
  writeFileSync(markdownModulePath, markdownModuleSource, 'utf8');
  writeFileSync(
    revisionInputPath,
    '{"contractVersion":1,"mode":"markdown","document":"# Buyer benchmark"}\n',
    'utf8',
  );
  writeFileSync(revisionModulePath, revisionModuleSource, 'utf8');

  return {
    markdownArtifactSha256: createHash('sha256')
      .update(markdownModuleSource)
      .digest('hex'),
    markdownInputPath,
    markdownModulePath,
    revisionArtifactSha256: createHash('sha256')
      .update(revisionModuleSource)
      .digest('hex'),
    revisionInputPath,
    revisionModulePath,
  };
}

describe('single-command benchmark suite contract', () => {
  it('measures and summarizes Markdown serialization and revision evidence with one command', () => {
    const directory = mkdtempSync(join(tmpdir(), 'inkspan-benchmark-suite-'));
    temporaryDirectories.push(directory);
    const outputDirectory = join(directory, 'evidence');
    const inputs = writeBenchmarkInputs(directory);

    const output = execFileSync(
      process.execPath,
      benchmarkArguments(
        inputs.markdownInputPath,
        inputs.markdownModulePath,
        inputs.markdownArtifactSha256,
        inputs.revisionInputPath,
        inputs.revisionModulePath,
        inputs.revisionArtifactSha256,
        outputDirectory,
      ),
      {
        cwd: repositoryRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 10_000,
      },
    );

    expect(JSON.parse(output.trim())).toEqual({
      contractVersion: 1,
      documentProfile: 'small',
      sampleCount: 2,
      sourceCommitSha: currentSourceCommitSha,
      runtimeId: currentRuntimeId,
      referenceHardwareId: `refhw-sha256-${'b'.repeat(64)}`,
      markdownSamples: 'markdown/samples.json',
      markdownSummaryJson: 'markdown/summary/summary.json',
      markdownSummaryText: 'markdown/summary/summary.txt',
      revisionSamples: 'revision/samples.json',
      revisionSummaryJson: 'revision/summary/summary.json',
      revisionSummaryText: 'revision/summary/summary.txt',
      status: 'completed',
    });

    const markdownSamples = JSON.parse(
      readFileSync(join(outputDirectory, 'markdown', 'samples.json'), 'utf8'),
    ) as { benchmarkId?: unknown; documentProfile?: unknown; samples?: unknown };
    expect(markdownSamples.benchmarkId).toBe('markdown-serialization-small');
    expect(markdownSamples.documentProfile).toBe('small');
    expect(markdownSamples.samples).toHaveLength(2);

    const markdownSummary = JSON.parse(
      readFileSync(
        join(outputDirectory, 'markdown', 'summary', 'summary.json'),
        'utf8',
      ),
    ) as { benchmarkId?: unknown; documentProfile?: unknown };
    expect(markdownSummary.benchmarkId).toBe('markdown-serialization-small');
    expect(markdownSummary.documentProfile).toBe('small');
    expect(
      readFileSync(
        join(outputDirectory, 'markdown', 'summary', 'summary.txt'),
        'utf8',
      ),
    ).toContain('markdown-serialization-small');

    const revisionSamples = JSON.parse(
      readFileSync(join(outputDirectory, 'revision', 'samples.json'), 'utf8'),
    ) as { benchmarkId?: unknown; documentProfile?: unknown; samples?: unknown };
    expect(revisionSamples.benchmarkId).toBe('revision-evidence-small');
    expect(revisionSamples.documentProfile).toBe('small');
    expect(revisionSamples.samples).toHaveLength(2);

    const revisionSummary = JSON.parse(
      readFileSync(
        join(outputDirectory, 'revision', 'summary', 'summary.json'),
        'utf8',
      ),
    ) as { benchmarkId?: unknown; documentProfile?: unknown };
    expect(revisionSummary.benchmarkId).toBe('revision-evidence-small');
    expect(revisionSummary.documentProfile).toBe('small');
    expect(
      readFileSync(
        join(outputDirectory, 'revision', 'summary', 'summary.txt'),
        'utf8',
      ),
    ).toContain('revision-evidence-small');
  }, 20_000);

  it('rejects a claimed source commit that is not the checked-out HEAD', () => {
    const directory = mkdtempSync(join(tmpdir(), 'inkspan-benchmark-suite-source-'));
    temporaryDirectories.push(directory);
    const outputDirectory = join(directory, 'evidence');
    const inputs = writeBenchmarkInputs(directory);
    const mismatchedCommit =
      currentSourceCommitSha === 'f'.repeat(40) ? 'e'.repeat(40) : 'f'.repeat(40);

    const result = spawnSync(
      process.execPath,
      benchmarkArguments(
        inputs.markdownInputPath,
        inputs.markdownModulePath,
        inputs.markdownArtifactSha256,
        inputs.revisionInputPath,
        inputs.revisionModulePath,
        inputs.revisionArtifactSha256,
        outputDirectory,
        mismatchedCommit,
      ),
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
      'Benchmark suite source commit does not match checked-out HEAD.\n',
    );
    expect(result.stderr).not.toContain(currentSourceCommitSha);
    expect(result.stderr).not.toContain(mismatchedCommit);
    expect(existsSync(outputDirectory)).toBe(false);
  });

  it('removes partial suite evidence when a downstream measurement fails', () => {
    const directory = mkdtempSync(join(tmpdir(), 'inkspan-benchmark-suite-'));
    temporaryDirectories.push(directory);
    const outputDirectory = join(directory, 'evidence');
    const inputs = writeBenchmarkInputs(directory);
    const failingRevisionModuleSource =
      "export async function createDocumentEnvelopeRevisionEvidenceBytes() { throw new Error('private benchmark failure'); }\n";
    writeFileSync(
      inputs.revisionModulePath,
      failingRevisionModuleSource,
      'utf8',
    );
    const failingRevisionArtifactSha256 = createHash('sha256')
      .update(failingRevisionModuleSource)
      .digest('hex');

    const result = spawnSync(
      process.execPath,
      benchmarkArguments(
        inputs.markdownInputPath,
        inputs.markdownModulePath,
        inputs.markdownArtifactSha256,
        inputs.revisionInputPath,
        inputs.revisionModulePath,
        failingRevisionArtifactSha256,
        outputDirectory,
      ),
      {
        cwd: repositoryRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 10_000,
      },
    );

    expect(result.status).not.toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(
      'Benchmark suite revision measurement failed.\n',
    );
    expect(existsSync(outputDirectory)).toBe(false);
  });

  it('fails closed before writing evidence through a symlink output directory', () => {
    const directory = mkdtempSync(join(tmpdir(), 'inkspan-benchmark-suite-'));
    temporaryDirectories.push(directory);
    const inputs = writeBenchmarkInputs(directory);
    const actualOutputDirectory = join(directory, 'outside-target');
    const outputDirectory = join(directory, 'evidence-link');
    mkdirSync(actualOutputDirectory);
    symlinkSync(
      actualOutputDirectory,
      outputDirectory,
      process.platform === 'win32' ? 'junction' : 'dir',
    );

    const result = spawnSync(
      process.execPath,
      benchmarkArguments(
        inputs.markdownInputPath,
        inputs.markdownModulePath,
        inputs.markdownArtifactSha256,
        inputs.revisionInputPath,
        inputs.revisionModulePath,
        inputs.revisionArtifactSha256,
        outputDirectory,
      ),
      {
        cwd: repositoryRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 10_000,
      },
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toBe(
      'Benchmark suite output directory must be a non-symlink directory.\n',
    );
    expect(existsSync(join(actualOutputDirectory, 'markdown'))).toBe(false);
    expect(existsSync(join(actualOutputDirectory, 'revision'))).toBe(false);
  }, 20_000);
});
