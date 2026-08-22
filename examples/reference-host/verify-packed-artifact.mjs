import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
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
  copyFileSync(
    join(repositoryRoot, 'examples/reference-host/autosave-view-model.mjs'),
    join(hostDirectory, 'autosave-view-model.mjs'),
  );
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
import { dataUriToBytes } from '${packageName}/converter';
import { markdownToHtml, markdownToPlainText } from '${packageName}/markdown';
import { createAutosaveViewModel } from './autosave-view-model.mjs';

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
assert.deepEqual(Array.from(dataUriToBytes('data:text/plain;base64,SGk=').bytes), [72, 105]);
const markdownSource = '# Packed handoff\\n\\nBuyer text';
const projectedHtml = markdownToHtml(markdownSource);
assert.equal(projectedHtml, markdownToHtml(markdownSource));
assert.match(markdownToPlainText(markdownSource), /Packed handoff/u);
assert.match(markdownToPlainText(markdownSource), /Buyer text/u);

const digestHex = '41'.repeat(32);
const evidence = Object.freeze({
  envelope: Object.freeze({
    schemaId: 'https://inkspan.io/schemas/document-envelope/v1',
    schemaVersion: 1,
    documentJson: Object.freeze({ type: 'doc' }),
  }),
  revision: Object.freeze({
    algorithm: 'SHA-256',
    digestHex,
    strongEntityTag: \`"sha256-\${digestHex}"\`,
  }),
});
const autosaveViewModel = createAutosaveViewModel();
const autosaveViewStates = [];
const autosaveQueue = createDocumentAutosaveQueue({
  save() {
    return { status: 'saved' };
  },
  onSnapshotChange(snapshot) {
    autosaveViewStates.push(autosaveViewModel.observe(snapshot).viewState);
  },
});
assert.equal(autosaveViewModel.observe(autosaveQueue.getSnapshot()).viewState, 'clean');
const autosaveOutcome = await autosaveQueue.enqueue(evidence);
await autosaveQueue.flush();
await Promise.resolve();
assert.equal(autosaveOutcome.status, 'saved');
assert.ok(autosaveViewStates.includes('saving'));
assert.equal(autosaveViewStates.at(-1), 'clean');
assert.equal((await autosaveQueue.close()).state, 'closed');

const rootEntry = import.meta.resolve('${packageName}');
const autosaveEntry = import.meta.resolve('${packageName}/autosave');
const converterEntry = import.meta.resolve('${packageName}/converter');
const markdownEntry = import.meta.resolve('${packageName}/markdown');
const styleEntry = import.meta.resolve('${packageName}/styles.css');
const fullFontEntry = import.meta.resolve('${packageName}/fonts.css');
const latinFontEntry = import.meta.resolve('${packageName}/fonts-latin.css');
for (const entry of [
  rootEntry,
  autosaveEntry,
  converterEntry,
  markdownEntry,
  styleEntry,
  fullFontEntry,
  latinFontEntry,
]) {
  assert.ok(entry.startsWith('file:'), 'Packed package export did not resolve to a file URL.');
}

process.stdout.write(JSON.stringify({
  serverRenderedNamedField: true,
  autosaveObserverWired: true,
  converterRoundTrip: true,
  markdownProjection: true,
  rootEntry,
  autosaveEntry,
  converterEntry,
  markdownEntry,
  styleEntry,
  fullFontEntry,
  latinFontEntry,
}));
`,
    'utf8',
  );

  const consumerResult = JSON.parse(run(process.execPath, [consumerPath], hostDirectory));

  const commonJsConsumerPath = join(hostDirectory, 'consumer.cjs');
  writeFileSync(
    commonJsConsumerPath,
    `const assert = require('node:assert/strict');
const React = require('react');
const { renderToString } = require('react-dom/server');
const { CwlEditor } = require('${packageName}');
const { createDocumentAutosaveQueue } = require('${packageName}/autosave');
const { dataUriToBytes } = require('${packageName}/converter');
const { markdownToHtml, markdownToPlainText } = require('${packageName}/markdown');

const serverHtml = renderToString(
  React.createElement(CwlEditor, {
    mode: 'markdown',
    defaultValue: '# Packed CommonJS draft',
    formFieldName: 'message_body',
    hideToolbar: true,
  }),
);
assert.match(serverHtml, /name="message_body"/u);
assert.match(serverHtml, /value="# Packed CommonJS draft"/u);
assert.equal(typeof createDocumentAutosaveQueue, 'function');
assert.deepEqual(Array.from(dataUriToBytes('data:text/plain;base64,T0s=').bytes), [79, 75]);
const markdownSource = '# Packed CommonJS handoff\\n\\nBuyer text';
const projectedHtml = markdownToHtml(markdownSource);
assert.equal(projectedHtml, markdownToHtml(markdownSource));
assert.match(markdownToPlainText(markdownSource), /Packed CommonJS handoff/u);
assert.match(markdownToPlainText(markdownSource), /Buyer text/u);

process.stdout.write(JSON.stringify({
  serverRenderedNamedField: true,
  converterRoundTrip: true,
  markdownProjection: true,
  rootEntry: require.resolve('${packageName}'),
  autosaveEntry: require.resolve('${packageName}/autosave'),
  converterEntry: require.resolve('${packageName}/converter'),
  markdownEntry: require.resolve('${packageName}/markdown'),
}));
`,
    'utf8',
  );

  const commonJsConsumerResult = JSON.parse(
    run(process.execPath, [commonJsConsumerPath], hostDirectory),
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
    'Installed package escaped the isolated host node_modules tree.',
  );

  const executableEntries = [
    ['ESM root', fileURLToPath(consumerResult.rootEntry)],
    ['ESM autosave', fileURLToPath(consumerResult.autosaveEntry)],
    ['ESM converter', fileURLToPath(consumerResult.converterEntry)],
    ['ESM markdown', fileURLToPath(consumerResult.markdownEntry)],
    ['CommonJS root', commonJsConsumerResult.rootEntry],
    ['CommonJS autosave', commonJsConsumerResult.autosaveEntry],
    ['CommonJS converter', commonJsConsumerResult.converterEntry],
    ['CommonJS markdown', commonJsConsumerResult.markdownEntry],
  ];
  for (const [label, entry] of executableEntries) {
    assert.equal(
      isContained(installedPackageDirectory, entry),
      true,
      `${label} import escaped the installed packed package.`,
    );
    assert.equal(
      relative(realpathSync(installedPackageDirectory), realpathSync(entry)).startsWith(
        `dist${sep}`,
      ),
      true,
      `${label} executable import did not resolve through packed dist/.`,
    );
  }

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

  const sourceImportDetected = executableEntries.some(([, entry]) =>
    relative(realpathSync(installedPackageDirectory), realpathSync(entry)).startsWith(
      `src${sep}`,
    ),
  );
  assert.equal(
    sourceImportDetected,
    false,
    'Packed consumer unexpectedly resolved an executable import through source files.',
  );

  const esmServerRenderedNamedField = consumerResult.serverRenderedNamedField === true;
  const commonJsServerRenderedNamedField =
    commonJsConsumerResult.serverRenderedNamedField === true;

  process.stdout.write(
    `${JSON.stringify({
      packageName,
      packageVersion,
      installedFromTarball: true,
      consumerInstallCompleted: true,
      // Preserve the established verifier receipt while extending it with
      // format-specific evidence below.
      serverRenderedNamedField: esmServerRenderedNamedField,
      esmServerRenderedNamedField,
      commonJsServerRenderedNamedField,
      autosaveObserverWired: consumerResult.autosaveObserverWired === true,
      esmConverterRoundTrip: consumerResult.converterRoundTrip === true,
      commonJsConverterRoundTrip: commonJsConsumerResult.converterRoundTrip === true,
      esmMarkdownProjection: consumerResult.markdownProjection === true,
      commonJsMarkdownProjection: commonJsConsumerResult.markdownProjection === true,
      publicAssetEntriesContained,
      executableEntriesContained: true,
      sourceImportDetected,
    })}\n`,
  );
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
