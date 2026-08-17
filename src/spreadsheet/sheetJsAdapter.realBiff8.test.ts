import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import {
  sheetJsBytesToWorkbookData,
  type SheetJsParserModule,
} from './sheetJsAdapter.js';
import {
  parseSheetJsSpreadsheetBytes,
  spreadsheetFileToDocumentJson,
} from './sheetJsRuntime.js';
import { preflightSpreadsheetBinarySource } from './spreadsheetImport.js';

function realBiff8WithHiddenSheet(): Uint8Array {
  const workbook = XLSX.utils.book_new();
  const summary = XLSX.utils.aoa_to_sheet([
    ['Kind', 'Value'],
    ['Unicode', '매출'],
    ['Multiline', 'line 1\nline 2'],
    ['Boolean', true],
    [
      'Date',
      {
        t: 'd',
        v: new Date(Date.UTC(2026, 7, 17)),
        z: 'yyyy-mm-dd',
      } satisfies XLSX.CellObject,
    ],
    [
      'Formula',
      {
        t: 'n',
        v: 42,
        f: 'SUM(40,2)',
      } satisfies XLSX.CellObject,
    ],
    [
      'Hyperlink',
      {
        t: 's',
        v: 'Reference',
        l: { Target: 'https://secret.invalid/workbook' },
      } satisfies XLSX.CellObject,
    ],
  ]);
  XLSX.utils.book_append_sheet(workbook, summary, 'Summary');
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([['private hidden value']]),
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

function visibilityProjection(workbook: {
  readonly worksheets: readonly { readonly name: string; readonly hidden: boolean }[];
}) {
  return workbook.worksheets.map(({ name, hidden }) => ({ name, hidden }));
}

const EXPECTED_VISIBILITY = [
  { name: 'Summary', hidden: false },
  { name: 'Hidden', hidden: true },
  { name: 'Empty', hidden: false },
] as const;

describe('real BIFF8 hidden-sheet metadata', () => {
  it('survives parser, adapter, runtime, and file-source boundaries', async () => {
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
      visibilityProjection(
        sheetJsBytesToWorkbookData(
          bytes,
          lazyXlsx as unknown as SheetJsParserModule,
        ),
      ),
    ).toEqual(EXPECTED_VISIBILITY);

    expect(
      visibilityProjection(await parseSheetJsSpreadsheetBytes(bytes)),
    ).toEqual(EXPECTED_VISIBILITY);

    const result = await spreadsheetFileToDocumentJson({
      size: bytes.byteLength,
      async arrayBuffer() {
        return bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ) as ArrayBuffer;
      },
    });
    expect(result).toMatchObject({
      worksheetCount: 1,
      rowCount: 7,
      cellCount: 14,
    });
  });
});
