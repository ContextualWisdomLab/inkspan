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

describe('headless deterministic Markdown package contract', () => {
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
    expect(existsSync(verifierPath)).toBe(true);
    if (!existsSync(verifierPath)) return;

    const verifier = readFileSync(verifierPath, 'utf8');
    expect(verifier).toContain('externalRuntimeImportPattern');
    expect(verifier).toContain('dynamicLoaderPattern');
    expect(verifier).toContain('ambientAuthorityPattern');
    expect(verifier).toContain('React');
    expect(verifier).toContain('@tiptap');
    expect(verifier).toContain('yjs');
  });
});
