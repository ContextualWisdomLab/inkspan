import type { JSONContent } from '@tiptap/core';

const MAX_VISIBLE_WORKSHEETS = 64;
const MAX_WORKBOOK_ROWS = 10_000;
const MAX_WORKSHEET_COLUMNS = 256;
const MAX_WORKBOOK_CELLS = 262_144;
const MAX_CELL_TEXT_CODE_UNITS = 32_768;
const MAX_WORKBOOK_TEXT_CODE_UNITS = 8_388_608;
const RESOURCE_LIMIT_MESSAGE = 'Spreadsheet exceeds the configured resource limits.';

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

    let worksheetTextCodeUnits = 0;
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