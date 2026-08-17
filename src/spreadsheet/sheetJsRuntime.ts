import {
  preflightSpreadsheetBinarySource,
  SpreadsheetImportError,
  spreadsheetWorkbookToDocumentJson,
  type SpreadsheetImportResult,
  type SpreadsheetWorkbookData,
} from './spreadsheetImport.js';
import {
  sheetJsBytesToWorkbookData,
  type SheetJsParserModule,
} from './sheetJsAdapter.js';

const MAX_SPREADSHEET_SOURCE_BYTES = 64 * 1024 * 1024;

/** Minimal browser-file contract needed by the local spreadsheet import boundary. */
export interface SpreadsheetFileSource {
  /** Byte length available before allocating and reading the file body. */
  readonly size: number;
  /** Read the local file body without granting any path, network, or persistence authority. */
  arrayBuffer(): Promise<ArrayBuffer>;
}

function resourceLimitExceeded(): SpreadsheetImportError {
  return new SpreadsheetImportError(
    'RESOURCE_LIMIT_EXCEEDED',
    'Spreadsheet exceeds the configured resource limits.',
  );
}

function unsupportedOrCorruptSource(): SpreadsheetImportError {
  return new SpreadsheetImportError(
    'UNSUPPORTED_OR_CORRUPT',
    'Spreadsheet source is unsupported or corrupt.',
  );
}

/**
 * Parse supported local XLS/XLSX bytes after preflighting their binary envelope.
 *
 * The parser loader is deliberately injected so the preflight ordering is directly
 * testable without importing the parser package. The loader is not invoked until the
 * caller-controlled bytes have crossed Inkspan's local signature and resource bounds.
 */
export async function parseSheetJsSpreadsheetBytesWithParserLoader(
  source: Uint8Array,
  loadParser: () => Promise<SheetJsParserModule>,
): Promise<SpreadsheetWorkbookData> {
  const boundedSource = preflightSpreadsheetBinarySource(source);
  const parser = await loadParser();
  return sheetJsBytesToWorkbookData(boundedSource.bytes, parser);
}

/**
 * Parse supported local XLS/XLSX bytes through Inkspan's bounded SheetJS adapter.
 *
 * The public byte-array entry point validates the source envelope and byte ceiling
 * before the parser module is loaded. The parser package is loaded locally and
 * receives no network, credential, persistence, model, transport, or editor
 * mutation authority. Its untrusted materialized output still crosses the same
 * descriptor-safe resource bounds as an injected parser module before it becomes
 * parser-neutral workbook data.
 */
export async function parseSheetJsSpreadsheetBytes(
  source: Uint8Array,
): Promise<SpreadsheetWorkbookData> {
  return parseSheetJsSpreadsheetBytesWithParserLoader(
    source,
    async () => (await import('xlsx')) as unknown as SheetJsParserModule,
  );
}

/**
 * Read one local browser file and convert its visible worksheets to inert TipTap JSON.
 *
 * Source size is checked before `arrayBuffer()` so oversized user-selected files are
 * rejected before a proportional allocation. Read failures and malformed source
 * identities are normalized to the stable payload-redacted import error contract.
 */
export async function spreadsheetFileToDocumentJson(
  source: SpreadsheetFileSource,
): Promise<SpreadsheetImportResult> {
  let sourceSize: number;
  try {
    sourceSize = source.size;
  } catch {
    throw unsupportedOrCorruptSource();
  }

  if (!Number.isSafeInteger(sourceSize) || sourceSize < 0) {
    throw unsupportedOrCorruptSource();
  }
  if (sourceSize > MAX_SPREADSHEET_SOURCE_BYTES) {
    throw resourceLimitExceeded();
  }

  let buffer: ArrayBuffer;
  try {
    buffer = await source.arrayBuffer();
  } catch {
    throw unsupportedOrCorruptSource();
  }
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength !== sourceSize) {
    throw unsupportedOrCorruptSource();
  }

  const workbook = await parseSheetJsSpreadsheetBytes(new Uint8Array(buffer));
  return spreadsheetWorkbookToDocumentJson(workbook);
}
