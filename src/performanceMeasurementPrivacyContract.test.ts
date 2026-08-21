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

describe('benchmark evidence privacy contract', () => {
  it('rejects unsupported metadata instead of accepting arbitrary evidence payloads', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-benchmark-privacy-'));
    const input = join(root, 'samples.json');
    const output = join(root, 'output');
    try {
      writeFileSync(
        input,
        `${JSON.stringify({
          contractVersion: 1,
          benchmarkId: 'markdown-serialization-large',
          unit: 'ms',
          sourceCommitSha: SOURCE_COMMIT_SHA,
          artifactSha256: ARTIFACT_SHA256,
          documentProfile: 'large',
          runtimeId: 'node-22.18.0',
          referenceHardwareId: 'github-actions-ubuntu-24.04-x64',
          samples: [10, 20, 30],
          prompt: 'must-not-enter-benchmark-evidence',
        })}\n`,
        'utf8',
      );

      const result = spawnSync(
        process.execPath,
        [script, '--input', input, '--output', output],
        {
          cwd: process.cwd(),
          encoding: 'utf8',
        },
      );

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
});
