import { createHash } from 'node:crypto';
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

const MAX_INPUT_BYTES = 16 * 1024 * 1024;
const MAX_MODULE_BYTES = 16 * 1024 * 1024;
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
  'Revision benchmark output directory must be a non-symlink directory.';

function resolveArguments(argv) {
  const expectedFlags = [
    '--input',
    '--module',
    '--profile',
    '--samples',
    '--source-commit-sha',
    '--artifact-sha256',
    '--runtime-id',
    '--reference-hardware-id',
    '--output',
  ];
  if (
    argv.length !== expectedFlags.length * 2 ||
    expectedFlags.some((flag, index) => argv[index * 2] !== flag) ||
    expectedFlags.some((_, index) => argv[index * 2 + 1]?.length === 0)
  ) {
    throw new Error(
      'Usage: node benchmarks/measure-revision-evidence.mjs --input <document-envelope.json> --module <packed-revision-evidence-module> --profile <small|medium|large|stress> --samples <count> --source-commit-sha <sha> --artifact-sha256 <sha256> --runtime-id <runtime> --reference-hardware-id <hardware> --output <samples.json>',
    );
  }

  const values = Object.fromEntries(
    expectedFlags.map((flag, index) => [flag, argv[index * 2 + 1]]),
  );
  const profile = values['--profile'];
  if (!DOCUMENT_PROFILES.has(profile)) {
    throw new Error('Revision benchmark profile is invalid.');
  }
  const sampleCount = Number(values['--samples']);
  if (
    !Number.isSafeInteger(sampleCount) ||
    sampleCount < 1 ||
    sampleCount > MAX_SAMPLES
  ) {
    throw new Error('Revision benchmark sample count must be an integer from 1 to 1000.');
  }
  const sourceCommitSha = values['--source-commit-sha'];
  if (!SHA1_PATTERN.test(sourceCommitSha)) {
    throw new Error(
      'Revision benchmark source commit must be a lowercase 40-character SHA.',
    );
  }
  const artifactSha256 = values['--artifact-sha256'];
  if (!SHA256_PATTERN.test(artifactSha256)) {
    throw new Error(
      'Revision benchmark artifact digest must be a lowercase 64-character SHA-256.',
    );
  }
  const runtimeId = values['--runtime-id'];
  if (!RUNTIME_ID_PATTERN.test(runtimeId)) {
    throw new Error('Revision benchmark runtime ID is invalid.');
  }
  const referenceHardwareId = values['--reference-hardware-id'];
  if (!REFERENCE_HARDWARE_ID_PATTERN.test(referenceHardwareId)) {
    throw new Error('Revision benchmark reference hardware ID is invalid.');
  }

  return Object.freeze({
    inputPath: resolve(values['--input']),
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
    if (!metadata.isFile()) {
      throw new Error(invalidFileMessage);
    }
    if (metadata.size > maximumBytes) {
      throw new Error(oversizedMessage);
    }
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

function readBoundedEnvelopeBytes(path) {
  return readBoundedRegularFile(
    path,
    MAX_INPUT_BYTES,
    'Revision benchmark input must be a regular non-symlink file.',
    'Revision benchmark input exceeds the supported size.',
  );
}

function resolveLocalModule(pathOrUrl) {
  if (
    pathOrUrl.startsWith('http:') ||
    pathOrUrl.startsWith('https:') ||
    pathOrUrl.startsWith('data:') ||
    pathOrUrl.startsWith('node:')
  ) {
    throw new Error('Measured revision module must be a local regular file.');
  }
  let moduleUrl;
  try {
    moduleUrl = pathOrUrl.startsWith('file:')
      ? new URL(pathOrUrl)
      : pathToFileURL(resolve(pathOrUrl));
  } catch {
    throw new Error('Measured revision module must be a local regular file.');
  }
  if (moduleUrl.protocol !== 'file:') {
    throw new Error('Measured revision module must be a local regular file.');
  }
  let resolvedPath;
  try {
    resolvedPath = resolve(fileURLToPath(moduleUrl));
  } catch {
    throw new Error('Measured revision module must be a local regular file.');
  }
  let metadata;
  try {
    metadata = lstatSync(resolvedPath, { throwIfNoEntry: false });
  } catch {
    throw new Error('Measured revision module must be a local regular file.');
  }
  if (
    metadata === undefined ||
    metadata.isSymbolicLink() ||
    !metadata.isFile()
  ) {
    throw new Error('Measured revision module must be a local regular file.');
  }
  try {
    return realpathSync(resolvedPath);
  } catch {
    throw new Error('Measured revision module must be a local regular file.');
  }
}

function measuredModuleSha256(modulePath) {
  const bytes = readBoundedRegularFile(
    modulePath,
    MAX_MODULE_BYTES,
    'Measured revision module must be a local regular file.',
    'Measured revision module exceeds the supported size.',
  );
  return createHash('sha256').update(bytes).digest('hex');
}

function verifyMeasuredModuleDigest(modulePath, expectedSha256) {
  if (measuredModuleSha256(modulePath) !== expectedSha256) {
    throw new Error(
      'Revision benchmark artifact digest does not match the measured module.',
    );
  }
}

function inspectOutputPath(path) {
  try {
    return lstatSync(path, { throwIfNoEntry: false });
  } catch {
    throw new Error('Revision benchmark output path could not be inspected.');
  }
}

function inspectOutputDirectoryComponent(path) {
  try {
    return lstatSync(path, { throwIfNoEntry: false });
  } catch {
    throw new Error('Revision benchmark output directory could not be inspected.');
  }
}

function assertNoSymlinkOutputAncestors(path) {
  let current = dirname(path);
  while (true) {
    const metadata = inspectOutputDirectoryComponent(current);
    if (metadata?.isSymbolicLink()) {
      throw new Error(OUTPUT_DIRECTORY_ERROR);
    }
    const parent = dirname(current);
    if (parent === current) return;
    current = parent;
  }
}

function refersToSameFile(leftPath, rightPath) {
  const rightMetadata = inspectOutputPath(rightPath);
  if (rightMetadata === undefined) return false;
  if (!rightMetadata.isFile()) {
    throw new Error('Revision benchmark output must be a regular file.');
  }
  const left = statSync(leftPath);
  const right = statSync(rightPath);
  return left.dev === right.dev && left.ino === right.ino;
}

async function loadMeasuredModule(modulePath) {
  try {
    return await import(pathToFileURL(modulePath).href);
  } catch {
    throw new Error('Measured revision module could not be loaded.');
  }
}

function writeMeasurementOutput(path, content) {
  assertNoSymlinkOutputAncestors(path);
  try {
    mkdirSync(dirname(path), { recursive: true });
  } catch {
    throw new Error('Revision benchmark output could not be written.');
  }
  assertNoSymlinkOutputAncestors(path);
  try {
    writeFileSync(path, content, 'utf8');
  } catch {
    throw new Error('Revision benchmark output could not be written.');
  }
}

async function runMeasuredRevision(createRevisionEvidence, source) {
  let evidence;
  try {
    evidence = await createRevisionEvidence(source);
  } catch {
    throw new Error('Measured revision-evidence execution failed.');
  }

  let digestHex;
  try {
    if (typeof evidence !== 'object' || evidence === null) {
      throw new Error('invalid revision evidence');
    }
    const revision = evidence.revision;
    if (typeof revision !== 'object' || revision === null) {
      throw new Error('invalid revision evidence');
    }
    digestHex = revision.digestHex;
  } catch {
    throw new Error('Measured revision-evidence result is invalid.');
  }

  if (typeof digestHex !== 'string' || !SHA256_PATTERN.test(digestHex)) {
    throw new Error('Measured revision-evidence result is invalid.');
  }
}

async function main() {
  const args = resolveArguments(process.argv.slice(2));
  assertNoSymlinkOutputAncestors(args.outputPath);
  const source = readBoundedEnvelopeBytes(args.inputPath);
  if (
    args.inputPath === args.outputPath ||
    refersToSameFile(args.inputPath, args.outputPath)
  ) {
    throw new Error('Revision benchmark output must not overwrite its input.');
  }
  const modulePath = resolveLocalModule(args.modulePath);
  if (
    modulePath === args.outputPath ||
    refersToSameFile(modulePath, args.outputPath)
  ) {
    throw new Error(
      'Revision benchmark output must not overwrite the measured module.',
    );
  }
  verifyMeasuredModuleDigest(modulePath, args.artifactSha256);

  const measuredModule = await loadMeasuredModule(modulePath);
  if (
    typeof measuredModule.createDocumentEnvelopeRevisionEvidenceBytes !==
    'function'
  ) {
    throw new Error(
      'Measured revision module must export createDocumentEnvelopeRevisionEvidenceBytes().',
    );
  }

  await runMeasuredRevision(
    measuredModule.createDocumentEnvelopeRevisionEvidenceBytes,
    source,
  );

  const samples = [];
  for (let index = 0; index < args.sampleCount; index += 1) {
    const start = performance.now();
    await runMeasuredRevision(
      measuredModule.createDocumentEnvelopeRevisionEvidenceBytes,
      source,
    );
    const elapsed = performance.now() - start;
    if (!Number.isFinite(elapsed) || elapsed < 0) {
      throw new Error('Revision measurement produced invalid runtime evidence.');
    }
    samples.push(elapsed);
  }

  verifyMeasuredModuleDigest(modulePath, args.artifactSha256);
  assertNoSymlinkOutputAncestors(args.outputPath);
  const outputMetadata = inspectOutputPath(args.outputPath);
  if (outputMetadata !== undefined && !outputMetadata.isFile()) {
    throw new Error('Revision benchmark output must be a regular file.');
  }
  writeMeasurementOutput(
    args.outputPath,
    `${JSON.stringify(
      {
        contractVersion: 1,
        benchmarkId: `revision-evidence-${args.profile}`,
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
      : 'Revision benchmark measurement failed.';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
