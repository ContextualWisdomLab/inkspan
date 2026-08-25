import { spawnSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const repositoryRoot = process.cwd();
const suitePath = resolve(repositoryRoot, 'benchmarks/run-current-suite.mjs');
const dirtySentinelPath = resolve(
  repositoryRoot,
  `.inkspan-benchmark-dirty-provenance-${process.pid}`,
);

afterEach(() => {
  rmSync(dirtySentinelPath, { force: true });
});

describe('benchmark source checkout provenance', () => {
  it('rejects untracked source state before acquisition evidence can run', () => {
    writeFileSync(dirtySentinelPath, 'untracked benchmark provenance sentinel\n');

    const result = spawnSync(process.execPath, [suitePath], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 10_000,
    });

    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(
      'Benchmark suite source checkout must be clean before acquisition evidence is recorded.\n',
    );
    expect(result.stderr).not.toContain('Usage:');
    expect(result.stderr).not.toContain(dirtySentinelPath);
  });
});
