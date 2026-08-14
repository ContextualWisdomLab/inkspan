import { describe, expect, it } from 'vitest';
import { spreadsheetWorkbookToDocumentJson } from './spreadsheetImport.js';

describe('spreadsheet workbook row-count preflight', () => {
  it('rejects an impossible worksheet row count before reading row entries', () => {
    let rowRead = false;
    const rows = new Array<readonly string[]>(10_001);
    Object.defineProperty(rows, '0', {
      configurable: true,
      enumerable: true,
      get() {
        rowRead = true;
        throw new Error('row payload must not be read');
      },
    });

    expect(() =>
      spreadsheetWorkbookToDocumentJson({
        worksheets: [{ name: 'Too many rows', hidden: false, rows }],
      }),
    ).toThrowError('Spreadsheet exceeds the configured resource limits.');
    expect(rowRead).toBe(false);
  });
});
