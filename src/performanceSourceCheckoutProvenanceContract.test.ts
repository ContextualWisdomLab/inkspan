import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

const repositoryRoot = process.cwd();
const helperUrl = pathToFileURL(
  resolve(repositoryRoot, 'benchmarks/source-checkout-provenance.mjs'),
).href;
const temporaryDirectories: string[] = [];

const probe = `
import { assertCleanSourceCheckout } from ${JSON.stringify(helperUrl)};
try {
  assertCleanSourceCheckout(process.argv[1], process.argv[2]);
  process.stdout.write('clean\\n');
} catch (error) {
  process.stderr.write(\`${'${error instanceof Error ? error.message : "verification failed"}'}\\n\`);
  process.exitCode = 1;
}
`;

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function createRepository(): string {
  const directory = mkdtempSync(join(tmpdir(), 'inkspan-benchmark-provenance-'));
  temporaryDirectories.push(directory);
  execFileSync('git', ['init', '--quiet'], { cwd: directory });
  execFileSync('git', ['config', 'user.email', 'test@example.invalid'], {
    cwd: directory,
  });
  execFileSync('git', ['config', 'user.name', 'Inkspan Test'], {
    cwd: directory,
  });
  writeFileSync(join(directory, 'tracked.txt'), 'committed\n');
  execFileSync('git', ['add', 'tracked.txt'], { cwd: directory });
  execFileSync('git', ['commit', '--quiet', '-m', 'fixture'], { cwd: directory });
  return directory;
}

function headSha(directory: string): string {
  return execFileSync('git', ['rev-parse', '--verify', 'HEAD'], {
    cwd: directory,
    encoding: 'utf8',
  }).trim();
}

function probeCheckout(directory: string, expectedCommitSha = headSha(directory)) {
  return spawnSync(
    process.execPath,
    ['--input-type=module', '--eval', probe, directory, expectedCommitSha],
    {
      cwd: repositoryRoot,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 10_000,
    },
  );
}

describe('benchmark source checkout provenance', () => {
  it('accepts a clean source checkout at the claimed source commit', () => {
    const directory = createRepository();
    const result = probeCheckout(directory);

    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('clean\n');
    expect(result.stderr).toBe('');
  });

  it('rejects a clean checkout when the claimed source commit is not HEAD', () => {
    const directory = createRepository();
    const actualHead = headSha(directory);
    const mismatchedCommit = actualHead === 'f'.repeat(40) ? 'e'.repeat(40) : 'f'.repeat(40);
    const result = probeCheckout(directory, mismatchedCommit);

    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(
      'Benchmark suite source commit does not match checked-out HEAD.\n',
    );
    expect(result.stderr).not.toContain(actualHead);
    expect(result.stderr).not.toContain(mismatchedCommit);
  });

  it('rejects untracked source state without disclosing paths', () => {
    const directory = createRepository();
    const untrackedPath = join(directory, 'untracked-secret-name.txt');
    writeFileSync(untrackedPath, 'not part of the committed source\n');

    const result = probeCheckout(directory);

    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(
      'Benchmark suite source checkout must be clean before acquisition evidence is recorded.\n',
    );
    expect(result.stderr).not.toContain(untrackedPath);
    expect(result.stderr).not.toContain('untracked-secret-name.txt');
  });
});
