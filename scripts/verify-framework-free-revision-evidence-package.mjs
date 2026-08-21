import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(
  readFileSync(join(repositoryRoot, 'package.json'), 'utf8'),
);
const verificationRoot = mkdtempSync(
  join(tmpdir(), 'inkspan-framework-free-evidence-'),
);
const extractionDirectory = join(verificationRoot, 'extracted');
const consumerDirectory = join(verificationRoot, 'consumer');
const packageDirectory = join(
  consumerDirectory,
  'node_modules',
  ...packageJson.name.split('/'),
);

/** Execute one verification command and inherit diagnostics on failure. */
function run(command, argumentsList, cwd = repositoryRoot) {
  return execFileSync(command, argumentsList, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
}

/** Assert that a resolved path remains inside the framework-free consumer. */
function assertInsideConsumer(resolvedPath, description) {
  const relativePath = relative(
    realpathSync(consumerDirectory),
    realpathSync(resolvedPath),
  );
  assert.equal(isAbsolute(relativePath), false, description);
  assert.equal(
    relativePath === '..' || relativePath.startsWith(`..${sep}`),
    false,
    description,
  );
}

/** Pack and extract the exact npm artifact without installing dependencies. */
function prepareFrameworkFreePackage() {
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
  assert.ok(existsSync(tarballPath), 'npm pack did not create the tarball');
  run('tar', ['-xzf', tarballPath, '-C', extractionDirectory]);
  renameSync(join(extractionDirectory, 'package'), packageDirectory);
  writeFileSync(
    join(consumerDirectory, 'package.json'),
    '{"name":"inkspan-framework-free-consumer","private":true,"type":"module"}\n',
    'utf8',
  );

  const topLevelDependencies = readdirSync(
    join(consumerDirectory, 'node_modules'),
  );
  assert.deepEqual(topLevelDependencies, ['@contextualwisdomlab']);
  assert.deepEqual(
    readdirSync(join(consumerDirectory, 'node_modules', '@contextualwisdomlab')),
    ['cwl-editor'],
  );
  assertInsideConsumer(
    packageDirectory,
    'packed revision-evidence package escaped consumer tree',
  );
}

/** Execute the packed revision-evidence subpath with no framework installed. */
function verifyRuntimeConsumers() {
  const esmPath = join(consumerDirectory, 'consumer.mjs');
  writeFileSync(
    esmPath,
    `import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import * as evidence from '${packageJson.name}/revision-evidence';

const resolvedEntry = fileURLToPath(
  import.meta.resolve('${packageJson.name}/revision-evidence'),
);
assert.ok(resolvedEntry.endsWith('/dist/cwl-revision-evidence.js'));
assert.equal(typeof evidence.createDocumentEnvelopeRevisionEvidence, 'function');
assert.equal(typeof evidence.createDocumentEnvelopeRevisionEvidenceBytes, 'function');
assert.equal(typeof evidence.createDocumentEnvelopeTransitionEvidence, 'function');
assert.equal(typeof evidence.createDocumentEnvelopeTransitionEvidenceBytes, 'function');
assert.equal(
  evidence.DOCUMENT_TRANSITION_EVIDENCE_SCHEMA_ID,
  'https://inkspan.io/schemas/document-transition-evidence/v1',
);
assert.equal(evidence.DOCUMENT_TRANSITION_EVIDENCE_SCHEMA_VERSION, 1);
const source = {
  schemaId: evidence.DOCUMENT_ENVELOPE_SCHEMA_ID,
  schemaVersion: evidence.DOCUMENT_ENVELOPE_SCHEMA_VERSION,
  documentJson: { type: 'doc' },
};
const resultingSource = {
  ...source,
  documentJson: { type: 'doc', content: [{ type: 'paragraph' }] },
};
const fills = [0x42, 0x42, 0x43, 0x44];
let calls = 0;
const provider = {
  async digest(algorithm, bytes) {
    assert.equal(algorithm, 'SHA-256');
    assert.ok(ArrayBuffer.isView(bytes));
    const fill = fills[calls];
    assert.notEqual(fill, undefined);
    calls += 1;
    return new Uint8Array(32).fill(fill).buffer;
  },
};
const objectEvidence = await evidence.createDocumentEnvelopeRevisionEvidence(
  source,
  undefined,
  provider,
);
const byteEvidence = await evidence.createDocumentEnvelopeRevisionEvidenceBytes(
  new TextEncoder().encode(JSON.stringify(source)),
  undefined,
  provider,
);
const transition = await evidence.createDocumentEnvelopeTransitionEvidence(
  source,
  resultingSource,
  undefined,
  provider,
);
assert.deepEqual(objectEvidence.envelope, byteEvidence.envelope);
assert.equal(objectEvidence.revision.digestHex, '42'.repeat(32));
assert.equal(transition.previousRevision.digestHex, '43'.repeat(32));
assert.equal(transition.resultingRevision.digestHex, '44'.repeat(32));
assert.equal(transition.changed, true);
assert.equal('envelope' in transition, false);
assert.equal(Object.isFrozen(transition), true);
assert.equal(Object.isFrozen(transition.previousRevision), true);
assert.equal(Object.isFrozen(transition.resultingRevision), true);
assert.equal(calls, 4);
`,
    'utf8',
  );

  const commonJsPath = join(consumerDirectory, 'consumer.cjs');
  writeFileSync(
    commonJsPath,
    `const assert = require('node:assert/strict');
const evidence = require('${packageJson.name}/revision-evidence');

assert.ok(
  require.resolve('${packageJson.name}/revision-evidence')
    .endsWith('/dist/cwl-revision-evidence.cjs'),
);
assert.equal(typeof evidence.createDocumentEnvelopeRevisionEvidence, 'function');
assert.equal(typeof evidence.createDocumentEnvelopeRevisionEvidenceBytes, 'function');
assert.equal(typeof evidence.createDocumentEnvelopeTransitionEvidence, 'function');
assert.equal(typeof evidence.createDocumentEnvelopeTransitionEvidenceBytes, 'function');

void (async () => {
  const source = {
    schemaId: evidence.DOCUMENT_ENVELOPE_SCHEMA_ID,
    schemaVersion: evidence.DOCUMENT_ENVELOPE_SCHEMA_VERSION,
    documentJson: { type: 'doc' },
  };
  const captured = await evidence.createDocumentEnvelopeRevisionEvidence(
    source,
    undefined,
    {
      async digest() {
        return new ArrayBuffer(32);
      },
    },
  );
  assert.equal(captured.revision.digestHex, '00'.repeat(32));

  let calls = 0;
  const transition = await evidence.createDocumentEnvelopeTransitionEvidence(
    source,
    {
      ...source,
      documentJson: { type: 'doc', attrs: { reviewed: true } },
    },
    undefined,
    {
      async digest() {
        calls += 1;
        return new Uint8Array(32).fill(calls).buffer;
      },
    },
  );
  assert.equal(transition.previousRevision.digestHex, '01'.repeat(32));
  assert.equal(transition.resultingRevision.digestHex, '02'.repeat(32));
  assert.equal(transition.changed, true);
  assert.equal('envelope' in transition, false);
  assert.equal(Object.isFrozen(transition), true);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
`,
    'utf8',
  );

  run(process.execPath, [esmPath], consumerDirectory);
  run(process.execPath, [commonJsPath], consumerDirectory);
}

/** Compile declarations without DOM, React, TipTap, ProseMirror, or Yjs types. */
function verifyDeclarationConsumer() {
  const sourcePath = join(consumerDirectory, 'consumer.ts');
  const configurationPath = join(consumerDirectory, 'tsconfig.json');
  writeFileSync(
    sourcePath,
    `import {
  createDocumentEnvelopeRevisionEvidence,
  createDocumentEnvelopeTransitionEvidence,
  type CwlEditorDocumentRevisionEvidence,
  type CwlEditorDocumentTransitionEvidence,
  type DocumentEnvelopeDigestProvider,
} from '${packageJson.name}/revision-evidence';

declare const digestProvider: DocumentEnvelopeDigestProvider;
const source = {
  schemaId: 'https://inkspan.io/schemas/document-envelope/v1' as const,
  schemaVersion: 1 as const,
  documentJson: { type: 'doc' },
};
const captured: Promise<CwlEditorDocumentRevisionEvidence> =
  createDocumentEnvelopeRevisionEvidence(
    source,
    undefined,
    digestProvider,
  );
const transition: Promise<CwlEditorDocumentTransitionEvidence> =
  createDocumentEnvelopeTransitionEvidence(
    source,
    {
      ...source,
      documentJson: { type: 'doc', content: [{ type: 'paragraph' }] },
    },
    undefined,
    digestProvider,
  );
void captured;
void transition;
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
          lib: ['ES2022'],
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
  assert.ok(existsSync(compilerPath), 'repository TypeScript compiler is missing');
  run(process.execPath, [compilerPath, '--project', configurationPath]);
}

try {
  prepareFrameworkFreePackage();
  verifyRuntimeConsumers();
  verifyDeclarationConsumer();
  console.log(
    `Verified framework-free packed ${packageJson.name}/revision-evidence through ESM, CommonJS, and strict TypeScript.`,
  );
} finally {
  rmSync(verificationRoot, { recursive: true, force: true });
}
