import { describe, expect, it, vi } from 'vitest';
import {
  sheetJsBytesToWorkbookData,
  type SheetJsParserModule,
} from './sheetJsAdapter.js';
import { SpreadsheetImportError } from './spreadsheetImport.js';

const XLSX_SOURCE = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);

function expectSpreadsheetError(
  action: () => unknown,
  code: 'UNSUPPORTED_OR_CORRUPT' | 'RESOURCE_LIMIT_EXCEEDED',
): void {
  let caught: unknown;
  try {
    action();
  } catch (error) {
    caught = error;
  }

  expect(caught).toBeInstanceOf(SpreadsheetImportError);
  expect(caught).toMatchObject({ code });
}

function parserWithSelectiveSheetNames(
  selectiveSheetNames: unknown,
): SheetJsParserModule {
  let pass = 0;
  return {
    read: vi.fn(() => {
      pass += 1;
      if (pass === 1) {
        return { SheetNames: ['Summary'] };
      }
      return {
        SheetNames: selectiveSheetNames,
        Sheets: { Summary: {} },
      };
    }),
    utils: {
      decode_range: vi.fn(),
      sheet_to_json: vi.fn(),
    },
  };
}

describe('sheetJsBytesToWorkbookData selective sheet-index authority', () => {
  it('rejects a selective parse whose sheet-name container is not a data array', () => {
    expectSpreadsheetError(
      () =>
        sheetJsBytesToWorkbookData(
          XLSX_SOURCE,
          parserWithSelectiveSheetNames({}),
        ),
      'UNSUPPORTED_OR_CORRUPT',
    );
  });

  it('rejects a selective parse that reports more worksheet names than the workbook ceiling', () => {
    const sheetNames = Array.from(
      { length: 257 },
      (_, index) => `Sheet ${index}`,
    );
    expectSpreadsheetError(
      () =>
        sheetJsBytesToWorkbookData(
          XLSX_SOURCE,
          parserWithSelectiveSheetNames(sheetNames),
        ),
      'RESOURCE_LIMIT_EXCEEDED',
    );
  });

  it('rejects a selective parse whose sheet names are not strings', () => {
    expectSpreadsheetError(
      () =>
        sheetJsBytesToWorkbookData(
          XLSX_SOURCE,
          parserWithSelectiveSheetNames([123]),
        ),
      'UNSUPPORTED_OR_CORRUPT',
    );
  });

  it('rejects a selective parse whose sheet name exceeds the code-unit ceiling', () => {
    expectSpreadsheetError(
      () =>
        sheetJsBytesToWorkbookData(
          XLSX_SOURCE,
          parserWithSelectiveSheetNames(['x'.repeat(1_025)]),
        ),
      'RESOURCE_LIMIT_EXCEEDED',
    );
  });

  it('rejects a selective parse that lists the requested sheet more than once', () => {
    expectSpreadsheetError(
      () =>
        sheetJsBytesToWorkbookData(
          XLSX_SOURCE,
          parserWithSelectiveSheetNames(['Other', 'Summary', 'Summary']),
        ),
      'UNSUPPORTED_OR_CORRUPT',
    );
  });

  it('rejects a selective parse that omits the requested visible sheet', () => {
    expectSpreadsheetError(
      () =>
        sheetJsBytesToWorkbookData(
          XLSX_SOURCE,
          parserWithSelectiveSheetNames(['Other']),
        ),
      'UNSUPPORTED_OR_CORRUPT',
    );
  });
});
