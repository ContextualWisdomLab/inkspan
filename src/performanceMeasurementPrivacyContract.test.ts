import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const script = resolve(process.cwd(), 'benchmarks/summarize-samples.mjs');
const SOURCE_COMMIT_SHA = 'a'.repeat(40);
const ARTIFACT_SHA256 = 'b'.repeat(64);

const validInput = {
  contractVersion: 1,
  benchmarkId: 'markdown-serialization-large',
  unit: 'ms',
  sourceCommitSha: SOURCE_COMMIT_SHA,
  artifactSha256: ARTIFACT_SHA256,
  documentProfile: 'large',
  runtimeId: 'node-22.18.0',
  referenceHardwareId: 'github-actions-ubuntu-24.04-x64',
  samples: [10, 20, 30],
} as const;

function runSummary(inputValue: object) {
  const root = mkdtempSync(join(tmpdir(), 'inkspan-benchmark-privacy-'));
  const input = join(root, 'samples.json');
  const output = join(root, 'output');
  writeFileSync(input, `${JSON.stringify(inputValue)}\n`, 'utf8');

  const result = spawnSync(
    process.execPath,
    [script, '--input', input, '--output', output],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
    },
  );

  return { root, output, result };
}

describe('benchmark evidence privacy contract', () => {
  it('rejects unsupported metadata instead of accepting arbitrary evidence payloads', () => {
    const { root, output, result } = runSummary({
      ...validInput,
      prompt: 'must-not-enter-benchmark-evidence',
    });
    try {
      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr.trim()).toBe(
        'Benchmark sample input contains unsupported fields.',
      );
      expect(existsSync(join(output, 'summary.json'))).toBe(false);
      expect(existsSync(join(output, 'summary.txt'))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each([
    [
      'benchmarkId',
      'tenant-acme-large',
      'Benchmark benchmarkId is invalid.',
    ],
    ['runtimeId', 'tenant-acme', 'Benchmark runtimeId is invalid.'],
    [
      'referenceHardwareId',
      'tenant-acme',
      'Benchmark referenceHardwareId is invalid.',
    ],
  ])(
    'rejects caller-controlled %s values that could launder private identifiers into evidence',
    (field, value, expectedError) => {
      const { root, output, result } = runSummary({
        ...validInput,
        [field]: value,
      });
      try {
        expect(result.status).toBe(1);
        expect(result.stdout).toBe('');
        expect(result.stderr.trim()).toBe(expectedError);
        expect(existsSync(join(output, 'summary.json'))).toBe(false);
        expect(existsSync(join(output, 'summary.txt'))).toBe(false);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
  );
});
