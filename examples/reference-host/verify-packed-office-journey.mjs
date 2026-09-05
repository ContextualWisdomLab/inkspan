import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const referenceHostDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(referenceHostDirectory, '..', '..');
const command =
  'node examples/reference-host/verify-packed-office-journey.mjs';

function writeJson(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function planReceipt() {
  return {
    command,
    contractVersion: 1,
    packageAuthority: 'exact-packed-tarball',
    status: 'plan',
  };
}

function run(commandName, args, options = {}) {
  const result = spawnSync(commandName, args, {
    cwd: options.cwd ?? repositoryRoot,
    encoding: 'utf8',
    env: options.env ?? process.env,
    maxBuffer: 8 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: options.timeout ?? 180_000,
  });

  if (
    result.error !== undefined ||
    result.signal !== null ||
    result.status !== 0
  ) {
    throw new Error('Reference-host packed Office journey verification failed.');
  }

  return result.stdout;
}

function verifyPackedOfficeJourney() {
  const packageMetadata = JSON.parse(
    readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8'),
  );
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'inkspan-office-journey-'));

  try {
    run('pnpm', ['build'], { timeout: 240_000 });

    const packDirectory = join(temporaryRoot, 'pack');
    mkdirSync(packDirectory, { recursive: true });
    run('pnpm', ['pack', '--pack-destination', packDirectory]);

    const tarballs = readdirSync(packDirectory).filter((name) =>
      name.endsWith('.tgz'),
    );
    assert.equal(tarballs.length, 1, 'Expected exactly one packed Inkspan tarball.');

    const packageDirectory = join(
      temporaryRoot,
      'host',
      'node_modules',
      '@contextualwisdomlab',
      'cwl-editor',
    );
    mkdirSync(packageDirectory, { recursive: true });
    run(
      'tar',
      [
        '-xzf',
        join(packDirectory, tarballs[0]),
        '--strip-components=1',
        '-C',
        packageDirectory,
      ],
      { timeout: 60_000 },
    );

    const packedMetadata = JSON.parse(
      readFileSync(join(packageDirectory, 'package.json'), 'utf8'),
    );
    assert.equal(packedMetadata.name, packageMetadata.name);
    assert.equal(packedMetadata.version, packageMetadata.version);

    const packageEntry = join(packageDirectory, 'dist', 'cwl-editor.js');
    assert.equal(
      existsSync(packageEntry),
      true,
      'Packed Office journey is missing the public ESM entrypoint.',
    );

    run(
      process.execPath,
      [resolve(referenceHostDirectory, 'verify-office-handoff.mjs')],
      {
        env: {
          ...process.env,
          INKSPAN_BROWSER_PACKAGE_ENTRY: packageEntry,
        },
        timeout: 180_000,
      },
    );

    writeJson({
      contractVersion: 1,
      packageAuthority: 'exact-packed-tarball',
      status: 'completed',
    });
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

function main(argv) {
  if (argv.length === 1 && argv[0] === '--plan') {
    writeJson(planReceipt());
    return;
  }
  if (argv.length === 1 && argv[0] === '--self-test') {
    verifyPackedOfficeJourney();
    return;
  }
  throw new Error(`Usage: ${command} --plan | --self-test`);
}

try {
  main(process.argv.slice(2));
} catch (error) {
  const message =
    error instanceof Error
      ? error.message
      : 'Reference-host packed Office journey verification failed.';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
