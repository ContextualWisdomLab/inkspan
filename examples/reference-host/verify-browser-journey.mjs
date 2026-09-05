import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const referenceHostDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(referenceHostDirectory, '..', '..');
const browserDirectory = resolve(repositoryRoot, 'tests/browser');
const command = 'node examples/reference-host/verify-browser-journey.mjs';
const projects = Object.freeze(['chromium', 'firefox', 'webkit']);
const specs = Object.freeze([
  'reference-host-collaboration.browser.spec.ts',
  'reference-host-proposal.browser.spec.ts',
  'reference-host-recovery.browser.spec.ts',
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
    throw new Error(`Reference-host browser journey failed at ${commandName} ${args[0]} (exit ${result.status}, signal ${result.signal}, launch ${result.error?.code ?? 'ok'}).`);
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
    run('pnpm', [
      'exec', 'tsc', '--noEmit', '--allowJs', '--checkJs', 'false',
      '--strict', '--skipLibCheck', '--target', 'ES2022', '--module', 'ESNext',
      '--moduleResolution', 'bundler', '--jsx', 'react-jsx', '--esModuleInterop',
      'examples/reference-host/browser-host.tsx',
    ]);

    const packDirectory = join(temporaryRoot, 'pack');
    mkdirSync(packDirectory, { recursive: true });
    run('pnpm', ['pack', '--pack-destination', packDirectory]);

    const tarballs = readdirSync(packDirectory).filter((name) =>
      name.endsWith('.tgz'),
    );
    assert.equal(tarballs.length, 1, 'Expected exactly one packed Inkspan tarball.');

    const tarballPath = join(packDirectory, tarballs[0]);
    const packageSha256 = createHash('sha256').update(readFileSync(tarballPath)).digest('hex');
    const consumerDirectory = join(temporaryRoot, 'consumer');
    mkdirSync(consumerDirectory);
    // Match the existing isolated SSR consumer: install the packed artifact and
    // its declared dependency closure, never resolve dependencies from source.
    writeFileSync(join(consumerDirectory, 'package.json'), JSON.stringify({
      name: 'inkspan-reference-browser-consumer',
      private: true,
      type: 'module',
      packageManager: packageMetadata.packageManager,
      dependencies: {
        [packageMetadata.name]: `file:${tarballPath}`,
        react: packageMetadata.devDependencies.react,
        'react-dom': packageMetadata.devDependencies['react-dom'],
      },
    }));
    run('pnpm', ['install', '--prefer-offline', '--ignore-scripts', '--no-frozen-lockfile'], { cwd: consumerDirectory });
    const extractedDirectory = realpathSync(join(consumerDirectory, 'node_modules', ...packageMetadata.name.split('/')));
    assert.ok(extractedDirectory.startsWith(`${realpathSync(consumerDirectory)}${sep}`), 'Installed package escaped the isolated consumer.');

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
      '--reporter=json',
      ...specs,
      ...projects.flatMap((project) => ['--project', project]),
    ];
    const browserReportPath = join(temporaryRoot, 'browser-report.json');
    run('pnpm', playwrightArgs, {
      env: {
        ...process.env,
        INKSPAN_BROWSER_PACKAGE_ENTRY: packageEntry,
        PLAYWRIGHT_JSON_OUTPUT_FILE: browserReportPath,
      },
      timeout: 300_000,
    });
    const browserReport = JSON.parse(readFileSync(browserReportPath, 'utf8'));
    assert.deepEqual(browserReport.errors, []);
    assert.ok(browserReport.stats.expected > 0, 'No browser journeys passed.');
    for (const outcome of ['unexpected', 'skipped', 'flaky']) {
      assert.equal(browserReport.stats[outcome], 0, `Browser journeys included ${outcome} tests.`);
    }

    writeJson({
      contractVersion: 1,
      packageAuthority: 'exact-packed-tarball',
      packageSha256,
      installedDependencyClosure: true,
      projects: projects.length,
      specs: specs.length,
      tests: browserReport.stats,
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
