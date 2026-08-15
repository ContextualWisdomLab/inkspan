import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('spreadsheet package subpath contract', () => {
  it('declares an independently built framework-neutral spreadsheet surface', () => {
    const repositoryRoot = process.cwd();
    const packageJson = JSON.parse(
      readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8'),
    ) as {
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
      'src/spreadsheet/index.ts',
      'vite.spreadsheet.config.ts',
      'scripts/verify-spreadsheet-subpath-package.mjs',
    ];
    for (const relativePath of requiredFiles) {
      expect(existsSync(resolve(repositoryRoot, relativePath))).toBe(true);
    }
  });
});
