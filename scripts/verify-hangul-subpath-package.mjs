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
const verificationRoot = mkdtempSync(join(tmpdir(), 'inkspan-hangul-'));
const extractionDirectory = join(verificationRoot, 'extracted');
const consumerDirectory = join(verificationRoot, 'consumer');
const packageDirectory = join(
  consumerDirectory,
  'node_modules',
  ...packageJson.name.split('/'),
);

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
  const tarballPath = join(verificationRoot, packResult.filename);
  assert.ok(existsSync(tarballPath));
  run('tar', ['-xzf', tarballPath, '-C', extractionDirectory]);
  renameSync(join(extractionDirectory, 'package'), packageDirectory);
  writeFileSync(
    join(consumerDirectory, 'package.json'),
    '{"name":"inkspan-hangul-consumer","private":true,"type":"module"}\n',
    'utf8',
  );
}

function verifyBundleAuthority() {
  for (const filename of ['cwl-hangul.js', 'cwl-hangul.cjs']) {
    const source = readFileSync(join(packageDirectory, 'dist', filename), 'utf8');
    assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource/u);
    assert.doesNotMatch(source, /react-dom|@tiptap\/react|y-prosemirror|\byjs\b/u);
    assert.doesNotMatch(source, /process\.env|import\.meta\.env|NVIDIA_NIM_API_KEY|COPILOT_GITHUB_TOKEN/u);
  }
}

function verifyRuntimeConsumers() {
  const esmPath = join(consumerDirectory, 'consumer.mjs');
  writeFileSync(
    esmPath,
    `import assert from 'node:assert/strict';\nconst api = await import('${packageJson.name}/hangul');\nassert.equal(typeof api.openHangulDocument, 'function');\nassert.equal(typeof api.exportHangulDocument, 'function');\nassert.equal(typeof api.HangulDocumentError, 'function');\n`,
    'utf8',
  );
  run(process.execPath, [esmPath], consumerDirectory);

  const cjsPath = join(consumerDirectory, 'consumer.cjs');
  writeFileSync(
    cjsPath,
    `const assert = require('node:assert/strict');\nconst api = require('${packageJson.name}/hangul');\nassert.equal(typeof api.openHangulDocument, 'function');\nassert.equal(typeof api.exportHangulDocument, 'function');\n`,
    'utf8',
  );
  run(process.execPath, [cjsPath], consumerDirectory);
}

function verifyDeclarationConsumer() {
  const sourcePath = join(consumerDirectory, 'consumer.ts');
  const configPath = join(consumerDirectory, 'tsconfig.json');
  writeFileSync(
    sourcePath,
    `import {\n  HangulDocumentError,\n  exportHangulDocument,\n  openHangulDocument,\n  type HangulDocumentEngine,\n  type HangulEngineDocument,\n} from '${packageJson.name}/hangul';\nconst document = null as unknown as HangulEngineDocument;\nconst engine = null as unknown as HangulDocumentEngine;\nvoid [HangulDocumentError, openHangulDocument, exportHangulDocument, document, engine];\n`,
    'utf8',
  );
  writeFileSync(
    configPath,
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
  run(process.execPath, [compilerPath, '--project', configPath], consumerDirectory);
}

try {
  preparePackage();
  verifyBundleAuthority();
  verifyRuntimeConsumers();
  verifyDeclarationConsumer();
  console.log(`Verified packed ${packageJson.name}/hangul ESM, CommonJS, and declarations.`);
} finally {
  rmSync(verificationRoot, { recursive: true, force: true });
}
