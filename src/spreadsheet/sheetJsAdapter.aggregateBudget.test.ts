import { describe, expect, it, vi } from 'vitest';
import {
  sheetJsBytesToWorkbookData,
  type SheetJsParserModule,
} from './sheetJsAdapter.js';
import { SpreadsheetImportError } from './spreadsheetImport.js';

const XLSX_SOURCE = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);

function decodeRange(range: string): unknown {
  const match = /^A1:A(\d+)$/.exec(range);
  if (match === null) throw new Error('unexpected range');
  return {
    s: { r: 0, c: 0 },
    e: { r: Number(match[1]) - 1, c: 0 },
  };
}

describe('SheetJS aggregate parser budget', () => {
  it('discovers sheet names without rows and decreases the parser row ceiling before each selected sheet parse', () => {
    const readOptions: Record<string, unknown>[] = [];
    const read = vi.fn((_source: Uint8Array, rawOptions: unknown) => {
      const options = rawOptions as Record<string, unknown>;
      readOptions.push(options);

      if (readOptions.length === 1) {
        if (options.bookSheets !== true) {
          throw new Error('the first parser pass materialized worksheet data');
        }
        return {
          SheetNames: ['First', 'Second'],
        };
      }

      if (options.sheets === 'First') {
        return {
          SheetNames: ['First', 'Second'],
          Sheets: { First: { '!ref': 'A1:A6000' } },
          Workbook: { Sheets: [{ Hidden: 0 }, { Hidden: 0 }] },
        };
      }

      if (options.sheets === 'Second') {
        return {
          SheetNames: ['First', 'Second'],
          Sheets: { Second: { '!ref': 'A1:A4001' } },
          Workbook: { Sheets: [{ Hidden: 0 }, { Hidden: 0 }] },
        };
      }

      throw new Error('unexpected parser pass');
    });
    const sheetToJson = vi.fn(() => []);
    const parser = {
      read,
      utils: {
        decode_range: decodeRange,
        sheet_to_json: sheetToJson,
      },
    } as unknown as SheetJsParserModule;

    let caught: unknown;
    try {
      sheetJsBytesToWorkbookData(XLSX_SOURCE, parser);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(SpreadsheetImportError);
    expect(caught).toMatchObject({ code: 'RESOURCE_LIMIT_EXCEEDED' });
    expect(read).toHaveBeenCalledTimes(3);
    expect(readOptions[0]).toMatchObject({ bookSheets: true });
    expect(readOptions[1]).toMatchObject({
      sheets: 'First',
      sheetRows: 10_001,
    });
    expect(readOptions[2]).toMatchObject({
      sheets: 'Second',
      sheetRows: 4_001,
    });
    expect(sheetToJson).toHaveBeenCalledTimes(1);
  });
});
