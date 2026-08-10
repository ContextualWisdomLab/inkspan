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
const verificationRoot = mkdtempSync(join(tmpdir(), 'inkspan-markdown-'));
const extractionDirectory = join(verificationRoot, 'extracted');
const consumerDirectory = join(verificationRoot, 'consumer');
const packageDirectory = join(
  consumerDirectory,
  'node_modules',
  ...packageJson.name.split('/'),
);

// The shipped serializer bundle must be self-contained: any external runtime
// import, re-export, or dynamic loader would add authority not visible in the
// narrow deterministic conversion contract.
const dynamicLoaderPattern = /(?:\bimport\s*\(|\brequire\s*\()/u;
const externalRuntimeImportPattern =
  /(?:\bimport\s+(?:[^'";]*?\sfrom\s*)?['"][^'"]+['"]|\bexport\s+[^'";]*?\sfrom\s*['"][^'"]+['"])/u;
const ambientAuthorityPattern =
  /(?:\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|\bEventSource\b|\bprocess\.env\b|\bimport\.meta\.env\b|\bDeno\.env\b|\bBun\.env\b)/u;
const forbiddenProductGraphPattern =
  /(?:ReactDOM|\bReact\b|react-dom|@tiptap|y-prosemirror|\byjs\b|\bnaruon\b|contextual-orchestrator|NVIDIA_NIM_API_KEY|COPILOT_GITHUB_TOKEN)/iu;

/** Execute one deterministic package-consumer command. */
function run(command, argumentsList, cwd = repositoryRoot) {
  return execFileSync(command, argumentsList, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
}

/** Build one real npm tarball and install its files without running scripts. */
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
    '{"name":"inkspan-markdown-consumer","private":true,"type":"module"}\n',
    'utf8',
  );
}

/** Prove emitted JavaScript cannot acquire framework, network, or secret authority. */
function verifyAuthorityFreeBundles() {
  for (const filename of ['cwl-markdown.js', 'cwl-markdown.cjs']) {
    const bundleSource = readFileSync(
      join(packageDirectory, 'dist', filename),
      'utf8',
    );
    assert.equal(
      dynamicLoaderPattern.test(bundleSource),
      false,
      `${filename} must not invoke dynamic module loaders`,
    );
    assert.doesNotMatch(
      bundleSource,
      externalRuntimeImportPattern,
      `${filename} must not import external runtime authority`,
    );
    assert.doesNotMatch(
      bundleSource,
      ambientAuthorityPattern,
      `${filename} must not reference ambient network or credential authority`,
    );
    assert.doesNotMatch(
      bundleSource,
      forbiddenProductGraphPattern,
      `${filename} must not embed React, TipTap, Yjs, CWL host, or model authority`,
    );
  }
}

/** Exercise deterministic runtime behavior through the exact packed public subpath. */
function verifyRuntimeConsumers() {
  const esmPath = join(consumerDirectory, 'consumer.mjs');
  writeFileSync(
    esmPath,
    `import assert from 'node:assert/strict';
import {
  markdownToEmailHtml,
  markdownToHtml,
  markdownToPlainText,
  normalizeMarkdown,
} from '${packageJson.name}/markdown';
assert.match(markdownToHtml('[safe](https://example.com)'), /href="https:\/\/example\.com"/u);
assert.doesNotMatch(markdownToHtml('[unsafe](javascript:alert(1))'), /href=/u);
assert.equal(markdownToPlainText('**Alpha** [Beta](https://example.com)'), 'Alpha Beta');
assert.match(normalizeMarkdown('**Alpha**'), /\*\*Alpha\*\*/u);
const email = markdownToEmailHtml('Hello', {
  fullDocument: true,
  languageTag: 'ko-kr',
  textDirection: 'ltr',
});
assert.match(email, /<html lang="ko-KR" dir="ltr">/u);
`,
    'utf8',
  );

  const cjsPath = join(consumerDirectory, 'consumer.cjs');
  writeFileSync(
    cjsPath,
    `const assert = require('node:assert/strict');
const markdown = require('${packageJson.name}/markdown');
assert.equal(typeof markdown.markdownToHtml, 'function');
assert.equal(typeof markdown.htmlToMarkdown, 'function');
assert.equal(typeof markdown.markdownToEmailHtml, 'function');
assert.equal(markdown.markdownToPlainText('# Title'), 'Title');
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
  htmlToMarkdown,
  htmlToPlainText,
  markdownToEmailHtml,
  markdownToHtml,
  markdownToPlainText,
  normalizeMarkdown,
  type HtmlToMarkdownOptions,
  type MarkdownToEmailHtmlOptions,
  type PlainTextOptions,
} from '${packageJson.name}/markdown';
const htmlOptions: HtmlToMarkdownOptions = { includeImageAlt: false };
const emailOptions: MarkdownToEmailHtmlOptions = {
  fullDocument: true,
  languageTag: 'en-US',
  textDirection: 'ltr',
};
const plainOptions: PlainTextOptions = { includeImageAlt: true };
void [
  markdownToHtml('x'),
  htmlToMarkdown('<p>x</p>', htmlOptions),
  normalizeMarkdown('x'),
  markdownToEmailHtml('x', emailOptions),
  markdownToPlainText('x', plainOptions),
  htmlToPlainText('<p>x</p>', plainOptions),
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
  verifyAuthorityFreeBundles();
  verifyRuntimeConsumers();
  verifyDeclarationConsumer();
  console.log(
    `Verified packed ${packageJson.name}/markdown through authority-bounded ESM, CommonJS, and strict TypeScript consumers.`,
  );
} finally {
  rmSync(verificationRoot, { recursive: true, force: true });
}
