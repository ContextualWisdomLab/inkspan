import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';

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
const referenceHardwareId = `refhw-sha256-${'d'.repeat(64)}`;

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function sha256(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function createPackedBenchmarkFixture(
  directory: string,
  name: string,
  markdownMarker: string,
): {
  markdownModuleSha256: string;
  packageSha256: string;
  tarballPath: string;
} {
  const packageDirectory = join(directory, `${name}-package-source`);
  const distDirectory = join(packageDirectory, 'dist');
  const packDirectory = join(directory, `${name}-packed`);
  mkdirSync(distDirectory, { recursive: true });
  mkdirSync(packDirectory, { recursive: true });

  const markdownModule = `export function markdownToHtml(source) { return \`<p data-marker="${markdownMarker}">\${source}</p>\`; }\n`;
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
    markdownModule,
    'utf8',
  );
  writeFileSync(
    join(distDirectory, 'cwl-revision-evidence.js'),
    `export async function createDocumentEnvelopeRevisionEvidenceBytes() { return { revision: { digestHex: '${'e'.repeat(64)}' } }; }\n`,
    'utf8',
  );
  writeFileSync(
    join(distDirectory, 'cwl-autosave.js'),
    [
      'export function createDocumentAutosaveQueue({ save }) {',
      '  return {',
      '    async enqueue(evidence) { return await save(evidence); },',
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
    markdownModuleSha256: sha256(markdownModule),
    packageSha256: sha256(readFileSync(tarballPath)),
    tarballPath,
  };
}

function createTarInterpositionShim(
  directory: string,
  originalTarballPath: string,
  adversarialTarballPath: string,
): { environment: NodeJS.ProcessEnv; originalBackupPath: string } {
  const shimDirectory = join(directory, 'shim');
  mkdirSync(shimDirectory, { recursive: true });
  const originalBackupPath = join(directory, 'original-package-backup.tgz');
  copyFileSync(originalTarballPath, originalBackupPath);
  const realTar = execFileSync('sh', ['-c', 'command -v tar'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  const shimPath = join(shimDirectory, 'tar');
  writeFileSync(
    shimPath,
    `#!/usr/bin/env node\nimport { copyFileSync } from 'node:fs';\nimport { spawnSync } from 'node:child_process';\n\nconst args = process.argv.slice(2);\nconst target = args[1];\nconst original = process.env.INKSPAN_TEST_ORIGINAL_TARBALL;\nif (target === original) copyFileSync(process.env.INKSPAN_TEST_ADVERSARIAL_TARBALL, original);\ntry {\n  const result = spawnSync(process.env.INKSPAN_TEST_REAL_TAR, args, { stdio: ['ignore', 'pipe', 'pipe'] });\n  if (result.stdout) process.stdout.write(result.stdout);\n  if (result.stderr) process.stderr.write(result.stderr);\n  process.exitCode = result.status ?? 1;\n} finally {\n  if (target === original) copyFileSync(process.env.INKSPAN_TEST_ORIGINAL_BACKUP, original);\n}\n`,
    'utf8',
  );
  chmodSync(shimPath, 0o755);
  return {
    originalBackupPath,
    environment: {
      ...process.env,
      PATH: `${shimDirectory}${delimiter}${process.env.PATH ?? ''}`,
      INKSPAN_TEST_REAL_TAR: realTar,
      INKSPAN_TEST_ORIGINAL_TARBALL: originalTarballPath,
      INKSPAN_TEST_ADVERSARIAL_TARBALL: adversarialTarballPath,
      INKSPAN_TEST_ORIGINAL_BACKUP: originalBackupPath,
    },
  };
}

describe('packed artifact benchmark path stability', () => {
  it('measures the same tarball bytes whose package digest was verified', () => {
    if (process.platform === 'win32') return;

    const directory = mkdtempSync(join(tmpdir(), 'inkspan-packed-path-stability-'));
    temporaryDirectories.push(directory);
    const original = createPackedBenchmarkFixture(directory, 'original', 'verified');
    const adversarial = createPackedBenchmarkFixture(directory, 'adversarial', 'interposed');
    const { environment } = createTarInterpositionShim(
      directory,
      original.tarballPath,
      adversarial.tarballPath,
    );
    const markdownInputPath = join(directory, 'input.md');
    const revisionInputPath = join(directory, 'document-envelope.json');
    const outputDirectory = join(directory, 'evidence');
    writeFileSync(markdownInputPath, '# Stable packed artifact\n', 'utf8');
    writeFileSync(
      revisionInputPath,
      '{"contractVersion":1,"mode":"markdown","document":"# Stable packed artifact"}\n',
      'utf8',
    );

    const result = spawnSync(
      process.execPath,
      [
        suitePath,
        '--input',
        markdownInputPath,
        '--revision-input',
        revisionInputPath,
        '--package-tarball',
        original.tarballPath,
        '--package-sha256',
        original.packageSha256,
        '--profile',
        'small',
        '--samples',
        '1',
        '--source-commit-sha',
        sourceCommitSha,
        '--runtime-id',
        activeRuntimeId,
        '--reference-hardware-id',
        referenceHardwareId,
        '--output',
        outputDirectory,
      ],
      {
        cwd: repositoryRoot,
        encoding: 'utf8',
        env: environment,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 15_000,
      },
    );

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    const markdownEvidence = JSON.parse(
      readFileSync(join(outputDirectory, 'markdown', 'samples.json'), 'utf8'),
    ) as { artifactSha256: string };
    expect(markdownEvidence.artifactSha256).toBe(original.markdownModuleSha256);
  }, 20_000);
});
