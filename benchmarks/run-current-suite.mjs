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
const MAX_PACKAGE_BYTES = 64 * 1024 * 1024;
const READ_CHUNK_BYTES = 64 * 1024;
const READ_ONLY_NOFOLLOW = constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0);
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
const packageTarballValueIndex =
  packedFlags.indexOf('--package-tarball') * 2 + 1;

function matchesArguments(argv, expectedFlags) {
  return (
    argv.length === expectedFlags.length * 2 &&
    expectedFlags.every((flag, index) => argv[index * 2] === flag) &&
    expectedFlags.every((_, index) => argv[index * 2 + 1]?.length > 0)
  );
}

function matchingFlags(argv) {
  if (matchesArguments(argv, packedFlags)) return packedFlags;
  if (matchesArguments(argv, legacyFlags)) return legacyFlags;
  return null;
}

function assertFreshOutputDirectory(argv) {
  const flags = matchingFlags(argv);
  if (flags === null) return;
  const outputValueIndex = flags.indexOf('--output') * 2 + 1;
  const outputDirectory = resolve(repositoryRoot, argv[outputValueIndex]);
  let metadata;
  try {
    metadata = lstatSync(outputDirectory, { throwIfNoEntry: false });
  } catch {
    return;
  }
  if (metadata?.isDirectory()) {
    throw new Error('Benchmark suite output directory must not already exist.');
  }
}

function readPackedTarballSnapshot(path) {
  let pathMetadata;
  try {
    pathMetadata = lstatSync(path, { throwIfNoEntry: false });
  } catch {
    throw new Error(
      'Benchmark suite package tarball must be a regular non-symlink file.',
    );
  }
  if (
    pathMetadata === undefined ||
    pathMetadata.isSymbolicLink() ||
    !pathMetadata.isFile()
  ) {
    throw new Error(
      'Benchmark suite package tarball must be a regular non-symlink file.',
    );
  }

  let descriptor;
  try {
    descriptor = openSync(path, READ_ONLY_NOFOLLOW);
  } catch {
    throw new Error(
      'Benchmark suite package tarball must be a regular non-symlink file.',
    );
  }
  try {
    const metadata = fstatSync(descriptor);
    if (!metadata.isFile()) {
      throw new Error(
        'Benchmark suite package tarball must be a regular non-symlink file.',
      );
    }
    if (metadata.size > MAX_PACKAGE_BYTES) {
      throw new Error('Benchmark suite package tarball exceeds the supported size.');
    }

    const chunks = [];
    let totalBytes = 0;
    while (totalBytes <= MAX_PACKAGE_BYTES) {
      const remainingBudget = MAX_PACKAGE_BYTES + 1 - totalBytes;
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
      if (totalBytes > MAX_PACKAGE_BYTES) {
        throw new Error('Benchmark suite package tarball exceeds the supported size.');
      }
      chunks.push(chunk.subarray(0, bytesRead));
    }
    return Buffer.concat(chunks, totalBytes);
  } finally {
    closeSync(descriptor);
  }
}

function snapshotPackedArguments(argv) {
  if (!matchesArguments(argv, packedFlags)) {
    return Object.freeze({ argv, temporaryDirectory: null });
  }

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

function main(argv) {
  assertCleanSourceCheckout(repositoryRoot);
  assertFreshOutputDirectory(argv);
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

try {
  main(process.argv.slice(2));
} catch (error) {
  const message =
    error instanceof Error ? error.message : 'Benchmark suite failed.';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
