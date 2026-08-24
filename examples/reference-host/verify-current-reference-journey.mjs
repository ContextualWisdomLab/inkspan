import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const referenceHostDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(referenceHostDirectory, '..', '..');
const command = 'node examples/reference-host/verify-current-reference-journey.mjs';
const steps = Object.freeze([
  Object.freeze({
    args: Object.freeze(['--self-test']),
    path: 'examples/reference-host/synthetic-document-repository.mjs',
  }),
  Object.freeze({
    args: Object.freeze(['--self-test']),
    path: 'examples/reference-host/delayed-proposal.mjs',
  }),
  Object.freeze({
    args: Object.freeze(['--self-test']),
    path: 'examples/reference-host/autosave-view-model.mjs',
  }),
  Object.freeze({
    args: Object.freeze(['--self-test']),
    path: 'examples/reference-host/collaboration-provider-lifecycle.mjs',
  }),
  Object.freeze({
    args: Object.freeze([]),
    path: 'examples/reference-host/verify-packed-artifact.mjs',
  }),
  Object.freeze({
    args: Object.freeze(['--self-test']),
    path: 'examples/reference-host/verify-packed-office-journey.mjs',
  }),
  Object.freeze({
    args: Object.freeze(['--self-test']),
    path: 'examples/reference-host/verify-browser-journey.mjs',
  }),
]);

function writeJson(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function planReceipt() {
  return {
    command,
    contractVersion: 1,
    status: 'plan',
    steps,
  };
}

function runStep(step) {
  const result = spawnSync(
    process.execPath,
    [resolve(repositoryRoot, step.path), ...step.args],
    {
      cwd: repositoryRoot,
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 360_000,
    },
  );

  if (
    result.error !== undefined ||
    result.signal !== null ||
    result.status !== 0
  ) {
    throw new Error('Reference-host current journey verification failed.');
  }
}

function main(argv) {
  if (argv.length === 1 && argv[0] === '--plan') {
    writeJson(planReceipt());
    return;
  }
  if (argv.length !== 0) {
    throw new Error(`Usage: ${command} [--plan]`);
  }

  for (const step of steps) {
    runStep(step);
  }

  writeJson({
    contractVersion: 1,
    status: 'completed',
    steps: steps.length,
  });
}

try {
  main(process.argv.slice(2));
} catch (error) {
  const message =
    error instanceof Error
      ? error.message
      : 'Reference-host current journey verification failed.';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
