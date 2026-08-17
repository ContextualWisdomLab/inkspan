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

describe('sheetJsBytesToWorkbookData BIFF8 visibility authority', () => {
  it('snapshots pristine visibility before any selective body read can mutate parser metadata', () => {
    const summarySheet = { '!ref': 'A1' };
    const privateSheet = { '!ref': 'A1' };
    const pristineSheetMetadata = [{ Hidden: 0 }, { Hidden: 1 }];
    const read = vi.fn(
      (
        _source: Uint8Array,
        options: Parameters<SheetJsParserModule['read']>[1],
      ): unknown => {
        if (options.sheetRows === 1 && options.sheets === undefined) {
          return {
            SheetNames: ['Summary', 'Private'],
            Sheets: {
              Summary: summarySheet,
              Private: privateSheet,
            },
            Workbook: {
              Sheets: pristineSheetMetadata,
            },
          };
        }
        if (options.sheets === 'Summary') {
          // Model the real BIFF8 parser interaction observed in hosted CI: a
          // later selective read can invalidate metadata objects retained from
          // the pristine visibility parse. Inkspan must have copied the hidden
          // decision before granting the parser another read.
          pristineSheetMetadata[1]!.Hidden = 0;
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

    expect(sheetJsBytesToWorkbookData(BIFF8_SOURCE, parser)).toEqual({
      worksheets: [
        { name: 'Summary', hidden: false, rows: [['public']] },
        { name: 'Private', hidden: true, rows: [] },
      ],
    });
    expect(read).toHaveBeenCalledTimes(2);
    expect(read).toHaveBeenNthCalledWith(1, BIFF8_SOURCE, {
      type: 'array',
      cellFormula: false,
      cellHTML: false,
      cellNF: false,
      bookVBA: false,
      sheetRows: 1,
    });
    expect(read).toHaveBeenNthCalledWith(2, BIFF8_SOURCE, {
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

  it('isolates the authoritative BIFF8 visibility source from later body reads', () => {
    const summarySheet = { '!ref': 'A1' };
    const privateSheet = { '!ref': 'A1' };
    let retainedVisibilitySource: Uint8Array | undefined;
    let visibilityWasCorrupted = false;

    const read = vi.fn(
      (
        source: Uint8Array,
        options: Parameters<SheetJsParserModule['read']>[1],
      ): unknown => {
        if (options.sheetRows === 1 && options.sheets === undefined) {
          retainedVisibilitySource = source;
          const hidden = visibilityWasCorrupted ? 0 : 1;
          visibilityWasCorrupted = false;
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
        }
        if (options.sheets === 'Summary') {
          if (source === retainedVisibilitySource) {
            visibilityWasCorrupted = true;
          }
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
            Workbook: { Sheets: [{ Hidden: 0 }] },
          };
        }
        throw new Error('unexpected parser invocation');
      },
    );
    const parser: SheetJsParserModule = {
      read,
      utils: {
        decode_range: () => ({ s: { r: 0, c: 0 }, e: { r: 0, c: 0 } }),
        sheet_to_json: vi.fn(() => [['public']]),
      },
    };

    expect(sheetJsBytesToWorkbookData(BIFF8_SOURCE, parser)).toEqual({
      worksheets: [
        { name: 'Summary', hidden: false, rows: [['public']] },
        { name: 'Private', hidden: true, rows: [] },
      ],
    });
    expect(sheetJsBytesToWorkbookData(BIFF8_SOURCE, parser)).toEqual({
      worksheets: [
        { name: 'Summary', hidden: false, rows: [['public']] },
        { name: 'Private', hidden: true, rows: [] },
      ],
    });

    expect(read).toHaveBeenCalledTimes(4);
    expect(read.mock.calls[0]?.[0]).not.toBe(BIFF8_SOURCE);
    expect(read.mock.calls[0]?.[0]).not.toBe(read.mock.calls[1]?.[0]);
    expect(read.mock.calls[2]?.[0]).not.toBe(read.mock.calls[3]?.[0]);
  });

  it('does not issue body reads when bounded BIFF8 discovery reports no sheets', () => {
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
    expect(read).toHaveBeenCalledWith(BIFF8_SOURCE, {
      type: 'array',
      cellFormula: false,
      cellHTML: false,
      cellNF: false,
      bookVBA: false,
      sheetRows: 1,
    });
  });
});