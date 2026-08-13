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

/**
 * Convert parser-neutral displayed worksheet text into editable TipTap blocks.
 *
 * This test-first placeholder intentionally reaches the public product boundary
 * and fails until the bounded conversion contract is implemented.
 */
export function spreadsheetWorkbookToDocumentJson(
  _workbook: SpreadsheetWorkbookData,
): SpreadsheetImportResult {
  throw new SpreadsheetImportError(
    'UNSUPPORTED_OR_CORRUPT',
    'Spreadsheet import is not implemented.',
  );
}
