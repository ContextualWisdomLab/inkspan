import { deflateRawSync } from 'node:zlib';

export const WORD_NAMESPACES = [
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"',
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"',
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"',
  'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"',
].join(' ');

export const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89,
]);

export interface ZipEntryInput {
  readonly data: string | Uint8Array;
  readonly method?: 0 | 8;
  readonly flags?: number;
  readonly localName?: string;
  readonly centralName?: string;
}

export interface DocxFixtureOptions {
  readonly body?: string;
  readonly contentTypes?: string | false;
  readonly document?: string | false;
  readonly relationships?: string | false;
  readonly styles?: string | false;
  readonly numbering?: string | false;
  readonly media?: Readonly<Record<string, Uint8Array>>;
  readonly extraEntries?: Readonly<
    Record<string, string | Uint8Array | ZipEntryInput>
  >;
  readonly method?: 0 | 8;
}

function uint16(value: number): Uint8Array {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
}

function uint32(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
  return bytes;
}

function concatenate(chunks: readonly Uint8Array[]): Uint8Array {
  const result = new Uint8Array(
    chunks.reduce((total, chunk) => total + chunk.byteLength, 0),
  );
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

export function fixtureCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function buildZip(
  entries: Readonly<Record<string, string | Uint8Array | ZipEntryInput>>,
  defaultMethod: 0 | 8 = 8,
): Uint8Array {
  const localRecords: Uint8Array[] = [];
  const centralRecords: Uint8Array[] = [];
  let localOffset = 0;
  for (const [logicalName, rawInput] of Object.entries(entries)) {
    const input: ZipEntryInput =
      typeof rawInput === 'string' || rawInput instanceof Uint8Array
        ? { data: rawInput }
        : rawInput;
    const flags = input.flags ?? 0x0800;
    const method = input.method ?? defaultMethod;
    const localName = new TextEncoder().encode(input.localName ?? logicalName);
    const centralName = new TextEncoder().encode(input.centralName ?? logicalName);
    const raw =
      typeof input.data === 'string'
        ? new TextEncoder().encode(input.data)
        : input.data;
    const compressed =
      method === 8 ? new Uint8Array(deflateRawSync(raw)) : raw.slice();
    const checksum = fixtureCrc32(raw);
    const local = concatenate([
      uint32(0x04034b50),
      uint16(20),
      uint16(flags),
      uint16(method),
      uint16(0),
      uint16(0),
      uint32(checksum),
      uint32(compressed.byteLength),
      uint32(raw.byteLength),
      uint16(localName.byteLength),
      uint16(0),
      localName,
      compressed,
    ]);
    const central = concatenate([
      uint32(0x02014b50),
      uint16(20),
      uint16(20),
      uint16(flags),
      uint16(method),
      uint16(0),
      uint16(0),
      uint32(checksum),
      uint32(compressed.byteLength),
      uint32(raw.byteLength),
      uint16(centralName.byteLength),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(0),
      uint32(localOffset),
      centralName,
    ]);
    localRecords.push(local);
    centralRecords.push(central);
    localOffset += local.byteLength;
  }
  const centralDirectory = concatenate(centralRecords);
  const end = concatenate([
    uint32(0x06054b50),
    uint16(0),
    uint16(0),
    uint16(centralRecords.length),
    uint16(centralRecords.length),
    uint32(centralDirectory.byteLength),
    uint32(localOffset),
    uint16(0),
  ]);
  return concatenate([...localRecords, centralDirectory, end]);
}

export function createDocx(options: DocxFixtureOptions = {}): Uint8Array {
  const contentTypes =
    options.contentTypes === false
      ? undefined
      : options.contentTypes ??
        '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';
  const document =
    options.document === false
      ? undefined
      : options.document ??
        `<w:document ${WORD_NAMESPACES}><w:body>${options.body ?? '<w:p><w:r><w:t>Hello</w:t></w:r></w:p>'}<w:sectPr/></w:body></w:document>`;
  const entries: Record<string, string | Uint8Array | ZipEntryInput> = {};
  if (contentTypes !== undefined) entries['[Content_Types].xml'] = contentTypes;
  if (document !== undefined) entries['word/document.xml'] = document;
  if (options.relationships !== false && options.relationships !== undefined) {
    entries['word/_rels/document.xml.rels'] = options.relationships;
  }
  if (options.styles !== false && options.styles !== undefined) {
    entries['word/styles.xml'] = options.styles;
  }
  if (options.numbering !== false && options.numbering !== undefined) {
    entries['word/numbering.xml'] = options.numbering;
  }
  for (const [path, bytes] of Object.entries(options.media ?? {})) {
    entries[path] = bytes;
  }
  Object.assign(entries, options.extraEntries ?? {});
  return buildZip(entries, options.method ?? 8);
}

export function findSignature(
  bytes: Uint8Array,
  signature: number,
  from = 0,
): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let offset = from; offset + 4 <= bytes.byteLength; offset += 1) {
    if (view.getUint32(offset, true) === signature) return offset;
  }
  return -1;
}

export function patchUint16(
  source: Uint8Array,
  offset: number,
  value: number,
): Uint8Array {
  const result = source.slice();
  new DataView(result.buffer).setUint16(offset, value, true);
  return result;
}

export function patchUint32(
  source: Uint8Array,
  offset: number,
  value: number,
): Uint8Array {
  const result = source.slice();
  new DataView(result.buffer).setUint32(offset, value >>> 0, true);
  return result;
}
