import type {
  SpreadsheetWorkbookData,
  SpreadsheetWorksheetData,
} from './spreadsheetImport.js';
import {
  preflightSpreadsheetBinarySource,
  SpreadsheetImportError,
} from './spreadsheetImport.js';

const MAX_VISIBLE_WORKSHEETS = 64;
const MAX_WORKBOOK_WORKSHEETS = 256;
const MAX_WORKSHEET_NAME_CODE_UNITS = 1_024;
const MAX_WORKBOOK_ROWS = 10_000;
const MAX_WORKSHEET_COLUMNS = 256;
const MAX_WORKBOOK_CELLS = 262_144;
const RESOURCE_LIMIT_MESSAGE =
  'Spreadsheet exceeds the configured resource limits.';
const UNSUPPORTED_SOURCE_MESSAGE =
  'Spreadsheet source is unsupported or corrupt.';

/** Minimal SheetJS runtime contract consumed by Inkspan's local adapter. */
export interface SheetJsParserModule {
  readonly read: (
    source: Uint8Array,
    options: {
      readonly type: 'array';
      readonly cellFormula: false;
      readonly cellHTML: false;
      readonly cellNF: false;
      readonly bookVBA: false;
    },
  ) => unknown;
  readonly utils: {
    readonly decode_range: (range: string) => unknown;
    readonly sheet_to_json: (
      sheet: unknown,
      options: {
        readonly header: 1;
        readonly raw: false;
        readonly defval: '';
        readonly blankrows: true;
      },
    ) => unknown;
  };
}

interface PreparedSheet {
  readonly name: string;
  readonly hidden: boolean;
  readonly sheet: object;
  readonly hasRange: boolean;
}

function resourceLimitExceeded(): never {
  throw new SpreadsheetImportError(
    'RESOURCE_LIMIT_EXCEEDED',
    RESOURCE_LIMIT_MESSAGE,
  );
}

function unsupportedOrCorruptSource(): never {
  throw new SpreadsheetImportError(
    'UNSUPPORTED_OR_CORRUPT',
    UNSUPPORTED_SOURCE_MESSAGE,
  );
}

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

function isArray(value: unknown): value is readonly unknown[] {
  try {
    return Array.isArray(value);
  } catch {
    return false;
  }
}

function readOwnDataProperty(source: object, key: PropertyKey): unknown {
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(source, key);
  } catch {
    unsupportedOrCorruptSource();
  }
  if (descriptor === undefined || !('value' in descriptor)) {
    unsupportedOrCorruptSource();
  }
  return descriptor.value;
}

function readOptionalOwnDataProperty(source: object, key: PropertyKey): unknown {
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(source, key);
  } catch {
    unsupportedOrCorruptSource();
  }
  if (descriptor === undefined) return undefined;
  if (!('value' in descriptor)) unsupportedOrCorruptSource();
  return descriptor.value;
}

function readArrayLength(source: readonly unknown[]): number {
  const length = readOwnDataProperty(source, 'length');
  if (!Number.isSafeInteger(length) || (length as number) < 0) {
    unsupportedOrCorruptSource();
  }
  return length as number;
}

function readHiddenState(
  sheetMetadata: readonly unknown[] | undefined,
  index: number,
): boolean {
  if (sheetMetadata === undefined || index >= readArrayLength(sheetMetadata)) {
    return false;
  }
  const metadata = readOwnDataProperty(sheetMetadata, String(index));
  if (!isObject(metadata)) unsupportedOrCorruptSource();
  const hidden = readOptionalOwnDataProperty(metadata, 'Hidden');
  if (hidden === undefined || hidden === 0) return false;
  if (hidden === 1 || hidden === 2) return true;
  return unsupportedOrCorruptSource();
}

function readWorkbookSheetMetadata(workbook: object): readonly unknown[] | undefined {
  const workbookMetadata = readOptionalOwnDataProperty(workbook, 'Workbook');
  if (workbookMetadata === undefined) return undefined;
  if (!isObject(workbookMetadata)) unsupportedOrCorruptSource();
  const sheetMetadata = readOptionalOwnDataProperty(workbookMetadata, 'Sheets');
  if (sheetMetadata === undefined) return undefined;
  if (!isArray(sheetMetadata)) unsupportedOrCorruptSource();
  return sheetMetadata;
}

function decodeRangeDimensions(
  parser: SheetJsParserModule,
  reference: string,
): { readonly rows: number; readonly columns: number } {
  let decoded: unknown;
  try {
    decoded = parser.utils.decode_range(reference);
  } catch {
    unsupportedOrCorruptSource();
  }
  if (!isObject(decoded)) unsupportedOrCorruptSource();
  const start = readOwnDataProperty(decoded, 's');
  const end = readOwnDataProperty(decoded, 'e');
  if (!isObject(start) || !isObject(end)) unsupportedOrCorruptSource();
  const startRow = readOwnDataProperty(start, 'r');
  const startColumn = readOwnDataProperty(start, 'c');
  const endRow = readOwnDataProperty(end, 'r');
  const endColumn = readOwnDataProperty(end, 'c');
  for (const coordinate of [startRow, startColumn, endRow, endColumn]) {
    if (!Number.isSafeInteger(coordinate) || (coordinate as number) < 0) {
      unsupportedOrCorruptSource();
    }
  }
  if ((endRow as number) < (startRow as number)) unsupportedOrCorruptSource();
  if ((endColumn as number) < (startColumn as number)) {
    unsupportedOrCorruptSource();
  }
  return {
    rows: (endRow as number) - (startRow as number) + 1,
    columns: (endColumn as number) - (startColumn as number) + 1,
  };
}

function readDisplayedRows(
  parser: SheetJsParserModule,
  sheet: object,
): readonly (readonly string[])[] {
  let rawRows: unknown;
  try {
    rawRows = parser.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      defval: '',
      blankrows: true,
    });
  } catch {
    unsupportedOrCorruptSource();
  }
  if (!isArray(rawRows)) unsupportedOrCorruptSource();
  const rowCount = readArrayLength(rawRows);
  const rows: string[][] = [];
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const rawRow = readOwnDataProperty(rawRows, String(rowIndex));
    if (!isArray(rawRow)) unsupportedOrCorruptSource();
    const columnCount = readArrayLength(rawRow);
    const row: string[] = [];
    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      const cell = readOwnDataProperty(rawRow, String(columnIndex));
      if (typeof cell !== 'string') unsupportedOrCorruptSource();
      row.push(cell);
    }
    rows.push(row);
  }
  return rows;
}

/**
 * Project locally parsed SheetJS workbook data into Inkspan's parser-neutral
 * workbook contract without granting formulas, macros, links, or parser output
 * any editor authority. Decoded worksheet ranges are bounded before row arrays
 * are materialized by `sheet_to_json`.
 */
export function sheetJsBytesToWorkbookData(
  source: Uint8Array,
  parser: SheetJsParserModule,
): SpreadsheetWorkbookData {
  const boundedSource = preflightSpreadsheetBinarySource(source);
  let parsed: unknown;
  try {
    parsed = parser.read(boundedSource.bytes, {
      type: 'array',
      cellFormula: false,
      cellHTML: false,
      cellNF: false,
      bookVBA: false,
    });
  } catch {
    unsupportedOrCorruptSource();
  }
  if (!isObject(parsed)) unsupportedOrCorruptSource();

  const sheetNames = readOwnDataProperty(parsed, 'SheetNames');
  const sheets = readOwnDataProperty(parsed, 'Sheets');
  if (!isArray(sheetNames) || !isObject(sheets)) unsupportedOrCorruptSource();
  const sheetCount = readArrayLength(sheetNames);
  if (sheetCount > MAX_WORKBOOK_WORKSHEETS) resourceLimitExceeded();
  const sheetMetadata = readWorkbookSheetMetadata(parsed);

  const prepared: PreparedSheet[] = [];
  let visibleCount = 0;
  let decodedRows = 0;
  let decodedCells = 0;

  for (let index = 0; index < sheetCount; index += 1) {
    const name = readOwnDataProperty(sheetNames, String(index));
    if (typeof name !== 'string') unsupportedOrCorruptSource();
    if (name.length > MAX_WORKSHEET_NAME_CODE_UNITS) resourceLimitExceeded();
    const sheet = readOwnDataProperty(sheets, name);
    if (!isObject(sheet)) unsupportedOrCorruptSource();
    const hidden = readHiddenState(sheetMetadata, index);
    if (hidden) {
      prepared.push({ name, hidden: true, sheet, hasRange: false });
      continue;
    }

    visibleCount += 1;
    if (visibleCount > MAX_VISIBLE_WORKSHEETS) resourceLimitExceeded();
    const reference = readOptionalOwnDataProperty(sheet, '!ref');
    if (reference === undefined) {
      prepared.push({ name, hidden: false, sheet, hasRange: false });
      continue;
    }
    if (typeof reference !== 'string' || reference.length === 0) {
      unsupportedOrCorruptSource();
    }
    const dimensions = decodeRangeDimensions(parser, reference);
    if (dimensions.columns > MAX_WORKSHEET_COLUMNS) resourceLimitExceeded();
    decodedRows += dimensions.rows;
    decodedCells += dimensions.rows * dimensions.columns;
    if (decodedRows > MAX_WORKBOOK_ROWS || decodedCells > MAX_WORKBOOK_CELLS) {
      resourceLimitExceeded();
    }
    prepared.push({ name, hidden: false, sheet, hasRange: true });
  }

  const worksheets: SpreadsheetWorksheetData[] = prepared.map((entry) => ({
    name: entry.name,
    hidden: entry.hidden,
    rows:
      entry.hidden || !entry.hasRange
        ? []
        : readDisplayedRows(parser, entry.sheet),
  }));
  return { worksheets };
}
