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
const forbiddenProductGraphPattern =
  /(?:\bReact\b|react-dom|@tiptap|y-prosemirror|\byjs\b|nar(u|uo)n|contextual-orchestrator|NVIDIA_NIM_API_KEY|COPILOT_GITHUB_TOKEN)/iu;

/** Execute one deterministic package-consumer command. */
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
  const packResult = JSON.parse(run('npm', [
    'pack',
    '--json',
    '--ignore-scripts',
    '--pack-destination',
    verificationRoot,
  ]))[0];
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

  // The public declarations retain erased TipTap/ProseMirror structural types;
  // expose the repository's already-installed declarations without installing
// anything into the system runtime.
  const repositoryTiptap = join(repositoryRoot, 'node_modules', '@tiptap');
  const consumerTiptap = join(consumerDirectory, 'node_modules', '@tiptap');
  assert.ok(existsSync(repositoryTiptap));
  symlinkSync(repositoryTiptap, consumerTiptap, 'dir');
}

/** Prove the React-free review bundle cannot acquire runtime authority. */
function verifyAuthorityFreeBundles() {
  for (const filename of ['cwl-review.js', 'cwl-review.cjs']) {
    const source = readFileSync(join(packageDirectory, 'dist', filename), 'utf8');
    assert.equal(dynamicLoaderPattern.test(source), false, filename);
    assert.doesNotMatch(source, externalRuntimeImportPattern, filename);
    assert.doesNotMatch(source, ambientAuthorityPattern, filename);
    assert.doesNotMatch(source, forbiddenProductGraphPattern, filename);
  }
}

/** Exercise the exact packed ESM and CommonJS subpath. */
function verifyRuntimeConsumers() {
  const esmPath = join(consumerDirectory, 'consumer.mjs');
  writeFileSync(
    esmPath,
    `import assert from 'node:assert/strict';
import {
  INKSPAN_REVIEW_CONTRACT_VERSION,
  TEXT_POSITION_PROJECTION_ID,
  TEXT_POSITION_PROJECTION_VERSION,
  CwlReviewTargetError,
  DocumentEnvelopeRevisionError,
  TextPositionSelectorEvidenceError,
  createDocumentEnvelopeRevision,
  createReviewTarget,
  createTextPositionSelector,
  REVIEW_CONTRACT_SCHEMA_ID,
  REVIEW_CONTRACT_SCHEMA_VERSION,
  createReviewOperationResult,
} from '${packageJson.name}/review';
assert.equal(INKSPAN_REVIEW_CONTRACT_VERSION, 1);
assert.equal(TEXT_POSITION_PROJECTION_ID, 'inkspan-prosemirror-text');
assert.equal(TEXT_POSITION_PROJECTION_VERSION, 1);
assert.equal(typeof CwlReviewTargetError, 'function');
assert.equal(typeof DocumentEnvelopeRevisionError, 'function');
assert.equal(typeof TextPositionSelectorEvidenceError, 'function');
assert.equal(typeof createDocumentEnvelopeRevision, 'function');
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
const envelope = (reviewed = false) => ({
  schemaId: 'https://inkspan.io/schemas/document-envelope/v1',
  schemaVersion: 1,
  documentJson: reviewed ? { type: 'doc', attrs: { reviewed: true } } : { type: 'doc' },
});
const revision = (fill) => {
  const digestHex = fill.toString(16).padStart(2, '0').repeat(32);
  return { algorithm: 'SHA-256', digestHex, strongEntityTag: \`"sha256-\${digestHex}"\` };
};
const expected = revision(1);
let digestCalls = 0;
const result = await createReviewOperationResult({
  action: 'accept',
  suggestion: {
    suggestionId: 'packed-suggestion',
    kind: 'insert',
    state: 'pending',
    expectedRevision: expected,
    target: { revision: expected, selector: { type: 'TextPositionSelector', start: 0, end: 0 }, textProjection: { id: 'inkspan-prosemirror-text', version: 1 } },
    text: 'x',
  },
}, envelope(), envelope(true), undefined, { digest: async () => new Uint8Array(32).fill(++digestCalls).buffer });
assert.equal(REVIEW_CONTRACT_SCHEMA_ID, 'https://inkspan.io/schemas/review/v1');
assert.equal(REVIEW_CONTRACT_SCHEMA_VERSION, 1);
assert.equal(result.status, 'accepted');
assert.equal(result.transitionEvidence.changed, true);
assert.equal('documentJson' in result, false);
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
assert.equal(typeof review.CwlReviewTargetError, 'function');
assert.equal(typeof review.createDocumentEnvelopeRevision, 'function');
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
assert.equal(review.REVIEW_CONTRACT_SCHEMA_ID, 'https://inkspan.io/schemas/review/v1');
assert.equal(review.REVIEW_CONTRACT_SCHEMA_VERSION, 1);
assert.equal(typeof review.validateReviewTarget, 'function');
assert.equal(typeof review.createReviewOperationResult, 'function');
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
  INKSPAN_REVIEW_CONTRACT_VERSION,
  CwlReviewTargetError,
  createReviewTarget,
  type CwlReviewTarget,
  type CwlReviewTargetErrorCode,
  type CwlEditorDocumentRevision,
  type CwlEditorTextPositionSelector,
  type CwlEditorTextProjectionIdentity,
  REVIEW_CONTRACT_SCHEMA_ID,
  validateReviewTarget,
  type CwlEditorReviewTarget,
  type ReviewContractErrorCode,
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
const code: CwlReviewTargetErrorCode = new CwlReviewTargetError().code;
void [
  detachedTarget.revision,
  detachedTarget.selector.start,
  detachedTarget.selector.end,
  detachedTarget.projection.id,
  code,
];
const operationTarget: CwlEditorReviewTarget = {
  revision: { algorithm: 'SHA-256', digestHex: 'a'.repeat(64), strongEntityTag: '"sha256-' + 'a'.repeat(64) + '"' },
  selector: { type: 'TextPositionSelector', start: 0, end: 0 },
  textProjection: { id: 'inkspan-prosemirror-text', version: 1 },
};
const operationValidated = validateReviewTarget(operationTarget);
const operationCode: ReviewContractErrorCode = 'stale_revision';
void [REVIEW_CONTRACT_SCHEMA_ID, operationValidated.selector.start, operationCode];
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
    `Verified packed ${packageJson.name}/review through provider-neutral ESM, CommonJS, and strict TypeScript consumers.`,
  );
} finally {
  rmSync(verificationRoot, { recursive: true, force: true });
}
