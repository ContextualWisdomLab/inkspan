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

describe('benchmark evidence UTF-8 contract', () => {
  it('rejects malformed UTF-8 before parsing or generating summary evidence', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-benchmark-utf8-'));
    const input = join(root, 'samples.json');
    const output = join(root, 'output');
    try {
      const prefix = [
        '{"contractVersion":1,',
        '"benchmarkId":"markdown-serialization-large",',
        '"unit":"ms",',
        `"sourceCommitSha":"${SOURCE_COMMIT_SHA}",`,
        `"artifactSha256":"${ARTIFACT_SHA256}",`,
        '"documentProfile":"large",',
        '"runtimeId":"node-22.18.0",',
        '"referenceHardwareId":"github-actions-ubuntu-24.04-x64",',
        '"samples":[1,2,3],',
        '"untrustedNote":"',
      ].join('');
      writeFileSync(
        input,
        Buffer.concat([
          Buffer.from(prefix, 'utf8'),
          Buffer.from([0x80]),
          Buffer.from('"}\n', 'utf8'),
        ]),
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
        'Benchmark sample input must be valid UTF-8 JSON.',
      );
      expect(existsSync(join(output, 'summary.json'))).toBe(false);
      expect(existsSync(join(output, 'summary.txt'))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
