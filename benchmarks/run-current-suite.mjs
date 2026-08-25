import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertCleanSourceCheckout } from './source-checkout-provenance.mjs';

const benchmarkDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(benchmarkDirectory, '..');
const coreRunnerPath = resolve(benchmarkDirectory, 'run-current-suite-core.mjs');

function main(argv) {
  assertCleanSourceCheckout(repositoryRoot);

  const result = spawnSync(process.execPath, [coreRunnerPath, ...argv], {
    cwd: repositoryRoot,
    stdio: 'inherit',
    timeout: 600_000,
  });

  if (result.error !== undefined || result.signal !== null) {
    throw new Error('Benchmark suite internal runner could not complete.');
  }

  process.exitCode = result.status ?? 1;
}

try {
  main(process.argv.slice(2));
} catch (error) {
  const message =
    error instanceof Error ? error.message : 'Benchmark suite failed.';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
