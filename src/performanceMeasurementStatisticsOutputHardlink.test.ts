import { spawnSync } from 'node:child_process';
import {
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const script = resolve(process.cwd(), 'benchmarks/summarize-samples.mjs');

function writeInput(path: string): void {
  writeFileSync(
    path,
    `${JSON.stringify({
      contractVersion: 1,
      benchmarkId: 'markdown-serialization-small',
      unit: 'ms',
      sourceCommitSha: 'a'.repeat(40),
      artifactSha256: 'b'.repeat(64),
      documentProfile: 'small',
      runtimeId: 'node-22.18.0',
      referenceHardwareId: 'github-actions-ubuntu-24.04-x64',
      samples: [1, 2, 3],
    })}\n`,
    'utf8',
  );
}

describe('benchmark summary output hard-link safety', () => {
  it('fails closed before truncating an unrelated hard-linked output target', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-summary-output-hardlink-'));
    const input = join(root, 'samples.json');
    const output = join(root, 'output');
    const sentinel = join(root, 'buyer-owned.txt');
    const summaryJson = join(output, 'summary.json');

    try {
      writeInput(input);
      mkdirSync(output);
      writeFileSync(sentinel, 'buyer-owned-content\n', 'utf8');
      linkSync(sentinel, summaryJson);
      const originalSentinel = readFileSync(sentinel, 'utf8');

      const result = spawnSync(
        process.execPath,
        [script, '--input', input, '--output', output],
        { cwd: process.cwd(), encoding: 'utf8' },
      );

      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr.trim()).toBe(
        'Benchmark summary output paths must not be multiply linked.',
      );
      expect(readFileSync(sentinel, 'utf8')).toBe(originalSentinel);
      expect(existsSync(join(output, 'summary.txt'))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
