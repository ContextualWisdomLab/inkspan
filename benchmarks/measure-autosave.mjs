import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readSync,
  realpathSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const benchmarkDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(benchmarkDirectory, '..');
const MAX_MODULE_BYTES = 16 * 1024 * 1024;
const MAX_INPUT_BYTES = 16 * 1024 * 1024;
const READ_CHUNK_BYTES = 64 * 1024;
const MAX_SAMPLES = 1_000;
const READ_ONLY_NOFOLLOW = constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0);
const DOCUMENT_PROFILES = new Set(['small', 'medium', 'large', 'stress']);
const SHA1_PATTERN = /^[0-9a-f]{40}$/u;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const RUNTIME_ID_PATTERN =
  /^(?:node|python|chromium|firefox|webkit|playwright)-[0-9]+(?:\.[0-9]+){1,3}$/u;
const REFERENCE_HARDWARE_ID_PATTERN =
  /^(?:github-actions-(?:ubuntu|windows|macos)-[0-9]+(?:\.[0-9]+){0,2}-(?:x64|arm64)|refhw-sha256-[0-9a-f]{64})$/u;
const OUTPUT_DIRECTORY_ERROR =
  'Autosave benchmark output directory must be a non-symlink directory.';
const OUTPUT_EXISTS_ERROR = 'Autosave benchmark output must not already exist.';
const SYNTHETIC_DOCUMENT_LABEL = 'Synthetic autosave benchmark document';

function resolveArguments(argv) {
  const legacyFlags = [
    '--module',
    '--profile',
    '--samples',
    '--source-commit-sha',
    '--artifact-sha256',
    '--runtime-id',
    '--reference-hardware-id',
    '--output',
  ];
  const inputFlags = ['--input', ...legacyFlags];
  const expectedFlags =
    argv.length === inputFlags.length * 2 ? inputFlags : legacyFlags;
  if (
    argv.length !== expectedFlags.length * 2 ||
    expectedFlags.some((flag, index) => argv[index * 2] !== flag) ||
    expectedFlags.some((_, index) => argv[index * 2 + 1]?.length === 0)
  ) {
    throw new Error(
      'Usage: node benchmarks/measure-autosave.mjs [--input <document-envelope.json>] --module <packed-autosave-module> --profile <small|medium|large|stress> --samples <count> --source-commit-sha <sha> --artifact-sha256 <sha256> --runtime-id <runtime> --reference-hardware-id <hardware> --output <samples.json>',
    );
  }

  const values = Object.fromEntries(
    expectedFlags.map((flag, index) => [flag, argv[index * 2 + 1]]),
  );
  const profile = values['--profile'];
  if (!DOCUMENT_PROFILES.has(profile)) {
    throw new Error('Autosave benchmark profile is invalid.');
  }
  const sampleCount = Number(values['--samples']);
  if (
    !Number.isSafeInteger(sampleCount) ||
    sampleCount < 1 ||
    sampleCount > MAX_SAMPLES
  ) {
    throw new Error(
      'Autosave benchmark sample count must be an integer from 1 to 1000.',
    );
  }
  const sourceCommitSha = values['--source-commit-sha'];
  if (!SHA1_PATTERN.test(sourceCommitSha)) {
    throw new Error(
      'Autosave benchmark source commit must be a lowercase 40-character SHA.',
    );
  }
  const artifactSha256 = values['--artifact-sha256'];
  if (!SHA256_PATTERN.test(artifactSha256)) {
    throw new Error(
      'Autosave benchmark artifact digest must be a lowercase 64-character SHA-256.',
    );
  }
  const runtimeId = values['--runtime-id'];
  if (!RUNTIME_ID_PATTERN.test(runtimeId)) {
    throw new Error('Autosave benchmark runtime ID is invalid.');
  }
  const referenceHardwareId = values['--reference-hardware-id'];
  if (!REFERENCE_HARDWARE_ID_PATTERN.test(referenceHardwareId)) {
    throw new Error('Autosave benchmark reference hardware ID is invalid.');
  }

  return Object.freeze({
    inputPath:
      values['--input'] === undefined ? null : resolve(values['--input']),
    modulePath: values['--module'],
    profile,
    sampleCount,
    sourceCommitSha,
    artifactSha256,
    runtimeId,
    referenceHardwareId,
    outputPath: resolve(values['--output']),
  });
}

function assertMeasurementProvenance(sourceCommitSha, runtimeId) {
  const result = spawnSync('git', ['rev-parse', '--verify', 'HEAD'], {
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
    !SHA1_PATTERN.test(checkoutSha ?? '')
  ) {
    throw new Error(
      'Benchmark measurement source commit could not be verified against the current checkout.',
    );
  }
  if (sourceCommitSha !== checkoutSha) {
    throw new Error(
      'Benchmark measurement source commit does not match checked-out HEAD.',
    );
  }
  if (runtimeId !== `node-${process.versions.node}`) {
    throw new Error(
      'Benchmark measurement runtime ID must match the active Node runtime.',
    );
  }
}

function readBoundedRegularFile(path, maximumBytes, invalidFileMessage, oversizedMessage) {
  let pathMetadata;
  try {
    pathMetadata = lstatSync(path, { throwIfNoEntry: false });
  } catch {
    throw new Error(invalidFileMessage);
  }
  if (
    pathMetadata === undefined ||
    pathMetadata.isSymbolicLink() ||
    !pathMetadata.isFile()
  ) {
    throw new Error(invalidFileMessage);
  }

  let descriptor;
  try {
    descriptor = openSync(path, READ_ONLY_NOFOLLOW);
  } catch {
    throw new Error(invalidFileMessage);
  }
  try {
    const metadata = fstatSync(descriptor);
    if (!metadata.isFile()) throw new Error(invalidFileMessage);
    if (metadata.size > maximumBytes) throw new Error(oversizedMessage);
    const chunks = [];
    let totalBytes = 0;
    while (totalBytes <= maximumBytes) {
      const remainingBudget = maximumBytes + 1 - totalBytes;
      const chunk = Buffer.allocUnsafe(Math.min(READ_CHUNK_BYTES, remainingBudget));
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

function resolveLocalModule(pathOrUrl) {
  if (
    pathOrUrl.startsWith('http:') ||
    pathOrUrl.startsWith('https:') ||
    pathOrUrl.startsWith('data:') ||
    pathOrUrl.startsWith('node:')
  ) {
    throw new Error('Measured autosave module must be a local regular file.');
  }
  let moduleUrl;
  try {
    moduleUrl = pathOrUrl.startsWith('file:')
      ? new URL(pathOrUrl)
      : pathToFileURL(resolve(pathOrUrl));
  } catch {
    throw new Error('Measured autosave module must be a local regular file.');
  }
  if (moduleUrl.protocol !== 'file:') {
    throw new Error('Measured autosave module must be a local regular file.');
  }
  let resolvedPath;
  try {
    resolvedPath = resolve(fileURLToPath(moduleUrl));
  } catch {
    throw new Error('Measured autosave module must be a local regular file.');
  }
  let metadata;
  try {
    metadata = lstatSync(resolvedPath, { throwIfNoEntry: false });
  } catch {
    throw new Error('Measured autosave module must be a local regular file.');
  }
  if (
    metadata === undefined ||
    metadata.isSymbolicLink() ||
    !metadata.isFile()
  ) {
    throw new Error('Measured autosave module must be a local regular file.');
  }
  try {
    return realpathSync(resolvedPath);
  } catch {
    throw new Error('Measured autosave module must be a local regular file.');
  }
}

function measuredModuleSha256(modulePath) {
  const bytes = readBoundedRegularFile(
    modulePath,
    MAX_MODULE_BYTES,
    'Measured autosave module must be a local regular file.',
    'Measured autosave module exceeds the supported size.',
  );
  return createHash('sha256').update(bytes).digest('hex');
}

function verifyMeasuredModuleDigest(modulePath, expectedSha256) {
  if (measuredModuleSha256(modulePath) !== expectedSha256) {
    throw new Error(
      'Autosave benchmark artifact digest does not match the measured module.',
    );
  }
}

function inspectOutputPath(path) {
  try {
    return lstatSync(path, { throwIfNoEntry: false });
  } catch {
    throw new Error('Autosave benchmark output path could not be inspected.');
  }
}

function inspectOutputDirectoryComponent(path) {
  try {
    return lstatSync(path, { throwIfNoEntry: false });
  } catch {
    throw new Error('Autosave benchmark output directory could not be inspected.');
  }
}

function assertNoSymlinkOutputAncestors(path) {
  let current = dirname(path);
  while (true) {
    const metadata = inspectOutputDirectoryComponent(current);
    if (metadata?.isSymbolicLink()) throw new Error(OUTPUT_DIRECTORY_ERROR);
    const parent = dirname(current);
    if (parent === current) return;
    current = parent;
  }
}

function refersToSameFile(leftPath, rightPath) {
  const rightMetadata = inspectOutputPath(rightPath);
  if (rightMetadata === undefined) return false;
  if (!rightMetadata.isFile()) {
    throw new Error('Autosave benchmark output must be a regular file.');
  }
  const left = statSync(leftPath);
  const right = statSync(rightPath);
  return left.dev === right.dev && left.ino === right.ino;
}

async function loadMeasuredModule(modulePath) {
  try {
    return await import(pathToFileURL(modulePath).href);
  } catch {
    throw new Error('Measured autosave module could not be loaded.');
  }
}

function createSyntheticRevisionEvidence(inputPath) {
  if (inputPath !== null) {
    const source = readBoundedRegularFile(
      inputPath,
      MAX_INPUT_BYTES,
      'Autosave benchmark input must be a regular non-symlink file.',
      'Autosave benchmark input exceeds the supported size.',
    );
    let envelope;
    try {
      envelope = JSON.parse(source.toString('utf8'));
    } catch {
      throw new Error('Autosave benchmark input must be a valid document envelope.');
    }
    if (
      envelope?.schemaId !==
        'https://inkspan.io/schemas/document-envelope/v1' ||
      envelope.schemaVersion !== 1 ||
      typeof envelope.documentJson !== 'object' ||
      envelope.documentJson === null
    ) {
      throw new Error('Autosave benchmark input must be a valid document envelope.');
    }
    const digestHex = createHash('sha256').update(source).digest('hex');
    return Object.freeze({
      envelope,
      revision: Object.freeze({
        algorithm: 'SHA-256',
        digestHex,
        strongEntityTag: `"sha256-${digestHex}"`,
      }),
    });
  }
  const textNode = Object.freeze({ type: 'text', text: SYNTHETIC_DOCUMENT_LABEL });
  const paragraph = Object.freeze({
    type: 'paragraph',
    content: Object.freeze([textNode]),
  });
  const documentJson = Object.freeze({
    type: 'doc',
    content: Object.freeze([paragraph]),
  });
  const digestHex = createHash('sha256')
    .update(JSON.stringify(documentJson))
    .digest('hex');
  return Object.freeze({
    envelope: Object.freeze({
      schemaId: 'https://inkspan.io/schemas/document-envelope/v1',
      schemaVersion: 1,
      documentJson,
    }),
    revision: Object.freeze({
      algorithm: 'SHA-256',
      digestHex,
      strongEntityTag: `"sha256-${digestHex}"`,
    }),
  });
}

async function measureOneEnqueue(createDocumentAutosaveQueue, evidence) {
  let saveCalls = 0;
  const queue = createDocumentAutosaveQueue({
    save: () => {
      saveCalls += 1;
      return Object.freeze({ status: 'saved' });
    },
  });
  if (
    typeof queue !== 'object' ||
    queue === null ||
    typeof queue.enqueue !== 'function'
  ) {
    throw new Error('Measured autosave module returned an invalid queue.');
  }

  const start = performance.now();
  const outcome = await queue.enqueue(evidence);
  const elapsed = performance.now() - start;
  if (
    typeof outcome !== 'object' ||
    outcome === null ||
    outcome.status !== 'saved' ||
    saveCalls !== 1
  ) {
    throw new Error('Measured autosave enqueue result is invalid.');
  }
  if (!Number.isFinite(elapsed) || elapsed < 0) {
    throw new Error('Autosave measurement produced invalid runtime evidence.');
  }
  if (typeof queue.close === 'function') await queue.close();
  return elapsed;
}

function writeMeasurementOutput(path, content) {
  assertNoSymlinkOutputAncestors(path);
  try {
    mkdirSync(dirname(path), { recursive: true });
  } catch {
    throw new Error('Autosave benchmark output could not be written.');
  }
  assertNoSymlinkOutputAncestors(path);
  try {
    writeFileSync(path, content, { encoding: 'utf8', flag: 'wx' });
  } catch {
    throw new Error('Autosave benchmark output could not be written.');
  }
}

async function main() {
  const args = resolveArguments(process.argv.slice(2));
  assertNoSymlinkOutputAncestors(args.outputPath);
  const modulePath = resolveLocalModule(args.modulePath);
  if (
    modulePath === args.outputPath ||
    refersToSameFile(modulePath, args.outputPath)
  ) {
    throw new Error(
      'Autosave benchmark output must not overwrite the measured module.',
    );
  }
  verifyMeasuredModuleDigest(modulePath, args.artifactSha256);
  assertMeasurementProvenance(args.sourceCommitSha, args.runtimeId);

  const measuredModule = await loadMeasuredModule(modulePath);
  if (typeof measuredModule.createDocumentAutosaveQueue !== 'function') {
    throw new Error(
      'Measured autosave module must export createDocumentAutosaveQueue().',
    );
  }
  const evidence = createSyntheticRevisionEvidence(args.inputPath);

  await measureOneEnqueue(measuredModule.createDocumentAutosaveQueue, evidence);
  const samples = [];
  for (let index = 0; index < args.sampleCount; index += 1) {
    samples.push(
      await measureOneEnqueue(measuredModule.createDocumentAutosaveQueue, evidence),
    );
  }

  verifyMeasuredModuleDigest(modulePath, args.artifactSha256);
  assertMeasurementProvenance(args.sourceCommitSha, args.runtimeId);
  assertNoSymlinkOutputAncestors(args.outputPath);
  const outputMetadata = inspectOutputPath(args.outputPath);
  if (outputMetadata !== undefined && !outputMetadata.isFile()) {
    throw new Error('Autosave benchmark output must be a regular file.');
  }
  if (outputMetadata !== undefined && outputMetadata.nlink !== 1) {
    throw new Error('Autosave benchmark output must not be multiply linked.');
  }
  if (outputMetadata !== undefined) throw new Error(OUTPUT_EXISTS_ERROR);

  writeMeasurementOutput(
    args.outputPath,
    `${JSON.stringify(
      {
        contractVersion: 1,
        benchmarkId: `autosave-enqueue-${args.profile}`,
        unit: 'ms',
        sourceCommitSha: args.sourceCommitSha,
        artifactSha256: args.artifactSha256,
        documentProfile: args.profile,
        runtimeId: args.runtimeId,
        referenceHardwareId: args.referenceHardwareId,
        samples,
      },
      null,
      2,
    )}\n`,
  );
}

try {
  await main();
} catch (error) {
  const message =
    error instanceof Error
      ? error.message
      : 'Autosave benchmark measurement failed.';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
