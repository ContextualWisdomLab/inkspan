import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'vite';

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);
const packageMetadata = JSON.parse(
  readFileSync(join(repositoryRoot, 'package.json'), 'utf8'),
);
const packageName = packageMetadata.name;
const packageVersion = packageMetadata.version;

function run(command, argumentsList, cwd) {
  return execFileSync(command, argumentsList, {
    cwd,
    encoding: 'utf8',
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function isContained(parentPath, childPath) {
  const relation = relative(realpathSync(parentPath), realpathSync(childPath));
  return relation === '' || (!relation.startsWith(`..${sep}`) && relation !== '..');
}

const requestedMode = process.argv.slice(2);
assert.equal(
  requestedMode.length === 0 ||
    (requestedMode.length === 1 && requestedMode[0] === '--self-test'),
  true,
  'Expected no arguments or --self-test.',
);

const temporaryRoot = mkdtempSync(join(tmpdir(), 'inkspan-reference-host-app-ssr-'));

try {
  run('pnpm', ['build'], repositoryRoot);

  const packDirectory = join(temporaryRoot, 'pack');
  mkdirSync(packDirectory, { recursive: true });
  run('pnpm', ['pack', '--pack-destination', packDirectory], repositoryRoot);

  const tarballs = readdirSync(packDirectory).filter((name) => name.endsWith('.tgz'));
  assert.equal(tarballs.length, 1, 'Expected exactly one packed Inkspan tarball.');
  const tarballPath = join(packDirectory, tarballs[0]);

  const hostDirectory = join(temporaryRoot, 'host');
  mkdirSync(hostDirectory, { recursive: true });
  writeFileSync(
    join(hostDirectory, 'package.json'),
    `${JSON.stringify(
      {
        name: 'inkspan-reference-host-app-ssr-consumer',
        private: true,
        type: 'module',
        packageManager: packageMetadata.packageManager,
        dependencies: {
          [packageName]: `file:${tarballPath}`,
          react: packageMetadata.devDependencies.react,
          'react-dom': packageMetadata.devDependencies['react-dom'],
        },
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  run(
    'pnpm',
    ['install', '--prefer-offline', '--ignore-scripts', '--no-frozen-lockfile'],
    hostDirectory,
  );

  const installedPackageDirectory = join(
    hostDirectory,
    'node_modules',
    ...packageName.split('/'),
  );
  const installedMetadata = JSON.parse(
    readFileSync(join(installedPackageDirectory, 'package.json'), 'utf8'),
  );
  assert.equal(installedMetadata.name, packageName);
  assert.equal(installedMetadata.version, packageVersion);
  assert.equal(
    isContained(join(hostDirectory, 'node_modules'), installedPackageDirectory),
    true,
    'Installed application dependency escaped the isolated consumer.',
  );

  const packedEntry = join(installedPackageDirectory, 'dist', 'cwl-editor.js');
  assert.equal(
    relative(realpathSync(installedPackageDirectory), realpathSync(packedEntry)).startsWith(
      `dist${sep}`,
    ),
    true,
    'Installed application dependency did not resolve through packed dist/.',
  );

  const applicationEntry = join(hostDirectory, 'application-ssr.tsx');
  const referenceHostApplication = join(
    repositoryRoot,
    'examples',
    'reference-host',
    'reference-host-app.tsx',
  );
  writeFileSync(
    applicationEntry,
    `import React from 'react';
import { renderToString } from 'react-dom/server';
import { ReferenceHostApp } from ${JSON.stringify(referenceHostApplication)};

const loadingLabel = 'Loading exact-packed Inkspan editor';
const serverHtml = renderToString(
  React.createElement(ReferenceHostApp, {
    loadingLabel,
    onAuthorizedSubmit() {
      throw new Error('Host submit authority must not execute during server rendering.');
    },
  }),
);

const applicationServerRendered =
  serverHtml.includes('<main') &&
  serverHtml.includes('Inkspan reference host') &&
  serverHtml.includes('aria-labelledby="reference-host-heading"');
const clientEditorDeferred =
  serverHtml.includes('aria-busy="true"') &&
  serverHtml.includes(loadingLabel) &&
  !serverHtml.includes('name="message_body"');

if (!applicationServerRendered) {
  throw new Error('Reference-host application shell did not server-render deterministically.');
}
if (!clientEditorDeferred) {
  throw new Error('Reference-host client editor crossed the server hydration boundary.');
}

process.stdout.write(JSON.stringify({
  applicationServerRendered,
  clientEditorDeferred,
}));
`,
    'utf8',
  );

  const outputDirectory = join(hostDirectory, 'ssr-build');
  await build({
    root: hostDirectory,
    configFile: false,
    logLevel: 'silent',
    resolve: {
      alias: [
        { find: packageName, replacement: packedEntry },
        { find: 'react', replacement: join(hostDirectory, 'node_modules', 'react') },
        {
          find: 'react-dom',
          replacement: join(hostDirectory, 'node_modules', 'react-dom'),
        },
      ],
    },
    build: {
      ssr: applicationEntry,
      outDir: outputDirectory,
      emptyOutDir: true,
      rollupOptions: {
        output: {
          entryFileNames: 'reference-host-ssr.mjs',
        },
      },
    },
    ssr: {
      noExternal: true,
    },
  });

  const applicationReceipt = JSON.parse(
    run(process.execPath, [join(outputDirectory, 'reference-host-ssr.mjs')], hostDirectory),
  );
  assert.equal(applicationReceipt.applicationServerRendered, true);
  assert.equal(applicationReceipt.clientEditorDeferred, true);

  process.stdout.write(
    `${JSON.stringify({
      packageName,
      packageVersion,
      packageAuthority: 'exact-packed-tarball',
      applicationServerRendered: true,
      clientEditorDeferred: true,
    })}\n`,
  );
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
