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
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(
  readFileSync(join(repositoryRoot, 'package.json'), 'utf8'),
);
const verificationRoot = mkdtempSync(
  join(tmpdir(), 'inkspan-envelope-identity-'),
);
const extractionDirectory = join(verificationRoot, 'extracted');
const consumerDirectory = join(verificationRoot, 'consumer');
const packageDirectory = join(
  consumerDirectory,
  'node_modules',
  ...packageJson.name.split('/'),
);
const frameworkModulePattern =
  /(?:['"](?:react(?:-dom)?(?:\/[^'"]*)?|@tiptap\/[^'"]+|prosemirror-[^'"]+|yjs(?:\/[^'"]*)?)['"])/u;

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
    '{"name":"inkspan-envelope-identity-consumer","private":true,"type":"module"}\n',
    'utf8',
  );
}

function verifyFrameworkFreeBundles() {
  for (const filename of [
    'cwl-envelope-identity.js',
    'cwl-envelope-identity.cjs',
  ]) {
    const bundlePath = join(packageDirectory, 'dist', filename);
    const bundleSource = readFileSync(bundlePath, 'utf8');
    assert.doesNotMatch(
      bundleSource,
      frameworkModulePattern,
      `${filename} must not reference framework dependencies`,
    );
  }
}

function verifyRuntimeConsumers() {
  const esmPath = join(consumerDirectory, 'consumer.mjs');
  writeFileSync(
    esmPath,
    `import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import {
  inspectDocumentEnvelopeIdentity,
  inspectDocumentEnvelopeIdentityBytes,
} from '${packageJson.name}/envelope-identity';
const resolved = fileURLToPath(import.meta.resolve('${packageJson.name}/envelope-identity'));
assert.ok(resolved.endsWith('/dist/cwl-envelope-identity.js'));
const source = {
  schemaId: 'https://inkspan.io/schemas/document-envelope/v9',
  schemaVersion: 9,
  documentJson: { legacy: 'private-body' },
};
const objectIdentity = inspectDocumentEnvelopeIdentity(source);
const byteIdentity = inspectDocumentEnvelopeIdentityBytes(
  new TextEncoder().encode(JSON.stringify(source)),
);
assert.deepEqual(objectIdentity, { schemaId: source.schemaId, schemaVersion: 9 });
assert.deepEqual(byteIdentity, objectIdentity);
assert.equal(Object.isFrozen(objectIdentity), true);
assert.equal(JSON.stringify(objectIdentity).includes('private-body'), false);
`,
    'utf8',
  );

  const cjsPath = join(consumerDirectory, 'consumer.cjs');
  writeFileSync(
    cjsPath,
    `const assert = require('node:assert/strict');
const identity = require('${packageJson.name}/envelope-identity');
assert.ok(require.resolve('${packageJson.name}/envelope-identity').endsWith('/dist/cwl-envelope-identity.cjs'));
const result = identity.inspectDocumentEnvelopeIdentity({
  schemaId: 'legacy-schema',
  schemaVersion: 2,
  documentJson: { future: true },
});
assert.deepEqual(result, { schemaId: 'legacy-schema', schemaVersion: 2 });
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
  inspectDocumentEnvelopeIdentity,
  inspectDocumentEnvelopeIdentityBytes,
  type CwlEditorDocumentEnvelopeIdentity,
  type DocumentEnvelopeLimits,
} from '${packageJson.name}/envelope-identity';
const limits: DocumentEnvelopeLimits = { maxJsonValues: 100 };
const objectIdentity: Readonly<CwlEditorDocumentEnvelopeIdentity> =
  inspectDocumentEnvelopeIdentity({
    schemaId: 'legacy',
    schemaVersion: 3,
    documentJson: {},
  }, limits);
const byteIdentity: Readonly<CwlEditorDocumentEnvelopeIdentity> =
  inspectDocumentEnvelopeIdentityBytes(new Uint8Array(), limits);
void objectIdentity;
void byteIdentity;
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
  assert.ok(existsSync(compilerPath));
  run(process.execPath, [compilerPath, '--project', configurationPath]);
}

try {
  preparePackage();
  verifyFrameworkFreeBundles();
  verifyRuntimeConsumers();
  verifyDeclarationConsumer();
  console.log(
    `Verified framework-free packed ${packageJson.name}/envelope-identity through ESM, CommonJS, and strict TypeScript.`,
  );
} finally {
  rmSync(verificationRoot, { recursive: true, force: true });
}
