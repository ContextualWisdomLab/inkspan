import { describe, expect, it } from 'vitest';
import {
  sheetJsBytesToWorkbookData,
  type SheetJsParserModule,
} from './sheetJsAdapter.js';

const XLSX_SOURCE = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);

function parserForSelectedWorkbook(selectedWorkbook: unknown): SheetJsParserModule {
  return {
    read(_source, options) {
      if (options.bookSheets === true) {
        return { SheetNames: ['Summary'], Sheets: {} };
      }
      return selectedWorkbook;
    },
    utils: {
      decode_range: () => ({ s: { r: 0, c: 0 }, e: { r: 0, c: 0 } }),
      sheet_to_json: () => [],
    },
  };
}

function selectedWorkbook(sheetNames: unknown): object {
  return {
    SheetNames: sheetNames,
    Sheets: { Summary: {} },
  };
}

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

  expect(caught).toMatchObject({
    name: 'SpreadsheetImportError',
    code,
    message:
      code === 'UNSUPPORTED_OR_CORRUPT'
        ? 'Spreadsheet source is unsupported or corrupt.'
        : 'Spreadsheet exceeds the configured resource limits.',
  });
}

describe('SheetJS selective worksheet identity validation', () => {
  it('rejects a selected workbook without an array SheetNames identity', () => {
    expectSpreadsheetError(
      () =>
        sheetJsBytesToWorkbookData(
          XLSX_SOURCE,
          parserForSelectedWorkbook(selectedWorkbook('Summary')),
        ),
      'UNSUPPORTED_OR_CORRUPT',
    );
  });

  it('rejects a selected workbook with too many SheetNames entries', () => {
    expectSpreadsheetError(
      () =>
        sheetJsBytesToWorkbookData(
          XLSX_SOURCE,
          parserForSelectedWorkbook(
            selectedWorkbook(new Array<string>(257).fill('Other')),
          ),
        ),
      'RESOURCE_LIMIT_EXCEEDED',
    );
  });

  it('rejects a selected workbook with a non-string sheet identity', () => {
    expectSpreadsheetError(
      () =>
        sheetJsBytesToWorkbookData(
          XLSX_SOURCE,
          parserForSelectedWorkbook(selectedWorkbook([42])),
        ),
      'UNSUPPORTED_OR_CORRUPT',
    );
  });

  it('rejects a selected workbook with an oversized sheet identity', () => {
    expectSpreadsheetError(
      () =>
        sheetJsBytesToWorkbookData(
          XLSX_SOURCE,
          parserForSelectedWorkbook(selectedWorkbook(['x'.repeat(1_025)])),
        ),
      'RESOURCE_LIMIT_EXCEEDED',
    );
  });

  it('rejects a selected workbook that omits the requested worksheet identity', () => {
    expectSpreadsheetError(
      () =>
        sheetJsBytesToWorkbookData(
          XLSX_SOURCE,
          parserForSelectedWorkbook(selectedWorkbook(['Other'])),
        ),
      'UNSUPPORTED_OR_CORRUPT',
    );
  });

  it('rejects an ambiguous selected workbook that repeats the requested identity', () => {
    expectSpreadsheetError(
      () =>
        sheetJsBytesToWorkbookData(
          XLSX_SOURCE,
          parserForSelectedWorkbook(selectedWorkbook(['Summary', 'Summary'])),
        ),
      'UNSUPPORTED_OR_CORRUPT',
    );
  });
});
