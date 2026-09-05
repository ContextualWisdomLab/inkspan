import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const summarizer = resolve(process.cwd(), 'benchmarks/summarize-samples.mjs');

describe('benchmark summary input-path privacy contract', () => {
  it('redacts filesystem details when input inspection crosses a non-directory', () => {
    const root = mkdtempSync(join(tmpdir(), 'inkspan-summary-input-path-'));
    const privateSentinel = 'tenant-private-summary-input-parent';
    const blockedParent = join(root, privateSentinel);
    const input = join(blockedParent, 'samples.json');
    const output = join(root, 'summary');

    try {
      writeFileSync(blockedParent, 'not a directory', 'utf8');

      const result = spawnSync(
        process.execPath,
        [summarizer, '--input', input, '--output', output],
        { cwd: process.cwd(), encoding: 'utf8' },
      );

      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr.trim()).toBe(
        'Benchmark sample input must be a regular file.',
      );
      expect(result.stderr).not.toContain(privateSentinel);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
