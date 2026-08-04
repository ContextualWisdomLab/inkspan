import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(
  readFileSync(join(repositoryRoot, 'package.json'), 'utf8'),
);
const verificationDirectory = mkdtempSync(
  join(repositoryRoot, '.revision-evidence-verification-'),
);

/** Execute a package-consumer command from the repository root. */
function run(command, argumentsList) {
  return execFileSync(command, argumentsList, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
}

/**
 * Create an independent package scope for every generated consumer.
 *
 * Node package self-reference resolves an import matching the nearest package's
 * own name before searching `node_modules`. The verification directory lives
 * beneath the Inkspan repository, so it must declare a different package name;
 * otherwise a consumer can silently load the working tree instead of the packed
 * artifact that the release would publish.
 */
function createIndependentConsumerScope() {
  writeFileSync(
    join(verificationDirectory, 'package.json'),
    `${JSON.stringify(
      {
        name: 'inkspan-revision-evidence-consumer',
        private: true,
        type: 'module',
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}

/**
 * Pack and install the exact npm artifact into the isolated consumer tree.
 *
 * Extraction avoids a networked npm install while ensuring package-name imports
 * resolve to the tarball contents rather than to this repository's self-reference.
 */
function installPackedArtifact() {
  const packOutput = run('npm', [
    'pack',
    '--json',
    '--ignore-scripts',
    '--pack-destination',
    verificationDirectory,
  ]);
  const packResult = JSON.parse(packOutput)[0];
  assert.equal(packResult.name, packageJson.name);
  assert.equal(packResult.version, packageJson.version);

  const tarballPath = join(verificationDirectory, packResult.filename);
  const extractionDirectory = join(verificationDirectory, 'extracted');
  mkdirSync(extractionDirectory, { recursive: true });
  run('tar', ['-xzf', tarballPath, '-C', extractionDirectory]);

  const packageDirectory = join(
    verificationDirectory,
    'node_modules',
    ...packageJson.name.split('/'),
  );
  mkdirSync(dirname(packageDirectory), { recursive: true });
  renameSync(join(extractionDirectory, 'package'), packageDirectory);
  assert.ok(
    existsSync(join(packageDirectory, 'package.json')),
    'packed package was not installed into the isolated consumer tree',
  );
  return packageDirectory;
}

/** Compile one strict consumer against every packed revision-evidence path. */
function verifyRevisionEvidenceDeclarations() {
  const consumerPath = join(verificationDirectory, 'consumer.ts');
  writeFileSync(
    consumerPath,
    `import {
  createDocumentEnvelopeRevisionEvidence,
  createDocumentEnvelopeRevisionEvidenceBytes,
  type CwlEditorDocumentRevisionEvidence,
  type CwlEditorHandle,
  type DocumentEnvelopeDigestProvider,
} from '${packageJson.name}';

declare const editorHandle: CwlEditorHandle;
declare const digestProvider: DocumentEnvelopeDigestProvider;
const sourceEnvelope = {
  schemaId: 'https://inkspan.io/schemas/document-envelope/v1',
  schemaVersion: 1 as const,
  documentJson: { type: 'doc' },
};
const handleEvidence: Promise<CwlEditorDocumentRevisionEvidence | null> =
  editorHandle.getDocumentEnvelopeRevisionEvidence(undefined, digestProvider);
const objectEvidence: Promise<CwlEditorDocumentRevisionEvidence> =
  createDocumentEnvelopeRevisionEvidence(
    sourceEnvelope,
    undefined,
    digestProvider,
  );
const byteEvidence: Promise<CwlEditorDocumentRevisionEvidence> =
  createDocumentEnvelopeRevisionEvidenceBytes(
    new TextEncoder().encode(JSON.stringify(sourceEnvelope)),
    undefined,
    digestProvider,
  );
const inspected: Promise<void> = handleEvidence.then((captured) => {
  if (captured === null) return;
  const revisionTag: string = captured.revision.strongEntityTag;
  const documentType: unknown = captured.envelope.documentJson.type;
  void [revisionTag, documentType];
});
void [objectEvidence, byteEvidence, inspected];
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
    consumerPath,
  ]);
}

/** Execute the packed package API through ESM with real object and byte evidence. */
function verifyRevisionEvidenceEsmRuntime(packageDirectory) {
  const esmPath = join(verificationDirectory, 'consumer.mjs');
  writeFileSync(
    esmPath,
    `import assert from 'node:assert/strict';
import { isAbsolute, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as editor from '${packageJson.name}';

const resolvedEntry = fileURLToPath(import.meta.resolve('${packageJson.name}'));
const resolvedRelative = relative(${JSON.stringify(packageDirectory)}, resolvedEntry);
assert.equal(isAbsolute(resolvedRelative), false);
assert.equal(
  resolvedRelative === '..' || resolvedRelative.startsWith('..' + sep),
  false,
);
assert.equal(typeof editor.createDocumentEnvelopeRevisionEvidence, 'function');
assert.equal(typeof editor.createDocumentEnvelopeRevisionEvidenceBytes, 'function');
const sourceEnvelope = {
  schemaId: 'https://inkspan.io/schemas/document-envelope/v1',
  schemaVersion: 1,
  documentJson: { type: 'doc', content: [{ type: 'paragraph' }] },
};
let providerCalls = 0;
const provider = {
  async digest(algorithm, source) {
    assert.equal(algorithm, 'SHA-256');
    assert.ok(ArrayBuffer.isView(source));
    providerCalls += 1;
    return new Uint8Array(32).fill(0x5a).buffer;
  },
};
const objectEvidence = await editor.createDocumentEnvelopeRevisionEvidence(
  sourceEnvelope,
  undefined,
  provider,
);
const byteEvidence = await editor.createDocumentEnvelopeRevisionEvidenceBytes(
  new TextEncoder().encode(JSON.stringify(sourceEnvelope)),
  undefined,
  provider,
);
assert.deepEqual(objectEvidence.envelope, byteEvidence.envelope);
assert.equal(objectEvidence.revision.digestHex, '5a'.repeat(32));
assert.equal(
  objectEvidence.revision.strongEntityTag,
  '"sha256-' + '5a'.repeat(32) + '"',
);
assert.equal(Object.isFrozen(objectEvidence), true);
assert.equal(Object.isFrozen(objectEvidence.envelope), true);
assert.equal(Object.isFrozen(objectEvidence.revision), true);
assert.equal(providerCalls, 2);
`,
    'utf8',
  );
  run(process.execPath, [esmPath]);
}

/** Execute the packed package API through CommonJS with real evidence. */
function verifyRevisionEvidenceCommonJsRuntime(packageDirectory) {
  const commonJsPath = join(verificationDirectory, 'consumer.cjs');
  writeFileSync(
    commonJsPath,
    `const assert = require('node:assert/strict');
const { isAbsolute, relative, sep } = require('node:path');
const editor = require('${packageJson.name}');

void (async () => {
  const resolvedEntry = require.resolve('${packageJson.name}');
  const resolvedRelative = relative(${JSON.stringify(packageDirectory)}, resolvedEntry);
  assert.equal(isAbsolute(resolvedRelative), false);
  assert.equal(
    resolvedRelative === '..' || resolvedRelative.startsWith('..' + sep),
    false,
  );
  assert.equal(typeof editor.createDocumentEnvelopeRevisionEvidence, 'function');
  assert.equal(typeof editor.createDocumentEnvelopeRevisionEvidenceBytes, 'function');
  const sourceEnvelope = {
    schemaId: 'https://inkspan.io/schemas/document-envelope/v1',
    schemaVersion: 1,
    documentJson: { type: 'doc', content: [{ type: 'paragraph' }] },
  };
  let providerCalls = 0;
  const provider = {
    async digest(algorithm, source) {
      assert.equal(algorithm, 'SHA-256');
      assert.ok(ArrayBuffer.isView(source));
      providerCalls += 1;
      return new Uint8Array(32).fill(0xa5).buffer;
    },
  };
  const objectEvidence = await editor.createDocumentEnvelopeRevisionEvidence(
    sourceEnvelope,
    undefined,
    provider,
  );
  const byteEvidence = await editor.createDocumentEnvelopeRevisionEvidenceBytes(
    new TextEncoder().encode(JSON.stringify(sourceEnvelope)),
    undefined,
    provider,
  );
  assert.deepEqual(objectEvidence.envelope, byteEvidence.envelope);
  assert.equal(objectEvidence.revision.digestHex, 'a5'.repeat(32));
  assert.equal(
    objectEvidence.revision.strongEntityTag,
    '"sha256-' + 'a5'.repeat(32) + '"',
  );
  assert.equal(Object.isFrozen(objectEvidence), true);
  assert.equal(Object.isFrozen(objectEvidence.envelope), true);
  assert.equal(Object.isFrozen(objectEvidence.revision), true);
  assert.equal(providerCalls, 2);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
`,
    'utf8',
  );
  run(process.execPath, [commonJsPath]);
}

try {
  createIndependentConsumerScope();
  const packageDirectory = installPackedArtifact();
  verifyRevisionEvidenceDeclarations();
  verifyRevisionEvidenceEsmRuntime(packageDirectory);
  verifyRevisionEvidenceCommonJsRuntime(packageDirectory);
  console.log(
    `Verified packed ${packageJson.name}@${packageJson.version} pure and imperative revision-evidence consumers.`,
  );
} finally {
  rmSync(verificationDirectory, { recursive: true, force: true });
}
