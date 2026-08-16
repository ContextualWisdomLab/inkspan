import { describe, expect, it, vi } from 'vitest';
import {
  sheetJsBytesToWorkbookData,
  type SheetJsParserModule,
} from './sheetJsAdapter.js';
import {
  SpreadsheetImportError,
  type SpreadsheetImportErrorCode,
} from './spreadsheetImport.js';

const XLSX_SOURCE = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);

interface ParserFixtureOptions {
  readonly read?: () => unknown;
  readonly decodeRange?: (range: string) => unknown;
  readonly sheetToJson?: (sheet: unknown) => unknown;
}

function parserFixture(
  workbook: unknown = { SheetNames: [], Sheets: {} },
  options: ParserFixtureOptions = {},
) {
  const read = vi.fn(options.read ?? (() => workbook));
  const decodeRange = vi.fn(
    options.decodeRange ??
      (() => ({ s: { r: 0, c: 0 }, e: { r: 0, c: 0 } })),
  );
  const sheetToJson = vi.fn(options.sheetToJson ?? (() => [['value']]));

  return {
    parser: {
      read,
      utils: {
        decode_range: decodeRange,
        sheet_to_json: sheetToJson,
      },
    } as SheetJsParserModule,
    read,
    decodeRange,
    sheetToJson,
  };
}

function expectSpreadsheetError(
  action: () => unknown,
  code: SpreadsheetImportErrorCode,
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

function descriptorReportingLength(value: unknown): readonly unknown[] {
  return new Proxy([], {
    getOwnPropertyDescriptor(target, key) {
      if (key === 'length') {
        return {
          value,
          writable: true,
          enumerable: false,
          configurable: false,
        };
      }
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
}

function sheetWorkbook(
  sheet: object,
  options: {
    readonly name?: string;
    readonly hidden?: 0 | 1 | 2;
    readonly includeMetadata?: boolean;
  } = {},
): object {
  const name = options.name ?? 'Summary';
  const workbook: Record<string, unknown> = {
    SheetNames: [name],
    Sheets: { [name]: sheet },
  };
  if (options.includeMetadata !== false) {
    workbook.Workbook = {
      Sheets:
        options.hidden === undefined ? [{}] : [{ Hidden: options.hidden }],
    };
  }
  return workbook;
}

describe('sheetJsBytesToWorkbookData', () => {
  it('reads local workbook bytes with bounded non-executing options and projects visible displayed text', () => {
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

    expect(sheetJsBytesToWorkbookData(XLSX_SOURCE, parser)).toEqual({
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
    expect(read).toHaveBeenCalledWith(XLSX_SOURCE, {
      type: 'array',
      cellFormula: false,
      cellHTML: false,
      cellNF: false,
      bookVBA: false,
      sheetRows: 10_001,
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

  it('preserves a visible empty sheet without invoking the row materializer', () => {
    const emptySheet = {};
    const { parser, sheetToJson } = parserFixture(
      sheetWorkbook(emptySheet, { includeMetadata: false }),
    );

    expect(sheetJsBytesToWorkbookData(XLSX_SOURCE, parser)).toEqual({
      worksheets: [{ name: 'Summary', hidden: false, rows: [] }],
    });
    expect(sheetToJson).not.toHaveBeenCalled();
  });

  it.each([
    ['parser exception', { read: (): never => { throw new Error('private'); } }],
    ['non-object parser result', { read: (): null => null }],
  ] as const)('normalizes %s as an unsupported source', (_label, overrides) => {
    const { parser } = parserFixture(undefined, overrides);
    expectSpreadsheetError(
      () => sheetJsBytesToWorkbookData(XLSX_SOURCE, parser),
      'UNSUPPORTED_OR_CORRUPT',
    );
  });

  it('rejects hostile and accessor-backed required workbook members without evaluating them', () => {
    const descriptorFailure = new Proxy({}, {
      getOwnPropertyDescriptor() {
        throw new Error('private descriptor trap');
      },
    });
    const { parser: hostileParser } = parserFixture(descriptorFailure);
    expectSpreadsheetError(
      () => sheetJsBytesToWorkbookData(XLSX_SOURCE, hostileParser),
      'UNSUPPORTED_OR_CORRUPT',
    );

    const getter = vi.fn(() => ['Secret']);
    const accessorWorkbook = { Sheets: {} } as Record<string, unknown>;
    Object.defineProperty(accessorWorkbook, 'SheetNames', {
      enumerable: true,
      get: getter,
    });
    const { parser: accessorParser } = parserFixture(accessorWorkbook);
    expectSpreadsheetError(
      () => sheetJsBytesToWorkbookData(XLSX_SOURCE, accessorParser),
      'UNSUPPORTED_OR_CORRUPT',
    );
    expect(getter).not.toHaveBeenCalled();

    const { parser: missingParser } = parserFixture({ Sheets: {} });
    expectSpreadsheetError(
      () => sheetJsBytesToWorkbookData(XLSX_SOURCE, missingParser),
      'UNSUPPORTED_OR_CORRUPT',
    );
  });

  it('rejects invalid workbook container brands and hostile array branding', () => {
    const { proxy, revoke } = Proxy.revocable([], {});
    revoke();

    for (const workbook of [
      { SheetNames: {}, Sheets: {} },
      { SheetNames: [], Sheets: null },
      { SheetNames: proxy, Sheets: {} },
    ]) {
      const { parser } = parserFixture(workbook);
      expectSpreadsheetError(
        () => sheetJsBytesToWorkbookData(XLSX_SOURCE, parser),
        'UNSUPPORTED_OR_CORRUPT',
      );
    }
  });

  it('rejects invalid and negative reported array lengths before iteration', () => {
    for (const reportedLength of ['not-a-length', -1]) {
      const { parser } = parserFixture({
        SheetNames: descriptorReportingLength(reportedLength),
        Sheets: {},
      });
      expectSpreadsheetError(
        () => sheetJsBytesToWorkbookData(XLSX_SOURCE, parser),
        'UNSUPPORTED_OR_CORRUPT',
      );
    }
  });

  it('rejects more than the bounded total worksheet descriptor count before sheet inspection', () => {
    const sheetNames = Array.from({ length: 257 }, (_, index) => `Sheet ${index}`);
    const { parser } = parserFixture({ SheetNames: sheetNames, Sheets: {} });

    expectSpreadsheetError(
      () => sheetJsBytesToWorkbookData(XLSX_SOURCE, parser),
      'RESOURCE_LIMIT_EXCEEDED',
    );
  });

  it('validates optional workbook sheet metadata without invoking caller accessors', () => {
    const sheet = {};
    const workbookGetter = vi.fn(() => ({ Sheets: [] }));
    const accessorWorkbook = {
      SheetNames: ['Summary'],
      Sheets: { Summary: sheet },
    } as Record<string, unknown>;
    Object.defineProperty(accessorWorkbook, 'Workbook', {
      enumerable: true,
      get: workbookGetter,
    });
    const { parser: accessorParser } = parserFixture(accessorWorkbook);
    expectSpreadsheetError(
      () => sheetJsBytesToWorkbookData(XLSX_SOURCE, accessorParser),
      'UNSUPPORTED_OR_CORRUPT',
    );
    expect(workbookGetter).not.toHaveBeenCalled();

    const hostileWorkbookMetadata = new Proxy({}, {
      getOwnPropertyDescriptor() {
        throw new Error('private metadata trap');
      },
    });
    const { parser: hostileMetadataParser } = parserFixture({
      SheetNames: ['Summary'],
      Sheets: { Summary: sheet },
      Workbook: hostileWorkbookMetadata,
    });
    expectSpreadsheetError(
      () => sheetJsBytesToWorkbookData(XLSX_SOURCE, hostileMetadataParser),
      'UNSUPPORTED_OR_CORRUPT',
    );

    for (const Workbook of [1, {}, { Sheets: {} }]) {
      const { parser } = parserFixture({
        SheetNames: ['Summary'],
        Sheets: { Summary: sheet },
        Workbook,
      });
      if (Workbook && typeof Workbook === 'object' && !('Sheets' in Workbook)) {
        expect(sheetJsBytesToWorkbookData(XLSX_SOURCE, parser)).toEqual({
          worksheets: [{ name: 'Summary', hidden: false, rows: [] }],
        });
      } else {
        expectSpreadsheetError(
          () => sheetJsBytesToWorkbookData(XLSX_SOURCE, parser),
          'UNSUPPORTED_OR_CORRUPT',
        );
      }
    }

    const { proxy, revoke } = Proxy.revocable([], {});
    revoke();
    const { parser: revokedParser } = parserFixture({
      SheetNames: ['Summary'],
      Sheets: { Summary: sheet },
      Workbook: { Sheets: proxy },
    });
    expectSpreadsheetError(
      () => sheetJsBytesToWorkbookData(XLSX_SOURCE, revokedParser),
      'UNSUPPORTED_OR_CORRUPT',
    );
  });

  it('handles absent, short, hidden, very-hidden, and invalid metadata states deterministically', () => {
    const sheet = {};
    for (const workbook of [
      { SheetNames: ['Summary'], Sheets: { Summary: sheet } },
      {
        SheetNames: ['Summary'],
        Sheets: { Summary: sheet },
        Workbook: { Sheets: [] },
      },
      sheetWorkbook(sheet, { hidden: 0 }),
    ]) {
      const { parser } = parserFixture(workbook);
      expect(sheetJsBytesToWorkbookData(XLSX_SOURCE, parser)).toEqual({
        worksheets: [{ name: 'Summary', hidden: false, rows: [] }],
      });
    }

    for (const hidden of [1, 2] as const) {
      const { parser } = parserFixture(sheetWorkbook(sheet, { hidden }));
      expect(sheetJsBytesToWorkbookData(XLSX_SOURCE, parser)).toEqual({
        worksheets: [{ name: 'Summary', hidden: true, rows: [] }],
      });
    }

    const hiddenGetter = vi.fn(() => 1);
    const accessorMetadata = {};
    Object.defineProperty(accessorMetadata, 'Hidden', {
      enumerable: true,
      get: hiddenGetter,
    });
    const { parser: accessorMetadataParser } = parserFixture({
      SheetNames: ['Summary'],
      Sheets: { Summary: sheet },
      Workbook: { Sheets: [accessorMetadata] },
    });
    expectSpreadsheetError(
      () => sheetJsBytesToWorkbookData(XLSX_SOURCE, accessorMetadataParser),
      'UNSUPPORTED_OR_CORRUPT',
    );
    expect(hiddenGetter).not.toHaveBeenCalled();

    for (const metadata of [null, { Hidden: 3 }]) {
      const { parser } = parserFixture({
        SheetNames: ['Summary'],
        Sheets: { Summary: sheet },
        Workbook: { Sheets: [metadata] },
      });
      expectSpreadsheetError(
        () => sheetJsBytesToWorkbookData(XLSX_SOURCE, parser),
        'UNSUPPORTED_OR_CORRUPT',
      );
    }
  });

  it('rejects invalid worksheet names, oversized names, and invalid sheet objects', () => {
    const { parser: nonStringName } = parserFixture({
      SheetNames: [123],
      Sheets: {},
    });
    expectSpreadsheetError(
      () => sheetJsBytesToWorkbookData(XLSX_SOURCE, nonStringName),
      'UNSUPPORTED_OR_CORRUPT',
    );

    const oversized = 'x'.repeat(1_025);
    const { parser: oversizedName } = parserFixture({
      SheetNames: [oversized],
      Sheets: { [oversized]: {} },
    });
    expectSpreadsheetError(
      () => sheetJsBytesToWorkbookData(XLSX_SOURCE, oversizedName),
      'RESOURCE_LIMIT_EXCEEDED',
    );

    const { parser: invalidSheet } = parserFixture({
      SheetNames: ['Summary'],
      Sheets: { Summary: null },
    });
    expectSpreadsheetError(
      () => sheetJsBytesToWorkbookData(XLSX_SOURCE, invalidSheet),
      'UNSUPPORTED_OR_CORRUPT',
    );
  });

  it('bounds visible worksheets before range parsing', () => {
    const names = Array.from({ length: 65 }, (_, index) => `Visible ${index}`);
    const sheets = Object.fromEntries(names.map((name) => [name, {}]));
    const { parser, decodeRange } = parserFixture({
      SheetNames: names,
      Sheets: sheets,
    });

    expectSpreadsheetError(
      () => sheetJsBytesToWorkbookData(XLSX_SOURCE, parser),
      'RESOURCE_LIMIT_EXCEEDED',
    );
    expect(decodeRange).not.toHaveBeenCalled();
  });

  it('rejects invalid range members without evaluating accessor-backed references', () => {
    const refGetter = vi.fn(() => 'A1');
    const accessorSheet = {};
    Object.defineProperty(accessorSheet, '!ref', {
      enumerable: true,
      get: refGetter,
    });
    const { parser: accessorParser } = parserFixture(sheetWorkbook(accessorSheet));
    expectSpreadsheetError(
      () => sheetJsBytesToWorkbookData(XLSX_SOURCE, accessorParser),
      'UNSUPPORTED_OR_CORRUPT',
    );
    expect(refGetter).not.toHaveBeenCalled();

    const hostileSheet = new Proxy({}, {
      getOwnPropertyDescriptor() {
        throw new Error('private range trap');
      },
    });
    const { parser: hostileParser } = parserFixture(sheetWorkbook(hostileSheet));
    expectSpreadsheetError(
      () => sheetJsBytesToWorkbookData(XLSX_SOURCE, hostileParser),
      'UNSUPPORTED_OR_CORRUPT',
    );

    for (const reference of [0, '']) {
      const { parser } = parserFixture(
        sheetWorkbook({ '!ref': reference } as object),
      );
      expectSpreadsheetError(
        () => sheetJsBytesToWorkbookData(XLSX_SOURCE, parser),
        'UNSUPPORTED_OR_CORRUPT',
      );
    }
  });

  it('normalizes malformed decoded ranges and hostile range decoders', () => {
    const cases: readonly (() => unknown)[] = [
      () => { throw new Error('private'); },
      () => null,
      () => ({ s: null, e: { r: 0, c: 0 } }),
      () => ({ s: { r: 0, c: 0 }, e: null }),
      () => ({ s: { r: Number.NaN, c: 0 }, e: { r: 0, c: 0 } }),
      () => ({ s: { r: -1, c: 0 }, e: { r: 0, c: 0 } }),
      () => ({ s: { r: 1, c: 0 }, e: { r: 0, c: 0 } }),
      () => ({ s: { r: 0, c: 1 }, e: { r: 0, c: 0 } }),
    ];

    for (const decodeRange of cases) {
      const { parser } = parserFixture(
        sheetWorkbook({ '!ref': 'A1' }),
        { decodeRange: () => decodeRange() },
      );
      expectSpreadsheetError(
        () => sheetJsBytesToWorkbookData(XLSX_SOURCE, parser),
        'UNSUPPORTED_OR_CORRUPT',
      );
    }
  });

  it('preflights decoded column, aggregate-row, and aggregate-cell ceilings before row materialization', () => {
    const wide = parserFixture(
      sheetWorkbook({ '!ref': 'wide' }),
      {
        decodeRange: () => ({
          s: { r: 0, c: 0 },
          e: { r: 0, c: 256 },
        }),
      },
    );
    expectSpreadsheetError(
      () => sheetJsBytesToWorkbookData(XLSX_SOURCE, wide.parser),
      'RESOURCE_LIMIT_EXCEEDED',
    );
    expect(wide.sheetToJson).not.toHaveBeenCalled();

    const twoSheets = {
      SheetNames: ['First', 'Second'],
      Sheets: {
        First: { '!ref': 'first' },
        Second: { '!ref': 'second' },
      },
    };
    const rows = parserFixture(twoSheets, {
      decodeRange: () => ({
        s: { r: 0, c: 0 },
        e: { r: 5_999, c: 0 },
      }),
    });
    expectSpreadsheetError(
      () => sheetJsBytesToWorkbookData(XLSX_SOURCE, rows.parser),
      'RESOURCE_LIMIT_EXCEEDED',
    );
    expect(rows.sheetToJson).not.toHaveBeenCalled();

    const cells = parserFixture(
      sheetWorkbook({ '!ref': 'cells' }),
      {
        decodeRange: () => ({
          s: { r: 0, c: 0 },
          e: { r: 1_024, c: 255 },
        }),
      },
    );
    expectSpreadsheetError(
      () => sheetJsBytesToWorkbookData(XLSX_SOURCE, cells.parser),
      'RESOURCE_LIMIT_EXCEEDED',
    );
    expect(cells.sheetToJson).not.toHaveBeenCalled();
  });

  it('normalizes row materialization failures and hostile array containers', () => {
    const sheet = { '!ref': 'A1' };

    const throwing = parserFixture(sheetWorkbook(sheet), {
      sheetToJson: () => { throw new Error('private'); },
    });
    expectSpreadsheetError(
      () => sheetJsBytesToWorkbookData(XLSX_SOURCE, throwing.parser),
      'UNSUPPORTED_OR_CORRUPT',
    );

    const nonArray = parserFixture(sheetWorkbook(sheet), {
      sheetToJson: () => ({}),
    });
    expectSpreadsheetError(
      () => sheetJsBytesToWorkbookData(XLSX_SOURCE, nonArray.parser),
      'UNSUPPORTED_OR_CORRUPT',
    );

    const { proxy, revoke } = Proxy.revocable([], {});
    revoke();
    const revoked = parserFixture(sheetWorkbook(sheet), {
      sheetToJson: () => proxy,
    });
    expectSpreadsheetError(
      () => sheetJsBytesToWorkbookData(XLSX_SOURCE, revoked.parser),
      'UNSUPPORTED_OR_CORRUPT',
    );

    const invalidRow = parserFixture(sheetWorkbook(sheet), {
      sheetToJson: () => [null],
    });
    expectSpreadsheetError(
      () => sheetJsBytesToWorkbookData(XLSX_SOURCE, invalidRow.parser),
      'UNSUPPORTED_OR_CORRUPT',
    );

    const invalidRowLength = parserFixture(sheetWorkbook(sheet), {
      sheetToJson: () => [descriptorReportingLength(-1)],
    });
    expectSpreadsheetError(
      () => sheetJsBytesToWorkbookData(XLSX_SOURCE, invalidRowLength.parser),
      'UNSUPPORTED_OR_CORRUPT',
    );
  });

  it('rejects accessor-backed and non-string displayed cells without evaluating caller code', () => {
    const sheet = { '!ref': 'A1' };
    const cellGetter = vi.fn(() => 'private');
    const accessorRow: unknown[] = [];
    Object.defineProperty(accessorRow, '0', {
      enumerable: true,
      configurable: true,
      get: cellGetter,
    });
    accessorRow.length = 1;

    const accessor = parserFixture(sheetWorkbook(sheet), {
      sheetToJson: () => [accessorRow],
    });
    expectSpreadsheetError(
      () => sheetJsBytesToWorkbookData(XLSX_SOURCE, accessor.parser),
      'UNSUPPORTED_OR_CORRUPT',
    );
    expect(cellGetter).not.toHaveBeenCalled();

    const nonString = parserFixture(sheetWorkbook(sheet), {
      sheetToJson: () => [[42]],
    });
    expectSpreadsheetError(
      () => sheetJsBytesToWorkbookData(XLSX_SOURCE, nonString.parser),
      'UNSUPPORTED_OR_CORRUPT',
    );
  });
});
