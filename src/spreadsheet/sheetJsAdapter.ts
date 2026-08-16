import type { SpreadsheetWorkbookData } from './spreadsheetImport.js';
import { SpreadsheetImportError } from './spreadsheetImport.js';

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

/**
 * Project locally parsed SheetJS workbook data into Inkspan's parser-neutral
 * workbook contract. The implementation is intentionally test-first.
 */
export function sheetJsBytesToWorkbookData(
  _source: Uint8Array,
  _parser: SheetJsParserModule,
): SpreadsheetWorkbookData {
  throw new SpreadsheetImportError(
    'UNSUPPORTED_OR_CORRUPT',
    'Spreadsheet source is unsupported or corrupt.',
  );
}
