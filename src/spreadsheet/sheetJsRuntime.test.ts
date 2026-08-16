import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseSheetJsSpreadsheetBytes } from './sheetJsRuntime.js';

function workbookBytes(bookType: 'xlsx' | 'biff8'): Uint8Array {
  const workbook = XLSX.utils.book_new();
  const summary = XLSX.utils.aoa_to_sheet([
    ['Metric', 'Value'],
    ['Revenue', 42],
  ]);
  summary.C3 = { t: 'n', f: '1+1', v: 2 };
  summary['!ref'] = 'A1:C3';
  XLSX.utils.book_append_sheet(workbook, summary, 'Summary');

  const hidden = XLSX.utils.aoa_to_sheet([['secret']]);
  XLSX.utils.book_append_sheet(workbook, hidden, 'Hidden');
  workbook.Workbook ??= {};
  workbook.Workbook.Sheets ??= [];
  workbook.Workbook.Sheets[1] = {
    ...workbook.Workbook.Sheets[1],
    Hidden: 1,
  };

  const written = XLSX.write(workbook, {
    bookType,
    type: 'array',
  });
  return new Uint8Array(written);
}

describe('real SheetJS spreadsheet runtime', () => {
  it.each([
    ['XLSX', 'xlsx'],
    ['BIFF8 XLS', 'biff8'],
  ] as const)('parses a real %s workbook through the bounded adapter', async (_label, bookType) => {
    const workbook = await parseSheetJsSpreadsheetBytes(workbookBytes(bookType));

    expect(workbook).toEqual({
      worksheets: [
        {
          name: 'Summary',
          hidden: false,
          rows: [
            ['Metric', 'Value', ''],
            ['Revenue', '42', ''],
            ['', '', '2'],
          ],
        },
        {
          name: 'Hidden',
          hidden: true,
          rows: [],
        },
      ],
    });
  });
});
