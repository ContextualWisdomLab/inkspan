import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import {
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
const activeRuntimeId = `node-${process.versions.node}`;
const sourceCommitSha = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: repositoryRoot,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
}).trim();
const referenceHardwareId = `refhw-sha256-${'b'.repeat(64)}`;

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function sha256(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function createPackedBenchmarkFixture(directory: string): {
  packageSha256: string;
  tarballPath: string;
} {
  const packageDirectory = join(directory, 'package-source');
  const distDirectory = join(packageDirectory, 'dist');
  const packDirectory = join(directory, 'packed');
  mkdirSync(distDirectory, { recursive: true });
  mkdirSync(packDirectory, { recursive: true });

  writeFileSync(
    join(packageDirectory, 'package.json'),
    `${JSON.stringify(
      {
        name: '@contextualwisdomlab/cwl-editor',
        version: '0.0.0-benchmark-fixture',
        type: 'module',
        files: ['dist'],
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  writeFileSync(
    join(distDirectory, 'cwl-markdown.js'),
    [
      "export function markdownToHtml(source) { return `<p>${source}</p>`; }",
      "export function htmlToMarkdown(source) { return source.replace(/<[^>]+>/gu, '').trim(); }",
      '',
    ].join('\n'),
    'utf8',
  );
  writeFileSync(
    join(distDirectory, 'cwl-revision-evidence.js'),
    `const revision = { digestHex: '${'c'.repeat(64)}' };
export async function createDocumentEnvelopeRevisionEvidenceBytes() { return { revision }; }
export async function createDocumentEnvelopeTransitionEvidenceBytes() { return { previousRevision: revision, resultingRevision: revision, changed: false }; }
`,
    'utf8',
  );
  writeFileSync(
    join(distDirectory, 'cwl-autosave.js'),
    [
      'export function createDocumentAutosaveQueue({ save }) {',
      '  let active;',
      '  return {',
      '    enqueue(evidence) {',
      "      active ??= Promise.resolve(save(evidence)).then(() => ({ status: 'saved' }));",
      '      return active;',
      '    },',
      '    async close() {},',
      '  };',
      '}',
      '',
    ].join('\n'),
    'utf8',
  );

  const packResult = JSON.parse(
    execFileSync(
      'npm',
      [
        'pack',
        '--json',
        '--ignore-scripts',
        '--pack-destination',
        packDirectory,
      ],
      {
        cwd: packageDirectory,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    ),
  )[0] as { filename: string };
  const tarballPath = join(packDirectory, packResult.filename);
  return {
    packageSha256: sha256(readFileSync(tarballPath)),
    tarballPath,
  };
}

function packedSuiteArguments(options: {
  directory: string;
  packageSha256: string;
  runtimeId: string;
  sourceCommitSha?: string;
  tarballPath: string;
}): string[] {
  const markdownInputPath = join(options.directory, 'input.md');
  const htmlInputPath = join(options.directory, 'input.html');
  const revisionInputPath = join(options.directory, 'document-envelope.json');
  writeFileSync(markdownInputPath, '# Packed buyer benchmark\n', 'utf8');
  writeFileSync(htmlInputPath, '<h1>Packed buyer benchmark</h1>\n', 'utf8');
  writeFileSync(
    revisionInputPath,
    '{"schemaId":"https://inkspan.io/schemas/document-envelope/v1","schemaVersion":1,"documentJson":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Packed buyer benchmark"}]}]}}\n',
    'utf8',
  );
  return [
    suitePath,
    '--input',
    markdownInputPath,
    '--html-input',
    htmlInputPath,
    '--revision-input',
    revisionInputPath,
    '--package-tarball',
    options.tarballPath,
    '--package-sha256',
    options.packageSha256,
    '--profile',
    'small',
    '--samples',
    '2',
    '--source-commit-sha',
    options.sourceCommitSha ?? sourceCommitSha,
    '--runtime-id',
    options.runtimeId,
    '--reference-hardware-id',
    referenceHardwareId,
    '--output',
    join(options.directory, 'evidence'),
  ];
}

describe('packed artifact benchmark suite contract', () => {
  it('binds one-command benchmark evidence to packed artifact and run provenance', () => {
    const directory = mkdtempSync(join(tmpdir(), 'inkspan-packed-benchmark-'));
    temporaryDirectories.push(directory);
    const packed = createPackedBenchmarkFixture(directory);

    const result = spawnSync(
      process.execPath,
      packedSuiteArguments({
        directory,
        packageSha256: packed.packageSha256,
        runtimeId: activeRuntimeId,
        tarballPath: packed.tarballPath,
      }),
      {
        cwd: repositoryRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 15_000,
      },
    );

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout.trim())).toMatchObject({
      contractVersion: 1,
      documentProfile: 'small',
      sampleCount: 2,
      sourceCommitSha,
      runtimeId: activeRuntimeId,
      referenceHardwareId,
      packageName: '@contextualwisdomlab/cwl-editor',
      packageVersion: '0.0.0-benchmark-fixture',
      packageSha256: packed.packageSha256,
      autosaveSamples: 'autosave/samples.json',
      autosaveSummaryJson: 'autosave/summary/summary.json',
      autosaveSummaryText: 'autosave/summary/summary.txt',
      autosaveCoalescingSamples: 'autosave-coalescing/samples.json',
      autosaveCoalescingSummaryJson:
        'autosave-coalescing/summary/summary.json',
      autosaveCoalescingSummaryText:
        'autosave-coalescing/summary/summary.txt',
      htmlSerializationSamples: 'html-serialization/samples.json',
      htmlSerializationSummaryJson:
        'html-serialization/summary/summary.json',
      htmlSerializationSummaryText:
        'html-serialization/summary/summary.txt',
      status: 'completed',
    });

    const autosaveSamples = JSON.parse(
      readFileSync(
        join(directory, 'evidence', 'autosave', 'samples.json'),
        'utf8',
      ),
    ) as { benchmarkId?: unknown; samples?: unknown[] };
    expect(autosaveSamples.benchmarkId).toBe('autosave-enqueue-small');
    expect(autosaveSamples.samples).toHaveLength(2);

    const coalescingSamples = JSON.parse(
      readFileSync(
        join(directory, 'evidence', 'autosave-coalescing', 'samples.json'),
        'utf8',
      ),
    ) as { benchmarkId?: unknown; samples?: unknown[] };
    expect(coalescingSamples.benchmarkId).toBe('autosave-coalescing-small');
    expect(coalescingSamples.samples).toHaveLength(2);

    const htmlSamples = JSON.parse(
      readFileSync(
        join(directory, 'evidence', 'html-serialization', 'samples.json'),
        'utf8',
      ),
    ) as { benchmarkId?: unknown; samples?: unknown[] };
    expect(htmlSamples.benchmarkId).toBe('html-serialization-small');
    expect(htmlSamples.samples).toHaveLength(2);
  }, 20_000);

  it('rejects a runtime identifier that does not match the active Node process', () => {
    const directory = mkdtempSync(join(tmpdir(), 'inkspan-packed-runtime-'));
    temporaryDirectories.push(directory);
    const packed = createPackedBenchmarkFixture(directory);

    const result = spawnSync(
      process.execPath,
      packedSuiteArguments({
        directory,
        packageSha256: packed.packageSha256,
        runtimeId: 'node-0.0.0',
        tarballPath: packed.tarballPath,
      }),
      {
        cwd: repositoryRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 15_000,
      },
    );

    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(
      'Benchmark suite runtime ID must match the active Node runtime.\n',
    );
  });

  it('rejects source provenance that does not match the benchmark checkout', () => {
    const directory = mkdtempSync(join(tmpdir(), 'inkspan-packed-source-'));
    temporaryDirectories.push(directory);
    const packed = createPackedBenchmarkFixture(directory);

    const result = spawnSync(
      process.execPath,
      packedSuiteArguments({
        directory,
        packageSha256: packed.packageSha256,
        runtimeId: activeRuntimeId,
        sourceCommitSha: '0'.repeat(40),
        tarballPath: packed.tarballPath,
      }),
      {
        cwd: repositoryRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 15_000,
      },
    );

    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(
      'Benchmark suite source commit SHA must match the current benchmark checkout.\n',
    );
  });
});
