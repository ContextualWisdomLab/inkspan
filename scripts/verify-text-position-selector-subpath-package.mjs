import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(
  readFileSync(join(repositoryRoot, 'package.json'), 'utf8'),
);
const verificationRoot = mkdtempSync(
  join(tmpdir(), 'inkspan-text-position-selector-'),
);
const extractionDirectory = join(verificationRoot, 'extracted');
const consumerDirectory = join(verificationRoot, 'consumer');
const packageDirectory = join(
  consumerDirectory,
  'node_modules',
  ...packageJson.name.split('/'),
);

// The selector bundle is intentionally self-contained. Any dynamic module-loader
// call is authority-bearing regardless of whether its argument is a string,
// template literal, identifier, or computed expression, so reject the call form
// before considering static imports and re-exports.
const dynamicLoaderPattern = /(?:\bimport\s*\(|\brequire\s*\()/u;

// Static imports and re-exports are rejected across line breaks as well. The
// emitted selector bundle should have no external runtime module dependency.
const externalRuntimeImportPattern =
  /(?:\bimport\s+(?:[^'";]*?\sfrom\s*)?['"][^'"]+['"]|\bexport\s+[^'";]*?\sfrom\s*['"][^'"]+['"])/u;

// A self-contained bundle must also remain free of ambient network and common
// environment-backed credential authority even when no module import is needed.
const ambientAuthorityPattern =
  /(?:\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|\bEventSource\b|\bprocess\.env\b|\bimport\.meta\.env\b|\bDeno\.env\b|\bBun\.env\b)/u;

/** Execute one deterministic package-consumer command. */
function run(command, argumentsList, cwd = repositoryRoot) {
  return execFileSync(command, argumentsList, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
}

/** Build one real npm tarball and install its files without executing scripts. */
function preparePackage() {
  mkdirSync(extractionDirectory, { recursive: true });
  mkdirSync(dirname(packageDirectory), { recursive: true });
  const packOutput = run('npm', [
    'pack',
    '--json',
    '--ignore-scripts',
    '--pack-destination',
    verificationRoot,
  ]);
  const packResult = JSON.parse(packOutput)[0];
  assert.equal(packResult.name, packageJson.name);
  assert.equal(packResult.version, packageJson.version);
  const tarballPath = join(verificationRoot, packResult.filename);
  assert.ok(existsSync(tarballPath));
  run('tar', ['-xzf', tarballPath, '-C', extractionDirectory]);
  renameSync(join(extractionDirectory, 'package'), packageDirectory);
  writeFileSync(
    join(consumerDirectory, 'package.json'),
    '{"name":"inkspan-text-position-selector-consumer","private":true,"type":"module"}\n',
    'utf8',
  );

  // The package declares @tiptap/pm as a normal dependency. The packed fixture is
  // extracted without a package-manager install, so expose the already-frozen
  // repository dependency only for strict declaration resolution.
  const repositoryTiptap = join(repositoryRoot, 'node_modules', '@tiptap');
  const consumerTiptap = join(consumerDirectory, 'node_modules', '@tiptap');
  assert.ok(existsSync(repositoryTiptap));
  symlinkSync(repositoryTiptap, consumerTiptap, 'dir');
}

/** Prove emitted JavaScript carries no external or ambient runtime authority. */
function verifyAuthorityFreeBundles() {
  for (const filename of [
    'cwl-text-position-selector.js',
    'cwl-text-position-selector.cjs',
  ]) {
    const bundlePath = join(packageDirectory, 'dist', filename);
    const bundleSource = readFileSync(bundlePath, 'utf8');
    assert.equal(
      dynamicLoaderPattern.test(bundleSource),
      false,
      `${filename} must not invoke dynamic module loaders`,
    );
    assert.doesNotMatch(
      bundleSource,
      externalRuntimeImportPattern,
      `${filename} must not import external runtime authority`,
    );
    assert.doesNotMatch(
      bundleSource,
      ambientAuthorityPattern,
      `${filename} must not reference ambient network or credential authority`,
    );
  }
}

/** Exercise the exact public ESM and CommonJS subpath from the packed package. */
function verifyRuntimeConsumers() {
  const esmPath = join(consumerDirectory, 'consumer.mjs');
  writeFileSync(
    esmPath,
    `import assert from 'node:assert/strict';
import {
  TEXT_POSITION_PROJECTION_ID,
  TEXT_POSITION_PROJECTION_VERSION,
  TextPositionSelectorEvidenceError,
  WritingDiagnosticProjectionError,
  buildTextProjectionMap,
  createTextPositionSelector,
  resolveTextPositionSelector,
} from '${packageJson.name}/text-position-selector';
assert.equal(TEXT_POSITION_PROJECTION_ID, 'inkspan-prosemirror-text');
assert.equal(TEXT_POSITION_PROJECTION_VERSION, 1);
assert.equal(typeof TextPositionSelectorEvidenceError, 'function');
assert.equal(typeof WritingDiagnosticProjectionError, 'function');
assert.equal(typeof buildTextProjectionMap, 'function');
assert.equal(typeof createTextPositionSelector, 'function');
assert.equal(typeof resolveTextPositionSelector, 'function');
const failure = new WritingDiagnosticProjectionError('selector');
assert.equal(failure.code, 'selector');
`,
    'utf8',
  );

  const cjsPath = join(consumerDirectory, 'consumer.cjs');
  writeFileSync(
    cjsPath,
    `const assert = require('node:assert/strict');
const selector = require('${packageJson.name}/text-position-selector');
assert.equal(selector.TEXT_POSITION_PROJECTION_ID, 'inkspan-prosemirror-text');
assert.equal(selector.TEXT_POSITION_PROJECTION_VERSION, 1);
assert.equal(typeof selector.TextPositionSelectorEvidenceError, 'function');
assert.equal(typeof selector.WritingDiagnosticProjectionError, 'function');
assert.equal(typeof selector.buildTextProjectionMap, 'function');
assert.equal(typeof selector.createTextPositionSelector, 'function');
assert.equal(typeof selector.resolveTextPositionSelector, 'function');
const failure = new selector.WritingDiagnosticProjectionError('ambiguous_boundary');
assert.equal(failure.code, 'ambiguous_boundary');
`,
    'utf8',
  );

  run(process.execPath, [esmPath], consumerDirectory);
  run(process.execPath, [cjsPath], consumerDirectory);
}

/** Compile one strict TypeScript consumer against only the public subpath. */
function verifyDeclarationConsumer() {
  const sourcePath = join(consumerDirectory, 'consumer.ts');
  const configurationPath = join(consumerDirectory, 'tsconfig.json');
  writeFileSync(
    sourcePath,
    `import {
  TEXT_POSITION_PROJECTION_ID,
  TEXT_POSITION_PROJECTION_VERSION,
  TextPositionSelectorEvidenceError,
  WritingDiagnosticProjectionError,
  buildTextProjectionMap,
  createTextPositionSelector,
  resolveTextPositionSelector,
  type CwlEditorTextPositionSelector,
  type CwlEditorTextProjectionIdentity,
  type CwlWritingDiagnosticTextProjectionMap,
  type TextPositionSelectorEvidenceErrorCode,
  type WritingDiagnosticProjectionErrorCode,
} from '${packageJson.name}/text-position-selector';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { Selection } from '@tiptap/pm/state';
declare const documentNode: ProseMirrorNode;
declare const selection: Selection;
const forward = createTextPositionSelector(documentNode, selection);
const selector: CwlEditorTextPositionSelector = forward.selector;
const projection: CwlEditorTextProjectionIdentity = forward.textProjection;
const map: CwlWritingDiagnosticTextProjectionMap = buildTextProjectionMap(documentNode);
const resolved = resolveTextPositionSelector(documentNode, selector, projection);
const evidenceCode: TextPositionSelectorEvidenceErrorCode = 'segmenter_unavailable';
const projectionCode: WritingDiagnosticProjectionErrorCode = 'ambiguous_boundary';
const evidenceFailure = new TextPositionSelectorEvidenceError(evidenceCode);
const projectionFailure = new WritingDiagnosticProjectionError(projectionCode);
void [
  selector.start,
  selector.end,
  projection.id === TEXT_POSITION_PROJECTION_ID,
  projection.version === TEXT_POSITION_PROJECTION_VERSION,
  map.text,
  map.boundaryPositions.length,
  resolved.from,
  resolved.to,
  evidenceFailure.code,
  projectionFailure.code,
];
`,
    'utf8',
  );
  writeFileSync(
    configurationPath,
    `${JSON.stringify(
      {
        compilerOptions: {
          noEmit: true,
          strict: true,
          skipLibCheck: false,
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          target: 'ES2022',
          lib: ['ES2022', 'DOM', 'DOM.Iterable'],
          types: [],
        },
        files: ['./consumer.ts'],
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  const compilerPath = join(
    repositoryRoot,
    'node_modules',
    'typescript',
    'bin',
    'tsc',
  );
  assert.ok(existsSync(compilerPath));
  run(process.execPath, [compilerPath, '--project', configurationPath], consumerDirectory);
}

try {
  preparePackage();
  verifyAuthorityFreeBundles();
  verifyRuntimeConsumers();
  verifyDeclarationConsumer();
  console.log(
    `Verified packed ${packageJson.name}/text-position-selector through authority-bounded ESM, CommonJS, and strict TypeScript consumers.`,
  );
} finally {
  rmSync(verificationRoot, { recursive: true, force: true });
}
