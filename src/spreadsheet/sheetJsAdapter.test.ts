import { describe, expect, it, vi } from 'vitest';
import {
  sheetJsBytesToWorkbookData,
  type SheetJsParserModule,
} from './sheetJsAdapter.js';

describe('sheetJsBytesToWorkbookData', () => {
  it('reads local workbook bytes with non-executing options and projects visible displayed text', () => {
    const visibleSheet = { id: 'visible' };
    const hiddenSheet = { id: 'hidden' };
    const read = vi.fn(() => ({
      SheetNames: ['Summary', 'Private'],
      Sheets: {
        Summary: visibleSheet,
        Private: hiddenSheet,
      },
      Workbook: {
        Sheets: [{ Hidden: 0 }, { Hidden: 1 }],
      },
    }));
    const decodeRange = vi.fn((range: string) => {
      if (range === 'A1:B2') {
        return { s: { r: 0, c: 0 }, e: { r: 1, c: 1 } };
      }
      return { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } };
    });
    const sheetToJson = vi.fn((sheet: unknown) => {
      if (sheet === visibleSheet) {
        return [
          ['Name', 'Value'],
          ['매출', '42'],
        ];
      }
      return [['secret']];
    });
    Object.assign(visibleSheet, { '!ref': 'A1:B2' });
    Object.assign(hiddenSheet, { '!ref': 'A1' });

    const parser: SheetJsParserModule = {
      read,
      utils: {
        decode_range: decodeRange,
        sheet_to_json: sheetToJson,
      },
    };
    const source = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);

    expect(sheetJsBytesToWorkbookData(source, parser)).toEqual({
      worksheets: [
        {
          name: 'Summary',
          hidden: false,
          rows: [
            ['Name', 'Value'],
            ['매출', '42'],
          ],
        },
        {
          name: 'Private',
          hidden: true,
          rows: [],
        },
      ],
    });
    expect(read).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledWith(source, {
      type: 'array',
      cellFormula: false,
      cellHTML: false,
      cellNF: false,
      bookVBA: false,
    });
    expect(decodeRange).toHaveBeenCalledTimes(1);
    expect(decodeRange).toHaveBeenCalledWith('A1:B2');
    expect(sheetToJson).toHaveBeenCalledTimes(1);
    expect(sheetToJson).toHaveBeenCalledWith(visibleSheet, {
      header: 1,
      raw: false,
      defval: '',
      blankrows: true,
    });
  });
});
