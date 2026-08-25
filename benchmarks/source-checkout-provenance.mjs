import { spawnSync } from 'node:child_process';

const MAX_STATUS_BYTES = 1024 * 1024;

export function assertCleanSourceCheckout(repositoryRoot) {
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
}
