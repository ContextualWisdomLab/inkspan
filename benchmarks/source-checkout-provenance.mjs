import { spawnSync } from 'node:child_process';

const MAX_STATUS_BYTES = 1024 * 1024;

function checkedOutHeadSha(repositoryRoot) {
  const result = spawnSync('git', ['rev-parse', '--verify', 'HEAD'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    maxBuffer: MAX_STATUS_BYTES,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 10_000,
  });

  if (
    result.error !== undefined ||
    result.signal !== null ||
    result.status !== 0 ||
    typeof result.stdout !== 'string'
  ) {
    throw new Error(
      'Benchmark suite source checkout identity could not be verified.',
    );
  }

  return result.stdout.trim();
}

export function assertCleanSourceCheckout(repositoryRoot, expectedSourceCommitSha) {
  const result = spawnSync(
    'git',
    ['status', '--porcelain=v1', '--untracked-files=all'],
    {
      cwd: repositoryRoot,
      encoding: 'utf8',
      maxBuffer: MAX_STATUS_BYTES,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 10_000,
    },
  );

  if (
    result.error !== undefined ||
    result.signal !== null ||
    result.status !== 0 ||
    typeof result.stdout !== 'string'
  ) {
    throw new Error(
      'Benchmark suite source checkout cleanliness could not be verified.',
    );
  }

  if (result.stdout.length !== 0) {
    throw new Error(
      'Benchmark suite source checkout must be clean before acquisition evidence is recorded.',
    );
  }

  if (
    expectedSourceCommitSha !== undefined &&
    checkedOutHeadSha(repositoryRoot) !== expectedSourceCommitSha
  ) {
    throw new Error(
      'Benchmark suite source commit does not match checked-out HEAD.',
    );
  }
}
