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

import {
  createIndependentConsumerManifest,
  createTypeScriptVerificationArguments,
  stageLockedNodeModules,
} from './revision-evidence-consumer-config.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(
  readFileSync(join(repositoryRoot, 'package.json'), 'utf8'),
);
const verificationDirectory = mkdtempSync(
  join(tmpdir(), 'inkspan-revision-evidence-'),
);
const externalDependencyNames = Object.freeze([
  ...new Set([
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.peerDependencies ?? {}),
  ]),
]);
const consumerTypeDependencyNames = Object.freeze([
  '@types/react',
  '@types/react-dom',
]);
const installedConsumerDependencyNames = Object.freeze([
  ...new Set([
    ...externalDependencyNames,
    ...consumerTypeDependencyNames,
    'typescript',
  ]),
]);

/** Execute a package-consumer command from the repository root. */
function run(command, argumentsList) {
  return execFileSync(command, argumentsList, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
}

/** Return the exact already-installed version of one consumer dependency. */
function readInstalledDependencyVersion(packageName) {
  const manifestPath = join(
    repositoryRoot,
    'node_modules',
    ...packageName.split('/'),
    'package.json',
  );
  assert.ok(
    existsSync(manifestPath),
    `repository install is missing dependency metadata: ${packageName}`,
  );
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  assert.equal(
    typeof manifest.version,
    'string',
    `installed dependency has no version: ${packageName}`,
  );
  return manifest.version;
}

/** Assert that a resolved path cannot escape the independent consumer tree. */
function assertPathInsideConsumer(resolvedPath, description) {
  const relativePath = relative(verificationDirectory, resolvedPath);
  assert.equal(
    isAbsolute(relativePath),
    false,
    `${description} resolved outside the independent consumer tree`,
  );
  assert.equal(
    relativePath === '..' || relativePath.startsWith(`..${sep}`),
    false,
    `${description} resolved outside the independent consumer tree`,
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
  return packResult.filename;
}

/**
 * Stage the packed artifact and exact frozen-lockfile dependency closure.
 *
 * The repository installation has already passed `pnpm install
 * --frozen-lockfile`. Copying that complete pnpm tree avoids a second resolver
 * pass that could select a newer transitive package missing from the offline
 * store. The packed tarball then replaces only Inkspan's package directory, so
 * ESM, CommonJS, and declarations execute the publishable artifact while every
 * external dependency remains physically isolated below the temporary consumer.
 */
function stageIndependentConsumer(tarballFileName) {
  const exactRuntimeDependencies = Object.fromEntries(
    externalDependencyNames.map((packageName) => [
      packageName,
      readInstalledDependencyVersion(packageName),
    ]),
  );
  const exactTypeDependencies = Object.fromEntries(
    consumerTypeDependencyNames.map((packageName) => [
      packageName,
      readInstalledDependencyVersion(packageName),
    ]),
  );
  const exactTypeScriptVersion = readInstalledDependencyVersion('typescript');
  const consumerManifest = createIndependentConsumerManifest({
    packageName: packageJson.name,
    packageManager: packageJson.packageManager,
    tarballFileName,
    exactRuntimeDependencies,
    exactTypeDependencies,
    exactTypeScriptVersion,
  });
  writeFileSync(
    join(verificationDirectory, 'package.json'),
    `${JSON.stringify(consumerManifest, null, 2)}\n`,
    'utf8',
  );

  const targetNodeModules = join(verificationDirectory, 'node_modules');
  stageLockedNodeModules(
    join(repositoryRoot, 'node_modules'),
    targetNodeModules,
  );

  const extractionDirectory = join(verificationDirectory, 'packed-artifact');
  mkdirSync(extractionDirectory, { recursive: true });
  run('tar', [
    '-xzf',
    join(verificationDirectory, tarballFileName),
    '-C',
    extractionDirectory,
  ]);

  const packageDirectory = join(
    targetNodeModules,
    ...packageJson.name.split('/'),
  );
  mkdirSync(dirname(packageDirectory), { recursive: true });
  rmSync(packageDirectory, { recursive: true, force: true });
  renameSync(join(extractionDirectory, 'package'), packageDirectory);

  assert.ok(
    existsSync(join(packageDirectory, 'package.json')),
    'packed package was not staged into the independent consumer tree',
  );
  const installedPackageDirectory = realpathSync(packageDirectory);
  assertPathInsideConsumer(
    installedPackageDirectory,
    'packed package directory',
  );
  for (const dependencyName of installedConsumerDependencyNames) {
    const dependencyDirectory = join(
      targetNodeModules,
      ...dependencyName.split('/'),
    );
    assert.ok(
      existsSync(join(dependencyDirectory, 'package.json')),
      `independent consumer is missing required dependency: ${dependencyName}`,
    );
    assertPathInsideConsumer(
      realpathSync(dependencyDirectory),
      `dependency ${dependencyName}`,
    );
  }
  return installedPackageDirectory;
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

  run(
    'pnpm',
    createTypeScriptVerificationArguments(verificationDirectory, consumerPath),
  );
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

const consumerDirectory = ${JSON.stringify(verificationDirectory)};
function assertInsideConsumer(resolvedPath, description) {
  const resolvedRelative = relative(consumerDirectory, resolvedPath);
  assert.equal(isAbsolute(resolvedRelative), false, description);
  assert.equal(
    resolvedRelative === '..' || resolvedRelative.startsWith('..' + sep),
    false,
    description,
  );
}
const resolvedEntry = fileURLToPath(import.meta.resolve('${packageJson.name}'));
assertInsideConsumer(resolvedEntry, 'packed ESM entry escaped consumer tree');
const packageRelative = relative(${JSON.stringify(packageDirectory)}, resolvedEntry);
assert.equal(isAbsolute(packageRelative), false);
assert.equal(
  packageRelative === '..' || packageRelative.startsWith('..' + sep),
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
  const tarballFileName = packArtifact();
  const installedPackageDirectory = stageIndependentConsumer(tarballFileName);
  verifyRevisionEvidenceDeclarations();
  verifyRevisionEvidenceEsmRuntime(installedPackageDirectory);
  verifyRevisionEvidenceCommonJsRuntime(installedPackageDirectory);
  console.log(
    `Verified independently staged ${packageJson.name}@${packageJson.version} pure and imperative revision-evidence consumers.`,
  );
} finally {
  rmSync(verificationDirectory, { recursive: true, force: true });
}
