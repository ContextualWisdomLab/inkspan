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
const MAX_BIFF8_WORKSHEETS = 256;
const BIFF8_BOF_RECORD = 0x0809;
const BIFF8_BOUNDSHEET8_RECORD = 0x0085;
const BIFF8_EOF_RECORD = 0x000a;
const BIFF8_VERSION = 0x0600;
const BIFF8_WORKBOOK_GLOBALS = 0x0005;

interface SheetJsCfbEntry {
  readonly content?: unknown;
}

interface SheetJsCfbModule {
  readonly read: (
    source: Uint8Array,
    options: { readonly type: 'buffer' },
  ) => unknown;
  readonly find: (container: unknown, path: string) => SheetJsCfbEntry | null;
}

type SheetJsParserWithCfb = SheetJsParserModule & {
  readonly CFB?: SheetJsCfbModule;
};

/** Minimal browser-file contract needed by the local spreadsheet import boundary. */
export interface SpreadsheetFileSource {
  /** Byte length available before allocating and reading the file body. */
  readonly size: number;
  /**
   * Read the local file body without granting any path, network, or persistence
   * authority. Genuine `File`/`Blob` values may omit this method; those are
   * read through `FileReader` or `Response` instead of requiring `arrayBuffer`.
   */
  arrayBuffer?(): Promise<ArrayBuffer>;
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

function isBlobSource(source: SpreadsheetFileSource): source is SpreadsheetFileSource & Blob {
  return typeof Blob !== 'undefined' && source instanceof Blob;
}

function readBlobViaFileReader(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    let reader: FileReader;
    try {
      reader = new FileReader();
    } catch {
      reject(unsupportedOrCorruptSource());
      return;
    }

    reader.onload = () => {
      const result = reader.result;
      if (!(result instanceof ArrayBuffer)) {
        reject(unsupportedOrCorruptSource());
        return;
      }
      resolve(result);
    };
    reader.onerror = () => {
      reject(unsupportedOrCorruptSource());
    };

    try {
      reader.readAsArrayBuffer(blob);
    } catch {
      reject(unsupportedOrCorruptSource());
    }
  });
}

async function readSourceArrayBuffer(
  source: SpreadsheetFileSource,
): Promise<ArrayBuffer> {
  let arrayBufferMethod: unknown;
  try {
    arrayBufferMethod = source.arrayBuffer;
  } catch {
    throw unsupportedOrCorruptSource();
  }

  if (typeof arrayBufferMethod === 'function') {
    try {
      return await arrayBufferMethod.call(source);
    } catch {
      throw unsupportedOrCorruptSource();
    }
  }

  if (isBlobSource(source) && typeof FileReader !== 'undefined') {
    return readBlobViaFileReader(source);
  }
  if (isBlobSource(source) && typeof Response !== 'undefined') {
    try {
      return await new Response(source).arrayBuffer();
    } catch {
      throw unsupportedOrCorruptSource();
    }
  }
  throw unsupportedOrCorruptSource();
}

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

function readOwnDataProperty(source: object, key: PropertyKey): unknown {
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(source, key);
  } catch {
    throw unsupportedOrCorruptSource();
  }
  if (descriptor === undefined || !('value' in descriptor)) {
    throw unsupportedOrCorruptSource();
  }
  return descriptor.value;
}

function readUint16LittleEndian(source: Uint8Array, offset: number): number {
  return source[offset]! | (source[offset + 1]! << 8);
}

function copyCfbEntryBytes(content: unknown, sourceByteLength: number): Uint8Array {
  if (ArrayBuffer.isView(content)) {
    let byteLength: number;
    let elementLength: unknown;
    try {
      byteLength = content.byteLength;
      elementLength = Reflect.get(content, 'length');
    } catch {
      throw unsupportedOrCorruptSource();
    }
    if (
      !Number.isSafeInteger(byteLength) ||
      byteLength < 0 ||
      byteLength > sourceByteLength ||
      elementLength !== byteLength
    ) {
      throw unsupportedOrCorruptSource();
    }

    const copy = new Uint8Array(byteLength);
    for (let index = 0; index < copy.byteLength; index += 1) {
      const value = readOwnDataProperty(content, String(index));
      if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 0xff) {
        throw unsupportedOrCorruptSource();
      }
      copy[index] = value as number;
    }
    return copy;
  }
  if (!Array.isArray(content)) {
    throw unsupportedOrCorruptSource();
  }

  const length = readOwnDataProperty(content, 'length');
  if (
    !Number.isSafeInteger(length) ||
    (length as number) < 0 ||
    (length as number) > sourceByteLength
  ) {
    throw unsupportedOrCorruptSource();
  }

  const copy = new Uint8Array(length as number);
  for (let index = 0; index < copy.byteLength; index += 1) {
    const value = readOwnDataProperty(content, String(index));
    if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 0xff) {
      throw unsupportedOrCorruptSource();
    }
    copy[index] = value as number;
  }
  return copy;
}

function readBiff8WorkbookStream(
  source: Uint8Array,
  parser: SheetJsParserModule,
): Uint8Array {
  const cfb = (parser as SheetJsParserWithCfb).CFB;
  if (
    !isObject(cfb) ||
    typeof cfb.read !== 'function' ||
    typeof cfb.find !== 'function'
  ) {
    throw unsupportedOrCorruptSource();
  }

  let container: unknown;
  let workbookEntry: SheetJsCfbEntry | null;
  try {
    container = cfb.read(new Uint8Array(source), { type: 'buffer' });
    workbookEntry = cfb.find(container, 'Workbook');
  } catch {
    throw unsupportedOrCorruptSource();
  }
  if (!isObject(workbookEntry)) {
    throw unsupportedOrCorruptSource();
  }

  const content = readOwnDataProperty(workbookEntry, 'content');
  return copyCfbEntryBytes(content, source.byteLength);
}

function readBiff8HiddenStates(workbookStream: Uint8Array): readonly boolean[] {
  let offset = 0;
  let sawWorkbookBof = false;
  const hiddenStates: boolean[] = [];

  while (offset + 4 <= workbookStream.byteLength) {
    const recordType = readUint16LittleEndian(workbookStream, offset);
    const recordLength = readUint16LittleEndian(workbookStream, offset + 2);
    const payloadOffset = offset + 4;
    const nextOffset = payloadOffset + recordLength;
    if (nextOffset > workbookStream.byteLength) {
      throw unsupportedOrCorruptSource();
    }

    if (!sawWorkbookBof) {
      if (
        recordType !== BIFF8_BOF_RECORD ||
        recordLength < 4 ||
        readUint16LittleEndian(workbookStream, payloadOffset) !== BIFF8_VERSION ||
        readUint16LittleEndian(workbookStream, payloadOffset + 2) !==
          BIFF8_WORKBOOK_GLOBALS
      ) {
        throw unsupportedOrCorruptSource();
      }
      sawWorkbookBof = true;
    } else if (recordType === BIFF8_BOUNDSHEET8_RECORD) {
      if (recordLength < 8) {
        throw unsupportedOrCorruptSource();
      }
      const visibility = workbookStream[payloadOffset + 4]!;
      if ((visibility & 0xfc) !== 0 || (visibility & 0x03) === 0x03) {
        throw unsupportedOrCorruptSource();
      }
      hiddenStates.push((visibility & 0x03) !== 0);
      if (hiddenStates.length > MAX_BIFF8_WORKSHEETS) {
        throw resourceLimitExceeded();
      }
    } else if (recordType === BIFF8_EOF_RECORD) {
      return hiddenStates;
    }

    offset = nextOffset;
  }

  throw unsupportedOrCorruptSource();
}

function readArrayLength(value: unknown): number {
  let arrayValue: unknown[];
  try {
    if (!Array.isArray(value)) {
      throw unsupportedOrCorruptSource();
    }
    arrayValue = value;
  } catch {
    throw unsupportedOrCorruptSource();
  }
  return readOwnDataProperty(arrayValue, 'length') as number;
}

function withAuthoritativeBiff8Visibility(
  parser: SheetJsParserModule,
  hiddenStates: readonly boolean[],
): SheetJsParserModule {
  const workbookMetadata = Object.freeze({
    Sheets: Object.freeze(
      hiddenStates.map((hidden) => Object.freeze({ Hidden: hidden ? 1 : 0 })),
    ),
  });

  return {
    read(source, options) {
      const parsedWorkbook = parser.read(source, options);
      if (!isObject(parsedWorkbook)) {
        return parsedWorkbook;
      }

      const sheetNames = readOwnDataProperty(parsedWorkbook, 'SheetNames');
      if (readArrayLength(sheetNames) !== hiddenStates.length) {
        throw unsupportedOrCorruptSource();
      }

      return new Proxy(parsedWorkbook, {
        getOwnPropertyDescriptor(target, property) {
          if (property === 'Workbook') {
            return {
              configurable: true,
              enumerable: true,
              value: workbookMetadata,
              writable: false,
            };
          }
          return Reflect.getOwnPropertyDescriptor(target, property);
        },
      });
    },
    utils: parser.utils,
  };
}

/**
 * Parse supported local XLS/XLSX bytes after preflighting their binary envelope.
 *
 * The parser loader is deliberately injected so the preflight ordering is directly
 * testable without importing the parser package. The loader is not invoked until the
 * caller-controlled bytes have crossed Inkspan's local signature and resource bounds.
 * BIFF8 worksheet visibility is additionally recovered from the raw BoundSheet8
 * records in the CFB Workbook stream so confidentiality does not depend on mutable
 * parser-emitted visibility metadata observed to vary across repeated reads.
 */
export async function parseSheetJsSpreadsheetBytesWithParserLoader(
  source: Uint8Array,
  loadParser: () => Promise<SheetJsParserModule>,
): Promise<SpreadsheetWorkbookData> {
  const boundedSource = preflightSpreadsheetBinarySource(source);
  const parser = await loadParser();
  if (boundedSource.format !== 'xls') {
    return sheetJsBytesToWorkbookData(boundedSource.bytes, parser);
  }

  const workbookStream = readBiff8WorkbookStream(boundedSource.bytes, parser);
  const hiddenStates = readBiff8HiddenStates(workbookStream);
  return sheetJsBytesToWorkbookData(
    boundedSource.bytes,
    withAuthoritativeBiff8Visibility(parser, hiddenStates),
  );
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
 * Source size is checked before the file body is read so oversized user-selected
 * files are rejected before a proportional allocation. Browser `File` values are
 * read through `arrayBuffer()` when present, otherwise through `FileReader` or
 * `Response`, matching the image-import fallback for DOMs that omit
 * `Blob.arrayBuffer`. Read failures and malformed source identities are
 * normalized to the stable payload-redacted import error contract.
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

  const buffer = await readSourceArrayBuffer(source);
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength !== sourceSize) {
    throw unsupportedOrCorruptSource();
  }

  const workbook = await parseSheetJsSpreadsheetBytes(new Uint8Array(buffer));
  return spreadsheetWorkbookToDocumentJson(workbook);
}
