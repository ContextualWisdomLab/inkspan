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

const ONE_SNAPSHOT_OPTIONS = {
  type: 'array',
  cellFormula: false,
  cellHTML: false,
  cellNF: false,
  bookVBA: false,
  sheetRows: 10_001,
} as const;

describe('sheetJsBytesToWorkbookData BIFF8 visibility authority', () => {
  it('projects BIFF8 visibility and visible bodies from one bounded workbook snapshot', () => {
    const summarySheet = { '!ref': 'A1' };
    const privateSheet = { '!ref': 'A1' };
    const read = vi.fn(
      (
        _source: Uint8Array,
        options: Parameters<SheetJsParserModule['read']>[1],
      ): unknown => {
        expect(options).toEqual(ONE_SNAPSHOT_OPTIONS);
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

    expect(sheetJsBytesToWorkbookData(BIFF8_SOURCE, parser)).toEqual({
      worksheets: [
        { name: 'Summary', hidden: false, rows: [['public']] },
        { name: 'Private', hidden: true, rows: [] },
      ],
    });
    expect(read).toHaveBeenCalledTimes(1);
    expect(read.mock.calls[0]?.[0]).not.toBe(BIFF8_SOURCE);
    expect(read).toHaveBeenCalledWith(expect.any(Uint8Array), ONE_SNAPSHOT_OPTIONS);
    expect(sheetToJson).toHaveBeenCalledTimes(1);
    expect(sheetToJson).toHaveBeenCalledWith(summarySheet, {
      header: 1,
      raw: false,
      defval: '',
      blankrows: true,
    });
  });

  it('remains deterministic across repeated BIFF8 imports without selective parser reads', () => {
    const summarySheet = { '!ref': 'A1' };
    const privateSheet = { '!ref': 'A1' };
    let parserHistoryWasPoisoned = false;

    const read = vi.fn(
      (
        _source: Uint8Array,
        options: Parameters<SheetJsParserModule['read']>[1],
      ): unknown => {
        if (options.sheets !== undefined || options.sheetRows === 1) {
          parserHistoryWasPoisoned = true;
        }
        const hidden = parserHistoryWasPoisoned ? 0 : 1;
        return {
          SheetNames: ['Summary', 'Private'],
          Sheets: {
            Summary: summarySheet,
            Private: privateSheet,
          },
          Workbook: {
            Sheets: [{ Hidden: 0 }, { Hidden: hidden }],
          },
        };
      },
    );
    const parser: SheetJsParserModule = {
      read,
      utils: {
        decode_range: () => ({ s: { r: 0, c: 0 }, e: { r: 0, c: 0 } }),
        sheet_to_json: vi.fn((sheet: unknown) =>
          sheet === summarySheet ? [['public']] : [['private']],
        ),
      },
    };

    for (let attempt = 0; attempt < 2; attempt += 1) {
      expect(sheetJsBytesToWorkbookData(BIFF8_SOURCE, parser)).toEqual({
        worksheets: [
          { name: 'Summary', hidden: false, rows: [['public']] },
          { name: 'Private', hidden: true, rows: [] },
        ],
      });
    }

    expect(read).toHaveBeenCalledTimes(2);
    for (const [, options] of read.mock.calls) {
      expect(options).toEqual(ONE_SNAPSHOT_OPTIONS);
    }
  });

  it('does not issue any additional parser reads when a bounded BIFF8 snapshot has no sheets', () => {
    const read = vi.fn(() => ({ SheetNames: [], Sheets: {} }));
    const parser: SheetJsParserModule = {
      read,
      utils: {
        decode_range: vi.fn(),
        sheet_to_json: vi.fn(),
      },
    };

    expect(sheetJsBytesToWorkbookData(BIFF8_SOURCE, parser)).toEqual({
      worksheets: [],
    });
    expect(read).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledWith(expect.any(Uint8Array), ONE_SNAPSHOT_OPTIONS);
  });
});