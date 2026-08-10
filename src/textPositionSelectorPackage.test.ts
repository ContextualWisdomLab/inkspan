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

describe('React-free text-position selector package contract', () => {
  it('declares one independently consumable ESM CommonJS and TypeScript subpath', () => {
    expect(packageMetadata.exports['./text-position-selector']).toEqual({
      types: './dist/text-position-selector/index.d.ts',
      import: './dist/cwl-text-position-selector.js',
      require: './dist/cwl-text-position-selector.cjs',
    });
    expect(packageMetadata.scripts.build).toContain(
      'vite build --config vite.text-position-selector.config.ts',
    );
    expect(packageMetadata.scripts['verify:package']).toContain(
      'verify-text-position-selector-subpath-package.mjs',
    );
    expect(existsSync(resolve(process.cwd(), 'vite.text-position-selector.config.ts'))).toBe(true);
    expect(existsSync(resolve(process.cwd(), 'src/text-position-selector/index.ts'))).toBe(true);
  });

  it('keeps the public distribution guide explicit about the React-free boundary', () => {
    const guide = repositoryFile('docs/package-distribution.md');
    expect(guide).toContain(
      '`@contextualwisdomlab/cwl-editor/text-position-selector`',
    );
    expect(guide).toMatch(/React-free[^\n]*text-position/iu);
    expect(guide).toMatch(/ESM[^\n]*CommonJS[^\n]*strict TypeScript/iu);
  });
});
