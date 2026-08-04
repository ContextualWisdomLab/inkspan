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
  const relativePath = relative(consumerDirectory, realpathSync(resolvedPath));
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
const source = {
  schemaId: evidence.DOCUMENT_ENVELOPE_SCHEMA_ID,
  schemaVersion: evidence.DOCUMENT_ENVELOPE_SCHEMA_VERSION,
  documentJson: { type: 'doc' },
};
let calls = 0;
const provider = {
  async digest(algorithm, bytes) {
    assert.equal(algorithm, 'SHA-256');
    assert.ok(ArrayBuffer.isView(bytes));
    calls += 1;
    return new Uint8Array(32).fill(0x42).buffer;
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
assert.deepEqual(objectEvidence.envelope, byteEvidence.envelope);
assert.equal(objectEvidence.revision.digestHex, '42'.repeat(32));
assert.equal(calls, 2);
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
void evidence.createDocumentEnvelopeRevisionEvidence(
  {
    schemaId: evidence.DOCUMENT_ENVELOPE_SCHEMA_ID,
    schemaVersion: evidence.DOCUMENT_ENVELOPE_SCHEMA_VERSION,
    documentJson: { type: 'doc' },
  },
  undefined,
  {
    async digest() {
      return new ArrayBuffer(32);
    },
  },
).then((captured) => {
  assert.equal(captured.revision.digestHex, '00'.repeat(32));
}).catch((error) => {
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
  writeFileSync(
    sourcePath,
    `import {
  createDocumentEnvelopeRevisionEvidence,
  type CwlEditorDocumentRevisionEvidence,
  type DocumentEnvelopeDigestProvider,
} from '${packageJson.name}/revision-evidence';

declare const digestProvider: DocumentEnvelopeDigestProvider;
const captured: Promise<CwlEditorDocumentRevisionEvidence> =
  createDocumentEnvelopeRevisionEvidence(
    {
      schemaId: 'https://inkspan.io/schemas/document-envelope/v1',
      schemaVersion: 1,
      documentJson: { type: 'doc' },
    },
    undefined,
    digestProvider,
  );
void captured;
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
    'ES2022',
    sourcePath,
  ]);
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
