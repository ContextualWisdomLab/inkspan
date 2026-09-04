import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);
const packageJson = JSON.parse(
  readFileSync(join(repositoryRoot, 'package.json'), 'utf8'),
);
const packageName = packageJson.name;
const verificationDirectory = mkdtempSync(
  join(tmpdir(), 'inkspan-package-verification-'),
);
const consumerDirectory = join(verificationDirectory, 'consumer');
const packedPackageDirectory = join(
  consumerDirectory,
  'node_modules',
  ...packageName.split('/'),
);

/** Execute a command from the repository root with inherited diagnostics. */
function run(command, argumentsList, options = {}) {
  return execFileSync(command, argumentsList, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    ...options,
  });
}

/** Match a package export target without constructing executable regex input. */
function matchesExportTarget(target, filePath) {
  const normalizedTarget = target.startsWith('./') ? target.slice(2) : target;
  const targetSegments = normalizedTarget.split('*');
  if (targetSegments.length === 1) return filePath === normalizedTarget;
  if (!filePath.startsWith(targetSegments[0])) return false;

  let searchOffset = targetSegments[0].length;
  for (const segment of targetSegments.slice(1, -1)) {
    const segmentOffset = filePath.indexOf(segment, searchOffset);
    if (segmentOffset < 0) return false;
    searchOffset = segmentOffset + segment.length;
  }

  const finalSegment = targetSegments.at(-1) ?? '';
  return (
    filePath.length >= searchOffset + finalSegment.length &&
    filePath.endsWith(finalSegment)
  );
}

/** Recursively collect file targets from package export conditions. */
function collectExportTargets(value, targets = []) {
  if (typeof value === 'string') {
    if (value.startsWith('./')) targets.push(value);
    return targets;
  }
  if (value && typeof value === 'object') {
    for (const nestedValue of Object.values(value)) {
      collectExportTargets(nestedValue, targets);
    }
  }
  return targets;
}

/** Assert that every public package target is present in the npm tarball. */
function verifyPackedFiles(filePaths) {
  const requiredFiles = [
    'package.json',
    'README.md',
    'LICENSE',
    'dist/cwl-editor.js',
    'dist/cwl-editor.cjs',
    'dist/cwl-editor.css',
    'dist/index.d.ts',
    'dist/cwl-autosave.js',
    'dist/cwl-autosave.cjs',
    'dist/autosave/index.d.ts',
    'dist/cwl-collaboration.js',
    'dist/cwl-collaboration.cjs',
    'dist/collaboration/index.d.ts',
    'dist/cwl-converter.js',
    'dist/cwl-converter.cjs',
    'dist/converter/index.d.ts',
    'dist/cwl-revision-evidence.js',
    'dist/cwl-revision-evidence.cjs',
    'dist/revision-evidence/index.d.ts',
    'src/fonts/fonts.css',
    'src/fonts/fonts-latin.css',
  ];
  for (const requiredFile of requiredFiles) {
    assert.ok(
      filePaths.has(requiredFile),
      `npm package is missing required file: ${requiredFile}`,
    );
  }

  const publicTargets = [
    packageJson.main,
    packageJson.module,
    packageJson.types,
    ...collectExportTargets(packageJson.exports),
  ].filter(Boolean);
  for (const target of publicTargets) {
    assert.ok(
      [...filePaths].some((filePath) => matchesExportTarget(target, filePath)),
      `npm package export target is absent: ${target}`,
    );
  }

  const forbiddenPaths = [...filePaths].filter(
    (filePath) =>
      /(?:^|\/)(?:coverage|demo|office|\.github)(?:\/|$)/u.test(filePath) ||
      /\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(filePath) ||
      (filePath.startsWith('src/') && !filePath.startsWith('src/fonts/')),
  );
  assert.deepEqual(
    forbiddenPaths,
    [],
    `npm package contains development-only files: ${forbiddenPaths.join(', ')}`,
  );
}

/** Write and execute an ESM or CommonJS package-consumer smoke test. */
function runConsumerSmokeTest(fileName, source) {
  const smokeTestPath = join(consumerDirectory, fileName);
  writeFileSync(smokeTestPath, source, 'utf8');
  run(process.execPath, [smokeTestPath], { cwd: consumerDirectory });
}

/** Compile a strict TypeScript consumer against the packed public declarations. */
function verifyConsumerTypes() {
  const consumerTypePath = join(consumerDirectory, 'consumer-types.ts');
  writeFileSync(
    consumerTypePath,
    `import {
  createDocumentEnvelopeRevision,
  DocumentEnvelopeRestoreError,
  markdownToHtml,
  restoreDocumentEnvelopeBytesIfMatch,
  restoreDocumentEnvelopeIfMatch,
  validateSafeLinkHref,
  type CwlEditorDocumentChangeEvent,
  type CwlEditorDocumentEnvelope,
  type CwlEditorDocumentRevision,
  type CwlEditorDocumentSnapshot,
  type CwlEditorFormResetEvent,
  type CwlEditorHandle,
  type CwlEditorIfMatchRestoreResult,
  type CwlEditorProps,
  type CwlEditorSelectionEvent,
  type CwlEditorSelectionSnapshot,
  type DocumentEnvelopeDigestProvider,
} from '${packageName}';
import {
  createDocumentAutosaveQueue,
  type DocumentAutosaveRequestOutcome,
} from '${packageName}/autosave';
import {
  assertCollaborationConfiguration,
  type CollaborationUser,
} from '${packageName}/collaboration';
import {
  bytesToDataUri,
  type EncodeOptions,
} from '${packageName}/converter';
import type {
  CwlEditorDocumentRevisionEvidence,
} from '${packageName}/revision-evidence';

const renderMarkdown: (markdown: string) => string = markdownToHtml;
const safeHref: string = validateSafeLinkHref('/documents/current');
const collaborationGuard = assertCollaborationConfiguration;
const conditionalObjectRestore = restoreDocumentEnvelopeIfMatch;
const conditionalByteRestore = restoreDocumentEnvelopeBytesIfMatch;
const restoreError: Error = new DocumentEnvelopeRestoreError();
const encodeOptions: EncodeOptions = { mimeType: 'application/octet-stream' };
const dataUri: string = bytesToDataUri(new Uint8Array([1]), encodeOptions);
type EditorDestroyCallback = NonNullable<CwlEditorProps['onDestroy']>;
type EditorDocumentChangeCallback = NonNullable<
  CwlEditorProps['onDocumentChange']
>;
declare const editorHandle: CwlEditorHandle;
declare const documentChangeEvent: CwlEditorDocumentChangeEvent;
declare const documentSnapshot: CwlEditorDocumentSnapshot;
declare const resetEvent: CwlEditorFormResetEvent;
declare const selectionEvent: CwlEditorSelectionEvent;
declare const selectionSnapshot: CwlEditorSelectionSnapshot;
declare const destroyCallback: EditorDestroyCallback;
declare const documentChangeCallback: EditorDocumentChangeCallback;
declare const collaborationUser: CollaborationUser;
declare const digestProvider: DocumentEnvelopeDigestProvider;
declare const revisionEvidence: CwlEditorDocumentRevisionEvidence;
const expectedStrongEntityTag = '"sha256-' + '0'.repeat(64) + '"';
const currentSnapshot: CwlEditorDocumentSnapshot = editorHandle.getSnapshot();
const currentRevision: Promise<CwlEditorDocumentRevision | null> =
  editorHandle.getDocumentEnvelopeRevision(undefined, digestProvider);
const conditionalRestore: Promise<CwlEditorIfMatchRestoreResult | null> =
  editorHandle.restoreDocumentEnvelopeIfMatch(
    expectedStrongEntityTag,
    {
      schemaId: 'https://inkspan.io/schemas/document-envelope/v1',
      schemaVersion: 1,
      documentJson: { type: 'doc' },
    },
    undefined,
    digestProvider,
  );
const conditionalEvidence: Promise<void> = conditionalRestore.then((result) => {
  if (result === null) return;
  if (result.status === 'restored') {
    const previousRevision: CwlEditorDocumentRevision =
      result.previousRevision;
    const previousEnvelope: CwlEditorDocumentEnvelope =
      result.previousEnvelope;
    const revision: CwlEditorDocumentRevision = result.revision;
    const envelope: CwlEditorDocumentEnvelope = result.envelope;
    void [
      previousRevision.strongEntityTag,
      previousEnvelope.documentJson,
      revision.strongEntityTag,
      envelope.documentJson,
    ];
    return;
  }
  if (result.currentRevision === null) {
    const currentEnvelope: null = result.currentEnvelope;
    void currentEnvelope;
    return;
  }
  const currentEnvelope: CwlEditorDocumentEnvelope = result.currentEnvelope;
  void currentEnvelope.documentJson;
});
const conditionalByteRestoreResult: Promise<
  CwlEditorIfMatchRestoreResult | null
> = editorHandle.restoreDocumentEnvelopeBytesIfMatch(
  expectedStrongEntityTag,
  new Uint8Array(),
  undefined,
  digestProvider,
);
const standaloneRevision: Promise<CwlEditorDocumentRevision> =
  createDocumentEnvelopeRevision(
    {
      schemaId: 'https://inkspan.io/schemas/document-envelope/v1',
      schemaVersion: 1,
      documentJson: { type: 'doc' },
    },
    undefined,
    digestProvider,
  );
const autosaveQueue = createDocumentAutosaveQueue({
  save: async () => ({ status: 'saved' }),
});
const autosaveOutcome: Promise<DocumentAutosaveRequestOutcome> =
  autosaveQueue.enqueue(revisionEvidence);
void [
  renderMarkdown,
  safeHref,
  collaborationGuard,
  conditionalObjectRestore,
  conditionalByteRestore,
  restoreError,
  dataUri,
  editorHandle,
  documentChangeEvent,
  documentSnapshot,
  currentSnapshot,
  currentRevision,
  conditionalRestore,
  conditionalEvidence,
  conditionalByteRestoreResult,
  standaloneRevision,
  autosaveQueue,
  autosaveOutcome,
  resetEvent,
  selectionEvent,
  selectionSnapshot,
  destroyCallback,
  documentChangeCallback,
  collaborationUser,
];
`,
    'utf8',
  );

  run('pnpm', [
    'exec',
    'tsc',
    '--noEmit',
    '--strict',
    '--skipLibCheck',
    'false',
    '--module',
    'NodeNext',
    '--moduleResolution',
    'NodeNext',
    '--target',
    'ES2022',
    '--lib',
    'ES2022,DOM,DOM.Iterable',
    consumerTypePath,
  ]);
}

try {
  symlinkSync(
    join(repositoryRoot, 'node_modules'),
    join(verificationDirectory, 'node_modules'),
    'dir',
  );

  const packOutput = run('npm', [
    'pack',
    '--json',
    '--ignore-scripts',
    '--pack-destination',
    verificationDirectory,
  ]);
  const packResults = JSON.parse(packOutput);
  assert.equal(packResults.length, 1, 'npm pack must produce exactly one package');
  const [packResult] = packResults;
  assert.equal(packResult.name, packageName);
  assert.equal(packResult.version, packageJson.version);
  assert.equal(
    packResult.filename,
    basename(packResult.filename),
    'npm pack filename must not contain path components',
  );
  const packageArchivePath = join(verificationDirectory, packResult.filename);
  assert.ok(existsSync(packageArchivePath), 'npm pack archive was not created');
  const packedFiles = new Set(packResult.files.map(({ path }) => path));
  verifyPackedFiles(packedFiles);

  mkdirSync(packedPackageDirectory, { recursive: true });
  run('tar', [
    '-xzf',
    packageArchivePath,
    '--strip-components=1',
    '-C',
    packedPackageDirectory,
  ]);
  const extractedPackageJson = JSON.parse(
    readFileSync(join(packedPackageDirectory, 'package.json'), 'utf8'),
  );
  assert.equal(extractedPackageJson.name, packageName);
  assert.equal(extractedPackageJson.version, packageJson.version);

  writeFileSync(
    join(consumerDirectory, 'package.json'),
    `${JSON.stringify(
      {
        name: 'inkspan-package-verification-consumer',
        private: true,
        type: 'module',
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  runConsumerSmokeTest(
    'consumer-esm.mjs',
    `import assert from 'node:assert/strict';
import { realpathSync } from 'node:fs';
import { isAbsolute, join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const packedPackageRoot = realpathSync(
  join(process.cwd(), 'node_modules', ...'${packageName}'.split('/')),
);
function assertResolvedInsidePackedPackage(resolved, message) {
  const resolvedPath = realpathSync(fileURLToPath(resolved));
  const relativePath = relative(packedPackageRoot, resolvedPath);
  assert.ok(
    relativePath !== '' &&
      relativePath !== '..' &&
      !relativePath.startsWith('..' + sep) &&
      !isAbsolute(relativePath),
    message,
  );
  return resolvedPath;
}
const rootEntrypoint = assertResolvedInsidePackedPackage(
  import.meta.resolve('${packageName}'),
  'ESM root package must resolve from isolated consumer node_modules',
);
const autosaveEntrypoint = assertResolvedInsidePackedPackage(
  import.meta.resolve('${packageName}/autosave'),
  'ESM autosave package must resolve from isolated consumer node_modules',
);
const collaborationEntrypoint = assertResolvedInsidePackedPackage(
  import.meta.resolve('${packageName}/collaboration'),
  'ESM collaboration package must resolve from isolated consumer node_modules',
);
const converterEntrypoint = assertResolvedInsidePackedPackage(
  import.meta.resolve('${packageName}/converter'),
  'ESM converter package must resolve from isolated consumer node_modules',
);
const editor = await import(pathToFileURL(rootEntrypoint).href);
const autosave = await import(pathToFileURL(autosaveEntrypoint).href);
const collaboration = await import(
  pathToFileURL(collaborationEntrypoint).href
);
const converter = await import(pathToFileURL(converterEntrypoint).href);
assert.equal(typeof editor.markdownToHtml, 'function');
assert.equal(editor.validateSafeLinkHref('/documents/current'), '/documents/current');
assert.equal(typeof editor.restoreDocumentEnvelopeIfMatch, 'function');
assert.equal(typeof editor.restoreDocumentEnvelopeBytesIfMatch, 'function');
assert.equal(typeof editor.DocumentEnvelopeRestoreError, 'function');
assert.ok(editor.CwlEditor);
assert.equal(typeof autosave.createDocumentAutosaveQueue, 'function');
assert.equal(typeof autosave.DocumentAutosaveQueueError, 'function');
assert.equal(typeof collaboration.assertCollaborationConfiguration, 'function');
assert.ok(collaboration.CollaborativeCwlEditor);
assert.equal(typeof converter.bytesToDataUri, 'function');
for (const subpath of ['styles.css', 'fonts.css', 'fonts-latin.css']) {
  const resolved = import.meta.resolve('${packageName}/' + subpath);
  assert.ok(resolved.startsWith('file:'));
  assertResolvedInsidePackedPackage(
    resolved,
    'ESM subpath must resolve from isolated consumer node_modules',
  );
}
`,
  );

  runConsumerSmokeTest(
    'consumer-commonjs.cjs',
    `const assert = require('node:assert/strict');
const { realpathSync } = require('node:fs');
const { isAbsolute, join, relative, sep } = require('node:path');

const packedPackageRoot = realpathSync(
  join(process.cwd(), 'node_modules', ...'${packageName}'.split('/')),
);
function assertResolvedInsidePackedPackage(resolved, message) {
  const resolvedPath = realpathSync(resolved);
  const relativePath = relative(packedPackageRoot, resolvedPath);
  assert.ok(
    relativePath !== '' &&
      relativePath !== '..' &&
      !relativePath.startsWith('..' + sep) &&
      !isAbsolute(relativePath),
    message,
  );
  return resolvedPath;
}
const rootEntrypoint = assertResolvedInsidePackedPackage(
  require.resolve('${packageName}'),
  'CommonJS root package must resolve from isolated consumer node_modules',
);
const autosaveEntrypoint = assertResolvedInsidePackedPackage(
  require.resolve('${packageName}/autosave'),
  'CommonJS autosave package must resolve from isolated consumer node_modules',
);
const collaborationEntrypoint = assertResolvedInsidePackedPackage(
  require.resolve('${packageName}/collaboration'),
  'CommonJS collaboration package must resolve from isolated consumer node_modules',
);
const converterEntrypoint = assertResolvedInsidePackedPackage(
  require.resolve('${packageName}/converter'),
  'CommonJS converter package must resolve from isolated consumer node_modules',
);
const editor = require(rootEntrypoint);
const autosave = require(autosaveEntrypoint);
const collaboration = require(collaborationEntrypoint);
const converter = require(converterEntrypoint);
assert.equal(typeof editor.markdownToHtml, 'function');
assert.equal(editor.validateSafeLinkHref('/documents/current'), '/documents/current');
assert.equal(typeof editor.restoreDocumentEnvelopeIfMatch, 'function');
assert.equal(typeof editor.restoreDocumentEnvelopeBytesIfMatch, 'function');
assert.equal(typeof editor.DocumentEnvelopeRestoreError, 'function');
assert.ok(editor.CwlEditor);
assert.equal(typeof autosave.createDocumentAutosaveQueue, 'function');
assert.equal(typeof autosave.DocumentAutosaveQueueError, 'function');
assert.equal(typeof collaboration.assertCollaborationConfiguration, 'function');
assert.ok(collaboration.CollaborativeCwlEditor);
assert.equal(typeof converter.bytesToDataUri, 'function');
for (const subpath of ['styles.css', 'fonts.css', 'fonts-latin.css']) {
  const resolved = require.resolve('${packageName}/' + subpath);
  assertResolvedInsidePackedPackage(
    resolved,
    'CommonJS subpath must resolve from isolated consumer node_modules',
  );
}
`,
  );

  verifyConsumerTypes();

  console.log(
    `Verified ${packageName}@${packageJson.version}: exact npm tarball contents, isolated ESM, CommonJS, SSR-safe imports, subpath exports, and TypeScript declarations.`,
  );
} finally {
  rmSync(verificationDirectory, { recursive: true, force: true });
}
