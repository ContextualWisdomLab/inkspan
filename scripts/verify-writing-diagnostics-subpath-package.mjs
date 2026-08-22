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
  join(tmpdir(), 'inkspan-writing-diagnostics-'),
);
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
const forbiddenFrameworkPattern =
  /(?:@tiptap\/react|react-dom|\breact\b|\byjs\b|y-prosemirror|contextual-orchestrator|\bnaruon\b)/iu;

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
    '{"name":"inkspan-writing-diagnostics-consumer","private":true,"type":"module"}\n',
    'utf8',
  );

  // The public declarations use ProseMirror model types only. The packed fixture
  // is extracted without package-manager installation, so expose the repository's
  // frozen dependency solely for strict declaration resolution.
  const repositoryTiptap = join(repositoryRoot, 'node_modules', '@tiptap');
  const consumerTiptap = join(consumerDirectory, 'node_modules', '@tiptap');
  assert.ok(existsSync(repositoryTiptap));
  symlinkSync(repositoryTiptap, consumerTiptap, 'dir');
}

/** Prove emitted JavaScript carries no framework, network, or credential authority. */
function verifyAuthorityFreeBundles() {
  for (const filename of [
    'cwl-writing-diagnostics.js',
    'cwl-writing-diagnostics.cjs',
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
    assert.doesNotMatch(
      bundleSource,
      forbiddenFrameworkPattern,
      `${filename} must remain framework and collaboration neutral`,
    );
  }
}

/** Return one complete strict host diagnostic for runtime consumer checks. */
function diagnosticLiteral() {
  const digestHex = '11'.repeat(32);
  return {
    diagnosticId: 'consumer-diagnostic',
    documentRevision: {
      algorithm: 'SHA-256',
      digestHex,
      strongEntityTag: `"sha256-${digestHex}"`,
    },
    textProjection: {
      id: 'inkspan-prosemirror-text',
      version: 1,
    },
    selector: {
      type: 'TextPositionSelector',
      start: 0,
      end: 5,
    },
    categoryCode: 'clarity',
    priority: 'important',
    title: 'Clarify the request',
    explanation: 'State the requested action.',
    suggestedReplacement: 'Omega',
    provenance: {
      workflowId: 'consumer-workflow',
      workflowVersion: '1',
      judgePolicyVersion: '1',
    },
  };
}

/** Write a reusable fake structural document expression for runtime consumers. */
function fakeDocumentSource() {
  return `({
  descendants(visitor) {
    visitor(Object.freeze({
      isBlock: false,
      isText: true,
      isLeaf: false,
      inlineContent: false,
      text: 'Alpha',
      nodeSize: 5,
    }), 1);
  },
})`;
}

/** Exercise the exact public ESM, CommonJS, and SSR-safe subpath. */
function verifyRuntimeConsumers() {
  const diagnostic = JSON.stringify(diagnosticLiteral());
  const fakeDocument = fakeDocumentSource();
  const esmPath = join(consumerDirectory, 'consumer.mjs');
  writeFileSync(
    esmPath,
    `import assert from 'node:assert/strict';
import {
  DEFAULT_WRITING_DIAGNOSTIC_LIMITS,
  TEXT_POSITION_PROJECTION_ID,
  TEXT_POSITION_PROJECTION_VERSION,
  WritingDiagnosticError,
  WritingDiagnosticProjectionError,
  buildTextProjectionMap,
  resolveTextPositionSelector,
  validateWritingDiagnostics,
} from '${packageJson.name}/writing-diagnostics';
assert.equal(DEFAULT_WRITING_DIAGNOSTIC_LIMITS.maxDiagnostics, 256);
assert.equal(TEXT_POSITION_PROJECTION_ID, 'inkspan-prosemirror-text');
assert.equal(TEXT_POSITION_PROJECTION_VERSION, 1);
assert.equal(typeof WritingDiagnosticError, 'function');
assert.equal(typeof WritingDiagnosticProjectionError, 'function');
const validated = validateWritingDiagnostics([${diagnostic}]);
assert.equal(validated.length, 1);
assert.equal(Object.isFrozen(validated), true);
const documentNode = ${fakeDocument};
const projection = buildTextProjectionMap(documentNode);
assert.equal(projection.text, 'Alpha');
assert.deepEqual(
  resolveTextPositionSelector(
    documentNode,
    validated[0].selector,
    validated[0].textProjection,
  ),
  { from: 1, to: 6 },
);
`,
    'utf8',
  );

  const cjsPath = join(consumerDirectory, 'consumer.cjs');
  writeFileSync(
    cjsPath,
    `const assert = require('node:assert/strict');
const diagnostics = require('${packageJson.name}/writing-diagnostics');
assert.equal(diagnostics.DEFAULT_WRITING_DIAGNOSTIC_LIMITS.maxDiagnostics, 256);
assert.equal(diagnostics.TEXT_POSITION_PROJECTION_ID, 'inkspan-prosemirror-text');
assert.equal(diagnostics.TEXT_POSITION_PROJECTION_VERSION, 1);
const validated = diagnostics.validateWritingDiagnostics([${diagnostic}]);
assert.equal(validated.length, 1);
const documentNode = ${fakeDocument};
assert.equal(diagnostics.buildTextProjectionMap(documentNode).text, 'Alpha');
assert.deepEqual(
  diagnostics.resolveTextPositionSelector(
    documentNode,
    validated[0].selector,
    validated[0].textProjection,
  ),
  { from: 1, to: 6 },
);
const failure = new diagnostics.WritingDiagnosticProjectionError('selector');
assert.equal(failure.code, 'selector');
`,
    'utf8',
  );

  const ssrPath = join(consumerDirectory, 'ssr-consumer.mjs');
  writeFileSync(
    ssrPath,
    `import assert from 'node:assert/strict';
import * as diagnostics from '${packageJson.name}/writing-diagnostics';
assert.equal(typeof globalThis.document, 'undefined');
assert.equal(typeof globalThis.window, 'undefined');
assert.deepEqual(diagnostics.validateWritingDiagnostics([]), []);
assert.equal(typeof diagnostics.resolveTextPositionSelector, 'function');
`,
    'utf8',
  );

  run(process.execPath, [esmPath], consumerDirectory);
  run(process.execPath, [cjsPath], consumerDirectory);
  run(process.execPath, [ssrPath], consumerDirectory);
}

/** Compile one strict TypeScript consumer against only the public subpath. */
function verifyDeclarationConsumer() {
  const sourcePath = join(consumerDirectory, 'consumer.ts');
  const configurationPath = join(consumerDirectory, 'tsconfig.json');
  writeFileSync(
    sourcePath,
    `import {
  DEFAULT_WRITING_DIAGNOSTIC_LIMITS,
  TEXT_POSITION_PROJECTION_ID,
  TEXT_POSITION_PROJECTION_VERSION,
  WritingDiagnosticError,
  WritingDiagnosticProjectionError,
  buildTextProjectionMap,
  resolveTextPositionSelector,
  validateWritingDiagnostics,
  type CwlEditorTextPositionSelector,
  type CwlEditorTextPositionSelectorEvidence,
  type CwlEditorTextProjectionIdentity,
  type CwlWritingDiagnostic,
  type CwlWritingDiagnosticPriority,
  type CwlWritingDiagnosticProvenance,
  type CwlWritingDiagnosticTextProjectionMap,
  type WritingDiagnosticErrorCode,
  type WritingDiagnosticLimits,
  type WritingDiagnosticProjectionErrorCode,
} from '${packageJson.name}/writing-diagnostics';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
declare const documentNode: ProseMirrorNode;
const digestHex = '11'.repeat(32);
const selector: CwlEditorTextPositionSelector = {
  type: 'TextPositionSelector',
  start: 0,
  end: 5,
};
const textProjection: CwlEditorTextProjectionIdentity = {
  id: TEXT_POSITION_PROJECTION_ID,
  version: TEXT_POSITION_PROJECTION_VERSION,
};
const provenance: CwlWritingDiagnosticProvenance = {
  workflowId: 'consumer-workflow',
  workflowVersion: '1',
  judgePolicyVersion: '1',
};
const priority: CwlWritingDiagnosticPriority = 'important';
const diagnostic: CwlWritingDiagnostic = {
  diagnosticId: 'consumer-diagnostic',
  documentRevision: {
    algorithm: 'SHA-256',
    digestHex,
    strongEntityTag: \`"sha256-\${digestHex}"\`,
  },
  textProjection,
  selector,
  categoryCode: 'clarity',
  priority,
  title: 'Clarify the request',
  explanation: 'State the requested action.',
  provenance,
};
const limits: WritingDiagnosticLimits = {
  maxDiagnostics: DEFAULT_WRITING_DIAGNOSTIC_LIMITS.maxDiagnostics,
};
const validated = validateWritingDiagnostics([diagnostic], limits);
const map: CwlWritingDiagnosticTextProjectionMap = buildTextProjectionMap(documentNode);
const resolved = resolveTextPositionSelector(
  documentNode,
  validated[0]!.selector,
  validated[0]!.textProjection,
);
const evidence: CwlEditorTextPositionSelectorEvidence = {
  revision: diagnostic.documentRevision,
  selector,
  textProjection,
};
const contractCode: WritingDiagnosticErrorCode = 'contract';
const projectionCode: WritingDiagnosticProjectionErrorCode = 'selector';
const contractFailure = new WritingDiagnosticError(contractCode);
const projectionFailure = new WritingDiagnosticProjectionError(projectionCode);
void [
  map.text,
  resolved.from,
  resolved.to,
  evidence.revision.strongEntityTag,
  contractFailure.code,
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
    `Verified packed ${packageJson.name}/writing-diagnostics through authority-bounded ESM, CommonJS, SSR, and strict TypeScript consumers.`,
  );
} finally {
  rmSync(verificationRoot, { recursive: true, force: true });
}
