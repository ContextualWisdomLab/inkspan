import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('spreadsheet package subpath contract', () => {
  it('declares an independently built framework-neutral spreadsheet surface', () => {
    const packageJsonPath = fileURLToPath(
      new URL('../../package.json', import.meta.url),
    );
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      exports?: Record<string, unknown>;
      scripts?: Record<string, string>;
    };

    expect(packageJson.exports?.['./spreadsheet']).toEqual({
      types: './dist/spreadsheet/index.d.ts',
      import: './dist/cwl-spreadsheet.js',
      require: './dist/cwl-spreadsheet.cjs',
    });
    expect(packageJson.scripts?.build).toContain('vite.spreadsheet.config.ts');
    expect(packageJson.scripts?.['verify:package']).toContain(
      'verify-spreadsheet-subpath-package.mjs',
    );

    const requiredFiles = [
      './index.ts',
      '../../vite.spreadsheet.config.ts',
      '../../scripts/verify-spreadsheet-subpath-package.mjs',
    ];
    for (const relativePath of requiredFiles) {
      expect(
        existsSync(fileURLToPath(new URL(relativePath, import.meta.url))),
      ).toBe(true);
    }
  });
});
