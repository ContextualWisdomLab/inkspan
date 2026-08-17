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

async function expectUnsupported(action: () => unknown): Promise<void> {
  expect(action).toThrowError(
    expect.objectContaining({
      name: 'SpreadsheetImportError',
      code: 'UNSUPPORTED_OR_CORRUPT',
      message: 'Spreadsheet source is unsupported or corrupt.',
    }),
  );
}

async function expectResourceLimit(action: () => unknown): Promise<void> {
  expect(action).toThrowError(
    expect.objectContaining({
      name: 'SpreadsheetImportError',
      code: 'RESOURCE_LIMIT_EXCEEDED',
      message: 'Spreadsheet exceeds the configured resource limits.',
    }),
  );
}

describe('SheetJS selective worksheet identity validation', () => {
  it('rejects a selected workbook without an array SheetNames identity', async () => {
    await expectUnsupported(() =>
      sheetJsBytesToWorkbookData(
        XLSX_SOURCE,
        parserForSelectedWorkbook(selectedWorkbook('Summary')),
      ),
    );
  });

  it('rejects a selected workbook with too many SheetNames entries', async () => {
    await expectResourceLimit(() =>
      sheetJsBytesToWorkbookData(
        XLSX_SOURCE,
        parserForSelectedWorkbook(
          selectedWorkbook(new Array<string>(257).fill('Other')),
        ),
      ),
    );
  });

  it('rejects a selected workbook with a non-string sheet identity', async () => {
    await expectUnsupported(() =>
      sheetJsBytesToWorkbookData(
        XLSX_SOURCE,
        parserForSelectedWorkbook(selectedWorkbook([42])),
      ),
    );
  });

  it('rejects a selected workbook with an oversized sheet identity', async () => {
    await expectResourceLimit(() =>
      sheetJsBytesToWorkbookData(
        XLSX_SOURCE,
        parserForSelectedWorkbook(selectedWorkbook(['x'.repeat(1_025)])),
      ),
    );
  });

  it('rejects a selected workbook that omits the requested worksheet identity', async () => {
    await expectUnsupported(() =>
      sheetJsBytesToWorkbookData(
        XLSX_SOURCE,
        parserForSelectedWorkbook(selectedWorkbook(['Other'])),
      ),
    );
  });

  it('rejects an ambiguous selected workbook that repeats the requested identity', async () => {
    await expectUnsupported(() =>
      sheetJsBytesToWorkbookData(
        XLSX_SOURCE,
        parserForSelectedWorkbook(selectedWorkbook(['Summary', 'Summary'])),
      ),
    );
  });
});
