import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
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
const packageSubpath = `${packageJson.name}/revision-evidence`;
const verificationDirectory = mkdtempSync(
  join(tmpdir(), 'inkspan-revision-evidence-'),
);

/** Execute a package-consumer command from the repository root. */
function run(command, argumentsList) {
  return execFileSync(command, argumentsList, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
}

/** Assert that one canonical path remains inside a trusted parent directory. */
function assertPathInside(resolvedPath, parentDirectory, description) {
  const relativePath = relative(parentDirectory, resolvedPath);
  assert.equal(
    isAbsolute(relativePath),
    false,
    `${description} resolved outside its independent package directory`,
  );
  assert.equal(
    relativePath === '..' || relativePath.startsWith(`..${sep}`),
    false,
    `${description} resolved outside its independent package directory`,
  );
}

/** Pack the exact publishable npm artifact without executing package scripts. */
function packArtifact() {
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
  assert.ok(existsSync(tarballPath), 'npm pack did not create the tarball');
  return tarballPath;
}

/**
 * Extract only the packed package into an operating-system temporary consumer.
 *
 * No dependency manager runs in this tree. React, TipTap, collaboration, and
 * repository ancestor modules are therefore unavailable, and any accidental
 * runtime or declaration dependency fails closed during the following checks.
 */
function extractStandalonePackage(tarballPath) {
  const extractionDirectory = join(verificationDirectory, 'extracted-package');
  const packageDirectory = join(
    verificationDirectory,
    'node_modules',
    ...packageJson.name.split('/'),
  );
  mkdirSync(extractionDirectory, { recursive: true });
  mkdirSync(dirname(packageDirectory), { recursive: true });
  run('tar', ['-xzf', tarballPath, '-C', extractionDirectory]);
  renameSync(join(extractionDirectory, 'package'), packageDirectory);

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

  const installedPackageDirectory = realpathSync(packageDirectory);
  assertPathInside(
    installedPackageDirectory,
    realpathSync(verificationDirectory),
    'packed package',
  );
  for (const forbiddenDependency of ['react', '@tiptap/core', '@tiptap/react']) {
    assert.equal(
      existsSync(
        join(
          verificationDirectory,
          'node_modules',
          ...forbiddenDependency.split('/'),
        ),
      ),
      false,
      `standalone consumer unexpectedly contains ${forbiddenDependency}`,
    );
  }
  return installedPackageDirectory;
}

/** Compile a strict dependency-free consumer against the packed declarations. */
function verifyRevisionEvidenceDeclarations() {
  const consumerPath = join(verificationDirectory, 'consumer.ts');
  writeFileSync(
    consumerPath,
    `import {
  DEFAULT_DOCUMENT_ENVELOPE_LIMITS,
  DOCUMENT_ENVELOPE_SCHEMA_ID,
  DOCUMENT_ENVELOPE_SCHEMA_VERSION,
  DocumentEnvelopeError,
  DocumentEnvelopeRevisionError,
  createDocumentEnvelopeRevisionEvidence,
  createDocumentEnvelopeRevisionEvidenceBytes,
  type CwlEditorDocumentRevisionEvidence,
  type DocumentEnvelopeDigestProvider,
} from '${packageSubpath}';

const sourceEnvelope = {
  schemaId: DOCUMENT_ENVELOPE_SCHEMA_ID,
  schemaVersion: DOCUMENT_ENVELOPE_SCHEMA_VERSION,
  documentJson: { type: 'doc' as const },
};
declare const digestProvider: DocumentEnvelopeDigestProvider;
const objectEvidence: Promise<CwlEditorDocumentRevisionEvidence> =
  createDocumentEnvelopeRevisionEvidence(
    sourceEnvelope,
    DEFAULT_DOCUMENT_ENVELOPE_LIMITS,
    digestProvider,
  );
const byteEvidence: Promise<CwlEditorDocumentRevisionEvidence> =
  createDocumentEnvelopeRevisionEvidenceBytes(
    new TextEncoder().encode(JSON.stringify(sourceEnvelope)),
    undefined,
    digestProvider,
  );
const inspected: Promise<void> = objectEvidence.then((captured) => {
  const revisionTag: string = captured.revision.strongEntityTag;
  const documentType: 'doc' = captured.envelope.documentJson.type;
  void [revisionTag, documentType];
});
const envelopeError: DocumentEnvelopeError =
  new DocumentEnvelopeError('redacted');
const revisionError: DocumentEnvelopeRevisionError =
  new DocumentEnvelopeRevisionError('redacted');
void [byteEvidence, inspected, envelopeError, revisionError];
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

/** Execute the packed standalone subpath through ESM with real evidence. */
function verifyRevisionEvidenceEsmRuntime(packageDirectory) {
  const esmPath = join(verificationDirectory, 'consumer.mjs');
  writeFileSync(
    esmPath,
    `import assert from 'node:assert/strict';
import { isAbsolute, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as evidenceApi from '${packageSubpath}';

const resolvedEntry = fileURLToPath(import.meta.resolve('${packageSubpath}'));
const resolvedRelative = relative(${JSON.stringify(packageDirectory)}, resolvedEntry);
assert.equal(isAbsolute(resolvedRelative), false);
assert.equal(
  resolvedRelative === '..' || resolvedRelative.startsWith('..' + sep),
  false,
);
assert.equal(typeof evidenceApi.createDocumentEnvelopeRevisionEvidence, 'function');
assert.equal(typeof evidenceApi.createDocumentEnvelopeRevisionEvidenceBytes, 'function');
assert.equal(typeof evidenceApi.DocumentEnvelopeError, 'function');
assert.equal(typeof evidenceApi.DocumentEnvelopeRevisionError, 'function');
const sourceEnvelope = {
  schemaId: evidenceApi.DOCUMENT_ENVELOPE_SCHEMA_ID,
  schemaVersion: evidenceApi.DOCUMENT_ENVELOPE_SCHEMA_VERSION,
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
const objectEvidence = await evidenceApi.createDocumentEnvelopeRevisionEvidence(
  sourceEnvelope,
  undefined,
  provider,
);
const byteEvidence =
  await evidenceApi.createDocumentEnvelopeRevisionEvidenceBytes(
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
assert.equal(Object.isFrozen(objectEvidence.envelope.documentJson), true);
assert.equal(Object.isFrozen(objectEvidence.revision), true);
assert.equal(providerCalls, 2);
await assert.rejects(
  evidenceApi.createDocumentEnvelopeRevisionEvidence({
    ...sourceEnvelope,
    schemaVersion: 99,
  }),
  evidenceApi.DocumentEnvelopeError,
);
await assert.rejects(
  evidenceApi.createDocumentEnvelopeRevisionEvidence(
    sourceEnvelope,
    undefined,
    null,
  ),
  evidenceApi.DocumentEnvelopeRevisionError,
);
`,
    'utf8',
  );
  run(process.execPath, [esmPath]);
}

/** Execute the packed standalone subpath through CommonJS with real evidence. */
function verifyRevisionEvidenceCommonJsRuntime(packageDirectory) {
  const commonJsPath = join(verificationDirectory, 'consumer.cjs');
  writeFileSync(
    commonJsPath,
    `const assert = require('node:assert/strict');
const { isAbsolute, relative, sep } = require('node:path');
const evidenceApi = require('${packageSubpath}');

void (async () => {
  const resolvedEntry = require.resolve('${packageSubpath}');
  const resolvedRelative = relative(${JSON.stringify(packageDirectory)}, resolvedEntry);
  assert.equal(isAbsolute(resolvedRelative), false);
  assert.equal(
    resolvedRelative === '..' || resolvedRelative.startsWith('..' + sep),
    false,
  );
  assert.equal(typeof evidenceApi.createDocumentEnvelopeRevisionEvidence, 'function');
  assert.equal(typeof evidenceApi.createDocumentEnvelopeRevisionEvidenceBytes, 'function');
  assert.equal(typeof evidenceApi.DocumentEnvelopeError, 'function');
  assert.equal(typeof evidenceApi.DocumentEnvelopeRevisionError, 'function');
  const sourceEnvelope = {
    schemaId: evidenceApi.DOCUMENT_ENVELOPE_SCHEMA_ID,
    schemaVersion: evidenceApi.DOCUMENT_ENVELOPE_SCHEMA_VERSION,
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
  const objectEvidence =
    await evidenceApi.createDocumentEnvelopeRevisionEvidence(
      sourceEnvelope,
      undefined,
      provider,
    );
  const byteEvidence =
    await evidenceApi.createDocumentEnvelopeRevisionEvidenceBytes(
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
  assert.equal(Object.isFrozen(objectEvidence.envelope.documentJson), true);
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
  const tarballPath = packArtifact();
  const installedPackageDirectory = extractStandalonePackage(tarballPath);
  verifyRevisionEvidenceDeclarations();
  verifyRevisionEvidenceEsmRuntime(installedPackageDirectory);
  verifyRevisionEvidenceCommonJsRuntime(installedPackageDirectory);
  console.log(
    `Verified extracted ${packageJson.name}@${packageJson.version} standalone revision-evidence ESM, CommonJS, declarations, and dependency isolation.`,
  );
} finally {
  rmSync(verificationDirectory, { recursive: true, force: true });
}
