import { describe, expect, it } from 'vitest';
import { spreadsheetWorkbookToDocumentJson } from './spreadsheetImport.js';

describe('spreadsheet worksheet-name resource boundary', () => {
  it('fails closed before materializing an oversized worksheet heading', () => {
    const workbook = {
      worksheets: [
        {
          name: 'x'.repeat(1_025),
          hidden: false,
          rows: [['kept']],
        },
      ],
    };

    expect(() => spreadsheetWorkbookToDocumentJson(workbook)).toThrowError(
      'Spreadsheet exceeds the configured resource limits.',
    );
  });
});
