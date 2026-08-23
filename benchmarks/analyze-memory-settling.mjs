import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
} from 'node:fs';
import { resolve } from 'node:path';

const MAX_INPUT_BYTES = 1024 * 1024;
const READ_CHUNK_BYTES = 64 * 1024;
const MAX_SAMPLES = 1_000_000;
const READ_ONLY_NONBLOCKING =
  constants.O_RDONLY |
  (constants.O_NONBLOCK ?? 0) |
  (constants.O_NOFOLLOW ?? 0);
const BENCHMARK_ID_PREFIX = 'editor-lifecycle-retained-memory-';
const BENCHMARK_ID_PATTERN =
  /^editor-lifecycle-retained-memory-(?:small|medium|large|stress)$/u;
const SHA1_PATTERN = /^[0-9a-f]{40}$/u;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const RUNTIME_ID_PATTERN =
  /^(?:node|python|chromium|firefox|webkit|playwright)-[0-9]+(?:\.[0-9]+){1,3}$/u;
const REFERENCE_HARDWARE_ID_PATTERN =
  /^(?:github-actions-(?:ubuntu|windows|macos)-[0-9]+(?:\.[0-9]+){0,2}-(?:x64|arm64)|refhw-sha256-[0-9a-f]{64})$/u;
const DOCUMENT_PROFILES = new Set(['small', 'medium', 'large', 'stress']);
const EVIDENCE_KEYS = new Set([
  'contractVersion',
  'benchmarkId',
  'unit',
  'sourceCommitSha',
  'artifactSha256',
  'documentProfile',
  'runtimeId',
  'referenceHardwareId',
  'warmupSamples',
  'samples',
]);
const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });

function resolveArguments(argv) {
  if (
    argv.length !== 6 ||
    argv[0] !== '--input' ||
    argv[1].length === 0 ||
    argv[2] !== '--window-size' ||
    argv[3].trim().length === 0 ||
    argv[4] !== '--max-growth-bytes' ||
    argv[5].trim().length === 0
  ) {
    throw new Error(
      'Usage: node benchmarks/analyze-memory-settling.mjs --input <evidence.json> --window-size <positive-integer> --max-growth-bytes <number>',
    );
  }

  const windowSize = Number(argv[3]);
  if (!Number.isSafeInteger(windowSize) || windowSize <= 0) {
    throw new Error('Memory settling window size must be a positive safe integer.');
  }

  const maxGrowthBytes = Number(argv[5]);
  if (!Number.isFinite(maxGrowthBytes) || maxGrowthBytes < 0) {
    throw new Error(
      'Memory settling max growth bytes must be a finite non-negative number.',
    );
  }

  return Object.freeze({
    inputPath: resolve(argv[1]),
    windowSize,
    maxGrowthBytes,
  });
}

function readBoundedJson(path) {
  const pathMetadata = lstatSync(path, { throwIfNoEntry: false });
  if (pathMetadata === undefined || pathMetadata.isSymbolicLink()) {
    throw new Error(
      'Memory settling evidence input must be a regular non-symlink file.',
    );
  }
  if (!pathMetadata.isFile()) {
    throw new Error('Memory settling evidence input must be a regular file.');
  }

  const descriptor = openSync(path, READ_ONLY_NONBLOCKING);
  try {
    const metadata = fstatSync(descriptor);
    if (!metadata.isFile()) {
      throw new Error('Memory settling evidence input must be a regular file.');
    }
    if (metadata.size > MAX_INPUT_BYTES) {
      throw new Error('Memory settling evidence input exceeds the supported size.');
    }

    const chunks = [];
    let totalBytes = 0;
    while (totalBytes <= MAX_INPUT_BYTES) {
      const remainingBudget = MAX_INPUT_BYTES + 1 - totalBytes;
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
      if (totalBytes > MAX_INPUT_BYTES) {
        throw new Error(
          'Memory settling evidence input exceeds the supported size.',
        );
      }
      chunks.push(chunk.subarray(0, bytesRead));
    }

    let text;
    try {
      text = UTF8_DECODER.decode(Buffer.concat(chunks, totalBytes));
    } catch {
      throw new Error('Memory settling evidence input must be valid UTF-8 JSON.');
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new Error('Memory settling evidence input must be valid JSON.');
    }
  } finally {
    closeSync(descriptor);
  }
}

function validateEvidence(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Memory settling evidence input must be an object.');
  }
  const keys = Object.keys(value);
  if (
    keys.length !== EVIDENCE_KEYS.size ||
    keys.some((key) => !EVIDENCE_KEYS.has(key))
  ) {
    throw new Error('Memory settling evidence input has an unsupported shape.');
  }
  if (value.contractVersion !== 1) {
    throw new Error('Memory settling evidence contractVersion must be 1.');
  }
  if (
    typeof value.benchmarkId !== 'string' ||
    !BENCHMARK_ID_PATTERN.test(value.benchmarkId)
  ) {
    throw new Error('Memory settling evidence benchmarkId is invalid.');
  }
  if (value.unit !== 'bytes') {
    throw new Error('Memory settling evidence unit must be bytes.');
  }
  if (
    typeof value.sourceCommitSha !== 'string' ||
    !SHA1_PATTERN.test(value.sourceCommitSha)
  ) {
    throw new Error('Memory settling evidence sourceCommitSha is invalid.');
  }
  if (
    typeof value.artifactSha256 !== 'string' ||
    !SHA256_PATTERN.test(value.artifactSha256)
  ) {
    throw new Error('Memory settling evidence artifactSha256 is invalid.');
  }
  if (
    typeof value.documentProfile !== 'string' ||
    !DOCUMENT_PROFILES.has(value.documentProfile)
  ) {
    throw new Error('Memory settling evidence documentProfile is invalid.');
  }
  if (
    value.benchmarkId.slice(BENCHMARK_ID_PREFIX.length) !== value.documentProfile
  ) {
    throw new Error(
      'Memory settling evidence benchmark profile must match documentProfile.',
    );
  }
  if (
    typeof value.runtimeId !== 'string' ||
    !RUNTIME_ID_PATTERN.test(value.runtimeId)
  ) {
    throw new Error('Memory settling evidence runtimeId is invalid.');
  }
  if (
    typeof value.referenceHardwareId !== 'string' ||
    !REFERENCE_HARDWARE_ID_PATTERN.test(value.referenceHardwareId)
  ) {
    throw new Error('Memory settling evidence referenceHardwareId is invalid.');
  }
  if (
    !Number.isSafeInteger(value.warmupSamples) ||
    value.warmupSamples < 0 ||
    value.warmupSamples > MAX_SAMPLES
  ) {
    throw new Error('Memory settling evidence warmupSamples is invalid.');
  }
  if (
    !Array.isArray(value.samples) ||
    value.samples.length === 0 ||
    value.samples.length > MAX_SAMPLES ||
    value.samples.some(
      (sample) =>
        !Number.isSafeInteger(sample) || sample < 0,
    )
  ) {
    throw new Error(
      'Memory settling evidence samples must be bounded non-negative safe integers.',
    );
  }
  if (value.warmupSamples >= value.samples.length) {
    throw new Error('Memory settling evidence warmupSamples is invalid.');
  }

  return Object.freeze({
    benchmarkId: value.benchmarkId,
    unit: value.unit,
    sourceCommitSha: value.sourceCommitSha,
    artifactSha256: value.artifactSha256,
    documentProfile: value.documentProfile,
    runtimeId: value.runtimeId,
    referenceHardwareId: value.referenceHardwareId,
    warmupSamples: value.warmupSamples,
    samples: Object.freeze([...value.samples]),
  });
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[midpoint];

  const left = sorted[midpoint - 1];
  const right = sorted[midpoint];
  const distance = right - left;
  const wholeMidpoint = left + Math.floor(distance / 2);
  if (distance % 2 === 1 && wholeMidpoint >= 2 ** 52) {
    throw new Error(
      'Memory settling window median must be exactly representable.',
    );
  }
  return wholeMidpoint + (distance % 2) / 2;
}

function analyze(evidence, windowSize, maxGrowthBytes) {
  const settledSamples = evidence.samples.slice(evidence.warmupSamples);
  if (settledSamples.length < windowSize * 2) {
    throw new Error(
      'Memory settling evidence requires warmup plus two disjoint comparison windows.',
    );
  }

  const firstWindowMedianBytes = median(settledSamples.slice(0, windowSize));
  const lastWindowMedianBytes = median(settledSamples.slice(-windowSize));
  const retainedGrowthBytes = lastWindowMedianBytes - firstWindowMedianBytes;

  return Object.freeze({
    contractVersion: 1,
    benchmarkId: evidence.benchmarkId,
    unit: evidence.unit,
    sourceCommitSha: evidence.sourceCommitSha,
    artifactSha256: evidence.artifactSha256,
    documentProfile: evidence.documentProfile,
    runtimeId: evidence.runtimeId,
    referenceHardwareId: evidence.referenceHardwareId,
    sampleCount: evidence.samples.length,
    warmupSamples: evidence.warmupSamples,
    windowSize,
    firstWindowMedianBytes,
    lastWindowMedianBytes,
    retainedGrowthBytes,
    maxGrowthBytes,
    passed: retainedGrowthBytes <= maxGrowthBytes,
  });
}

function main() {
  const { inputPath, windowSize, maxGrowthBytes } = resolveArguments(
    process.argv.slice(2),
  );
  const evidence = validateEvidence(readBoundedJson(inputPath));
  const result = analyze(evidence, windowSize, maxGrowthBytes);
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (!result.passed) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  const message =
    error instanceof Error ? error.message : 'Memory settling analysis failed.';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
