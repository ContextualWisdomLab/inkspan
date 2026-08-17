import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseSheetJsSpreadsheetBytes } from './sheetJsRuntime.js';

function serializeBiff8(workbook: XLSX.WorkBook): Uint8Array {
  const serialized = XLSX.write(workbook, { type: 'array', bookType: 'biff8' });
  return serialized instanceof Uint8Array
    ? serialized
    : new Uint8Array(serialized as ArrayBuffer);
}

function realBiff8WithHiddenSheet(): Uint8Array {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ['Kind', 'Value'],
      ['Revenue', 42],
    ]),
    'Summary',
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([['private hidden value']]),
    'Hidden',
  );
  workbook.Workbook = {
    ...(workbook.Workbook ?? {}),
    Sheets: [{ Hidden: 0 }, { Hidden: 1 }],
  };
  return serializeBiff8(workbook);
}

function realBiff8WithoutHiddenSheet(): Uint8Array {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ['Kind', 'Value'],
      ['Previous', 1],
    ]),
    'Previous',
  );
  return serializeBiff8(workbook);
}

function visibilityProjection(workbook: {
  readonly worksheets: readonly { readonly name: string; readonly hidden: boolean }[];
}) {
  return workbook.worksheets.map(({ name, hidden }) => ({ name, hidden }));
}

const EXPECTED_VISIBILITY = [
  { name: 'Summary', hidden: false },
  { name: 'Hidden', hidden: true },
] as const;

describe('SheetJS BIFF8 runtime source isolation', () => {
  it('does not mutate caller bytes and gives the same visibility on repeated imports', async () => {
    const bytes = realBiff8WithHiddenSheet();
    const pristineBytes = Array.from(bytes);

    expect(
      visibilityProjection(await parseSheetJsSpreadsheetBytes(bytes)),
    ).toEqual(EXPECTED_VISIBILITY);
    expect(Array.from(bytes)).toEqual(pristineBytes);

    expect(
      visibilityProjection(await parseSheetJsSpreadsheetBytes(bytes)),
    ).toEqual(EXPECTED_VISIBILITY);
    expect(Array.from(bytes)).toEqual(pristineBytes);
  });

  it('does not let an earlier BIFF8 workbook alter a later workbook visibility decision', async () => {
    expect(
      visibilityProjection(
        await parseSheetJsSpreadsheetBytes(realBiff8WithoutHiddenSheet()),
      ),
    ).toEqual([{ name: 'Previous', hidden: false }]);

    expect(
      visibilityProjection(
        await parseSheetJsSpreadsheetBytes(realBiff8WithHiddenSheet()),
      ),
    ).toEqual(EXPECTED_VISIBILITY);
  });
});
