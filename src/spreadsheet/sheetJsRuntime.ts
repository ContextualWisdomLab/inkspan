import type { SpreadsheetWorkbookData } from './spreadsheetImport.js';
import {
  sheetJsBytesToWorkbookData,
  type SheetJsParserModule,
} from './sheetJsAdapter.js';

/**
 * Parse supported local XLS/XLSX bytes through Inkspan's bounded SheetJS adapter.
 *
 * The parser package is loaded locally and receives no network, credential,
 * persistence, model, transport, or editor mutation authority. Its untrusted
 * materialized output still crosses the same descriptor-safe resource bounds as
 * an injected parser module before it becomes parser-neutral workbook data.
 */
export async function parseSheetJsSpreadsheetBytes(
  source: Uint8Array,
): Promise<SpreadsheetWorkbookData> {
  const parser = (await import('xlsx')) as unknown as SheetJsParserModule;
  return sheetJsBytesToWorkbookData(source, parser);
}
