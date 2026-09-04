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

import { findRuntimeModuleAuthority } from './javascript-runtime-authority.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(
  readFileSync(join(repositoryRoot, 'package.json'), 'utf8'),
);
const verificationRoot = mkdtempSync(join(tmpdir(), 'inkspan-docx-'));
const extractionDirectory = join(verificationRoot, 'extracted');
const consumerDirectory = join(verificationRoot, 'consumer');
const packageDirectory = join(
  consumerDirectory,
  'node_modules',
  ...packageJson.name.split('/'),
);
const ambientAuthorityPattern =
  /(?:\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|\bEventSource\b|\bprocess\.env\b|\bimport\.meta\.env\b|\bDeno\.env\b|\bBun\.env\b|\bindexedDB\b|\blocalStorage\b|\bsessionStorage\b)/u;

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
    '{"name":"inkspan-docx-consumer","private":true,"type":"module"}\n',
    'utf8',
  );
}

/** Prove the packed subpath exists and carries no external or ambient authority. */
function verifyPackedSurface() {
  for (const relativePath of [
    'dist/cwl-docx.js',
    'dist/cwl-docx.cjs',
    'dist/docx/index.d.ts',
  ]) {
    assert.ok(
      existsSync(join(packageDirectory, relativePath)),
      `${relativePath} must be present in the packed package`,
    );
  }

  for (const filename of ['cwl-docx.js', 'cwl-docx.cjs']) {
    const bundlePath = join(packageDirectory, 'dist', filename);
    const bundleSource = readFileSync(bundlePath, 'utf8');
    const moduleAuthority = findRuntimeModuleAuthority(bundleSource, filename);
    assert.equal(
      moduleAuthority.length,
      0,
      `${filename} must not import runtime module authority: ${JSON.stringify(moduleAuthority)}`,
    );
    assert.doesNotMatch(
      bundleSource,
      ambientAuthorityPattern,
      `${filename} must not reference ambient network, credential, or durable-storage authority`,
    );
  }
}

/** Return one little-endian unsigned 16-bit ZIP field. */
function uint16(value) {
  const bytes = Buffer.alloc(2);
  bytes.writeUInt16LE(value);
  return bytes;
}

/** Return one little-endian unsigned 32-bit ZIP field. */
function uint32(value) {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32LE(value >>> 0);
  return bytes;
}

/** Compute ZIP CRC-32 for one deterministic packed-consumer fixture. */
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Build the smallest stored-entry ZIP needed for a real DOCX consumer proof. */
function createStoredZip(entries) {
  const localRecords = [];
  const centralRecords = [];
  let localOffset = 0;
  for (const [name, source] of Object.entries(entries)) {
    const nameBytes = Buffer.from(name, 'utf8');
    const data = Buffer.from(source, 'utf8');
    const checksum = crc32(data);
    const local = Buffer.concat([
      uint32(0x04034b50),
      uint16(20),
      uint16(0x0800),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(checksum),
      uint32(data.byteLength),
      uint32(data.byteLength),
      uint16(nameBytes.byteLength),
      uint16(0),
      nameBytes,
      data,
    ]);
    const central = Buffer.concat([
      uint32(0x02014b50),
      uint16(20),
      uint16(20),
      uint16(0x0800),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(checksum),
      uint32(data.byteLength),
      uint32(data.byteLength),
      uint16(nameBytes.byteLength),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(0),
      uint32(localOffset),
      nameBytes,
    ]);
    localRecords.push(local);
    centralRecords.push(central);
    localOffset += local.byteLength;
  }
  const centralDirectory = Buffer.concat(centralRecords);
  const end = Buffer.concat([
    uint32(0x06054b50),
    uint16(0),
    uint16(0),
    uint16(centralRecords.length),
    uint16(centralRecords.length),
    uint32(centralDirectory.byteLength),
    uint32(localOffset),
    uint16(0),
  ]);
  return Buffer.concat([...localRecords, centralDirectory, end]);
}

/** Create one valid, local-only DOCX package for the packed runtime consumer. */
function createMinimalDocxBase64() {
  return createStoredZip({
    '[Content_Types].xml':
      '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    'word/document.xml':
      '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Packed consumer</w:t></w:r></w:p><w:sectPr/></w:body></w:document>',
  }).toString('base64');
}

/** Exercise the exact public ESM and CommonJS subpath from the packed package. */
function verifyRuntimeConsumers() {
  const validDocxBase64 = createMinimalDocxBase64();
  const expectedDocument = JSON.stringify({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Packed consumer' }],
      },
    ],
  });
  const esmPath = join(consumerDirectory, 'consumer.mjs');
  writeFileSync(
    esmPath,
    `import assert from 'node:assert/strict';
import {
  DEFAULT_DOCX_IMPORT_LIMITS,
  DocxImportError,
  importDocx,
  openDocx,
} from '${packageJson.name}/docx';
assert.equal(typeof DEFAULT_DOCX_IMPORT_LIMITS.maxArchiveBytes, 'number');
assert.equal(typeof DocxImportError, 'function');
assert.equal(typeof importDocx, 'function');
assert.equal(typeof openDocx, 'function');
const imported = await importDocx(Uint8Array.from(Buffer.from('${validDocxBase64}', 'base64')));
assert.deepEqual(imported.documentJson, ${expectedDocument});
assert.deepEqual(imported.warnings, []);
assert.equal(Object.isFrozen(imported), true);
assert.equal(Object.isFrozen(imported.documentJson), true);
await assert.rejects(
  importDocx(new Uint8Array()),
  (error) => error instanceof DocxImportError && error.code === 'invalid_source',
);
`,
    'utf8',
  );

  const cjsPath = join(consumerDirectory, 'consumer.cjs');
  writeFileSync(
    cjsPath,
    `const assert = require('node:assert/strict');
const docx = require('${packageJson.name}/docx');
assert.equal(typeof docx.DEFAULT_DOCX_IMPORT_LIMITS.maxArchiveBytes, 'number');
assert.equal(typeof docx.DocxImportError, 'function');
assert.equal(typeof docx.importDocx, 'function');
assert.equal(typeof docx.openDocx, 'function');
(async () => {
  const imported = await docx.importDocx(Uint8Array.from(Buffer.from('${validDocxBase64}', 'base64')));
  assert.deepEqual(imported.documentJson, ${expectedDocument});
  assert.deepEqual(imported.warnings, []);
  assert.equal(Object.isFrozen(imported), true);
  assert.equal(Object.isFrozen(imported.documentJson), true);
  await assert.rejects(
    docx.importDocx(new Uint8Array()),
    (error) => error instanceof docx.DocxImportError && error.code === 'invalid_source',
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
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
  DEFAULT_DOCX_IMPORT_LIMITS,
  DocxImportError,
  importDocx,
  openDocx,
  type DocxDocumentTarget,
  type DocxImportOptions,
  type DocxImportResult,
  type DocxSource,
} from '${packageJson.name}/docx';
declare const source: DocxSource;
declare const options: DocxImportOptions;
declare const target: DocxDocumentTarget;
const imported: Promise<DocxImportResult> = importDocx(source, options);
const opened: Promise<DocxImportResult> = openDocx(target, source, options);
const failure = new DocxImportError('invalid_source');
void [
  imported,
  opened,
  failure.code,
  DEFAULT_DOCX_IMPORT_LIMITS.maxArchiveBytes,
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
  verifyPackedSurface();
  verifyRuntimeConsumers();
  verifyDeclarationConsumer();
} finally {
  rmSync(verificationRoot, { recursive: true, force: true });
}