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

/** Read Blob size through the platform prototype without invoking caller overrides. */
function readBlobSize(blob: Blob): number {
  const getter = Object.getOwnPropertyDescriptor(Blob.prototype, 'size')!.get!;
  return getter.call(blob) as number;
}

/** Read one proven Blob without requiring Blob.arrayBuffer() in older DOMs. */
async function readBlobBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === 'function') {
    return new Uint8Array(await blob.arrayBuffer());
  }
  if (typeof FileReader === 'undefined') {
    throw new DocxImportError('invalid_source');
  }
  return new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (!(reader.result instanceof ArrayBuffer)) {
        reject(new DocxImportError('invalid_source'));
        return;
      }
      resolve(new Uint8Array(reader.result));
    };
    reader.onerror = () => reject(new DocxImportError('invalid_source'));
    reader.readAsArrayBuffer(blob);
  });
}

/** Copy one accepted binary source into an immutable import snapshot. */
async function snapshotSource(
  source: DocxSource,
  maxArchiveBytes: number,
): Promise<Uint8Array> {
  try {
    let view: Uint8Array;
    if (source instanceof ArrayBuffer) {
      view = new Uint8Array(source);
    } else if (ArrayBuffer.isView(source) && source.buffer instanceof ArrayBuffer) {
      view = new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
    } else if (typeof Blob !== 'undefined' && source instanceof Blob) {
      if (readBlobSize(source) > maxArchiveBytes) {
        throw new DocxImportError('input_too_large');
      }
      view = await readBlobBytes(source);
    } else {
      throw new DocxImportError('invalid_source');
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
    if (
      typeof target !== 'object' ||
      target === null ||
      typeof target.validateDocumentJson !== 'function' ||
      typeof target.setDocumentJson !== 'function'
    ) {
      throw new DocxImportError('editor_rejected_document');
    }
    if (target.validateDocumentJson(result.documentJson) !== true) {
      throw new DocxImportError('incompatible_editor_schema');
    }
    target.setDocumentJson(result.documentJson);
    return result;
  } catch (error) {
    throw normalizeDocxImportError(error, 'editor_rejected_document');
  }
}
