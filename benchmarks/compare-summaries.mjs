import {
  closeSync,
  constants,
  fstatSync,
  openSync,
  readSync,
} from 'node:fs';
import { resolve } from 'node:path';

const MAX_INPUT_BYTES = 1024 * 1024;
const READ_CHUNK_BYTES = 64 * 1024;
const MAX_SAMPLES = 1_000_000;
const READ_ONLY_NONBLOCKING =
  constants.O_RDONLY | (constants.O_NONBLOCK ?? 0);
const BENCHMARK_ID_PATTERN =
  /^(?:ssr-shell-render|client-hydration|editor-mount|first-editable-paint|editor-input|keyboard-input|ime-composition|toolbar-action|undo-redo|table-edit|paste|image-insertion|markdown-serialization|html-serialization|envelope-parse|envelope-canonicalization|revision-evidence|transition-evidence|autosave-enqueue|autosave-coalescing|autosave-commit|yjs-update|print-media|office-parse|office-render|office-publication)-(?:small|medium|large|stress)$/u;
const UNIT_PATTERN = /^[A-Za-z][A-Za-z0-9._/%-]{0,31}$/u;
const SHA1_PATTERN = /^[0-9a-f]{40}$/u;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const RUNTIME_ID_PATTERN =
  /^(?:node|python|chromium|firefox|webkit|playwright)-[0-9]+(?:\.[0-9]+){1,3}$/u;
const REFERENCE_HARDWARE_ID_PATTERN =
  /^(?:github-actions-(?:ubuntu|windows|macos)-[0-9]+(?:\.[0-9]+){0,2}-(?:x64|arm64)|refhw-sha256-[0-9a-f]{64})$/u;
const DOCUMENT_PROFILES = new Set(['small', 'medium', 'large', 'stress']);
const METRICS = new Set(['p50', 'p75', 'p95', 'maximum']);
const SUMMARY_KEYS = new Set([
  'contractVersion',
  'benchmarkId',
  'unit',
  'sourceCommitSha',
  'artifactSha256',
  'documentProfile',
  'runtimeId',
  'referenceHardwareId',
  'sampleCount',
  'percentileMethod',
  'minimum',
  'p50',
  'p75',
  'p95',
  'maximum',
]);
const COMPARABLE_FIELDS = [
  'benchmarkId',
  'unit',
  'documentProfile',
  'runtimeId',
  'referenceHardwareId',
  'sampleCount',
  'percentileMethod',
];
const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });

function resolveArguments(argv) {
  if (
    argv.length !== 8 ||
    argv[0] !== '--baseline' ||
    argv[1].length === 0 ||
    argv[2] !== '--current' ||
    argv[3].length === 0 ||
    argv[4] !== '--metric' ||
    !METRICS.has(argv[5]) ||
    argv[6] !== '--max-regression-percent' ||
    argv[7].trim().length === 0
  ) {
    throw new Error(
      'Usage: node benchmarks/compare-summaries.mjs --baseline <summary.json> --current <summary.json> --metric <p50|p75|p95|maximum> --max-regression-percent <number>',
    );
  }

  const maxRegressionPercent = Number(argv[7]);
  if (!Number.isFinite(maxRegressionPercent) || maxRegressionPercent < 0) {
    throw new Error(
      'Benchmark max regression percent must be a finite non-negative number.',
    );
  }

  return Object.freeze({
    baselinePath: resolve(argv[1]),
    currentPath: resolve(argv[3]),
    metric: argv[5],
    maxRegressionPercent,
  });
}

function readBoundedJson(path) {
  const descriptor = openSync(path, READ_ONLY_NONBLOCKING);
  try {
    const metadata = fstatSync(descriptor);
    if (!metadata.isFile()) {
      throw new Error('Benchmark summary input must be a regular file.');
    }
    if (metadata.size > MAX_INPUT_BYTES) {
      throw new Error('Benchmark summary input exceeds the supported size.');
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
        throw new Error('Benchmark summary input exceeds the supported size.');
      }
      chunks.push(chunk.subarray(0, bytesRead));
    }

    let text;
    try {
      text = UTF8_DECODER.decode(Buffer.concat(chunks, totalBytes));
    } catch {
      throw new Error('Benchmark summary input must be valid UTF-8 JSON.');
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new Error('Benchmark summary input must be valid JSON.');
    }
  } finally {
    closeSync(descriptor);
  }
}

function validateSummary(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Benchmark summary input must be an object.');
  }
  const keys = Object.keys(value);
  if (
    keys.length !== SUMMARY_KEYS.size ||
    keys.some((key) => !SUMMARY_KEYS.has(key))
  ) {
    throw new Error('Benchmark summary input has an unsupported shape.');
  }
  if (value.contractVersion !== 1) {
    throw new Error('Benchmark summary contractVersion must be 1.');
  }
  if (
    typeof value.benchmarkId !== 'string' ||
    !BENCHMARK_ID_PATTERN.test(value.benchmarkId)
  ) {
    throw new Error('Benchmark summary benchmarkId is invalid.');
  }
  if (typeof value.unit !== 'string' || !UNIT_PATTERN.test(value.unit)) {
    throw new Error('Benchmark summary unit is invalid.');
  }
  if (
    typeof value.sourceCommitSha !== 'string' ||
    !SHA1_PATTERN.test(value.sourceCommitSha)
  ) {
    throw new Error('Benchmark summary sourceCommitSha is invalid.');
  }
  if (
    typeof value.artifactSha256 !== 'string' ||
    !SHA256_PATTERN.test(value.artifactSha256)
  ) {
    throw new Error('Benchmark summary artifactSha256 is invalid.');
  }
  if (
    typeof value.documentProfile !== 'string' ||
    !DOCUMENT_PROFILES.has(value.documentProfile)
  ) {
    throw new Error('Benchmark summary documentProfile is invalid.');
  }
  if (
    typeof value.runtimeId !== 'string' ||
    !RUNTIME_ID_PATTERN.test(value.runtimeId)
  ) {
    throw new Error('Benchmark summary runtimeId is invalid.');
  }
  if (
    typeof value.referenceHardwareId !== 'string' ||
    !REFERENCE_HARDWARE_ID_PATTERN.test(value.referenceHardwareId)
  ) {
    throw new Error('Benchmark summary referenceHardwareId is invalid.');
  }
  if (
    !Number.isSafeInteger(value.sampleCount) ||
    value.sampleCount <= 0 ||
    value.sampleCount > MAX_SAMPLES
  ) {
    throw new Error('Benchmark summary sampleCount is invalid.');
  }
  if (value.percentileMethod !== 'nearest-rank') {
    throw new Error('Benchmark summary percentileMethod is invalid.');
  }

  const measurements = [
    value.minimum,
    value.p50,
    value.p75,
    value.p95,
    value.maximum,
  ];
  if (
    measurements.some(
      (measurement) =>
        typeof measurement !== 'number' ||
        !Number.isFinite(measurement) ||
        measurement < 0,
    )
  ) {
    throw new Error(
      'Benchmark summary measurements must be finite non-negative numbers.',
    );
  }
  for (let index = 1; index < measurements.length; index += 1) {
    if (measurements[index] < measurements[index - 1]) {
      throw new Error('Benchmark summary percentile ordering is invalid.');
    }
  }

  return Object.freeze({
    benchmarkId: value.benchmarkId,
    unit: value.unit,
    sourceCommitSha: value.sourceCommitSha,
    artifactSha256: value.artifactSha256,
    documentProfile: value.documentProfile,
    runtimeId: value.runtimeId,
    referenceHardwareId: value.referenceHardwareId,
    sampleCount: value.sampleCount,
    percentileMethod: value.percentileMethod,
    minimum: value.minimum,
    p50: value.p50,
    p75: value.p75,
    p95: value.p95,
    maximum: value.maximum,
  });
}

function assertComparable(baseline, current) {
  for (const field of COMPARABLE_FIELDS) {
    if (baseline[field] !== current[field]) {
      throw new Error(`Benchmark summaries are not comparable: ${field} differs.`);
    }
  }
  if (baseline.artifactSha256 === current.artifactSha256) {
    throw new Error(
      'Benchmark summaries must identify distinct measured artifacts.',
    );
  }
}

function normalizePercent(value) {
  const rounded = Number(value.toFixed(12));
  return Object.is(rounded, -0) ? 0 : rounded;
}

function compare(baseline, current, metric, maxRegressionPercent) {
  assertComparable(baseline, current);
  const baselineValue = baseline[metric];
  const currentValue = current[metric];
  if (baselineValue === 0 && currentValue !== 0) {
    throw new Error(
      'Benchmark regression percent is undefined for a zero non-matching baseline.',
    );
  }
  const regressionPercent =
    baselineValue === 0
      ? 0
      : normalizePercent(((currentValue - baselineValue) / baselineValue) * 100);
  if (!Number.isFinite(regressionPercent)) {
    throw new Error(
      'Benchmark regression percent is not finite for the supplied measurements.',
    );
  }
  return Object.freeze({
    contractVersion: 1,
    benchmarkId: baseline.benchmarkId,
    unit: baseline.unit,
    documentProfile: baseline.documentProfile,
    runtimeId: baseline.runtimeId,
    referenceHardwareId: baseline.referenceHardwareId,
    sampleCount: baseline.sampleCount,
    percentileMethod: baseline.percentileMethod,
    metric,
    baselineSourceCommitSha: baseline.sourceCommitSha,
    baselineArtifactSha256: baseline.artifactSha256,
    currentSourceCommitSha: current.sourceCommitSha,
    currentArtifactSha256: current.artifactSha256,
    baselineValue,
    currentValue,
    maxRegressionPercent,
    regressionPercent,
    passed: regressionPercent <= maxRegressionPercent,
  });
}

function main() {
  const { baselinePath, currentPath, metric, maxRegressionPercent } =
    resolveArguments(process.argv.slice(2));
  const baseline = validateSummary(readBoundedJson(baselinePath));
  const current = validateSummary(readBoundedJson(currentPath));
  const result = compare(baseline, current, metric, maxRegressionPercent);
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (!result.passed) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  const message =
    error instanceof Error ? error.message : 'Benchmark comparison failed.';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
