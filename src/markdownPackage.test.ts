import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HTML_TO_MARKDOWN_MAX_BYTES,
  MAXIMUM_HTML_TO_MARKDOWN_MAX_BYTES,
  HtmlToMarkdownResourceError,
  htmlToMarkdown,
  htmlToPlainText,
  markdownToEmailHtml,
  markdownToHtml,
  markdownToPlainText,
  normalizeMarkdown,
} from './markdown/index.js';

/** Read one repository file as UTF-8 text. */
function repositoryFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const packageMetadata = JSON.parse(repositoryFile('package.json')) as {
  exports: Record<string, unknown>;
  scripts: Record<string, string>;
};

describe('headless deterministic Markdown package contract', () => {
  it('executes the intended deterministic conversion surface through the source barrel', () => {
    expect(markdownToHtml('**Alpha**')).toContain('<strong>Alpha</strong>');
    expect(htmlToMarkdown('<p>Alpha</p>')).toBe('Alpha');
    expect(DEFAULT_HTML_TO_MARKDOWN_MAX_BYTES).toBe(16_777_216);
    expect(MAXIMUM_HTML_TO_MARKDOWN_MAX_BYTES).toBe(67_108_864);
    expect(HtmlToMarkdownResourceError).toBeInstanceOf(Function);
    expect(() =>
      htmlToMarkdown('<p>Alpha</p>', { maxHtmlBytes: 4 }),
    ).toThrowError(
      expect.objectContaining({
        name: 'HtmlToMarkdownResourceError',
        code: 'input_too_large',
      }),
    );
    expect(normalizeMarkdown('**Alpha**')).toContain('**Alpha**');
    expect(markdownToPlainText('[Alpha](https://example.com)')).toBe('Alpha');
    expect(htmlToPlainText('<p>Alpha</p>')).toBe('Alpha');
    expect(
      markdownToEmailHtml('Alpha', {
        fullDocument: true,
        languageTag: 'ko-kr',
        textDirection: 'ltr',
      }),
    ).toContain('<html lang="ko-KR" dir="ltr">');
  });

  it('declares one independently built ESM CommonJS and TypeScript subpath', () => {
    expect(packageMetadata.exports['./markdown']).toEqual({
      types: './dist/markdown/index.d.ts',
      import: './dist/cwl-markdown.js',
      require: './dist/cwl-markdown.cjs',
    });
    expect(packageMetadata.scripts.build).toContain(
      'vite build --config vite.markdown.config.ts',
    );
    expect(packageMetadata.scripts['verify:package']).toContain(
      'verify-markdown-subpath-package.mjs',
    );
    expect(existsSync(resolve(process.cwd(), 'vite.markdown.config.ts'))).toBe(true);
    expect(existsSync(resolve(process.cwd(), 'src/markdown/package.ts'))).toBe(true);
  });

  it('pins the headless build to Turndown standalone resolution and transforms its mixed CommonJS edge', () => {
    const configuration = repositoryFile('vite.markdown.config.ts');
    expect(configuration).toContain("createRequire(import.meta.url)");
    expect(configuration).toContain(
      "nodeRequire.resolve('turndown/lib/turndown.es.js')",
    );
    expect(configuration).toContain(".resolve(\n  '@mixmark-io/domino',\n)");
    expect(configuration).toContain("find: /^turndown$/u");
    expect(configuration).toContain("replacement: turndownStandaloneEntry");
    expect(configuration).toContain("find: /^@mixmark-io\\/domino$/u");
    expect(configuration).toContain("replacement: dominoStandaloneEntry");
    expect(configuration).toContain(
      "mainFields: ['module', 'jsnext:main', 'jsnext', 'main']",
    );
    expect(configuration).not.toContain(
      "mainFields: ['browser', 'module', 'jsnext:main', 'jsnext']",
    );
    expect(configuration).toContain('commonjsOptions:');
    expect(configuration).toContain('transformMixedEsModules: true');
  });

  it('requires serializers to depend on framework-neutral link and image policy modules', () => {
    const serializer = repositoryFile('src/markdown/serializer.ts');
    expect(serializer).toContain("../policy/safeLinkPolicy.js");
    expect(serializer).toContain("../policy/inlineImagePolicy.js");
    expect(serializer).not.toContain("../extensions/SafeLink.js");
    expect(serializer).not.toContain("../extensions/Base64Image.js");
  });

  it('requires a packed consumer authority-boundary verifier', () => {
    const verifierPath = resolve(
      process.cwd(),
      'scripts/verify-markdown-subpath-package.mjs',
    );
    const authorityScannerPath = resolve(
      process.cwd(),
      'scripts/javascript-runtime-authority.mjs',
    );
    const authorityScannerTestPath = resolve(
      process.cwd(),
      'scripts/javascript-runtime-authority.test.mjs',
    );
    expect(existsSync(verifierPath)).toBe(true);
    expect(existsSync(authorityScannerPath)).toBe(true);
    expect(existsSync(authorityScannerTestPath)).toBe(true);
    if (!existsSync(verifierPath) || !existsSync(authorityScannerPath)) return;

    const verifier = readFileSync(verifierPath, 'utf8');
    const authorityScanner = readFileSync(authorityScannerPath, 'utf8');
    expect(verifier).toContain('findRuntimeModuleAuthority');
    expect(verifier).toContain('moduleAuthority.length');
    expect(verifier).toContain('ambientAuthorityPattern');
    expect(verifier).toContain('ambient document access is forbidden');
    expect(verifier).toContain('maxHtmlBytes');
    expect(verifier).toContain('HtmlToMarkdownResourceError');
    expect(verifier).toContain('React');
    expect(verifier).toContain('@tiptap');
    expect(verifier).toContain('yjs');
    expect(authorityScanner).toContain('ts.createSourceFile');
    expect(authorityScanner).toContain('static-import');
    expect(authorityScanner).toContain('static-reexport');
    expect(authorityScanner).toContain('commonjs-require');
    expect(authorityScanner).toContain('dynamic-import');
    expect(packageMetadata.scripts['test:package-config']).toContain(
      'javascript-runtime-authority.test.mjs',
    );
  });
});
