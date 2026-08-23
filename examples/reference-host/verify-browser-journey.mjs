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
const browserDirectory = resolve(repositoryRoot, 'tests/browser');
const command = 'node examples/reference-host/verify-browser-journey.mjs';
const projects = Object.freeze(['chromium', 'firefox', 'webkit']);
const specs = Object.freeze([
  'reference-host-dirty-state.browser.spec.ts',
  'reference-host-forced-colors.print.browser.spec.ts',
  'reference-host-hydration.browser.spec.ts',
  'reference-host-readonly.browser.spec.ts',
  'reference-host.print.browser.spec.ts',
]);

function writeJson(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function planReceipt() {
  return {
    command,
    contractVersion: 1,
    packageAuthority: 'exact-packed-tarball',
    projects,
    specs,
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
    throw new Error('Reference-host browser journey verification failed.');
  }

  return result.stdout;
}

function verifyBrowserJourney() {
  const packageMetadata = JSON.parse(
    readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8'),
  );
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'inkspan-browser-journey-'));

  try {
    run('pnpm', ['build'], { timeout: 240_000 });

    const packDirectory = join(temporaryRoot, 'pack');
    mkdirSync(packDirectory, { recursive: true });
    run('pnpm', ['pack', '--pack-destination', packDirectory]);

    const tarballs = readdirSync(packDirectory).filter((name) =>
      name.endsWith('.tgz'),
    );
    assert.equal(tarballs.length, 1, 'Expected exactly one packed Inkspan tarball.');

    const extractedDirectory = join(temporaryRoot, 'package');
    mkdirSync(extractedDirectory, { recursive: true });
    run(
      'tar',
      [
        '-xzf',
        join(packDirectory, tarballs[0]),
        '--strip-components=1',
        '-C',
        extractedDirectory,
      ],
      { timeout: 60_000 },
    );

    const extractedMetadata = JSON.parse(
      readFileSync(join(extractedDirectory, 'package.json'), 'utf8'),
    );
    assert.equal(extractedMetadata.name, packageMetadata.name);
    assert.equal(extractedMetadata.version, packageMetadata.version);

    const packageEntry = join(extractedDirectory, 'dist/cwl-editor.js');
    assert.equal(
      existsSync(packageEntry),
      true,
      'Packed browser journey is missing the public ESM entrypoint.',
    );

    for (const spec of specs) {
      assert.equal(
        existsSync(join(browserDirectory, 'specs', spec)),
        true,
        `Reference-host browser journey is missing ${spec}.`,
      );
    }

    const playwrightArgs = [
      '--dir',
      'tests/browser',
      'exec',
      'playwright',
      'test',
      '--config',
      'playwright.config.ts',
      ...specs,
      ...projects.flatMap((project) => ['--project', project]),
    ];
    run('pnpm', playwrightArgs, {
      env: {
        ...process.env,
        INKSPAN_BROWSER_PACKAGE_ENTRY: packageEntry,
      },
      timeout: 300_000,
    });

    writeJson({
      contractVersion: 1,
      packageAuthority: 'exact-packed-tarball',
      projects: projects.length,
      specs: specs.length,
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
    verifyBrowserJourney();
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
      : 'Reference-host browser journey verification failed.';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
