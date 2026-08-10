import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/** Read one repository file as UTF-8 text. */
function repositoryFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const packageMetadata = JSON.parse(repositoryFile('package.json')) as {
  exports: Record<string, unknown>;
  scripts: Record<string, string>;
};

describe('headless deterministic Markdown/HTML serialization package contract', () => {
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
      'verify-headless-markdown-package.mjs',
    );
    expect(existsSync(resolve(process.cwd(), 'vite.markdown.config.ts'))).toBe(true);
    expect(existsSync(resolve(process.cwd(), 'src/markdown/index.ts'))).toBe(true);
  });

  it('keeps the headless source graph out of editor adapter modules', () => {
    const serializer = repositoryFile('src/markdown/serializer.ts');

    expect(serializer).not.toContain("from '../extensions/SafeLink.js'");
    expect(serializer).not.toContain("from '../extensions/Base64Image.js'");
    expect(existsSync(resolve(process.cwd(), 'src/policies/safeLinkPolicy.ts'))).toBe(true);
    expect(existsSync(resolve(process.cwd(), 'src/policies/inlineImagePolicy.ts'))).toBe(true);
  });

  it('binds packed verification to editor-free and ambient-authority-free runtime evidence', () => {
    expect(
      existsSync(
        resolve(process.cwd(), 'scripts/verify-headless-markdown-package.mjs'),
      ),
    ).toBe(true);
    const verifier = repositoryFile('scripts/verify-headless-markdown-package.mjs');

    expect(verifier).toContain('forbiddenRuntimeImportPattern');
    for (const forbiddenDependency of [
      'react',
      'react-dom',
      '@tiptap/react',
      '@tiptap/extension-',
      'yjs',
      'y-prosemirror',
    ]) {
      expect(verifier).toContain(forbiddenDependency);
    }
    expect(verifier).toContain('ambientAuthorityPattern');
    for (const forbiddenAuthority of [
      'fetch',
      'XMLHttpRequest',
      'WebSocket',
      'EventSource',
      'process\\.env',
      'import\\.meta\\.env',
    ]) {
      expect(verifier).toContain(forbiddenAuthority);
    }
  });
});
