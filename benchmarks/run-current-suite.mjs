import { spawnSync } from 'node:child_process';
import { lstatSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const benchmarkDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(benchmarkDirectory, '..');
const expectedFlags = Object.freeze([
  '--input',
  '--module',
  '--revision-input',
  '--revision-module',
  '--profile',
  '--samples',
  '--source-commit-sha',
  '--artifact-sha256',
  '--revision-artifact-sha256',
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
      'Usage: node benchmarks/run-current-suite.mjs --input <document.md> --module <packed-markdown-module> --revision-input <document-envelope.json> --revision-module <packed-revision-module> --profile <small|medium|large|stress> --samples <count> --source-commit-sha <sha> --artifact-sha256 <markdown-sha256> --revision-artifact-sha256 <revision-sha256> --runtime-id <runtime> --reference-hardware-id <hardware> --output <directory>',
    );
  }

  const values = Object.fromEntries(
    expectedFlags.map((flag, index) => [flag, argv[index * 2 + 1]]),
  );
  const sharedArguments = Object.freeze([
    '--profile',
    values['--profile'],
    '--samples',
    values['--samples'],
    '--source-commit-sha',
    values['--source-commit-sha'],
    '--runtime-id',
    values['--runtime-id'],
    '--reference-hardware-id',
    values['--reference-hardware-id'],
  ]);

  return Object.freeze({
    documentProfile: values['--profile'],
    markdownArguments: Object.freeze([
      '--input',
      values['--input'],
      '--module',
      values['--module'],
      ...sharedArguments,
      '--artifact-sha256',
      values['--artifact-sha256'],
    ]),
    revisionArguments: Object.freeze([
      '--input',
      values['--revision-input'],
      '--module',
      values['--revision-module'],
      ...sharedArguments,
      '--artifact-sha256',
      values['--revision-artifact-sha256'],
    ]),
    outputDirectory: resolve(values['--output']),
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

function runMeasurementAndSummary({
  measurementScript,
  measurementArguments,
  samplesPath,
  summaryDirectory,
  measurementFailure,
  summaryFailure,
}) {
  runBoundedNodeScript(
    measurementScript,
    [...measurementArguments, '--output', samplesPath],
    measurementFailure,
  );
  runBoundedNodeScript(
    'summarize-samples.mjs',
    ['--input', samplesPath, '--output', summaryDirectory],
    summaryFailure,
  );
}

function main(argv) {
  const args = resolveArguments(argv);
  prepareOutputDirectory(args.outputDirectory);

  const markdownSamplesPath = resolve(
    args.outputDirectory,
    'markdown',
    'samples.json',
  );
  const markdownSummaryDirectory = resolve(
    args.outputDirectory,
    'markdown',
    'summary',
  );
  const revisionSamplesPath = resolve(
    args.outputDirectory,
    'revision',
    'samples.json',
  );
  const revisionSummaryDirectory = resolve(
    args.outputDirectory,
    'revision',
    'summary',
  );

  runMeasurementAndSummary({
    measurementScript: 'measure-markdown.mjs',
    measurementArguments: args.markdownArguments,
    samplesPath: markdownSamplesPath,
    summaryDirectory: markdownSummaryDirectory,
    measurementFailure: 'Benchmark suite Markdown measurement failed.',
    summaryFailure: 'Benchmark suite Markdown summary failed.',
  });
  runMeasurementAndSummary({
    measurementScript: 'measure-revision-evidence.mjs',
    measurementArguments: args.revisionArguments,
    samplesPath: revisionSamplesPath,
    summaryDirectory: revisionSummaryDirectory,
    measurementFailure: 'Benchmark suite revision measurement failed.',
    summaryFailure: 'Benchmark suite revision summary failed.',
  });

  process.stdout.write(
    `${JSON.stringify({
      contractVersion: 1,
      documentProfile: args.documentProfile,
      markdownSamples: 'markdown/samples.json',
      markdownSummaryJson: 'markdown/summary/summary.json',
      markdownSummaryText: 'markdown/summary/summary.txt',
      revisionSamples: 'revision/samples.json',
      revisionSummaryJson: 'revision/summary/summary.json',
      revisionSummaryText: 'revision/summary/summary.txt',
      status: 'completed',
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
