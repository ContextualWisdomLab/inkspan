import { describe, expect, it, vi } from 'vitest';
import {
  sheetJsBytesToWorkbookData,
  type SheetJsParserModule,
} from './sheetJsAdapter.js';
import { SpreadsheetImportError } from './spreadsheetImport.js';

const XLSX_SOURCE = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);

function parserWithRows(rows: readonly unknown[]): SheetJsParserModule {
  let readCount = 0;
  return {
    read: vi.fn(() => {
      readCount += 1;
      if (readCount === 1) {
        return { SheetNames: ['Summary'] };
      }
      return {
        SheetNames: ['Summary'],
        Sheets: { Summary: { '!ref': 'A1:A1' } },
        Workbook: { Sheets: [{ Hidden: 0 }] },
      };
    }),
    utils: {
      decode_range: vi.fn(() => ({
        s: { r: 0, c: 0 },
        e: { r: 0, c: 0 },
      })),
      sheet_to_json: vi.fn(() => rows),
    },
  };
}

function expectResourceLimit(action: () => unknown): void {
  let caught: unknown;
  try {
    action();
  } catch (error) {
    caught = error;
  }

  expect(caught).toBeInstanceOf(SpreadsheetImportError);
  expect(caught).toMatchObject({ code: 'RESOURCE_LIMIT_EXCEEDED' });
}

describe('SheetJS materialized output bounds', () => {
  it('rejects more materialized rows than the decoded range before reading row entries', () => {
    let rowEntryInspected = false;
    const rows = new Proxy(new Array<unknown>(2), {
      getOwnPropertyDescriptor(target, key) {
        if (key === '0') {
          rowEntryInspected = true;
          throw new Error('row entry must not be inspected');
        }
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
    const parser = parserWithRows(rows);

    expectResourceLimit(() => sheetJsBytesToWorkbookData(XLSX_SOURCE, parser));
    expect(rowEntryInspected).toBe(false);
  });

  it('rejects a materialized row wider than the decoded range before reading cell entries', () => {
    let cellEntryInspected = false;
    const row = new Proxy(new Array<unknown>(257), {
      getOwnPropertyDescriptor(target, key) {
        if (key === '0') {
          cellEntryInspected = true;
          throw new Error('cell entry must not be inspected');
        }
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
    const parser = parserWithRows([row]);

    expectResourceLimit(() => sheetJsBytesToWorkbookData(XLSX_SOURCE, parser));
    expect(cellEntryInspected).toBe(false);
  });
});
