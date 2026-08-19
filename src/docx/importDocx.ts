import { DocxImportError, normalizeDocxImportError } from './errors.js';
import { resolveDocxImportLimits } from './limits.js';
import { parseDocxPackage } from './ooxml.js';
import type {
  DocxDocumentTarget,
  DocxImportOptions,
  DocxImportResult,
  DocxSource,
} from './types.js';
import { ZipArchive } from './zip.js';

const ARRAY_BUFFER_BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(
  ArrayBuffer.prototype,
  'byteLength',
)!.get!;
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(
  Uint8Array.prototype,
) as object;
const TYPED_ARRAY_BUFFER_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  'buffer',
)!.get!;
const TYPED_ARRAY_BYTE_OFFSET_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  'byteOffset',
)!.get!;
const TYPED_ARRAY_BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  'byteLength',
)!.get!;
const DATA_VIEW_BUFFER_GETTER = Object.getOwnPropertyDescriptor(
  DataView.prototype,
  'buffer',
)!.get!;
const DATA_VIEW_BYTE_OFFSET_GETTER = Object.getOwnPropertyDescriptor(
  DataView.prototype,
  'byteOffset',
)!.get!;
const DATA_VIEW_BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(
  DataView.prototype,
  'byteLength',
)!.get!;
const BLOB_PROTOTYPE =
  typeof Blob === 'undefined' ? undefined : Blob.prototype;
const BLOB_SIZE_GETTER =
  BLOB_PROTOTYPE === undefined
    ? undefined
    : Object.getOwnPropertyDescriptor(BLOB_PROTOTYPE, 'size')?.get;
const BLOB_ARRAY_BUFFER_DESCRIPTOR =
  BLOB_PROTOTYPE === undefined
    ? undefined
    : Object.getOwnPropertyDescriptor(BLOB_PROTOTYPE, 'arrayBuffer');
const BLOB_ARRAY_BUFFER =
  BLOB_ARRAY_BUFFER_DESCRIPTOR !== undefined &&
  'value' in BLOB_ARRAY_BUFFER_DESCRIPTOR &&
  typeof BLOB_ARRAY_BUFFER_DESCRIPTOR.value === 'function'
    ? (BLOB_ARRAY_BUFFER_DESCRIPTOR.value as (this: Blob) => Promise<ArrayBuffer>)
    : undefined;

interface ArrayBufferViewRange {
  readonly buffer: ArrayBufferLike;
  readonly byteOffset: number;
  readonly byteLength: number;
}

/** Identify a genuine ArrayBuffer through its internal slot without prototype traversal. */
function isIntrinsicArrayBuffer(value: unknown): value is ArrayBuffer {
  try {
    ARRAY_BUFFER_BYTE_LENGTH_GETTER.call(value);
    return true;
  } catch {
    return false;
  }
}

/** Read Blob size through the captured platform intrinsic without invoking caller overrides. */
function readBlobSize(blob: Blob): number {
  if (BLOB_SIZE_GETTER === undefined) {
    throw new DocxImportError('invalid_source');
  }
  return BLOB_SIZE_GETTER.call(blob) as number;
}

/** Identify a genuine Blob and read its size without prototype traversal. */
function tryReadBlobSize(value: unknown): number | undefined {
  try {
    return readBlobSize(value as Blob);
  } catch {
    return undefined;
  }
}

/** Read one proven Blob without requiring Blob.arrayBuffer() in older DOMs. */
async function readBlobBytes(blob: Blob): Promise<Uint8Array> {
  const ownArrayBuffer = Object.getOwnPropertyDescriptor(blob, 'arrayBuffer');
  const ownUndefinedArrayBuffer =
    ownArrayBuffer !== undefined &&
    'value' in ownArrayBuffer &&
    ownArrayBuffer.value === undefined;
  if (!ownUndefinedArrayBuffer && BLOB_ARRAY_BUFFER !== undefined) {
    return new Uint8Array(await BLOB_ARRAY_BUFFER.call(blob));
  }
  if (typeof FileReader === 'undefined') {
    throw new DocxImportError('invalid_source');
  }
  return new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (!isIntrinsicArrayBuffer(result)) {
        reject(new DocxImportError('invalid_source'));
        return;
      }
      resolve(new Uint8Array(result));
    };
    reader.onerror = () => reject(new DocxImportError('invalid_source'));
    reader.readAsArrayBuffer(blob);
  });
}

/** Read one genuine ArrayBuffer view range without invoking caller overrides. */
function readArrayBufferViewRange(source: ArrayBufferView): ArrayBufferViewRange {
  try {
    return {
      buffer: TYPED_ARRAY_BUFFER_GETTER.call(source) as ArrayBufferLike,
      byteOffset: TYPED_ARRAY_BYTE_OFFSET_GETTER.call(source) as number,
      byteLength: TYPED_ARRAY_BYTE_LENGTH_GETTER.call(source) as number,
    };
  } catch {
    return {
      buffer: DATA_VIEW_BUFFER_GETTER.call(source) as ArrayBufferLike,
      byteOffset: DATA_VIEW_BYTE_OFFSET_GETTER.call(source) as number,
      byteLength: DATA_VIEW_BYTE_LENGTH_GETTER.call(source) as number,
    };
  }
}

/** Copy one accepted binary source into an immutable import snapshot. */
async function snapshotSource(
  source: DocxSource,
  maxArchiveBytes: number,
): Promise<Uint8Array> {
  try {
    let view: Uint8Array;
    if (isIntrinsicArrayBuffer(source)) {
      view = new Uint8Array(source);
    } else if (ArrayBuffer.isView(source)) {
      const { buffer, byteOffset, byteLength } = readArrayBufferViewRange(source);
      if (!isIntrinsicArrayBuffer(buffer)) {
        throw new DocxImportError('invalid_source');
      }
      view = new Uint8Array(buffer, byteOffset, byteLength);
    } else {
      const blobSize = tryReadBlobSize(source);
      if (blobSize === undefined) {
        throw new DocxImportError('invalid_source');
      }
      if (blobSize > maxArchiveBytes) {
        throw new DocxImportError('input_too_large');
      }
      view = await readBlobBytes(source as Blob);
    }
    if (view.byteLength === 0) throw new DocxImportError('invalid_source');
    if (view.byteLength > maxArchiveBytes) {
      throw new DocxImportError('input_too_large');
    }
    return view.slice();
  } catch (error) {
    throw normalizeDocxImportError(error, 'invalid_source');
  }
}

/** Import one untrusted DOCX package without mutating an editor. */
export async function importDocx(
  source: DocxSource,
  options?: DocxImportOptions,
): Promise<DocxImportResult> {
  const limits = resolveDocxImportLimits(options);
  const bytes = await snapshotSource(source, limits.maxArchiveBytes);
  try {
    return await parseDocxPackage(ZipArchive.parse(bytes, limits), limits);
  } catch (error) {
    throw normalizeDocxImportError(error, 'invalid_docx');
  }
}

/** Import, schema-check, and atomically replace one compatible editor document. */
export async function openDocx(
  target: DocxDocumentTarget,
  source: DocxSource,
  options?: DocxImportOptions,
): Promise<DocxImportResult> {
  const result = await importDocx(source, options);
  try {
    if (typeof target !== 'object' || target === null) {
      throw new DocxImportError('editor_rejected_document');
    }
    const validateDocumentJson = target.validateDocumentJson;
    const setDocumentJson = target.setDocumentJson;
    if (
      typeof validateDocumentJson !== 'function' ||
      typeof setDocumentJson !== 'function'
    ) {
      throw new DocxImportError('editor_rejected_document');
    }
    if (validateDocumentJson.call(target, result.documentJson) !== true) {
      throw new DocxImportError('incompatible_editor_schema');
    }
    setDocumentJson.call(target, result.documentJson);
    return result;
  } catch (error) {
    throw normalizeDocxImportError(error, 'editor_rejected_document');
  }
}
