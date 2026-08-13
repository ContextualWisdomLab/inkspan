import type { JSONContent } from '@tiptap/core';

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
export type SpreadsheetImportErrorCode = 'UNSUPPORTED_OR_CORRUPT';

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

function paragraphWithText(text: string): JSONContent {
  return {
    type: 'paragraph',
    content: [{ type: 'text', text }],
  };
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

    content.push({
      type: 'heading',
      attrs: { level: 3 },
      content: [{ type: 'text', text: worksheet.name }],
    });
    content.push({
      type: 'table',
      content: worksheet.rows.map((row) => ({
        type: 'tableRow',
        content: row.map((cell) => ({
          type: 'tableCell',
          content: [paragraphWithText(cell)],
        })),
      })),
    });
    content.push({ type: 'paragraph' });

    worksheetCount += 1;
    rowCount += worksheet.rows.length;
    cellCount += worksheet.rows.reduce((count, row) => count + row.length, 0);
  }

  return { content, worksheetCount, rowCount, cellCount };
}
