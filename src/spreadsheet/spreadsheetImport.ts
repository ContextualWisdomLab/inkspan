import type { JSONContent } from '@tiptap/core';

const MAX_SPREADSHEET_SOURCE_BYTES = 64 * 1024 * 1024;
const MAX_VISIBLE_WORKSHEETS = 64;
const MAX_WORKBOOK_ROWS = 10_000;
const MAX_WORKSHEET_COLUMNS = 256;
const MAX_WORKBOOK_CELLS = 262_144;
const MAX_CELL_TEXT_CODE_UNITS = 32_768;
const MAX_WORKBOOK_TEXT_CODE_UNITS = 8_388_608;
const RESOURCE_LIMIT_MESSAGE = 'Spreadsheet exceeds the configured resource limits.';
const UNSUPPORTED_SOURCE_MESSAGE = 'Spreadsheet source is unsupported or corrupt.';
const XLSX_ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04] as const;
const XLS_COMPOUND_FILE_SIGNATURE = [
  0xd0,
  0xcf,
  0x11,
  0xe0,
  0xa1,
  0xb1,
  0x1a,
  0xe1,
] as const;

/** Binary spreadsheet container family identified before local parsing. */
export type SpreadsheetBinaryFormat = 'xls' | 'xlsx';

/** Bounded spreadsheet bytes paired with their detected container family. */
export interface SpreadsheetBinarySource {
  /** Container family selected only from the source signature. */
  readonly format: SpreadsheetBinaryFormat;
  /** Original local bytes retained without an additional proportional copy. */
  readonly bytes: Uint8Array;
}

/** One parser-neutral worksheet supplied to the bounded spreadsheet converter. */
export interface SpreadsheetWorksheetData {
  /** Display name used only after the worksheet passes visibility and resource checks. */
  readonly name: string;
  /** Whether the source workbook marks this worksheet hidden or very hidden. */
  readonly hidden: boolean;
  /** Rectangular or ragged displayed cell text in source reading order. */
  readonly rows: readonly (readonly string[])[];
}

/** Parser-neutral workbook projection accepted by the editor conversion boundary. */
export interface SpreadsheetWorkbookData {
  /** Source-order worksheet projections. */
  readonly worksheets: readonly SpreadsheetWorksheetData[];
}

/** Stable categories for spreadsheet-import failures. */
export type SpreadsheetImportErrorCode =
  | 'UNSUPPORTED_OR_CORRUPT'
  | 'RESOURCE_LIMIT_EXCEEDED';

/** Bounded spreadsheet content ready for one TipTap insertion transaction. */
export interface SpreadsheetImportResult {
  /** Block nodes inserted at the active editor selection. */
  readonly content: readonly JSONContent[];
  /** Number of visible, non-empty worksheets represented in `content`. */
  readonly worksheetCount: number;
  /** Number of represented worksheet rows. */
  readonly rowCount: number;
  /** Number of represented rectangular table cells, including blanks. */
  readonly cellCount: number;
}

/** Payload-redacted error emitted by the spreadsheet import boundary. */
export class SpreadsheetImportError extends Error {
  /** Stable failure category suitable for host telemetry and localized UI. */
  readonly code: SpreadsheetImportErrorCode;

  /** Create a spreadsheet import error without retaining source content. */
  constructor(code: SpreadsheetImportErrorCode, message: string) {
    super(message);
    this.name = 'SpreadsheetImportError';
    this.code = code;
  }
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

function startsWithSignature(
  source: Uint8Array,
  signature: readonly number[],
): boolean {
  if (source.byteLength < signature.length) return false;
  for (let index = 0; index < signature.length; index += 1) {
    if (source[index] !== signature[index]) return false;
  }
  return true;
}

/**
 * Bound and classify local XLS/XLSX bytes before any workbook parser is loaded.
 *
 * This is deliberately only a source-envelope preflight. A matching ZIP or OLE
 * signature does not assert that the remainder is a valid workbook; the later
 * parser boundary must still fail closed on malformed package structure.
 */
export function preflightSpreadsheetBinarySource(
  source: Uint8Array,
): SpreadsheetBinarySource {
  if (source.byteLength > MAX_SPREADSHEET_SOURCE_BYTES) resourceLimitExceeded();

  if (startsWithSignature(source, XLS_COMPOUND_FILE_SIGNATURE)) {
    return { format: 'xls', bytes: source };
  }
  if (startsWithSignature(source, XLSX_ZIP_SIGNATURE)) {
    return { format: 'xlsx', bytes: source };
  }
  return unsupportedOrCorruptSource();
}

function paragraphWithText(text: string): JSONContent {
  const content: JSONContent[] = [];
  const lines = text.split(/\r\n|\r|\n/u);

  for (const [index, line] of lines.entries()) {
    if (index > 0) content.push({ type: 'hardBreak' });
    if (line) content.push({ type: 'text', text: line });
  }

  return content.length > 0
    ? { type: 'paragraph', content }
    : { type: 'paragraph' };
}

interface PreparedWorksheet {
  readonly worksheet: SpreadsheetWorksheetData;
  readonly columnCount: number;
}

/** Convert parser-neutral displayed worksheet text into editable TipTap blocks. */
export function spreadsheetWorkbookToDocumentJson(
  workbook: SpreadsheetWorkbookData,
): SpreadsheetImportResult {
  const preparedWorksheets: PreparedWorksheet[] = [];
  let worksheetCount = 0;
  let rowCount = 0;
  let cellCount = 0;
  let textCodeUnits = 0;

  // Preflight the complete workbook before allocating proportional TipTap nodes.
  for (const worksheet of workbook.worksheets) {
    if (worksheet.hidden) continue;

    const nextRowCount = rowCount + worksheet.rows.length;
    if (nextRowCount > MAX_WORKBOOK_ROWS) resourceLimitExceeded();

    const columnCount = worksheet.rows.reduce(
      (maxColumns, row) => Math.max(maxColumns, row.length),
      0,
    );
    if (columnCount === 0) continue;
    if (worksheetCount >= MAX_VISIBLE_WORKSHEETS) resourceLimitExceeded();
    if (columnCount > MAX_WORKSHEET_COLUMNS) resourceLimitExceeded();

    const worksheetCellCount = worksheet.rows.length * columnCount;
    const nextCellCount = cellCount + worksheetCellCount;
    if (nextCellCount > MAX_WORKBOOK_CELLS) resourceLimitExceeded();

    let worksheetTextCodeUnits = worksheet.name.length;
    if (textCodeUnits + worksheetTextCodeUnits > MAX_WORKBOOK_TEXT_CODE_UNITS) {
      resourceLimitExceeded();
    }
    for (const row of worksheet.rows) {
      for (const cellText of row) {
        if (cellText.length > MAX_CELL_TEXT_CODE_UNITS) resourceLimitExceeded();
        worksheetTextCodeUnits += cellText.length;
        if (textCodeUnits + worksheetTextCodeUnits > MAX_WORKBOOK_TEXT_CODE_UNITS) {
          resourceLimitExceeded();
        }
      }
    }

    preparedWorksheets.push({ worksheet, columnCount });
    worksheetCount += 1;
    rowCount = nextRowCount;
    cellCount = nextCellCount;
    textCodeUnits += worksheetTextCodeUnits;
  }

  const content: JSONContent[] = [];
  for (const { worksheet, columnCount } of preparedWorksheets) {
    content.push({
      type: 'heading',
      attrs: { level: 3 },
      content: [{ type: 'text', text: worksheet.name }],
    });
    content.push({
      type: 'table',
      content: worksheet.rows.map((row) => ({
        type: 'tableRow',
        content: Array.from({ length: columnCount }, (_, columnIndex) => ({
          type: 'tableCell',
          content: [paragraphWithText(row[columnIndex] ?? '')],
        })),
      })),
    });
    content.push({ type: 'paragraph' });
  }

  return { content, worksheetCount, rowCount, cellCount };
}