import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const benchmarkDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(benchmarkDirectory, '..');
const legacyFlags = Object.freeze([
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
const packedFlags = Object.freeze([
  '--input',
  '--revision-input',
  '--package-tarball',
  '--package-sha256',
  '--profile',
  '--samples',
  '--source-commit-sha',
  '--runtime-id',
  '--reference-hardware-id',
  '--output',
]);
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const COMMIT_SHA_PATTERN = /^[0-9a-f]{40}$/u;
const MAX_PACKAGE_BYTES = 64 * 1024 * 1024;
const MAX_PACKAGE_INDEX_BYTES = 1024 * 1024;
const MAX_PACKAGE_MANIFEST_BYTES = 1024 * 1024;
const MAX_MODULE_BYTES = 16 * 1024 * 1024;
const READ_CHUNK_BYTES = 64 * 1024;
const READ_ONLY_NOFOLLOW = constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0);
const EXPECTED_PACKAGE_NAME = '@contextualwisdomlab/cwl-editor';
const PACKAGE_MANIFEST_ENTRY = 'package/package.json';
const MARKDOWN_MODULE_ENTRY = 'package/dist/cwl-markdown.js';
const REVISION_MODULE_ENTRY = 'package/dist/cwl-revision-evidence.js';
const AUTOSAVE_MODULE_ENTRY = 'package/dist/cwl-autosave.js';
const OUTPUT_DIRECTORY_ERROR =
  'Benchmark suite output directory must be a non-symlink directory.';
const OUTPUT_DIRECTORY_EXISTS_ERROR =
  'Benchmark suite output directory must not already exist.';

function matchesArguments(argv, expectedFlags) {
  return (
    argv.length === expectedFlags.length * 2 &&
    expectedFlags.every((flag, index) => argv[index * 2] === flag) &&
    expectedFlags.every((_, index) => argv[index * 2 + 1]?.length > 0)
  );
}

function valuesForArguments(argv, expectedFlags) {
  return Object.fromEntries(
    expectedFlags.map((flag, index) => [flag, argv[index * 2 + 1]]),
  );
}

function sharedArguments(values) {
  return Object.freeze({
    documentProfile: values['--profile'],
    sampleCount: values['--samples'],
    sourceCommitSha: values['--source-commit-sha'],
    runtimeId: values['--runtime-id'],
    referenceHardwareId: values['--reference-hardware-id'],
    markdownInputPath: values['--input'],
    revisionInputPath: values['--revision-input'],
    outputDirectory: resolve(values['--output']),
  });
}

function measurementArguments({
  inputPath,
  modulePath,
  artifactSha256,
  shared,
}) {
  return Object.freeze([
    '--input',
    inputPath,
    '--module',
    modulePath,
    '--profile',
    shared.documentProfile,
    '--samples',
    shared.sampleCount,
    '--source-commit-sha',
    shared.sourceCommitSha,
    '--artifact-sha256',
    artifactSha256,
    '--runtime-id',
    shared.runtimeId,
    '--reference-hardware-id',
    shared.referenceHardwareId,
  ]);
}

function autosaveMeasurementArguments({ modulePath, artifactSha256, shared }) {
  return Object.freeze([
    '--input',
    shared.revisionInputPath,
    '--module',
    modulePath,
    '--profile',
    shared.documentProfile,
    '--samples',
    shared.sampleCount,
    '--source-commit-sha',
    shared.sourceCommitSha,
    '--artifact-sha256',
    artifactSha256,
    '--runtime-id',
    shared.runtimeId,
    '--reference-hardware-id',
    shared.referenceHardwareId,
  ]);
}

function currentCheckoutSha() {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    maxBuffer: 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 10_000,
  });
  const checkoutSha = result.stdout?.trim();
  if (
    result.error !== undefined ||
    result.signal !== null ||
    result.status !== 0 ||
    !COMMIT_SHA_PATTERN.test(checkoutSha ?? '')
  ) {
    throw new Error(
      'Benchmark suite source commit SHA could not be verified against the current checkout.',
    );
  }
  return checkoutSha;
}

function resolveArguments(argv) {
  if (matchesArguments(argv, packedFlags)) {
    const values = valuesForArguments(argv, packedFlags);
    const packageSha256 = values['--package-sha256'];
    if (!SHA256_PATTERN.test(packageSha256)) {
      throw new Error(
        'Benchmark suite package digest must be a lowercase 64-character SHA-256.',
      );
    }
    const activeRuntimeId = `node-${process.versions.node}`;
    if (values['--runtime-id'] !== activeRuntimeId) {
      throw new Error(
        'Benchmark suite runtime ID must match the active Node runtime.',
      );
    }
    if (values['--source-commit-sha'] !== currentCheckoutSha()) {
      throw new Error(
        'Benchmark suite source commit SHA must match the current benchmark checkout.',
      );
    }
    return Object.freeze({
      mode: 'packed',
      shared: sharedArguments(values),
      packageTarballPath: resolve(values['--package-tarball']),
      packageSha256,
    });
  }

  if (matchesArguments(argv, legacyFlags)) {
    const values = valuesForArguments(argv, legacyFlags);
    const shared = sharedArguments(values);
    return Object.freeze({
      mode: 'module',
      shared,
      markdownArguments: measurementArguments({
        inputPath: shared.markdownInputPath,
        modulePath: values['--module'],
        artifactSha256: values['--artifact-sha256'],
        shared,
      }),
      revisionArguments: measurementArguments({
        inputPath: shared.revisionInputPath,
        modulePath: values['--revision-module'],
        artifactSha256: values['--revision-artifact-sha256'],
        shared,
      }),
      packageEvidence: null,
    });
  }

  throw new Error(
    'Usage: node benchmarks/run-current-suite.mjs --input <document.md> --revision-input <document-envelope.json> --package-tarball <packed-npm.tgz> --package-sha256 <sha256> --profile <small|medium|large|stress> --samples <count> --source-commit-sha <sha> --runtime-id <runtime> --reference-hardware-id <hardware> --output <directory>',
  );
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
    throw new Error(OUTPUT_DIRECTORY_EXISTS_ERROR);
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
  return true;
}

function removePartialOutputDirectory(path) {
  try {
    rmSync(path, { recursive: true, force: true });
  } catch {
    throw new Error('Benchmark suite partial evidence could not be removed.');
  }
}

function readBoundedRegularFile(path, maximumBytes, invalidMessage, oversizedMessage) {
  let pathMetadata;
  try {
    pathMetadata = lstatSync(path, { throwIfNoEntry: false });
  } catch {
    throw new Error(invalidMessage);
  }
  if (
    pathMetadata === undefined ||
    pathMetadata.isSymbolicLink() ||
    !pathMetadata.isFile()
  ) {
    throw new Error(invalidMessage);
  }

  let descriptor;
  try {
    descriptor = openSync(path, READ_ONLY_NOFOLLOW);
  } catch {
    throw new Error(invalidMessage);
  }
  try {
    const metadata = fstatSync(descriptor);
    if (!metadata.isFile()) throw new Error(invalidMessage);
    if (metadata.size > maximumBytes) throw new Error(oversizedMessage);

    const chunks = [];
    let totalBytes = 0;
    while (totalBytes <= maximumBytes) {
      const remainingBudget = maximumBytes + 1 - totalBytes;
      const chunk = Buffer.allocUnsafe(
        Math.min(READ_CHUNK_BYTES, remainingBudget),
      );
      const bytesRead = readSync(
        descriptor,
        chunk,
        0,
        chunk.byteLength,
        null,
      );
      if (bytesRead === 0) break;
      totalBytes += bytesRead;
      if (totalBytes > maximumBytes) throw new Error(oversizedMessage);
      chunks.push(chunk.subarray(0, bytesRead));
    }
    return Buffer.concat(chunks, totalBytes);
  } finally {
    closeSync(descriptor);
  }
}

function packageTarballBytes(path) {
  return readBoundedRegularFile(
    path,
    MAX_PACKAGE_BYTES,
    'Benchmark suite package tarball must be a regular non-symlink file.',
    'Benchmark suite package tarball exceeds the supported size.',
  );
}

function verifyPackageDigest(path, expectedSha256) {
  const actualSha256 = createHash('sha256')
    .update(packageTarballBytes(path))
    .digest('hex');
  if (actualSha256 !== expectedSha256) {
    throw new Error('Benchmark suite package digest does not match the packed artifact.');
  }
}

function runTar(argumentsList, maximumBytes, failureMessage) {
  const result = spawnSync('tar', argumentsList, {
    cwd: repositoryRoot,
    maxBuffer: maximumBytes,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 30_000,
  });
  if (
    result.error !== undefined ||
    result.signal !== null ||
    result.status !== 0 ||
    !Buffer.isBuffer(result.stdout) ||
    result.stdout.byteLength > maximumBytes
  ) {
    throw new Error(failureMessage);
  }
  return result.stdout;
}

function decodeUtf8(bytes, failureMessage) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error(failureMessage);
  }
}

function listPackedEntries(tarballPath) {
  const listing = decodeUtf8(
    runTar(
      ['-tzf', tarballPath],
      MAX_PACKAGE_INDEX_BYTES,
      'Benchmark suite package index could not be read.',
    ),
    'Benchmark suite package index must be valid UTF-8.',
  );
  return listing.split('\n').filter((entry) => entry.length > 0);
}

function assertUniquePackedEntry(entries, expectedEntry) {
  if (entries.filter((entry) => entry === expectedEntry).length !== 1) {
    throw new Error('Benchmark suite package is missing a unique required artifact.');
  }
}

function readPackedEntry(tarballPath, entry, maximumBytes) {
  return runTar(
    ['-xOzf', tarballPath, entry],
    maximumBytes,
    'Benchmark suite package artifact could not be read.',
  );
}

function parsePackageManifest(bytes) {
  let manifest;
  try {
    manifest = JSON.parse(
      decodeUtf8(bytes, 'Benchmark suite package manifest must be valid UTF-8.'),
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('valid UTF-8')) throw error;
    throw new Error('Benchmark suite package manifest must be valid JSON.');
  }
  if (
    manifest === null ||
    typeof manifest !== 'object' ||
    Array.isArray(manifest) ||
    manifest.name !== EXPECTED_PACKAGE_NAME ||
    typeof manifest.version !== 'string' ||
    manifest.version.length === 0 ||
    manifest.version.length > 128
  ) {
    throw new Error('Benchmark suite package identity is invalid.');
  }
  return Object.freeze({ name: manifest.name, version: manifest.version });
}

function moduleSha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function preparePackedBenchmarkModules(args) {
  verifyPackageDigest(args.packageTarballPath, args.packageSha256);
  const entries = listPackedEntries(args.packageTarballPath);
  for (const entry of [
    PACKAGE_MANIFEST_ENTRY,
    MARKDOWN_MODULE_ENTRY,
    REVISION_MODULE_ENTRY,
    AUTOSAVE_MODULE_ENTRY,
  ]) {
    assertUniquePackedEntry(entries, entry);
  }

  const manifestBytes = readPackedEntry(
    args.packageTarballPath,
    PACKAGE_MANIFEST_ENTRY,
    MAX_PACKAGE_MANIFEST_BYTES,
  );
  const manifest = parsePackageManifest(manifestBytes);
  const markdownModuleBytes = readPackedEntry(
    args.packageTarballPath,
    MARKDOWN_MODULE_ENTRY,
    MAX_MODULE_BYTES,
  );
  const revisionModuleBytes = readPackedEntry(
    args.packageTarballPath,
    REVISION_MODULE_ENTRY,
    MAX_MODULE_BYTES,
  );
  const autosaveModuleBytes = readPackedEntry(
    args.packageTarballPath,
    AUTOSAVE_MODULE_ENTRY,
    MAX_MODULE_BYTES,
  );
  verifyPackageDigest(args.packageTarballPath, args.packageSha256);

  const temporaryDirectory = mkdtempSync(
    join(tmpdir(), 'inkspan-packed-benchmark-'),
  );
  const markdownModulePath = join(temporaryDirectory, 'cwl-markdown.mjs');
  const revisionModulePath = join(
    temporaryDirectory,
    'cwl-revision-evidence.mjs',
  );
  const autosaveModulePath = join(temporaryDirectory, 'cwl-autosave.mjs');
  try {
    writeFileSync(markdownModulePath, markdownModuleBytes);
    writeFileSync(revisionModulePath, revisionModuleBytes);
    writeFileSync(autosaveModulePath, autosaveModuleBytes);
  } catch {
    rmSync(temporaryDirectory, { recursive: true, force: true });
    throw new Error('Benchmark suite package modules could not be prepared.');
  }

  return Object.freeze({
    temporaryDirectory,
    markdownModulePath,
    markdownArtifactSha256: moduleSha256(markdownModuleBytes),
    revisionModulePath,
    revisionArtifactSha256: moduleSha256(revisionModuleBytes),
    autosaveModulePath,
    autosaveArtifactSha256: moduleSha256(autosaveModuleBytes),
    packageEvidence: Object.freeze({
      packageName: manifest.name,
      packageVersion: manifest.version,
      packageSha256: args.packageSha256,
    }),
  });
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
  measurementArguments: argumentsList,
  samplesPath,
  summaryDirectory,
  measurementFailure,
  summaryFailure,
}) {
  runBoundedNodeScript(
    measurementScript,
    [...argumentsList, '--output', samplesPath],
    measurementFailure,
  );
  runBoundedNodeScript(
    'summarize-samples.mjs',
    ['--input', samplesPath, '--output', summaryDirectory],
    summaryFailure,
  );
}

function runSuite(args, markdownArguments, revisionArguments, autosaveArguments) {
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
    measurementArguments: markdownArguments,
    samplesPath: markdownSamplesPath,
    summaryDirectory: markdownSummaryDirectory,
    measurementFailure: 'Benchmark suite Markdown measurement failed.',
    summaryFailure: 'Benchmark suite Markdown summary failed.',
  });
  runMeasurementAndSummary({
    measurementScript: 'measure-revision-evidence.mjs',
    measurementArguments: revisionArguments,
    samplesPath: revisionSamplesPath,
    summaryDirectory: revisionSummaryDirectory,
    measurementFailure: 'Benchmark suite revision measurement failed.',
    summaryFailure: 'Benchmark suite revision summary failed.',
  });

  if (autosaveArguments !== null) {
    const autosaveSamplesPath = resolve(
      args.outputDirectory,
      'autosave',
      'samples.json',
    );
    const autosaveSummaryDirectory = resolve(
      args.outputDirectory,
      'autosave',
      'summary',
    );
    runMeasurementAndSummary({
      measurementScript: 'measure-autosave.mjs',
      measurementArguments: autosaveArguments,
      samplesPath: autosaveSamplesPath,
      summaryDirectory: autosaveSummaryDirectory,
      measurementFailure: 'Benchmark suite autosave measurement failed.',
      summaryFailure: 'Benchmark suite autosave summary failed.',
    });
  }
}

function suiteManifest(args, packageEvidence, includeAutosave) {
  return Object.freeze({
    contractVersion: 1,
    documentProfile: args.documentProfile,
    sampleCount: Number(args.sampleCount),
    sourceCommitSha: args.sourceCommitSha,
    runtimeId: args.runtimeId,
    referenceHardwareId: args.referenceHardwareId,
    ...(packageEvidence ?? {}),
    markdownSamples: 'markdown/samples.json',
    markdownSummaryJson: 'markdown/summary/summary.json',
    markdownSummaryText: 'markdown/summary/summary.txt',
    revisionSamples: 'revision/samples.json',
    revisionSummaryJson: 'revision/summary/summary.json',
    revisionSummaryText: 'revision/summary/summary.txt',
    ...(includeAutosave
      ? {
          autosaveSamples: 'autosave/samples.json',
          autosaveSummaryJson: 'autosave/summary/summary.json',
          autosaveSummaryText: 'autosave/summary/summary.txt',
        }
      : {}),
    status: 'completed',
  });
}

function main(argv) {
  const resolved = resolveArguments(argv);
  const shared = resolved.shared;
  let preparedPackage;
  if (resolved.mode === 'packed') {
    preparedPackage = preparePackedBenchmarkModules(resolved);
  }

  const markdownArguments =
    resolved.mode === 'packed'
      ? measurementArguments({
          inputPath: shared.markdownInputPath,
          modulePath: preparedPackage.markdownModulePath,
          artifactSha256: preparedPackage.markdownArtifactSha256,
          shared,
        })
      : resolved.markdownArguments;
  const revisionArguments =
    resolved.mode === 'packed'
      ? measurementArguments({
          inputPath: shared.revisionInputPath,
          modulePath: preparedPackage.revisionModulePath,
          artifactSha256: preparedPackage.revisionArtifactSha256,
          shared,
        })
      : resolved.revisionArguments;
  const autosaveArguments =
    resolved.mode === 'packed'
      ? autosaveMeasurementArguments({
          modulePath: preparedPackage.autosaveModulePath,
          artifactSha256: preparedPackage.autosaveArtifactSha256,
          shared,
        })
      : null;
  const packageEvidence =
    resolved.mode === 'packed' ? preparedPackage.packageEvidence : null;

  let createdOutputDirectory = false;
  try {
    createdOutputDirectory = prepareOutputDirectory(shared.outputDirectory);
    runSuite(shared, markdownArguments, revisionArguments, autosaveArguments);
    if (resolved.mode === 'packed') {
      verifyPackageDigest(resolved.packageTarballPath, resolved.packageSha256);
    }
  } catch (error) {
    if (createdOutputDirectory) {
      removePartialOutputDirectory(shared.outputDirectory);
    }
    throw error;
  } finally {
    if (preparedPackage !== undefined) {
      rmSync(preparedPackage.temporaryDirectory, {
        recursive: true,
        force: true,
      });
    }
  }

  process.stdout.write(
    `${JSON.stringify(
      suiteManifest(shared, packageEvidence, resolved.mode === 'packed'),
    )}\n`,
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
