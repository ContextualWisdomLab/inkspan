import { describe, expect, it } from 'vitest';
import { spreadsheetWorkbookToDocumentJson } from './spreadsheetImport.js';

describe('spreadsheet worksheet-name resource preflight', () => {
  it('rejects worksheet heading text that alone exceeds the workbook text ceiling', () => {
    const oversizedName = 'x'.repeat(8_388_609);

    expect(() =>
      spreadsheetWorkbookToDocumentJson({
        worksheets: [
          {
            name: oversizedName,
            hidden: false,
            rows: [['kept']],
          },
        ],
      }),
    ).toThrowError('Spreadsheet exceeds the configured resource limits.');
  });
});
