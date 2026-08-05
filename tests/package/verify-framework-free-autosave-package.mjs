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

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);
const packageJson = JSON.parse(
  readFileSync(join(repositoryRoot, 'package.json'), 'utf8'),
);
const verificationRoot = mkdtempSync(
  join(tmpdir(), 'inkspan-framework-free-autosave-'),
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

/** Assert that a resolved path remains inside the isolated consumer tree. */
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
  writeFileSync(
    join(consumerDirectory, 'package.json'),
    '{"name":"inkspan-autosave-consumer","private":true,"type":"module"}\n',
    'utf8',
  );

  assert.deepEqual(readdirSync(join(consumerDirectory, 'node_modules')), [
    '@contextualwisdomlab',
  ]);
  assert.deepEqual(
    readdirSync(join(consumerDirectory, 'node_modules', '@contextualwisdomlab')),
    ['cwl-editor'],
  );
  assertInsideConsumer(
    packageDirectory,
    'packed autosave package escaped consumer tree',
  );
}

/** Execute the packed autosave subpath with no framework installed. */
function verifyRuntimeConsumers() {
  const esmPath = join(consumerDirectory, 'consumer.mjs');
  writeFileSync(
    esmPath,
    `import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import {
  createDocumentAutosaveQueue,
  DocumentAutosaveQueueError,
} from '${packageJson.name}/autosave';

const resolvedEntry = fileURLToPath(
  import.meta.resolve('${packageJson.name}/autosave'),
);
assert.ok(resolvedEntry.endsWith('/dist/cwl-autosave.js'));
assert.equal(typeof createDocumentAutosaveQueue, 'function');
assert.equal(typeof DocumentAutosaveQueueError, 'function');
const digestHex = '42'.repeat(32);
const evidence = Object.freeze({
  envelope: Object.freeze({
    schemaId: 'https://inkspan.io/schemas/document-envelope/v1',
    schemaVersion: 1,
    documentJson: Object.freeze({ type: 'doc' }),
  }),
  revision: Object.freeze({
    algorithm: 'SHA-256',
    digestHex,
    strongEntityTag: \`"sha256-\${digestHex}"\`,
  }),
});
let calls = 0;
const queue = createDocumentAutosaveQueue({
  async save(received) {
    calls += 1;
    assert.notEqual(received, evidence);
    assert.deepEqual(received, evidence);
    assert.equal(Object.isFrozen(received), true);
    assert.equal(Object.isFrozen(received.envelope), true);
    assert.equal(Object.isFrozen(received.envelope.documentJson), true);
    assert.equal(Object.isFrozen(received.revision), true);
    return { status: 'saved' };
  },
});
assert.deepEqual(await queue.enqueue(evidence), {
  status: 'saved',
  strongEntityTag: evidence.revision.strongEntityTag,
});
assert.equal(calls, 1);

const mutableTextNode = { type: 'text', text: 'original' };
const partiallyFrozenEvidence = Object.freeze({
  envelope: Object.freeze({
    schemaId: 'https://inkspan.io/schemas/document-envelope/v1',
    schemaVersion: 1,
    documentJson: Object.freeze({
      type: 'doc',
      content: Object.freeze([mutableTextNode]),
    }),
  }),
  revision: evidence.revision,
});
assert.throws(
  () => queue.enqueue(partiallyFrozenEvidence),
  (error) =>
    error instanceof DocumentAutosaveQueueError &&
    error.code === 'invalid_revision_evidence',
);
mutableTextNode.text = 'mutated after rejection';
assert.equal(calls, 1);

assert.equal((await queue.flush()).state, 'idle');
assert.equal((await queue.close()).state, 'closed');
`,
    'utf8',
  );

  const commonJsPath = join(consumerDirectory, 'consumer.cjs');
  writeFileSync(
    commonJsPath,
    `const assert = require('node:assert/strict');
const autosave = require('${packageJson.name}/autosave');

assert.ok(
  require.resolve('${packageJson.name}/autosave')
    .endsWith('/dist/cwl-autosave.cjs'),
);
assert.equal(typeof autosave.createDocumentAutosaveQueue, 'function');
const digestHex = '24'.repeat(32);
const evidence = Object.freeze({
  envelope: Object.freeze({
    schemaId: 'https://inkspan.io/schemas/document-envelope/v1',
    schemaVersion: 1,
    documentJson: Object.freeze({ type: 'doc' }),
  }),
  revision: Object.freeze({
    algorithm: 'SHA-256',
    digestHex,
    strongEntityTag: \`"sha256-\${digestHex}"\`,
  }),
});
const queue = autosave.createDocumentAutosaveQueue({
  save() {
    return { status: 'conflict' };
  },
});
void queue.enqueue(evidence).then(async (outcome) => {
  assert.equal(outcome.status, 'conflict');
  assert.equal((await queue.flush()).blockedReason, 'conflict');
  assert.equal((await queue.close()).state, 'closed');
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
  const configurationPath = join(consumerDirectory, 'tsconfig.json');
  writeFileSync(
    sourcePath,
    `import {
  createDocumentAutosaveQueue,
  type DocumentAutosaveRequestOutcome,
  type DocumentAutosaveRevisionEvidence,
} from '${packageJson.name}/autosave';

declare const evidence: DocumentAutosaveRevisionEvidence;
const queue = createDocumentAutosaveQueue({
  save: async () => ({ status: 'saved' }),
});
const outcome: Promise<DocumentAutosaveRequestOutcome> = queue.enqueue(evidence);
void outcome;
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
    `Verified framework-free packed ${packageJson.name}/autosave through ESM, CommonJS, and strict TypeScript.`,
  );
} finally {
  rmSync(verificationRoot, { recursive: true, force: true });
}
