import type { JSONContent } from '@tiptap/core';

const MAX_VISIBLE_WORKSHEETS = 64;
const MAX_WORKSHEET_COLUMNS = 256;
const MAX_CELL_TEXT_CODE_UNITS = 32_768;
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

/** Convert parser-neutral displayed worksheet text into editable TipTap blocks. */
export function spreadsheetWorkbookToDocumentJson(
  workbook: SpreadsheetWorkbookData,
): SpreadsheetImportResult {
  const content: JSONContent[] = [];
  let worksheetCount = 0;
  let rowCount = 0;
  let cellCount = 0;

  for (const worksheet of workbook.worksheets) {
    if (worksheet.hidden) continue;

    const columnCount = worksheet.rows.reduce(
      (maxColumns, row) => Math.max(maxColumns, row.length),
      0,
    );
    if (columnCount === 0) continue;
    if (worksheetCount >= MAX_VISIBLE_WORKSHEETS) resourceLimitExceeded();
    if (columnCount > MAX_WORKSHEET_COLUMNS) resourceLimitExceeded();

    for (const row of worksheet.rows) {
      for (const cellText of row) {
        if (cellText.length > MAX_CELL_TEXT_CODE_UNITS) resourceLimitExceeded();
      }
    }

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

    worksheetCount += 1;
    rowCount += worksheet.rows.length;
    cellCount += worksheet.rows.length * columnCount;
  }

  return { content, worksheetCount, rowCount, cellCount };
}
