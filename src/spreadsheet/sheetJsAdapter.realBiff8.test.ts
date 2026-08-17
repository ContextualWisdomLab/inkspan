import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import {
  sheetJsBytesToWorkbookData,
  type SheetJsParserModule,
} from './sheetJsAdapter.js';
import { preflightSpreadsheetBinarySource } from './spreadsheetImport.js';

function realBiff8WithHiddenSheet(): Uint8Array {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([['public']]),
    'Summary',
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([['private']]),
    'Hidden',
  );
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([]), 'Empty');
  workbook.Workbook = {
    ...(workbook.Workbook ?? {}),
    Sheets: [{ Hidden: 0 }, { Hidden: 1 }, { Hidden: 0 }],
  };

  const serialized = XLSX.write(workbook, { type: 'array', bookType: 'biff8' });
  return serialized instanceof Uint8Array
    ? serialized
    : new Uint8Array(serialized as ArrayBuffer);
}

describe('real BIFF8 hidden-sheet metadata', () => {
  it('survives the lazy parser boundary and remains authoritative in the adapter', async () => {
    const bytes = realBiff8WithHiddenSheet();
    expect(preflightSpreadsheetBinarySource(bytes).format).toBe('xls');

    const lazyXlsx = await import('xlsx');
    const visibilityWorkbook = lazyXlsx.read(bytes, {
      type: 'array',
      cellFormula: false,
      cellHTML: false,
      cellNF: false,
      bookVBA: false,
      sheetRows: 1,
    });

    expect(visibilityWorkbook.SheetNames).toEqual([
      'Summary',
      'Hidden',
      'Empty',
    ]);
    expect(
      visibilityWorkbook.Workbook?.Sheets?.map((sheet) => sheet.Hidden ?? 0),
    ).toEqual([0, 1, 0]);
    expect(
      Object.getOwnPropertyDescriptor(
        visibilityWorkbook.Workbook!.Sheets![1]!,
        'Hidden',
      )?.value,
    ).toBe(1);

    expect(
      sheetJsBytesToWorkbookData(
        bytes,
        lazyXlsx as unknown as SheetJsParserModule,
      ).worksheets.map(({ name, hidden }) => ({ name, hidden })),
    ).toEqual([
      { name: 'Summary', hidden: false },
      { name: 'Hidden', hidden: true },
      { name: 'Empty', hidden: false },
    ]);
  });
});
