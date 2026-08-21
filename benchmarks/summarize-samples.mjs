import {
  closeSync,
  existsSync,
  fstatSync,
  mkdirSync,
  openSync,
  readSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';

const MAX_INPUT_BYTES = 16 * 1024 * 1024;
const READ_CHUNK_BYTES = 64 * 1024;
const MAX_SAMPLES = 1_000_000;
const BENCHMARK_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const UNIT_PATTERN = /^[A-Za-z][A-Za-z0-9._/%-]{0,31}$/u;

function resolveArguments(argv) {
  if (
    argv.length !== 4 ||
    argv[0] !== '--input' ||
    argv[1].length === 0 ||
    argv[2] !== '--output' ||
    argv[3].length === 0
  ) {
    throw new Error(
      'Usage: node benchmarks/summarize-samples.mjs --input <samples.json> --output <directory>',
    );
  }
  return Object.freeze({
    inputPath: resolve(argv[1]),
    outputDirectory: resolve(argv[3]),
  });
}

function readBoundedJson(path) {
  const descriptor = openSync(path, 'r');
  try {
    const metadata = fstatSync(descriptor);
    if (!metadata.isFile()) {
      throw new Error('Benchmark sample input must be a regular file.');
    }
    if (metadata.size > MAX_INPUT_BYTES) {
      throw new Error('Benchmark sample input exceeds the supported size.');
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
        throw new Error('Benchmark sample input exceeds the supported size.');
      }
      chunks.push(chunk.subarray(0, bytesRead));
    }

    const bytes = Buffer.concat(chunks, totalBytes);
    let parsed;
    try {
      parsed = JSON.parse(bytes.toString('utf8'));
    } catch {
      throw new Error('Benchmark sample input must be valid JSON.');
    }
    return parsed;
  } finally {
    closeSync(descriptor);
  }
}

function validateInput(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Benchmark sample input must be an object.');
  }
  if (value.contractVersion !== 1) {
    throw new Error('Benchmark sample contractVersion must be 1.');
  }
  if (
    typeof value.benchmarkId !== 'string' ||
    !BENCHMARK_ID_PATTERN.test(value.benchmarkId)
  ) {
    throw new Error('Benchmark benchmarkId is invalid.');
  }
  if (typeof value.unit !== 'string' || !UNIT_PATTERN.test(value.unit)) {
    throw new Error('Benchmark unit is invalid.');
  }
  if (
    !Array.isArray(value.samples) ||
    value.samples.length === 0 ||
    value.samples.length > MAX_SAMPLES
  ) {
    throw new Error('Benchmark samples must be a non-empty bounded array.');
  }
  if (
    value.samples.some(
      (sample) =>
        typeof sample !== 'number' || !Number.isFinite(sample) || sample < 0,
    )
  ) {
    throw new Error('Benchmark samples must be finite non-negative numbers.');
  }
  return Object.freeze({
    benchmarkId: value.benchmarkId,
    unit: value.unit,
    samples: Object.freeze([...value.samples]),
  });
}

function nearestRank(sorted, percentile) {
  const index = Math.ceil(percentile * sorted.length) - 1;
  return sorted[index];
}

function summarize(input) {
  const sorted = [...input.samples].sort((left, right) => left - right);
  return Object.freeze({
    contractVersion: 1,
    benchmarkId: input.benchmarkId,
    unit: input.unit,
    sampleCount: sorted.length,
    percentileMethod: 'nearest-rank',
    minimum: sorted[0],
    p50: nearestRank(sorted, 0.5),
    p75: nearestRank(sorted, 0.75),
    p95: nearestRank(sorted, 0.95),
    maximum: sorted.at(-1),
  });
}

function formatSummary(summary) {
  return [
    `benchmark=${summary.benchmarkId}`,
    `unit=${summary.unit}`,
    `samples=${summary.sampleCount}`,
    `percentile_method=${summary.percentileMethod}`,
    `minimum=${summary.minimum}`,
    `p50=${summary.p50}`,
    `p75=${summary.p75}`,
    `p95=${summary.p95}`,
    `maximum=${summary.maximum}`,
    '',
  ].join('\n');
}

function refersToSameFile(leftPath, rightPath) {
  if (!existsSync(leftPath) || !existsSync(rightPath)) return false;
  const left = statSync(leftPath);
  const right = statSync(rightPath);
  return left.dev === right.dev && left.ino === right.ino;
}

function main() {
  const { inputPath, outputDirectory } = resolveArguments(process.argv.slice(2));
  const summaryJsonPath = resolve(outputDirectory, 'summary.json');
  const summaryTextPath = resolve(outputDirectory, 'summary.txt');
  mkdirSync(outputDirectory, { recursive: true });
  if (
    inputPath === summaryJsonPath ||
    inputPath === summaryTextPath ||
    refersToSameFile(inputPath, summaryJsonPath) ||
    refersToSameFile(inputPath, summaryTextPath)
  ) {
    throw new Error('Benchmark output must not overwrite the sample input.');
  }
  const input = validateInput(readBoundedJson(inputPath));
  const summary = summarize(input);
  writeFileSync(
    summaryJsonPath,
    `${JSON.stringify(summary, null, 2)}\n`,
    'utf8',
  );
  writeFileSync(summaryTextPath, formatSummary(summary), 'utf8');
}

try {
  main();
} catch (error) {
  const message =
    error instanceof Error ? error.message : 'Benchmark summary failed.';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
