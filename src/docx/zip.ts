import { DocxImportError, normalizeDocxImportError } from './errors.js';
import type { DocxImportLimits } from './types.js';

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const MAX_EOCD_SEARCH_BYTES = 65_557;
const UTF8_FLAG = 0x0800;
const DATA_DESCRIPTOR_FLAG = 0x0008;
const ENCRYPTION_FLAGS = 0x2041;
const SUPPORTED_FLAGS = UTF8_FLAG | DATA_DESCRIPTOR_FLAG;

interface ZipEntry {
  readonly name: string;
  readonly flags: number;
  readonly method: number;
  readonly crc32: number;
  readonly compressedSize: number;
  readonly uncompressedSize: number;
  readonly localHeaderOffset: number;
}

/** @internal Read one little-endian unsigned 16-bit integer after a bounds check. */
export function readUint16(bytes: Uint8Array, offset: number): number {
  if (offset < 0 || offset + 2 > bytes.byteLength) {
    throw new DocxImportError('invalid_zip');
  }
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

/** @internal Read one little-endian unsigned 32-bit integer after a bounds check. */
export function readUint32(bytes: Uint8Array, offset: number): number {
  if (offset < 0 || offset + 4 > bytes.byteLength) {
    throw new DocxImportError('invalid_zip');
  }
  return (
    bytes[offset]! |
    (bytes[offset + 1]! << 8) |
    (bytes[offset + 2]! << 16) |
    (bytes[offset + 3]! << 24)
  ) >>> 0;
}

function decodeEntryName(nameBytes: Uint8Array, flags: number): string {
  if (nameBytes.byteLength === 0) throw new DocxImportError('invalid_zip');
  try {
    if ((flags & UTF8_FLAG) !== 0) {
      return new TextDecoder('utf-8', { fatal: true }).decode(nameBytes);
    }
    for (const byte of nameBytes) {
      if (byte < 0x20 || byte > 0x7e) {
        throw new DocxImportError('unsupported_archive');
      }
    }
    return new TextDecoder('ascii', { fatal: true }).decode(nameBytes);
  } catch (error) {
    throw normalizeDocxImportError(error, 'invalid_zip');
  }
}

function validateEntryName(name: string): boolean {
  if (
    name.length === 0 ||
    name.includes('\\') ||
    name.includes('\0') ||
    /[\u0000-\u001f\u007f]/u.test(name) ||
    name.startsWith('/') ||
    /^[A-Za-z]:/u.test(name)
  ) {
    throw new DocxImportError('invalid_zip');
  }
  const directory = name.endsWith('/');
  const segments = name.split('/');
  if (directory) segments.pop();
  if (
    segments.length === 0 ||
    segments.some((segment) => segment.length === 0 || segment === '.' || segment === '..')
  ) {
    throw new DocxImportError('invalid_zip');
  }
  return directory;
}

function findEndOfCentralDirectory(bytes: Uint8Array): number {
  if (bytes.byteLength < 22) throw new DocxImportError('invalid_zip');
  const minimum = Math.max(0, bytes.byteLength - MAX_EOCD_SEARCH_BYTES);
  for (let offset = bytes.byteLength - 22; offset >= minimum; offset -= 1) {
    if (readUint32(bytes, offset) !== EOCD_SIGNATURE) continue;
    const commentLength = readUint16(bytes, offset + 20);
    if (offset + 22 + commentLength === bytes.byteLength) return offset;
  }
  throw new DocxImportError('invalid_zip');
}

/** Compute the standard ZIP CRC-32 without mutable global tables. */
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function inflateRaw(
  compressed: Uint8Array,
  expectedBytes: number,
): Promise<Uint8Array> {
  if (
    typeof DecompressionStream === 'undefined' ||
    typeof ReadableStream === 'undefined'
  ) {
    throw new DocxImportError('decompression_unavailable');
  }
  let transform: DecompressionStream;
  try {
    transform = new DecompressionStream('deflate-raw');
  } catch {
    throw new DocxImportError('decompression_unavailable');
  }
  const input = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(compressed);
      controller.close();
    },
  });
  const reader = input.pipeThrough(transform).getReader();
  const output = new Uint8Array(expectedBytes);
  let offset = 0;
  try {
    for (;;) {
      const result = await reader.read();
      if (result.done) break;
      const chunk = result.value;
      if (offset + chunk.byteLength > expectedBytes) {
        throw new DocxImportError('invalid_zip');
      }
      output.set(chunk, offset);
      offset += chunk.byteLength;
    }
  } catch (error) {
    throw normalizeDocxImportError(error, 'invalid_zip');
  } finally {
    reader.releaseLock();
  }
  if (offset !== expectedBytes) throw new DocxImportError('invalid_zip');
  return output;
}

/** Bounded random-access reader for the entries of one validated ZIP archive. */
export class ZipArchive {
  readonly #bytes: Uint8Array;
  readonly #entries: ReadonlyMap<string, ZipEntry>;
  readonly #centralDirectoryOffset: number;
  readonly #cache = new Map<string, Promise<Uint8Array>>();

  private constructor(
    bytes: Uint8Array,
    entries: ReadonlyMap<string, ZipEntry>,
    centralDirectoryOffset: number,
  ) {
    this.#bytes = bytes;
    this.#entries = entries;
    this.#centralDirectoryOffset = centralDirectoryOffset;
  }

  /** Parse and validate one complete single-disk non-Zip64 archive. */
  static parse(
    bytes: Uint8Array,
    limits: Readonly<DocxImportLimits>,
  ): ZipArchive {
    const eocdOffset = findEndOfCentralDirectory(bytes);
    const diskNumber = readUint16(bytes, eocdOffset + 4);
    const centralDisk = readUint16(bytes, eocdOffset + 6);
    const entriesOnDisk = readUint16(bytes, eocdOffset + 8);
    const entryCount = readUint16(bytes, eocdOffset + 10);
    const centralSize = readUint32(bytes, eocdOffset + 12);
    const centralOffset = readUint32(bytes, eocdOffset + 16);
    if (diskNumber !== 0 || centralDisk !== 0 || entriesOnDisk !== entryCount) {
      throw new DocxImportError('unsupported_archive');
    }
    if (
      entryCount === 0xffff ||
      centralSize === 0xffffffff ||
      centralOffset === 0xffffffff
    ) {
      throw new DocxImportError('unsupported_archive');
    }
    if (entryCount < 1 || entryCount > limits.maxEntries) {
      throw new DocxImportError('archive_limit_exceeded');
    }
    if (
      centralOffset > eocdOffset ||
      centralSize > eocdOffset - centralOffset
    ) {
      throw new DocxImportError('invalid_zip');
    }

    const entries = new Map<string, ZipEntry>();
    let totalUncompressedBytes = 0;
    let cursor = centralOffset;
    const centralEnd = centralOffset + centralSize;
    for (let index = 0; index < entryCount; index += 1) {
      if (cursor + 46 > centralEnd || readUint32(bytes, cursor) !== CENTRAL_SIGNATURE) {
        throw new DocxImportError('invalid_zip');
      }
      const flags = readUint16(bytes, cursor + 8);
      const method = readUint16(bytes, cursor + 10);
      const checksum = readUint32(bytes, cursor + 16);
      const compressedSize = readUint32(bytes, cursor + 20);
      const uncompressedSize = readUint32(bytes, cursor + 24);
      const nameLength = readUint16(bytes, cursor + 28);
      const extraLength = readUint16(bytes, cursor + 30);
      const commentLength = readUint16(bytes, cursor + 32);
      const diskStart = readUint16(bytes, cursor + 34);
      const localHeaderOffset = readUint32(bytes, cursor + 42);
      const recordLength = 46 + nameLength + extraLength + commentLength;
      if (cursor + recordLength > centralEnd) {
        throw new DocxImportError('invalid_zip');
      }
      if ((flags & ENCRYPTION_FLAGS) !== 0) {
        throw new DocxImportError('encrypted_archive');
      }
      if ((flags & ~SUPPORTED_FLAGS) !== 0) {
        throw new DocxImportError('unsupported_archive');
      }
      if (method !== 0 && method !== 8) {
        throw new DocxImportError('unsupported_archive');
      }
      if (
        compressedSize === 0xffffffff ||
        uncompressedSize === 0xffffffff ||
        localHeaderOffset === 0xffffffff ||
        diskStart === 0xffff
      ) {
        throw new DocxImportError('unsupported_archive');
      }
      if (diskStart !== 0) throw new DocxImportError('unsupported_archive');
      if (
        compressedSize > limits.maxArchiveBytes ||
        uncompressedSize > limits.maxEntryBytes
      ) {
        throw new DocxImportError('archive_limit_exceeded');
      }
      if (
        (compressedSize === 0 && uncompressedSize !== 0) ||
        (compressedSize > 0 &&
          uncompressedSize > compressedSize * limits.maxCompressionRatio)
      ) {
        throw new DocxImportError('archive_limit_exceeded');
      }
      totalUncompressedBytes += uncompressedSize;
      if (totalUncompressedBytes > limits.maxTotalUncompressedBytes) {
        throw new DocxImportError('archive_limit_exceeded');
      }
      const nameStart = cursor + 46;
      const name = decodeEntryName(
        bytes.subarray(nameStart, nameStart + nameLength),
        flags,
      );
      const isDirectory = validateEntryName(name);
      if (!isDirectory) {
        if (entries.has(name)) throw new DocxImportError('invalid_zip');
        entries.set(
          name,
          Object.freeze({
            name,
            flags,
            method,
            crc32: checksum,
            compressedSize,
            uncompressedSize,
            localHeaderOffset,
          }),
        );
      }
      cursor += recordLength;
    }
    if (cursor !== centralEnd || entries.size === 0) {
      throw new DocxImportError('invalid_zip');
    }
    return new ZipArchive(bytes, entries, centralOffset);
  }

  /** Return whether one exact normalized package path exists. */
  has(name: string): boolean {
    return this.#entries.has(name);
  }

  /** Return the declared uncompressed byte length for one exact entry. */
  size(name: string): number | undefined {
    return this.#entries.get(name)?.uncompressedSize;
  }

  /** Read, decompress, size-check, and checksum one exact package entry once. */
  read(name: string): Promise<Uint8Array> {
    const cached = this.#cache.get(name);
    if (cached) return cached;
    const entry = this.#entries.get(name);
    if (!entry) return Promise.reject(new DocxImportError('invalid_docx'));
    const pending = this.#readEntry(entry).catch((error: unknown) => {
      this.#cache.delete(name);
      throw error;
    });
    this.#cache.set(name, pending);
    return pending;
  }

  async #readEntry(entry: ZipEntry): Promise<Uint8Array> {
    const offset = entry.localHeaderOffset;
    if (
      offset + 30 > this.#centralDirectoryOffset ||
      readUint32(this.#bytes, offset) !== LOCAL_SIGNATURE
    ) {
      throw new DocxImportError('invalid_zip');
    }
    const flags = readUint16(this.#bytes, offset + 6);
    const method = readUint16(this.#bytes, offset + 8);
    const localChecksum = readUint32(this.#bytes, offset + 14);
    const localCompressedSize = readUint32(this.#bytes, offset + 18);
    const localUncompressedSize = readUint32(this.#bytes, offset + 22);
    const nameLength = readUint16(this.#bytes, offset + 26);
    const extraLength = readUint16(this.#bytes, offset + 28);
    if (flags !== entry.flags || method !== entry.method) {
      throw new DocxImportError('invalid_zip');
    }
    if (
      (flags & DATA_DESCRIPTOR_FLAG) === 0 &&
      (localChecksum !== entry.crc32 ||
        localCompressedSize !== entry.compressedSize ||
        localUncompressedSize !== entry.uncompressedSize)
    ) {
      throw new DocxImportError('invalid_zip');
    }
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    if (
      dataStart > this.#centralDirectoryOffset ||
      entry.compressedSize > this.#centralDirectoryOffset - dataStart
    ) {
      throw new DocxImportError('invalid_zip');
    }
    const localName = decodeEntryName(
      this.#bytes.subarray(nameStart, nameStart + nameLength),
      flags,
    );
    if (localName !== entry.name) throw new DocxImportError('invalid_zip');
    const compressed = this.#bytes.subarray(
      dataStart,
      dataStart + entry.compressedSize,
    );
    const output =
      entry.method === 0
        ? compressed.slice()
        : await inflateRaw(compressed, entry.uncompressedSize);
    if (
      output.byteLength !== entry.uncompressedSize ||
      crc32(output) !== entry.crc32
    ) {
      throw new DocxImportError('invalid_zip');
    }
    return output;
  }
}
