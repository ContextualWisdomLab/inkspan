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
const verificationRoot = mkdtempSync(join(tmpdir(), 'inkspan-review-'));
const extractionDirectory = join(verificationRoot, 'extracted');
const consumerDirectory = join(verificationRoot, 'consumer');
const packageDirectory = join(
  consumerDirectory,
  'node_modules',
  ...packageJson.name.split('/'),
);

const dynamicLoaderPattern = /(?:\bimport\s*\(|\brequire\s*\()/u;
const externalRuntimeImportPattern =
  /(?:\bimport\s+(?:[^'";]*?\sfrom\s*)?['"][^'"]+['"]|\bexport\s+[^'";]*?\sfrom\s*['"][^'"]+['"])/u;
const ambientAuthorityPattern =
  /(?:\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|\bEventSource\b|\bprocess\.env\b|\bimport\.meta\.env\b|\bDeno\.env\b|\bBun\.env\b)/u;

function run(command, argumentsList, cwd = repositoryRoot) {
  return execFileSync(command, argumentsList, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
}

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
    '{"name":"inkspan-review-consumer","private":true,"type":"module"}\n',
    'utf8',
  );

  const repositoryTiptap = join(repositoryRoot, 'node_modules', '@tiptap');
  const consumerTiptap = join(consumerDirectory, 'node_modules', '@tiptap');
  assert.ok(existsSync(repositoryTiptap));
  symlinkSync(repositoryTiptap, consumerTiptap, 'dir');
}

function verifyAuthorityFreeBundles() {
  for (const filename of ['cwl-review.js', 'cwl-review.cjs']) {
    const source = readFileSync(join(packageDirectory, 'dist', filename), 'utf8');
    assert.equal(
      dynamicLoaderPattern.test(source),
      false,
      `${filename} must not invoke dynamic module loaders`,
    );
    assert.doesNotMatch(
      source,
      externalRuntimeImportPattern,
      `${filename} must not import external runtime authority`,
    );
    assert.doesNotMatch(
      source,
      ambientAuthorityPattern,
      `${filename} must not reference ambient network or credential authority`,
    );
  }
}

function verifyRuntimeConsumers() {
  const esmPath = join(consumerDirectory, 'consumer.mjs');
  writeFileSync(
    esmPath,
    `import assert from 'node:assert/strict';
import {
  INKSPAN_REVIEW_CONTRACT_VERSION,
  TEXT_POSITION_PROJECTION_ID,
  TEXT_POSITION_PROJECTION_VERSION,
  CwlReviewOperationError,
  CwlReviewSuggestionError,
  CwlReviewTargetError,
  DocumentEnvelopeRevisionError,
  TextPositionSelectorEvidenceError,
  createDocumentEnvelopeRevision,
  createReviewOperationResult,
  createReviewSuggestion,
  createReviewTarget,
  createTextPositionSelector,
} from '${packageJson.name}/review';
assert.equal(INKSPAN_REVIEW_CONTRACT_VERSION, 1);
assert.equal(TEXT_POSITION_PROJECTION_ID, 'inkspan-prosemirror-text');
assert.equal(TEXT_POSITION_PROJECTION_VERSION, 1);
assert.equal(typeof CwlReviewOperationError, 'function');
assert.equal(typeof CwlReviewSuggestionError, 'function');
assert.equal(typeof CwlReviewTargetError, 'function');
assert.equal(typeof DocumentEnvelopeRevisionError, 'function');
assert.equal(typeof TextPositionSelectorEvidenceError, 'function');
assert.equal(typeof createDocumentEnvelopeRevision, 'function');
assert.equal(typeof createReviewOperationResult, 'function');
assert.equal(typeof createReviewSuggestion, 'function');
assert.equal(typeof createReviewTarget, 'function');
assert.equal(typeof createTextPositionSelector, 'function');
const digestHex = 'a'.repeat(64);
const target = createReviewTarget({
  contractVersion: 1,
  revision: {
    algorithm: 'SHA-256',
    digestHex,
    strongEntityTag: '\"sha256-' + digestHex + '\"',
  },
  selector: { type: 'TextPositionSelector', start: 1, end: 2 },
  projection: { id: 'inkspan-prosemirror-text', version: 1 },
});
assert.equal(target.revision.digestHex, digestHex);
assert.equal(target.selector.start, 1);
assert.equal(Object.isFrozen(target), true);
assert.throws(
  () => createReviewTarget({ ...target, contractVersion: 2 }),
  CwlReviewTargetError,
);
const insertionTarget = createReviewTarget({
  ...target,
  selector: { type: 'TextPositionSelector', start: 1, end: 1 },
});
const suggestion = createReviewSuggestion({
  contractVersion: 1,
  kind: 'insert',
  target: insertionTarget,
  text: 'proposal',
});
assert.equal(suggestion.kind, 'insert');
assert.equal(Object.isFrozen(suggestion), true);
assert.throws(
  () => createReviewSuggestion({ ...suggestion, text: '' }),
  CwlReviewSuggestionError,
);
`,
    'utf8',
  );
  const cjsPath = join(consumerDirectory, 'consumer.cjs');
  writeFileSync(
    cjsPath,
    `const assert = require('node:assert/strict');
const review = require('${packageJson.name}/review');
assert.equal(review.INKSPAN_REVIEW_CONTRACT_VERSION, 1);
assert.equal(review.TEXT_POSITION_PROJECTION_ID, 'inkspan-prosemirror-text');
assert.equal(review.TEXT_POSITION_PROJECTION_VERSION, 1);
assert.equal(typeof review.CwlReviewOperationError, 'function');
assert.equal(typeof review.CwlReviewSuggestionError, 'function');
assert.equal(typeof review.CwlReviewTargetError, 'function');
assert.equal(typeof review.createDocumentEnvelopeRevision, 'function');
assert.equal(typeof review.createReviewOperationResult, 'function');
assert.equal(typeof review.createReviewSuggestion, 'function');
assert.equal(typeof review.createReviewTarget, 'function');
assert.equal(typeof review.createTextPositionSelector, 'function');
const digestHex = 'b'.repeat(64);
const target = review.createReviewTarget({
  contractVersion: 1,
  revision: {
    algorithm: 'SHA-256',
    digestHex,
    strongEntityTag: '\"sha256-' + digestHex + '\"',
  },
  selector: { type: 'TextPositionSelector', start: 0, end: 0 },
  projection: { id: 'inkspan-prosemirror-text', version: 1 },
});
assert.equal(target.revision.digestHex, digestHex);
assert.equal(Object.isFrozen(target.projection), true);
const suggestion = review.createReviewSuggestion({
  contractVersion: 1,
  kind: 'insert',
  target,
  text: 'proposal',
});
assert.equal(suggestion.text, 'proposal');
assert.equal(Object.isFrozen(suggestion), true);
`,
    'utf8',
  );
  run(process.execPath, [esmPath], consumerDirectory);
  run(process.execPath, [cjsPath], consumerDirectory);
}

function verifyDeclarationConsumer() {
  const sourcePath = join(consumerDirectory, 'consumer.ts');
  const configurationPath = join(consumerDirectory, 'tsconfig.json');
  writeFileSync(
    sourcePath,
    `import {
  INKSPAN_REVIEW_CONTRACT_VERSION,
  CwlReviewOperationError,
  CwlReviewSuggestionError,
  CwlReviewTargetError,
  createReviewOperationResult,
  createReviewSuggestion,
  createReviewTarget,
  type CwlReviewOperationErrorCode,
  type CwlReviewOperationResult,
  type CwlReviewSuggestion,
  type CwlReviewSuggestionErrorCode,
  type CwlReviewTarget,
  type CwlReviewTargetErrorCode,
  type CwlEditorDocumentRevision,
  type CwlEditorTextPositionSelector,
  type CwlEditorTextProjectionIdentity,
} from '${packageJson.name}/review';
declare const revision: CwlEditorDocumentRevision;
declare const selector: CwlEditorTextPositionSelector;
declare const projection: CwlEditorTextProjectionIdentity;
const target: CwlReviewTarget = {
  contractVersion: INKSPAN_REVIEW_CONTRACT_VERSION,
  revision,
  selector,
  projection,
};
const detachedTarget: CwlReviewTarget = createReviewTarget(target);
const suggestion: CwlReviewSuggestion = createReviewSuggestion({
  contractVersion: INKSPAN_REVIEW_CONTRACT_VERSION,
  kind: 'delete',
  target: {
    ...target,
    selector: { type: 'TextPositionSelector', start: 0, end: 1 },
  },
});
const operationPromise: Promise<CwlReviewOperationResult> =
  createReviewOperationResult(suggestion, 'reject', {}, {});
const targetCode: CwlReviewTargetErrorCode = new CwlReviewTargetError().code;
const suggestionCode: CwlReviewSuggestionErrorCode =
  new CwlReviewSuggestionError().code;
const operationCode: CwlReviewOperationErrorCode =
  new CwlReviewOperationError('invalid_operation').code;
void [
  detachedTarget.revision,
  detachedTarget.selector.start,
  detachedTarget.selector.end,
  detachedTarget.projection.id,
  suggestion.kind,
  operationPromise,
  targetCode,
  suggestionCode,
  operationCode,
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
    `Verified packed ${packageJson.name}/review through authority-bounded ESM, CommonJS, and strict TypeScript consumers.`,
  );
} finally {
  rmSync(verificationRoot, { recursive: true, force: true });
}
