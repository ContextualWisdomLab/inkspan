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
    "export function markdownToHtml(source) { return `<p>${source}</p>`; }\n",
    'utf8',
  );
  writeFileSync(
    join(distDirectory, 'cwl-revision-evidence.js'),
    `export async function createDocumentEnvelopeRevisionEvidenceBytes() { return { revision: { digestHex: '${'c'.repeat(64)}' } }; }\n`,
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
  tarballPath: string;
}): string[] {
  const markdownInputPath = join(options.directory, 'input.md');
  const revisionInputPath = join(options.directory, 'document-envelope.json');
  writeFileSync(markdownInputPath, '# Packed buyer benchmark\n', 'utf8');
  writeFileSync(
    revisionInputPath,
    '{"contractVersion":1,"mode":"markdown","document":"# Packed buyer benchmark"}\n',
    'utf8',
  );
  return [
    suitePath,
    '--input',
    markdownInputPath,
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
    'a'.repeat(40),
    '--runtime-id',
    options.runtimeId,
    '--reference-hardware-id',
    `refhw-sha256-${'b'.repeat(64)}`,
    '--output',
    join(options.directory, 'evidence'),
  ];
}

describe('packed artifact benchmark suite contract', () => {
  it('binds one-command benchmark evidence to a packed npm artifact digest', () => {
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
      packageName: '@contextualwisdomlab/cwl-editor',
      packageVersion: '0.0.0-benchmark-fixture',
      packageSha256: packed.packageSha256,
      status: 'completed',
    });
  });

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
});
