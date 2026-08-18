import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as spreadsheet from './index.js';
import {
  preflightSpreadsheetBinarySource,
  spreadsheetWorkbookToDocumentJson,
  SpreadsheetImportError,
} from './spreadsheetImport.js';

describe('spreadsheet package subpath contract', () => {
  it('re-exports the framework-neutral spreadsheet runtime through the public source barrel', () => {
    expect(spreadsheet.preflightSpreadsheetBinarySource).toBe(
      preflightSpreadsheetBinarySource,
    );
    expect(spreadsheet.spreadsheetWorkbookToDocumentJson).toBe(
      spreadsheetWorkbookToDocumentJson,
    );
    expect(spreadsheet.SpreadsheetImportError).toBe(SpreadsheetImportError);
  });

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
