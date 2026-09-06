import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const script = resolve(process.cwd(), 'benchmarks/summarize-samples.mjs');

describe('benchmark summary profile consistency contract', () => {
  it('rejects sample evidence whose benchmarkId profile disagrees with documentProfile', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-summary-profile-'));
    const inputPath = join(root, 'samples.json');
    const outputDirectory = join(root, 'summary');

    try {
      writeFileSync(
        inputPath,
        `${JSON.stringify({
          contractVersion: 1,
          benchmarkId: 'editor-input-small',
          unit: 'ms',
          sourceCommitSha: 'a'.repeat(40),
          artifactSha256: 'b'.repeat(64),
          documentProfile: 'large',
          runtimeId: 'chromium-1.62.0',
          referenceHardwareId: 'github-actions-ubuntu-24.04-x64',
          samples: [70, 80, 90, 100],
        })}\n`,
        'utf8',
      );

      const result = spawnSync(
        process.execPath,
        [script, '--input', inputPath, '--output', outputDirectory],
        { cwd: process.cwd(), encoding: 'utf8' },
      );

      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr.trim()).toBe(
        'Benchmark sample profile must match documentProfile.',
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
