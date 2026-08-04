import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(
  readFileSync(join(repositoryRoot, 'package.json'), 'utf8'),
);
const packageName = packageJson.name;
const verificationDirectory = mkdtempSync(
  join(repositoryRoot, '.package-verification-'),
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
    'dist/cwl-collaboration.js',
    'dist/cwl-collaboration.cjs',
    'dist/collaboration/index.d.ts',
    'dist/cwl-converter.js',
    'dist/cwl-converter.cjs',
    'dist/converter/index.d.ts',
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
  const smokeTestPath = join(verificationDirectory, fileName);
  writeFileSync(smokeTestPath, source, 'utf8');
  run(process.execPath, [smokeTestPath]);
}

/** Compile a strict TypeScript consumer against the packed public declarations. */
function verifyConsumerTypes() {
  const consumerTypePath = join(verificationDirectory, 'consumer-types.ts');
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
  assertCollaborationConfiguration,
  type CollaborationUser,
} from '${packageName}/collaboration';
import {
  bytesToDataUri,
  type EncodeOptions,
} from '${packageName}/converter';

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
  conditionalByteRestoreResult,
  standaloneRevision,
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
  const packOutput = run('npm', [
    'pack',
    '--dry-run',
    '--json',
    '--ignore-scripts',
  ]);
  const packResult = JSON.parse(packOutput)[0];
  assert.equal(packResult.name, packageName);
  assert.equal(packResult.version, packageJson.version);
  const packedFiles = new Set(packResult.files.map(({ path }) => path));
  verifyPackedFiles(packedFiles);

  runConsumerSmokeTest(
    'consumer-esm.mjs',
    `import assert from 'node:assert/strict';
import * as editor from '${packageName}';
import * as collaboration from '${packageName}/collaboration';
import * as converter from '${packageName}/converter';

assert.equal(typeof editor.markdownToHtml, 'function');
assert.equal(editor.validateSafeLinkHref('/documents/current'), '/documents/current');
assert.equal(typeof editor.restoreDocumentEnvelopeIfMatch, 'function');
assert.equal(typeof editor.restoreDocumentEnvelopeBytesIfMatch, 'function');
assert.equal(typeof editor.DocumentEnvelopeRestoreError, 'function');
assert.ok(editor.CwlEditor);
assert.equal(typeof collaboration.assertCollaborationConfiguration, 'function');
assert.ok(collaboration.CollaborativeCwlEditor);
assert.equal(typeof converter.bytesToDataUri, 'function');
for (const subpath of ['styles.css', 'fonts.css', 'fonts-latin.css']) {
  const resolved = import.meta.resolve('${packageName}/' + subpath);
  assert.ok(resolved.startsWith('file:'));
}
`,
  );

  runConsumerSmokeTest(
    'consumer-commonjs.cjs',
    `const assert = require('node:assert/strict');
const editor = require('${packageName}');
const collaboration = require('${packageName}/collaboration');
const converter = require('${packageName}/converter');

assert.equal(typeof editor.markdownToHtml, 'function');
assert.equal(editor.validateSafeLinkHref('/documents/current'), '/documents/current');
assert.equal(typeof editor.restoreDocumentEnvelopeIfMatch, 'function');
assert.equal(typeof editor.restoreDocumentEnvelopeBytesIfMatch, 'function');
assert.equal(typeof editor.DocumentEnvelopeRestoreError, 'function');
assert.ok(editor.CwlEditor);
assert.equal(typeof collaboration.assertCollaborationConfiguration, 'function');
assert.ok(collaboration.CollaborativeCwlEditor);
assert.equal(typeof converter.bytesToDataUri, 'function');
for (const subpath of ['styles.css', 'fonts.css', 'fonts-latin.css']) {
  const resolved = require.resolve('${packageName}/' + subpath);
  assert.ok(resolved.length > 0);
}
`,
  );

  verifyConsumerTypes();

  for (const subpath of ['styles.css', 'fonts.css', 'fonts-latin.css']) {
    const resolvedPath = fileURLToPath(
      import.meta.resolve(`${packageName}/${subpath}`),
    );
    assert.ok(existsSync(resolvedPath), `Export does not exist: ${subpath}`);
  }

  console.log(
    `Verified ${packageName}@${packageJson.version}: npm contents, ESM, CommonJS, SSR-safe imports, subpath exports, and TypeScript declarations.`,
  );
} finally {
  rmSync(verificationDirectory, { recursive: true, force: true });
}
