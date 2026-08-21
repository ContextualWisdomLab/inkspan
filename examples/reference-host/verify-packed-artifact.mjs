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

const temporaryRoot = mkdtempSync(join(tmpdir(), 'inkspan-reference-host-'));

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
        name: 'inkspan-reference-host-packed-consumer',
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

  // A published library consumer resolves the dependency ranges declared in the
  // packed manifest. Prefer the clean-checkout store, but permit the package
  // manager to fetch a transitive version that is valid for the packed consumer
  // even when that version is not present in Inkspan's development lockfile.
  run(
    'pnpm',
    ['install', '--prefer-offline', '--ignore-scripts', '--no-frozen-lockfile'],
    hostDirectory,
  );

  const consumerPath = join(hostDirectory, 'consumer.mjs');
  writeFileSync(
    consumerPath,
    `import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { CwlEditor } from '${packageName}';
import { createDocumentAutosaveQueue } from '${packageName}/autosave';

const serverHtml = renderToString(
  React.createElement(CwlEditor, {
    mode: 'markdown',
    defaultValue: '# Packed draft',
    formFieldName: 'message_body',
    hideToolbar: true,
  }),
);
assert.match(serverHtml, /name="message_body"/u);
assert.match(serverHtml, /value="# Packed draft"/u);
assert.equal(typeof createDocumentAutosaveQueue, 'function');

const rootEntry = import.meta.resolve('${packageName}');
const styleEntry = import.meta.resolve('${packageName}/styles.css');
const fullFontEntry = import.meta.resolve('${packageName}/fonts.css');
const latinFontEntry = import.meta.resolve('${packageName}/fonts-latin.css');
for (const entry of [rootEntry, styleEntry, fullFontEntry, latinFontEntry]) {
  assert.ok(entry.startsWith('file:'), 'Packed package export did not resolve to a file URL.');
}

process.stdout.write(JSON.stringify({
  serverRenderedNamedField: true,
  rootEntry,
  styleEntry,
  fullFontEntry,
  latinFontEntry,
}));
`,
    'utf8',
  );

  const consumerResult = JSON.parse(run(process.execPath, [consumerPath], hostDirectory));
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
    'Installed package escaped the isolated host node_modules tree.',
  );

  const resolvedRootPath = fileURLToPath(consumerResult.rootEntry);
  assert.equal(
    isContained(installedPackageDirectory, resolvedRootPath),
    true,
    'Consumer root import did not resolve through the packed host installation.',
  );

  const publicAssetEntries = [
    ['stylesheet', consumerResult.styleEntry],
    ['full font stylesheet', consumerResult.fullFontEntry],
    ['Latin font stylesheet', consumerResult.latinFontEntry],
  ];
  for (const [label, entry] of publicAssetEntries) {
    assert.equal(
      isContained(installedPackageDirectory, fileURLToPath(entry)),
      true,
      `${label} export escaped the installed packed package.`,
    );
  }
  const publicAssetEntriesContained = true;

  const sourceImportDetected = !relative(
    realpathSync(installedPackageDirectory),
    realpathSync(resolvedRootPath),
  ).startsWith(`dist${sep}`);
  assert.equal(
    sourceImportDetected,
    false,
    'Packed consumer unexpectedly resolved the executable root import outside dist/.',
  );

  process.stdout.write(
    `${JSON.stringify({
      packageName,
      packageVersion,
      installedFromTarball: true,
      consumerInstallCompleted: true,
      serverRenderedNamedField: consumerResult.serverRenderedNamedField === true,
      publicAssetEntriesContained,
      sourceImportDetected,
    })}\n`,
  );
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
