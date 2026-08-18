import { describe, expect, it, vi } from 'vitest';
import {
  sheetJsBytesToWorkbookData,
  type SheetJsParserModule,
} from './sheetJsAdapter.js';

const BIFF8_SOURCE = new Uint8Array([
  0xd0,
  0xcf,
  0x11,
  0xe0,
  0xa1,
  0xb1,
  0x1a,
  0xe1,
]);

describe('sheetJsBytesToWorkbookData blank BIFF8 range normalization', () => {
  it('treats a parser-synthesized blank-only A1 range as an empty worksheet body', () => {
    const emptySheet = { '!ref': 'A1' };
    const read = vi.fn(() => ({
      SheetNames: ['Empty'],
      Sheets: { Empty: emptySheet },
      Workbook: { Sheets: [{ Hidden: 0 }] },
    }));
    const sheetToJson = vi.fn(() => [['']]);
    const parser: SheetJsParserModule = {
      read,
      utils: {
        decode_range: vi.fn(() => ({
          s: { r: 0, c: 0 },
          e: { r: 0, c: 0 },
        })),
        sheet_to_json: sheetToJson,
      },
    };

    expect(sheetJsBytesToWorkbookData(BIFF8_SOURCE, parser)).toEqual({
      worksheets: [{ name: 'Empty', hidden: false, rows: [] }],
    });
    expect(read).toHaveBeenCalledTimes(1);
    expect(sheetToJson).toHaveBeenCalledOnce();
    expect(sheetToJson).toHaveBeenCalledWith(emptySheet, {
      header: 1,
      raw: false,
      defval: '',
      blankrows: true,
    });
  });
});
