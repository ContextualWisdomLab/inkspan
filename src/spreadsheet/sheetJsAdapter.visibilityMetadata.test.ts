import { describe, expect, it, vi } from 'vitest';
import {
  sheetJsBytesToWorkbookData,
  type SheetJsParserModule,
} from './sheetJsAdapter.js';

const XLSX_SOURCE = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);

describe('sheetJsBytesToWorkbookData worksheet visibility authority', () => {
  it('uses bounded whole-workbook metadata instead of selective-parse visibility', () => {
    const summarySheet = { '!ref': 'A1' };
    const privateSheet = { '!ref': 'A1' };
    const read = vi.fn(
      (
        _source: Uint8Array,
        options: Parameters<SheetJsParserModule['read']>[1],
      ): unknown => {
        if (options.bookSheets === true) {
          return {
            SheetNames: ['Summary', 'Private'],
            Sheets: {},
          };
        }
        if (options.sheetRows === 1 && options.sheets === undefined) {
          return {
            SheetNames: ['Summary', 'Private'],
            Sheets: {
              Summary: summarySheet,
              Private: privateSheet,
            },
            Workbook: {
              Sheets: [{ Hidden: 0 }, { Hidden: 1 }],
            },
          };
        }
        if (options.sheets === 'Summary') {
          return {
            SheetNames: ['Summary'],
            Sheets: { Summary: summarySheet },
            Workbook: { Sheets: [{ Hidden: 0 }] },
          };
        }
        if (options.sheets === 'Private') {
          return {
            SheetNames: ['Private'],
            Sheets: { Private: privateSheet },
            // Selective BIFF8 parsing can no longer be treated as visibility
            // authority because it may not preserve the original sheet flag.
            Workbook: { Sheets: [{ Hidden: 0 }] },
          };
        }
        throw new Error('unexpected parser invocation');
      },
    );
    const sheetToJson = vi.fn((sheet: unknown) =>
      sheet === summarySheet ? [['public']] : [['private']],
    );
    const parser: SheetJsParserModule = {
      read,
      utils: {
        decode_range: () => ({ s: { r: 0, c: 0 }, e: { r: 0, c: 0 } }),
        sheet_to_json: sheetToJson,
      },
    };

    expect(sheetJsBytesToWorkbookData(XLSX_SOURCE, parser)).toEqual({
      worksheets: [
        { name: 'Summary', hidden: false, rows: [['public']] },
        { name: 'Private', hidden: true, rows: [] },
      ],
    });
    expect(read).toHaveBeenCalledTimes(3);
    expect(read).toHaveBeenNthCalledWith(1, XLSX_SOURCE, {
      type: 'array',
      cellFormula: false,
      cellHTML: false,
      cellNF: false,
      bookVBA: false,
      bookSheets: true,
    });
    expect(read).toHaveBeenNthCalledWith(2, XLSX_SOURCE, {
      type: 'array',
      cellFormula: false,
      cellHTML: false,
      cellNF: false,
      bookVBA: false,
      sheetRows: 1,
    });
    expect(read).toHaveBeenNthCalledWith(3, XLSX_SOURCE, {
      type: 'array',
      cellFormula: false,
      cellHTML: false,
      cellNF: false,
      bookVBA: false,
      sheets: 'Summary',
      sheetRows: 10_001,
    });
    expect(sheetToJson).toHaveBeenCalledTimes(1);
    expect(sheetToJson).toHaveBeenCalledWith(summarySheet, {
      header: 1,
      raw: false,
      defval: '',
      blankrows: true,
    });
  });
});
