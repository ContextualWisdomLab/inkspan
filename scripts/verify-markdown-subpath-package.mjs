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
const verificationRoot = mkdtempSync(join(tmpdir(), 'inkspan-markdown-'));
const extractionDirectory = join(verificationRoot, 'extracted');
const consumerDirectory = join(verificationRoot, 'consumer');
const packageDirectory = join(
  consumerDirectory,
  'node_modules',
  ...packageJson.name.split('/'),
);

// The shipped serializer bundle must be self-contained. Parse executable syntax
// rather than raw text so bundled dependency comments cannot masquerade as
// module authority while real imports, re-exports, require(), and import()
// remain fail-closed findings.
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
    const moduleAuthority = findRuntimeModuleAuthority(bundleSource, filename);
    assert.equal(
      moduleAuthority.length,
      0,
      `${filename} must not contain executable runtime module authority: ${JSON.stringify(moduleAuthority)}`,
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
Object.defineProperty(globalThis, 'document', {
  configurable: true,
  get() { throw new Error('ambient document access is forbidden'); },
});
const markdown = await import('${packageJson.name}/markdown');
const {
  DEFAULT_HTML_TO_MARKDOWN_MAX_BYTES,
  DEFAULT_MARKDOWN_TO_HTML_MAX_BYTES,
  MAXIMUM_HTML_TO_MARKDOWN_MAX_BYTES,
  MAXIMUM_MARKDOWN_TO_HTML_MAX_BYTES,
  HtmlToMarkdownResourceError,
  MarkdownToHtmlResourceError,
  htmlToMarkdown,
  markdownToEmailHtml,
  markdownToHtml,
  markdownToPlainText,
  normalizeMarkdown,
} = markdown;
assert.equal(DEFAULT_HTML_TO_MARKDOWN_MAX_BYTES, 16_777_216);
assert.equal(MAXIMUM_HTML_TO_MARKDOWN_MAX_BYTES, 67_108_864);
assert.equal(DEFAULT_MARKDOWN_TO_HTML_MAX_BYTES, 16_777_216);
assert.equal(MAXIMUM_MARKDOWN_TO_HTML_MAX_BYTES, 67_108_864);
const safeHtml = markdownToHtml('[safe](https://example.com)');
assert.equal(safeHtml.includes('href="https://example.com"'), true);
assert.doesNotMatch(markdownToHtml('[unsafe](javascript:alert(1))'), /href=/u);
let markdownBoundedFailure;
try {
  markdownToHtml('oversized', { maxMarkdownBytes: 4 });
} catch (error) {
  markdownBoundedFailure = error;
}
assert.equal(markdownBoundedFailure instanceof MarkdownToHtmlResourceError, true);
assert.equal(markdownBoundedFailure?.name, 'MarkdownToHtmlResourceError');
assert.equal(markdownBoundedFailure?.code, 'input_too_large');
assert.equal(
  markdownBoundedFailure?.message,
  'Markdown-to-HTML input exceeds the configured byte limit.',
);
assert.equal(htmlToMarkdown('<p>Alpha <strong>Beta</strong></p>'), 'Alpha **Beta**');
let htmlBoundedFailure;
try {
  htmlToMarkdown('<p>oversized</p>', { maxHtmlBytes: 4 });
} catch (error) {
  htmlBoundedFailure = error;
}
assert.equal(htmlBoundedFailure instanceof HtmlToMarkdownResourceError, true);
assert.equal(htmlBoundedFailure?.name, 'HtmlToMarkdownResourceError');
assert.equal(htmlBoundedFailure?.code, 'input_too_large');
assert.equal(
  htmlBoundedFailure?.message,
  'HTML-to-Markdown input exceeds the configured byte limit.',
);
assert.equal(markdownToPlainText('**Alpha** [Beta](https://example.com)'), 'Alpha Beta');
assert.equal(normalizeMarkdown('**Alpha**').includes('**Alpha**'), true);
const email = markdownToEmailHtml('Hello', {
  fullDocument: true,
  languageTag: 'ko-kr',
  textDirection: 'ltr',
});
assert.equal(email.includes('<html lang="ko-KR" dir="ltr">'), true);
delete globalThis.document;
`,
    'utf8',
  );

  const cjsPath = join(consumerDirectory, 'consumer.cjs');
  writeFileSync(
    cjsPath,
    `const assert = require('node:assert/strict');
Object.defineProperty(globalThis, 'document', {
  configurable: true,
  get() { throw new Error('ambient document access is forbidden'); },
});
const markdown = require('${packageJson.name}/markdown');
assert.equal(typeof markdown.markdownToHtml, 'function');
assert.equal(markdown.htmlToMarkdown('<p>Gamma</p>'), 'Gamma');
assert.equal(markdown.DEFAULT_HTML_TO_MARKDOWN_MAX_BYTES, 16_777_216);
assert.equal(markdown.MAXIMUM_HTML_TO_MARKDOWN_MAX_BYTES, 67_108_864);
assert.equal(typeof markdown.HtmlToMarkdownResourceError, 'function');
assert.equal(markdown.DEFAULT_MARKDOWN_TO_HTML_MAX_BYTES, 16_777_216);
assert.equal(markdown.MAXIMUM_MARKDOWN_TO_HTML_MAX_BYTES, 67_108_864);
assert.equal(typeof markdown.MarkdownToHtmlResourceError, 'function');
assert.throws(
  () => markdown.markdownToHtml('oversized', { maxMarkdownBytes: 4 }),
  (error) => error instanceof markdown.MarkdownToHtmlResourceError && error.code === 'input_too_large',
);
assert.equal(typeof markdown.markdownToEmailHtml, 'function');
assert.equal(markdown.markdownToPlainText('# Title'), 'Title');
delete globalThis.document;
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
  DEFAULT_HTML_TO_MARKDOWN_MAX_BYTES,
  DEFAULT_MARKDOWN_TO_HTML_MAX_BYTES,
  MAXIMUM_HTML_TO_MARKDOWN_MAX_BYTES,
  MAXIMUM_MARKDOWN_TO_HTML_MAX_BYTES,
  HtmlToMarkdownResourceError,
  MarkdownToHtmlResourceError,
  htmlToMarkdown,
  htmlToPlainText,
  markdownToEmailHtml,
  markdownToHtml,
  markdownToPlainText,
  normalizeMarkdown,
  type HtmlToMarkdownOptions,
  type HtmlToMarkdownResourceErrorCode,
  type MarkdownToEmailHtmlOptions,
  type MarkdownToHtmlOptions,
  type MarkdownToHtmlResourceErrorCode,
  type PlainTextOptions,
} from '${packageJson.name}/markdown';
const htmlOptions: HtmlToMarkdownOptions = {
  includeImageAlt: false,
  maxHtmlBytes: 1024,
};
const markdownOptions: MarkdownToHtmlOptions = { maxMarkdownBytes: 1024 };
const htmlErrorCode: HtmlToMarkdownResourceErrorCode = 'input_too_large';
const htmlResourceError = new HtmlToMarkdownResourceError(htmlErrorCode);
const markdownErrorCode: MarkdownToHtmlResourceErrorCode = 'input_too_large';
const markdownResourceError = new MarkdownToHtmlResourceError(markdownErrorCode);
const emailOptions: MarkdownToEmailHtmlOptions = {
  fullDocument: true,
  languageTag: 'en-US',
  textDirection: 'ltr',
};
const plainOptions: PlainTextOptions = { includeImageAlt: true };
void [
  DEFAULT_HTML_TO_MARKDOWN_MAX_BYTES,
  MAXIMUM_HTML_TO_MARKDOWN_MAX_BYTES,
  DEFAULT_MARKDOWN_TO_HTML_MAX_BYTES,
  MAXIMUM_MARKDOWN_TO_HTML_MAX_BYTES,
  htmlResourceError.code,
  markdownResourceError.code,
  markdownToHtml('x', markdownOptions),
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
