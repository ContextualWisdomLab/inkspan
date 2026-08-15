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
const verificationRoot = mkdtempSync(join(tmpdir(), 'inkspan-spreadsheet-'));
const extractionDirectory = join(verificationRoot, 'extracted');
const consumerDirectory = join(verificationRoot, 'consumer');
const packageDirectory = join(
  consumerDirectory,
  'node_modules',
  ...packageJson.name.split('/'),
);
const ambientAuthorityPattern =
  /(?:\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|\bEventSource\b|\bprocess\.env\b|\bimport\.meta\.env\b|\bDeno\.env\b|\bBun\.env\b)/u;
const forbiddenProductGraphPattern =
  /(?:ReactDOM|\bReact\b|react-dom|@tiptap\/react|y-prosemirror|\byjs\b|\bnaruon\b|contextual-orchestrator|NVIDIA_NIM_API_KEY|COPILOT_GITHUB_TOKEN)/iu;

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
  const packResult = JSON.parse(
    run('npm', [
      'pack',
      '--json',
      '--ignore-scripts',
      '--pack-destination',
      verificationRoot,
    ]),
  )[0];
  assert.equal(packResult.name, packageJson.name);
  assert.equal(packResult.version, packageJson.version);
  const tarballPath = join(verificationRoot, packResult.filename);
  assert.ok(existsSync(tarballPath));
  run('tar', ['-xzf', tarballPath, '-C', extractionDirectory]);
  renameSync(join(extractionDirectory, 'package'), packageDirectory);
  writeFileSync(
    join(consumerDirectory, 'package.json'),
    '{"name":"inkspan-spreadsheet-consumer","private":true,"type":"module"}\n',
    'utf8',
  );
}

function verifyAuthorityFreeBundles() {
  assert.ok(existsSync(join(packageDirectory, 'dist', 'spreadsheet', 'index.d.ts')));
  for (const filename of ['cwl-spreadsheet.js', 'cwl-spreadsheet.cjs']) {
    const bundleSource = readFileSync(
      join(packageDirectory, 'dist', filename),
      'utf8',
    );
    assert.deepEqual(
      findRuntimeModuleAuthority(bundleSource, filename),
      [],
      `${filename} must not contain executable runtime module authority`,
    );
    assert.doesNotMatch(
      bundleSource,
      ambientAuthorityPattern,
      `${filename} must not reference ambient network or credential authority`,
    );
    assert.doesNotMatch(
      bundleSource,
      forbiddenProductGraphPattern,
      `${filename} must not embed React, Yjs, CWL host, or model authority`,
    );
  }
}

function verifyRuntimeConsumers() {
  const esmPath = join(consumerDirectory, 'consumer.mjs');
  writeFileSync(
    esmPath,
    `import assert from 'node:assert/strict';
const spreadsheet = await import('${packageJson.name}/spreadsheet');
const binary = spreadsheet.preflightSpreadsheetBinarySource(
  new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
);
assert.equal(binary.format, 'xlsx');
const result = spreadsheet.spreadsheetWorkbookToDocumentJson({
  worksheets: [{ name: 'Sheet 1', hidden: false, rows: [['Alpha', 'Beta']] }],
});
assert.equal(result.worksheetCount, 1);
assert.equal(result.rowCount, 1);
assert.equal(result.cellCount, 2);
assert.equal(result.content[0].type, 'heading');
assert.equal(result.content[1].type, 'table');
`,
    'utf8',
  );

  const cjsPath = join(consumerDirectory, 'consumer.cjs');
  writeFileSync(
    cjsPath,
    `const assert = require('node:assert/strict');
const spreadsheet = require('${packageJson.name}/spreadsheet');
assert.equal(typeof spreadsheet.preflightSpreadsheetBinarySource, 'function');
assert.equal(typeof spreadsheet.spreadsheetWorkbookToDocumentJson, 'function');
assert.throws(
  () => spreadsheet.preflightSpreadsheetBinarySource(new Uint8Array([1, 2, 3, 4])),
  (error) => error && error.code === 'UNSUPPORTED_OR_CORRUPT',
);
`,
    'utf8',
  );

  run(process.execPath, [esmPath], consumerDirectory);
  run(process.execPath, [cjsPath], consumerDirectory);
}

try {
  preparePackage();
  verifyAuthorityFreeBundles();
  verifyRuntimeConsumers();
  console.log(
    `Verified packed ${packageJson.name}/spreadsheet through authority-bounded ESM and CommonJS consumers.`,
  );
} finally {
  rmSync(verificationRoot, { recursive: true, force: true });
}
