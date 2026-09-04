import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  mkdtempSync,
  openSync,
  readSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertCleanSourceCheckout } from './source-checkout-provenance.mjs';

const benchmarkDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(benchmarkDirectory, '..');
const coreRunnerPath = resolve(benchmarkDirectory, 'run-current-suite-core.mjs');
const markdownMeasurementPath = resolve(
  benchmarkDirectory,
  'measure-markdown.mjs',
);
const sampleSummaryPath = resolve(benchmarkDirectory, 'summarize-samples.mjs');
const MAX_PACKAGE_BYTES = 64 * 1024 * 1024;
const MAX_MODULE_BYTES = 16 * 1024 * 1024;
const MAX_CHILD_OUTPUT_BYTES = 4 * 1024 * 1024;
const READ_CHUNK_BYTES = 64 * 1024;
const READ_ONLY_NOFOLLOW = constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0);
const PACKED_MARKDOWN_MODULE_ENTRY = 'package/dist/cwl-markdown.js';
const CORPUS_LOCK_PATH = resolve(benchmarkDirectory, 'corpus.lock.json');
const MAX_CORPUS_INPUT_BYTES = 16 * 1024 * 1024;
const MAX_CORPUS_LOCK_BYTES = 1024 * 1024;
const CORPUS_MISMATCH_ERROR =
  'Benchmark suite inputs must match the committed corpus profile.';
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
const htmlLegacyFlags = Object.freeze([
  '--input',
  '--html-input',
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
const packedHtmlFlags = Object.freeze([
  '--input',
  '--html-input',
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

function argumentsForFlags(values, flags) {
  return flags.flatMap((flag) => [flag, values[flag]]);
}

function matchingFlags(argv) {
  if (matchesArguments(argv, htmlLegacyFlags)) return htmlLegacyFlags;
  if (matchesArguments(argv, packedHtmlFlags)) return packedHtmlFlags;
  if (matchesArguments(argv, packedFlags)) return packedFlags;
  if (matchesArguments(argv, legacyFlags)) return legacyFlags;
  return null;
}

function inspectOutputPath(path) {
  try {
    return lstatSync(path, { throwIfNoEntry: false });
  } catch {
    throw new Error('Benchmark suite output directory could not be inspected.');
  }
}

function assertFreshOutputDirectory(argv) {
  const flags = matchingFlags(argv);
  if (flags === null) return;
  const outputValueIndex = flags.indexOf('--output') * 2 + 1;
  const outputDirectory = resolve(repositoryRoot, argv[outputValueIndex]);

  let current = outputDirectory;
  while (true) {
    const metadata = inspectOutputPath(current);
    if (metadata?.isSymbolicLink()) {
      throw new Error(
        'Benchmark suite output directory must be a non-symlink directory.',
      );
    }
    if (current === outputDirectory && metadata !== undefined) {
      if (!metadata.isDirectory()) {
        throw new Error(
          'Benchmark suite output directory must be a non-symlink directory.',
        );
      }
      throw new Error('Benchmark suite output directory must not already exist.');
    }
    const parent = dirname(current);
    if (parent === current) return;
    current = parent;
  }
}

function claimedLegacySourceCommitSha(argv) {
  if (matchesArguments(argv, htmlLegacyFlags)) {
    return valuesForArguments(argv, htmlLegacyFlags)['--source-commit-sha'];
  }
  if (matchesArguments(argv, legacyFlags)) {
    return valuesForArguments(argv, legacyFlags)['--source-commit-sha'];
  }
  return undefined;
}

function readRegularFileSnapshot(path, maximumBytes, invalidMessage, oversizedMessage) {
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
    if (!metadata.isFile()) {
      throw new Error(invalidMessage);
    }
    if (metadata.size > maximumBytes) {
      throw new Error(oversizedMessage);
    }

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
      if (totalBytes > maximumBytes) {
        throw new Error(oversizedMessage);
      }
      chunks.push(chunk.subarray(0, bytesRead));
    }
    return Buffer.concat(chunks, totalBytes);
  } finally {
    closeSync(descriptor);
  }
}

function readPackedTarballSnapshot(path) {
  return readRegularFileSnapshot(
    path,
    MAX_PACKAGE_BYTES,
    'Benchmark suite package tarball must be a regular non-symlink file.',
    'Benchmark suite package tarball exceeds the supported size.',
  );
}

function assertPackedCorpusInputs(argv) {
  const flags = matchesArguments(argv, packedHtmlFlags)
    ? packedHtmlFlags
    : matchesArguments(argv, packedFlags)
      ? packedFlags
      : null;
  if (flags === null) return;

  const values = valuesForArguments(argv, flags);
  let lock;
  try {
    lock = JSON.parse(
      readRegularFileSnapshot(
        CORPUS_LOCK_PATH,
        MAX_CORPUS_LOCK_BYTES,
        CORPUS_MISMATCH_ERROR,
        CORPUS_MISMATCH_ERROR,
      ).toString('utf8'),
    );
  } catch {
    throw new Error(CORPUS_MISMATCH_ERROR);
  }
  const profile = lock?.profiles?.[values['--profile']];
  const inputs = [
    ['--input', 'bytes', 'sha256'],
    ['--revision-input', 'envelopeBytes', 'envelopeSha256'],
    ...(flags === packedHtmlFlags
      ? [['--html-input', 'htmlBytes', 'htmlSha256']]
      : []),
  ];
  try {
    for (const [flag, byteKey, digestKey] of inputs) {
      const bytes = readRegularFileSnapshot(
        values[flag],
        MAX_CORPUS_INPUT_BYTES,
        CORPUS_MISMATCH_ERROR,
        CORPUS_MISMATCH_ERROR,
      );
      if (
        bytes.byteLength !== profile?.[byteKey] ||
        createHash('sha256').update(bytes).digest('hex') !== profile?.[digestKey]
      ) {
        throw new Error(CORPUS_MISMATCH_ERROR);
      }
    }
  } catch {
    throw new Error(CORPUS_MISMATCH_ERROR);
  }
}

function snapshotPackedArguments(argv) {
  const flags = matchesArguments(argv, packedHtmlFlags)
    ? packedHtmlFlags
    : matchesArguments(argv, packedFlags)
      ? packedFlags
      : null;
  if (flags === null) {
    return Object.freeze({ argv, temporaryDirectory: null });
  }

  const packageTarballValueIndex =
    flags.indexOf('--package-tarball') * 2 + 1;
  const packageTarballPath = resolve(argv[packageTarballValueIndex]);
  const packageBytes = readPackedTarballSnapshot(packageTarballPath);
  const temporaryDirectory = mkdtempSync(
    join(tmpdir(), 'inkspan-packed-suite-snapshot-'),
  );
  const snapshotPath = join(temporaryDirectory, 'package.tgz');
  try {
    writeFileSync(snapshotPath, packageBytes, { mode: 0o600 });
  } catch {
    rmSync(temporaryDirectory, { recursive: true, force: true });
    throw new Error('Benchmark suite package tarball snapshot could not be prepared.');
  }

  const snapshottedArguments = [...argv];
  snapshottedArguments[packageTarballValueIndex] = snapshotPath;
  return Object.freeze({
    argv: snapshottedArguments,
    temporaryDirectory,
  });
}

function runBoundedNode(scriptPath, args, failureMessage) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    maxBuffer: MAX_CHILD_OUTPUT_BYTES,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 600_000,
  });
  if (
    result.error !== undefined ||
    result.signal !== null ||
    result.status !== 0
  ) {
    throw new Error(failureMessage);
  }
  return result.stdout;
}

function runCoreNodePreservingError(args) {
  const result = spawnSync(process.execPath, [coreRunnerPath, ...args], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    maxBuffer: MAX_CHILD_OUTPUT_BYTES,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 600_000,
  });
  if (result.error !== undefined || result.signal !== null) {
    throw new Error('Benchmark suite internal runner could not complete.');
  }
  if (result.status !== 0) {
    const message = result.stderr.trimEnd();
    throw new Error(
      message.length > 0 ? message : 'Benchmark suite internal runner failed.',
    );
  }
  return result.stdout;
}

function parseCoreManifest(stdout) {
  let manifest;
  try {
    manifest = JSON.parse(stdout.trim());
  } catch {
    throw new Error('Benchmark suite internal runner returned invalid evidence.');
  }
  if (
    manifest === null ||
    typeof manifest !== 'object' ||
    Array.isArray(manifest) ||
    manifest.status !== 'completed'
  ) {
    throw new Error('Benchmark suite internal runner returned invalid evidence.');
  }
  return manifest;
}

function readPackedMarkdownModule(tarballPath) {
  const result = spawnSync(
    'tar',
    ['-xOzf', tarballPath, PACKED_MARKDOWN_MODULE_ENTRY],
    {
      cwd: repositoryRoot,
      maxBuffer: MAX_MODULE_BYTES + 1,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30_000,
    },
  );
  if (
    result.error !== undefined ||
    result.signal !== null ||
    result.status !== 0 ||
    !Buffer.isBuffer(result.stdout) ||
    result.stdout.byteLength > MAX_MODULE_BYTES
  ) {
    throw new Error('Benchmark suite packed Markdown module could not be read.');
  }
  return result.stdout;
}

function assertPackedSnapshotDigest(tarballPath, expectedSha256) {
  const actualSha256 = createHash('sha256')
    .update(readPackedTarballSnapshot(tarballPath))
    .digest('hex');
  if (actualSha256 !== expectedSha256) {
    throw new Error('Benchmark suite package digest does not match the packed artifact.');
  }
}

function htmlSerializationEvidenceArguments(values, modulePath, artifactSha256) {
  return [
    '--input',
    values['--html-input'],
    '--module',
    modulePath,
    '--operation',
    'html-to-markdown',
    '--profile',
    values['--profile'],
    '--samples',
    values['--samples'],
    '--source-commit-sha',
    values['--source-commit-sha'],
    '--artifact-sha256',
    artifactSha256,
    '--runtime-id',
    values['--runtime-id'],
    '--reference-hardware-id',
    values['--reference-hardware-id'],
  ];
}

function runHtmlSerializationSuite(argv) {
  const values = valuesForArguments(argv, htmlLegacyFlags);
  const outputDirectory = resolve(repositoryRoot, values['--output']);
  const legacyArguments = argumentsForFlags(values, legacyFlags);
  let coreCompleted = false;

  try {
    const coreStdout = runBoundedNode(
      coreRunnerPath,
      legacyArguments,
      'Benchmark suite internal runner failed.',
    );
    coreCompleted = true;
    const manifest = parseCoreManifest(coreStdout);
    const samplesPath = resolve(
      outputDirectory,
      'html-serialization',
      'samples.json',
    );
    const summaryDirectory = resolve(
      outputDirectory,
      'html-serialization',
      'summary',
    );

    runBoundedNode(
      markdownMeasurementPath,
      [
        ...htmlSerializationEvidenceArguments(
          values,
          values['--module'],
          values['--artifact-sha256'],
        ),
        '--output',
        samplesPath,
      ],
      'Benchmark suite HTML serialization measurement failed.',
    );
    runBoundedNode(
      sampleSummaryPath,
      ['--input', samplesPath, '--output', summaryDirectory],
      'Benchmark suite HTML serialization summary failed.',
    );

    process.stdout.write(
      `${JSON.stringify({
        ...manifest,
        htmlSerializationSamples: 'html-serialization/samples.json',
        htmlSerializationSummaryJson:
          'html-serialization/summary/summary.json',
        htmlSerializationSummaryText:
          'html-serialization/summary/summary.txt',
      })}\n`,
    );
  } catch (error) {
    if (coreCompleted) {
      rmSync(outputDirectory, { recursive: true, force: true });
    }
    throw error;
  }
}

function runPackedHtmlSerializationSuite(argv) {
  const values = valuesForArguments(argv, packedHtmlFlags);
  const outputDirectory = resolve(repositoryRoot, values['--output']);
  const coreArguments = argumentsForFlags(values, packedFlags);
  const snapshotted = snapshotPackedArguments(coreArguments);
  let coreCompleted = false;

  try {
    const coreStdout = runCoreNodePreservingError(snapshotted.argv);
    coreCompleted = true;
    const manifest = parseCoreManifest(coreStdout);
    const snapshotValues = valuesForArguments(snapshotted.argv, packedFlags);
    const snapshotTarballPath = snapshotValues['--package-tarball'];
    const markdownModuleBytes = readPackedMarkdownModule(snapshotTarballPath);
    const markdownModulePath = join(
      snapshotted.temporaryDirectory,
      'cwl-markdown.mjs',
    );
    try {
      writeFileSync(markdownModulePath, markdownModuleBytes, { mode: 0o600 });
    } catch {
      throw new Error('Benchmark suite packed Markdown module could not be prepared.');
    }
    const markdownArtifactSha256 = createHash('sha256')
      .update(markdownModuleBytes)
      .digest('hex');
    const samplesPath = resolve(
      outputDirectory,
      'html-serialization',
      'samples.json',
    );
    const summaryDirectory = resolve(
      outputDirectory,
      'html-serialization',
      'summary',
    );

    runBoundedNode(
      markdownMeasurementPath,
      [
        ...htmlSerializationEvidenceArguments(
          values,
          markdownModulePath,
          markdownArtifactSha256,
        ),
        '--output',
        samplesPath,
      ],
      'Benchmark suite HTML serialization measurement failed.',
    );
    runBoundedNode(
      sampleSummaryPath,
      ['--input', samplesPath, '--output', summaryDirectory],
      'Benchmark suite HTML serialization summary failed.',
    );
    assertPackedSnapshotDigest(
      snapshotTarballPath,
      values['--package-sha256'],
    );

    process.stdout.write(
      `${JSON.stringify({
        ...manifest,
        htmlSerializationSamples: 'html-serialization/samples.json',
        htmlSerializationSummaryJson:
          'html-serialization/summary/summary.json',
        htmlSerializationSummaryText:
          'html-serialization/summary/summary.txt',
      })}\n`,
    );
  } catch (error) {
    if (coreCompleted) {
      rmSync(outputDirectory, { recursive: true, force: true });
    }
    throw error;
  } finally {
    if (snapshotted.temporaryDirectory !== null) {
      rmSync(snapshotted.temporaryDirectory, {
        recursive: true,
        force: true,
      });
    }
  }
}

function runExistingSuite(argv) {
  const snapshotted = snapshotPackedArguments(argv);

  try {
    const result = spawnSync(
      process.execPath,
      [coreRunnerPath, ...snapshotted.argv],
      {
        cwd: repositoryRoot,
        stdio: 'inherit',
        timeout: 600_000,
      },
    );

    if (result.error !== undefined || result.signal !== null) {
      throw new Error('Benchmark suite internal runner could not complete.');
    }

    process.exitCode = result.status ?? 1;
  } finally {
    if (snapshotted.temporaryDirectory !== null) {
      rmSync(snapshotted.temporaryDirectory, {
        recursive: true,
        force: true,
      });
    }
  }
}

function main(argv) {
  assertCleanSourceCheckout(repositoryRoot);
  assertFreshOutputDirectory(argv);
  assertPackedCorpusInputs(argv);
  const expectedLegacySourceCommitSha = claimedLegacySourceCommitSha(argv);
  if (expectedLegacySourceCommitSha !== undefined) {
    assertCleanSourceCheckout(repositoryRoot, expectedLegacySourceCommitSha);
  }
  if (matchesArguments(argv, htmlLegacyFlags)) {
    runHtmlSerializationSuite(argv);
    return;
  }
  if (matchesArguments(argv, packedHtmlFlags)) {
    runPackedHtmlSerializationSuite(argv);
    return;
  }
  runExistingSuite(argv);
}

try {
  main(process.argv.slice(2));
} catch (error) {
  const message =
    error instanceof Error ? error.message : 'Benchmark suite failed.';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
