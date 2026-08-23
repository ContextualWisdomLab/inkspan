import { spawnSync } from 'node:child_process';
import { lstatSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const benchmarkDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(benchmarkDirectory, '..');
const expectedFlags = Object.freeze([
  '--input',
  '--module',
  '--profile',
  '--samples',
  '--source-commit-sha',
  '--artifact-sha256',
  '--runtime-id',
  '--reference-hardware-id',
  '--output',
]);
const OUTPUT_DIRECTORY_ERROR =
  'Benchmark suite output directory must be a non-symlink directory.';

function resolveArguments(argv) {
  if (
    argv.length !== expectedFlags.length * 2 ||
    expectedFlags.some((flag, index) => argv[index * 2] !== flag) ||
    expectedFlags.some((_, index) => argv[index * 2 + 1]?.length === 0)
  ) {
    throw new Error(
      'Usage: node benchmarks/run-current-suite.mjs --input <document.md> --module <packed-markdown-module> --profile <small|medium|large|stress> --samples <count> --source-commit-sha <sha> --artifact-sha256 <sha256> --runtime-id <runtime> --reference-hardware-id <hardware> --output <directory>',
    );
  }

  return Object.freeze({
    documentProfile: argv[5],
    forwardedArguments: Object.freeze(argv.slice(0, -2)),
    outputDirectory: resolve(argv[17]),
  });
}

function inspectOutputDirectory(path) {
  try {
    return lstatSync(path, { throwIfNoEntry: false });
  } catch {
    throw new Error('Benchmark suite output directory could not be inspected.');
  }
}

function assertNoSymlinkDirectoryComponents(path) {
  let current = path;
  while (true) {
    const metadata = inspectOutputDirectory(current);
    if (metadata?.isSymbolicLink()) {
      throw new Error(OUTPUT_DIRECTORY_ERROR);
    }
    const parent = dirname(current);
    if (parent === current) return;
    current = parent;
  }
}

function prepareOutputDirectory(path) {
  assertNoSymlinkDirectoryComponents(path);
  const existing = inspectOutputDirectory(path);
  if (existing !== undefined) {
    if (!existing.isDirectory()) {
      throw new Error(OUTPUT_DIRECTORY_ERROR);
    }
    return;
  }

  try {
    mkdirSync(path, { recursive: true });
  } catch {
    throw new Error('Benchmark suite output directory could not be prepared.');
  }

  assertNoSymlinkDirectoryComponents(path);
  const created = inspectOutputDirectory(path);
  if (created === undefined || !created.isDirectory()) {
    throw new Error(OUTPUT_DIRECTORY_ERROR);
  }
}

function runBoundedNodeScript(scriptName, args, failureMessage) {
  const result = spawnSync(
    process.execPath,
    [resolve(benchmarkDirectory, scriptName), ...args],
    {
      cwd: repositoryRoot,
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120_000,
    },
  );

  if (
    result.error !== undefined ||
    result.signal !== null ||
    result.status !== 0
  ) {
    throw new Error(failureMessage);
  }
}

function main(argv) {
  const args = resolveArguments(argv);
  prepareOutputDirectory(args.outputDirectory);
  const samplesPath = resolve(args.outputDirectory, 'samples.json');
  const summaryDirectory = resolve(args.outputDirectory, 'summary');

  runBoundedNodeScript(
    'measure-markdown.mjs',
    [...args.forwardedArguments, '--output', samplesPath],
    'Benchmark suite measurement failed.',
  );
  runBoundedNodeScript(
    'summarize-samples.mjs',
    ['--input', samplesPath, '--output', summaryDirectory],
    'Benchmark suite summary failed.',
  );

  process.stdout.write(
    `${JSON.stringify({
      contractVersion: 1,
      documentProfile: args.documentProfile,
      samples: 'samples.json',
      status: 'completed',
      summaryJson: 'summary/summary.json',
      summaryText: 'summary/summary.txt',
    })}\n`,
  );
}

try {
  main(process.argv.slice(2));
} catch (error) {
  const message =
    error instanceof Error ? error.message : 'Benchmark suite failed.';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
