import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(
  readFileSync(join(repositoryRoot, 'package.json'), 'utf8'),
);
const verificationRoot = mkdtempSync(join(tmpdir(), 'inkspan-review-react-'));
const extractionDirectory = join(verificationRoot, 'extracted');
const consumerDirectory = join(verificationRoot, 'consumer');
const packageDirectory = join(
  consumerDirectory,
  'node_modules',
  ...packageJson.name.split('/'),
);

const ambientAuthorityPattern =
  /(?:\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|\bEventSource\b|\bprocess\.env\b|\bimport\.meta\.env\b|\bDeno\.env\b|\bBun\.env\b)/u;
const dynamicImportPattern = /\bimport\s*\(/u;
const esmSpecifierPattern =
  /\b(?:import|export)\s+(?:[^'";]*?\sfrom\s*)?['"]([^'"]+)['"]/gu;
const requireSpecifierPattern = /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/gu;
const allowedRuntimeSpecifiers = new Set(['react', 'react/jsx-runtime']);

function run(command, argumentsList, cwd = repositoryRoot) {
  return execFileSync(command, argumentsList, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
}

function linkDependency(name) {
  const source = join(repositoryRoot, 'node_modules', ...name.split('/'));
  const target = join(consumerDirectory, 'node_modules', ...name.split('/'));
  assert.ok(existsSync(source), `repository dependency missing: ${name}`);
  mkdirSync(dirname(target), { recursive: true });
  symlinkSync(source, target, 'dir');
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
    '{"name":"inkspan-review-react-consumer","private":true,"type":"module"}\n',
    'utf8',
  );
  for (const dependency of [
    'react',
    'react-dom',
    '@types/react',
    '@types/react-dom',
  ]) {
    linkDependency(dependency);
  }
}

function verifyBoundedRuntimeImports() {
  const files = [
    ['cwl-review-react.js', esmSpecifierPattern],
    ['cwl-review-react.cjs', requireSpecifierPattern],
  ];
  for (const [filename, specifierPattern] of files) {
    const source = readFileSync(join(packageDirectory, 'dist', filename), 'utf8');
    assert.equal(
      ambientAuthorityPattern.test(source),
      false,
      `${filename} must not reference ambient network or credential authority`,
    );
    assert.equal(
      dynamicImportPattern.test(source),
      false,
      `${filename} must not dynamically import runtime authority`,
    );
    specifierPattern.lastIndex = 0;
    for (const match of source.matchAll(specifierPattern)) {
      assert.ok(
        allowedRuntimeSpecifiers.has(match[1]),
        `${filename} imports unexpected runtime authority: ${match[1]}`,
      );
    }
  }
}

function presentationFixture(digestCharacter) {
  const digestHex = digestCharacter.repeat(64);
  return {
    contractVersion: 1,
    threadKey: 'thread_1',
    target: {
      contractVersion: 1,
      revision: {
        algorithm: 'SHA-256',
        digestHex,
        strongEntityTag: `"sha256-${digestHex}"`,
      },
      selector: { type: 'TextPositionSelector', start: 3, end: 8 },
      projection: { id: 'inkspan-prosemirror-text', version: 1 },
    },
    state: 'unresolved',
    commentCount: 2,
    selected: true,
    canReply: true,
    canResolve: true,
  };
}

function verifyRuntimeConsumers() {
  const labelsSource = `{
  region: 'Document review',
  thread: (_thread, index) => 'Thread ' + (index + 1),
  reply: 'Reply',
  resolve: 'Resolve',
}`;
  const fixture = JSON.stringify(presentationFixture('a'));
  const esmPath = join(consumerDirectory, 'consumer.mjs');
  writeFileSync(
    esmPath,
    `import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CwlReviewThreadList } from '${packageJson.name}/review-react';
const html = renderToStaticMarkup(React.createElement(CwlReviewThreadList, {
  presentations: [${fixture}],
  labels: ${labelsSource},
  onSelectThread() {},
}));
assert.match(html, /aria-label="Document review"/u);
assert.match(html, /aria-pressed="true"/u);
assert.match(html, />Reply</u);
assert.match(html, /disabled=""[^>]*>Reply|>Reply<\/button>/u);
`,
    'utf8',
  );
  const cjsPath = join(consumerDirectory, 'consumer.cjs');
  writeFileSync(
    cjsPath,
    `const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { CwlReviewThreadList } = require('${packageJson.name}/review-react');
const html = renderToStaticMarkup(React.createElement(CwlReviewThreadList, {
  presentations: [${JSON.stringify(presentationFixture('b'))}],
  labels: ${labelsSource},
  onSelectThread() {},
}));
assert.match(html, /aria-label="Document review"/u);
assert.match(html, /aria-pressed="true"/u);
assert.match(html, />Resolve</u);
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
  CwlReviewThreadList,
  type CwlReviewThreadListLabels,
  type CwlReviewThreadListProps,
} from '${packageJson.name}/review-react';
const labels: CwlReviewThreadListLabels = {
  region: 'Document review',
  thread: (thread, index) => String(index) + thread.state,
  reply: 'Reply',
  resolve: 'Resolve',
};
const props: CwlReviewThreadListProps = {
  presentations: [],
  labels,
  onSelectThread(thread) {
    void thread.threadKey;
  },
};
const component: typeof CwlReviewThreadList = CwlReviewThreadList;
void [props, component];
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
          jsx: 'react-jsx',
          types: ['react'],
        },
        files: ['./consumer.ts'],
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  const compilerPath = join(repositoryRoot, 'node_modules', 'typescript', 'bin', 'tsc');
  assert.ok(existsSync(compilerPath));
  run(process.execPath, [compilerPath, '--project', configurationPath], consumerDirectory);
}

try {
  preparePackage();
  verifyBoundedRuntimeImports();
  verifyRuntimeConsumers();
  verifyDeclarationConsumer();
  console.log(
    `Verified packed ${packageJson.name}/review-react through bounded ESM, CommonJS, and strict TypeScript consumers.`,
  );
} finally {
  rmSync(verificationRoot, { recursive: true, force: true });
}
