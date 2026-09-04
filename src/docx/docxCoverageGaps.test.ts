import { describe, expect, it, vi } from 'vitest';
import {
  buildZip,
  createDocx,
  findSignature,
  patchUint16,
  patchUint32,
  PNG_BYTES,
  WORD_NAMESPACES,
} from '../../test/docxFixture.js';
import {
  DocxImportError,
  type DocxImportErrorCode,
} from './errors.js';
import { importDocx, openDocx } from './importDocx.js';
import { DEFAULT_DOCX_IMPORT_LIMITS } from './limits.js';
import { parseDocxPackage } from './ooxml.js';
import { readDocxPackageMetadata } from './ooxmlPackage.js';
import { appendInline, textNode, type InlinePart } from './ooxmlShared.js';
import { ZipArchive } from './zip.js';

const limits = DEFAULT_DOCX_IMPORT_LIMITS;
const LOCAL_SIGNATURE = 0x04034b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const EOCD_SIGNATURE = 0x06054b50;

function expectCode(operation: () => unknown, code: DocxImportErrorCode): void {
  let thrown: unknown;
  try {
    operation();
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(DocxImportError);
  expect(thrown).toMatchObject({ code });
}

async function expectAsyncCode(
  operation: Promise<unknown>,
  code: DocxImportErrorCode,
): Promise<void> {
  await expect(operation).rejects.toMatchObject({
    name: 'DocxImportError',
    code,
  });
}

function zipOffsets(bytes: Uint8Array): {
  readonly local: number;
  readonly central: number;
  readonly eocd: number;
} {
  const local = findSignature(bytes, LOCAL_SIGNATURE);
  const central = findSignature(bytes, CENTRAL_SIGNATURE);
  const eocd = findSignature(bytes, EOCD_SIGNATURE);
  expect(local).toBeGreaterThanOrEqual(0);
  expect(central).toBeGreaterThan(local);
  expect(eocd).toBeGreaterThan(central);
  return { local, central, eocd };
}

function expectZipCode(
  bytes: Uint8Array,
  code: DocxImportErrorCode,
  customLimits = limits,
): void {
  expectCode(() => ZipArchive.parse(bytes, customLimits), code);
}

function oneStoredEntry(): Uint8Array {
  return buildZip({ 'a.txt': 'abc' }, 0);
}

function blobPart(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

function relationshipXml(entries: string): string {
  return (
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    entries +
    '</Relationships>'
  );
}

function imageRelationship(id: string, target: string, type = 'image'): string {
  const relationshipType =
    type === 'image'
      ? 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image'
      : type;
  return `<Relationship Id="${id}" Type="${relationshipType}" Target="${target}"/>`;
}

function imageParagraph(id: string, alt = ''): string {
  return `<w:p><w:r><w:drawing><wp:docPr descr="${alt}"/><a:blip r:embed="${id}"/></w:drawing></w:r></w:p>`;
}

describe('DOCX ZIP safety coverage', () => {
  it('reads stored entries once, reports sizes, and rejects unknown entries', async () => {
    const parsed = ZipArchive.parse(oneStoredEntry(), limits);
    expect(parsed.has('a.txt')).toBe(true);
    expect(parsed.has('missing')).toBe(false);
    expect(parsed.size('a.txt')).toBe(3);
    expect(parsed.size('missing')).toBeUndefined();
    const first = parsed.read('a.txt');
    const second = parsed.read('a.txt');
    expect(second).toBe(first);
    await expect(first.then((bytes) => Array.from(bytes))).resolves.toEqual([97, 98, 99]);
    await expectAsyncCode(parsed.read('missing'), 'invalid_docx');
  });

  it('bounds integer reads and requires a structurally valid EOCD', () => {
    expectZipCode(new Uint8Array(), 'invalid_zip');
    expectZipCode(new Uint8Array(21), 'invalid_zip');

    const base = oneStoredEntry();
    const { eocd } = zipOffsets(base);
    expectZipCode(patchUint32(base, eocd, 0), 'invalid_zip');
    expectZipCode(patchUint16(base, eocd + 20, 1), 'invalid_zip');
  });

  it('rejects multi-disk, Zip64, entry-count, and central-directory boundary shapes', () => {
    const base = oneStoredEntry();
    const { eocd } = zipOffsets(base);
    for (const offset of [4, 6]) {
      expectZipCode(patchUint16(base, eocd + offset, 1), 'unsupported_archive');
    }
    expectZipCode(patchUint16(base, eocd + 8, 2), 'unsupported_archive');

    let zip64Entries = patchUint16(base, eocd + 8, 0xffff);
    zip64Entries = patchUint16(zip64Entries, eocd + 10, 0xffff);
    expectZipCode(zip64Entries, 'unsupported_archive');
    expectZipCode(patchUint32(base, eocd + 12, 0xffffffff), 'unsupported_archive');
    expectZipCode(patchUint32(base, eocd + 16, 0xffffffff), 'unsupported_archive');

    expectZipCode(base, 'archive_limit_exceeded', { ...limits, maxEntries: 0 });
    expectZipCode(patchUint32(base, eocd + 16, eocd + 1), 'invalid_zip');
    expectZipCode(patchUint32(base, eocd + 12, eocd + 1), 'invalid_zip');
  });

  it('rejects malformed central records, flags, methods, Zip64 fields, and foreign disks', () => {
    const base = oneStoredEntry();
    const { central } = zipOffsets(base);
    expectZipCode(patchUint32(base, central, 0), 'invalid_zip');
    expectZipCode(patchUint16(base, central + 28, 0xffff), 'invalid_zip');
    expectZipCode(patchUint16(base, central + 8, 0x0801), 'encrypted_archive');
    expectZipCode(patchUint16(base, central + 8, 0x0804), 'unsupported_archive');
    expectZipCode(patchUint16(base, central + 10, 9), 'unsupported_archive');

    for (const offset of [20, 24, 42]) {
      expectZipCode(patchUint32(base, central + offset, 0xffffffff), 'unsupported_archive');
    }
    expectZipCode(patchUint16(base, central + 34, 0xffff), 'unsupported_archive');
    expectZipCode(patchUint16(base, central + 34, 1), 'unsupported_archive');
  });

  it('enforces compressed, expanded, ratio, and total archive resource ceilings', () => {
    const stored = oneStoredEntry();
    expectZipCode(stored, 'archive_limit_exceeded', { ...limits, maxArchiveBytes: 2 });
    expectZipCode(stored, 'archive_limit_exceeded', { ...limits, maxEntryBytes: 2 });
    expectZipCode(stored, 'archive_limit_exceeded', {
      ...limits,
      maxTotalUncompressedBytes: 2,
    });

    const { central } = zipOffsets(stored);
    expectZipCode(patchUint32(stored, central + 20, 0), 'archive_limit_exceeded');

    const compressed = buildZip({ 'a.txt': 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }, 8);
    expectZipCode(compressed, 'archive_limit_exceeded', {
      ...limits,
      maxCompressionRatio: 1,
    });
  });

  it('validates entry names, duplicate logical paths, directories, and central-directory exhaustion', async () => {
    for (const centralName of ['', '/root', 'C:drive', 'a\\b', 'a\0b', 'a//b', 'a/./b', 'a/../b']) {
      expectZipCode(
        buildZip(
          {
            logical: {
              data: 'x',
              localName: 'logical',
              centralName,
            },
          },
          0,
        ),
        'invalid_zip',
      );
    }

    expectZipCode(
      buildZip(
        {
          logical: {
            data: 'x',
            flags: 0,
            localName: 'logical',
            centralName: 'é',
          },
        },
        0,
      ),
      'unsupported_archive',
    );

    const malformedUtf8 = buildZip({ logical: { data: 'x', centralName: 'x' } }, 0);
    const malformedCentral = zipOffsets(malformedUtf8).central;
    const malformedBytes = malformedUtf8.slice();
    malformedBytes[malformedCentral + 46] = 0xff;
    expectZipCode(malformedBytes, 'invalid_zip');

    expectZipCode(
      buildZip(
        {
          one: { data: '1', centralName: 'dup' },
          two: { data: '2', centralName: 'dup' },
        },
        0,
      ),
      'invalid_zip',
    );
    expectZipCode(buildZip({ 'folder/': 'x' }, 0), 'invalid_zip');

    const withDirectory = ZipArchive.parse(
      buildZip({ 'folder/': '', 'folder/a.txt': 'ok' }, 0),
      limits,
    );
    expect(withDirectory.has('folder/')).toBe(false);
    await expect(
      withDirectory.read('folder/a.txt').then((bytes) => Array.from(bytes)),
    ).resolves.toEqual([111, 107]);

    const base = oneStoredEntry();
    const { eocd } = zipOffsets(base);
    const centralSize = new DataView(base.buffer, base.byteOffset, base.byteLength).getUint32(
      eocd + 12,
      true,
    );
    expectZipCode(patchUint32(base, eocd + 12, centralSize + 1), 'invalid_zip');
  });

  it('validates local headers, metadata agreement, local names, payload bounds, size, and checksum', async () => {
    const base = oneStoredEntry();
    const { local, central } = zipOffsets(base);

    const readFailure = async (bytes: Uint8Array): Promise<void> => {
      const parsed = ZipArchive.parse(bytes, limits);
      await expectAsyncCode(parsed.read('a.txt'), 'invalid_zip');
    };

    await readFailure(patchUint32(base, local, 0));
    await readFailure(patchUint16(base, local + 6, 0));
    await readFailure(patchUint16(base, local + 8, 8));
    await readFailure(patchUint32(base, local + 14, 0));

    const localNameMismatch = buildZip(
      { 'a.txt': { data: 'abc', localName: 'b.txt', centralName: 'a.txt' } },
      0,
    );
    await readFailure(localNameMismatch);

    const invalidDataStart = patchUint16(base, local + 28, 0xffff);
    await readFailure(invalidDataStart);

    let tooLongPayload = buildZip(
      { 'a.txt': { data: 'abc', flags: 0x0808 } },
      0,
    );
    const tooLongOffsets = zipOffsets(tooLongPayload);
    tooLongPayload = patchUint32(tooLongPayload, tooLongOffsets.central + 20, 1_000);
    await readFailure(tooLongPayload);

    let wrongSize = buildZip({ 'a.txt': { data: 'abc', flags: 0x0808 } }, 0);
    const wrongSizeOffsets = zipOffsets(wrongSize);
    wrongSize = patchUint32(wrongSize, wrongSizeOffsets.central + 24, 4);
    await readFailure(wrongSize);

    const wrongCrc = base.slice();
    wrongCrc[local + 30 + 'a.txt'.length] ^= 0xff;
    await readFailure(wrongCrc);

    const foreignOffset = patchUint32(base, central + 42, central - 1);
    const parsedForeignOffset = ZipArchive.parse(foreignOffset, limits);
    await expectAsyncCode(parsedForeignOffset.read('a.txt'), 'invalid_zip');

    const retry = ZipArchive.parse(wrongCrc, limits);
    await expectAsyncCode(retry.read('a.txt'), 'invalid_zip');
    await expectAsyncCode(retry.read('a.txt'), 'invalid_zip');
  });

  it('fails closed when deflate support is unavailable or decompressed byte counts disagree', async () => {
    const originalDecompressionStream = globalThis.DecompressionStream;
    const originalReadableStream = globalThis.ReadableStream;
    const compressed = buildZip({ 'a.txt': 'abc' }, 8);

    try {
      vi.resetModules();
      vi.stubGlobal('DecompressionStream', undefined);
      vi.stubGlobal('ReadableStream', originalReadableStream);
      const { ZipArchive: MissingDecompressionZipArchive } = await import('./zip.js');
      await expectAsyncCode(
        MissingDecompressionZipArchive.parse(compressed, limits).read('a.txt'),
        'decompression_unavailable',
      );

      vi.resetModules();
      vi.stubGlobal('DecompressionStream', originalDecompressionStream);
      vi.stubGlobal('ReadableStream', undefined);
      const { ZipArchive: MissingReadableZipArchive } = await import('./zip.js');
      await expectAsyncCode(
        MissingReadableZipArchive.parse(compressed, limits).read('a.txt'),
        'decompression_unavailable',
      );

      vi.resetModules();
      vi.stubGlobal(
        'DecompressionStream',
        class {
          constructor() {
            throw new Error('unsupported');
          }
        },
      );
      vi.stubGlobal('ReadableStream', originalReadableStream);
      const { ZipArchive: UnsupportedZipArchive } = await import('./zip.js');
      await expectAsyncCode(
        UnsupportedZipArchive.parse(compressed, limits).read('a.txt'),
        'decompression_unavailable',
      );
    } finally {
      vi.unstubAllGlobals();
      vi.resetModules();
    }

    for (const expectedBytes of [1, 5]) {
      let mismatched = buildZip({ 'a.txt': { data: 'abc', method: 8, flags: 0x0808 } }, 8);
      const { central } = zipOffsets(mismatched);
      mismatched = patchUint32(mismatched, central + 24, expectedBytes);
      await expectAsyncCode(ZipArchive.parse(mismatched, limits).read('a.txt'), 'invalid_zip');
    }
  });
});

describe('DOCX source and editor boundary coverage', () => {
  it('rejects invalid, empty, and oversized binary source shapes', async () => {
    await expectAsyncCode(importDocx('not-bytes' as never), 'invalid_source');
    await expectAsyncCode(importDocx(new Uint8Array()), 'invalid_source');
    await expectAsyncCode(
      importDocx(new Blob([blobPart(createDocx())]), { limits: { maxArchiveBytes: 8 } }),
      'input_too_large',
    );
  });

  it('uses the bounded FileReader fallback without trusting malformed reader results', async () => {
    const bytes = createDocx({ method: 0 });
    const originalBlobArrayBuffer = Object.getOwnPropertyDescriptor(
      Blob.prototype,
      'arrayBuffer',
    );

    class SuccessfulReader {
      result: ArrayBuffer | string | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsArrayBuffer(): void {
        this.result = blobPart(bytes);
        this.onload?.();
      }
    }

    class WrongResultReader extends SuccessfulReader {
      override readAsArrayBuffer(): void {
        this.result = 'not-an-array-buffer';
        this.onload?.();
      }
    }

    class ErrorReader extends SuccessfulReader {
      override readAsArrayBuffer(): void {
        this.onerror?.();
      }
    }

    const importWithReader = async (
      reader: typeof SuccessfulReader | typeof WrongResultReader | typeof ErrorReader | undefined,
    ) => {
      vi.resetModules();
      Object.defineProperty(Blob.prototype, 'arrayBuffer', {
        configurable: true,
        writable: true,
        value: undefined,
      });
      vi.stubGlobal('FileReader', reader);
      return import('./importDocx.js');
    };

    try {
      const { importDocx: importWithSuccessfulReader } = await importWithReader(SuccessfulReader);
      await expect(
        importWithSuccessfulReader(new Blob([blobPart(bytes)])),
      ).resolves.toMatchObject({
        documentJson: { type: 'doc' },
      });

      const { importDocx: importWithWrongResultReader } = await importWithReader(WrongResultReader);
      await expectAsyncCode(
        importWithWrongResultReader(new Blob([blobPart(bytes)])),
        'invalid_source',
      );

      const { importDocx: importWithErrorReader } = await importWithReader(ErrorReader);
      await expectAsyncCode(
        importWithErrorReader(new Blob([blobPart(bytes)])),
        'invalid_source',
      );

      const { importDocx: importWithoutFileReader } = await importWithReader(undefined);
      await expectAsyncCode(
        importWithoutFileReader(new Blob([blobPart(bytes)])),
        'invalid_source',
      );
    } finally {
      if (originalBlobArrayBuffer === undefined) {
        Reflect.deleteProperty(Blob.prototype, 'arrayBuffer');
      } else {
        Object.defineProperty(
          Blob.prototype,
          'arrayBuffer',
          originalBlobArrayBuffer,
        );
      }
      vi.unstubAllGlobals();
      vi.resetModules();
    }
  });

  it('normalizes source reader failures and every invalid editor target shape', async () => {
    class ThrowingBlob extends Blob {
      override async arrayBuffer(): Promise<ArrayBuffer> {
        throw new Error('private failure');
      }
    }
    await expectAsyncCode(importDocx(new ThrowingBlob(['x'])), 'invalid_zip');

    const source = createDocx({ method: 0 });
    for (const target of [
      null,
      {},
      { validateDocumentJson: () => true },
      { setDocumentJson: () => undefined },
    ]) {
      await expectAsyncCode(openDocx(target as never, source), 'editor_rejected_document');
    }
    await expectAsyncCode(
      openDocx(
        {
          validateDocumentJson: () => {
            throw new Error('private validation failure');
          },
          setDocumentJson: () => undefined,
        },
        source,
      ),
      'editor_rejected_document',
    );
    await expectAsyncCode(
      openDocx(
        {
          validateDocumentJson: () => true,
          setDocumentJson: () => {
            throw new Error('private mutation failure');
          },
        },
        source,
      ),
      'editor_rejected_document',
    );
  });
});

describe('DOCX OOXML remaining safety and fidelity branches', () => {
  it('requires the main document part after a valid content-types manifest', async () => {
    const contentTypes =
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '</Types>';
    const parsed = ZipArchive.parse(buildZip({ '[Content_Types].xml': contentTypes }, 0), limits);
    await expectAsyncCode(readDocxPackageMetadata(parsed, limits), 'invalid_docx');
  });

  it('covers missing numbering format/start and a valid bullet descriptor', async () => {
    const numbering =
      `<w:numbering ${WORD_NAMESPACES}>` +
      '<w:abstractNum w:abstractNumId="missing-format"><w:lvl w:ilvl="0"/></w:abstractNum>' +
      '<w:abstractNum w:abstractNumId="bullet"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/></w:lvl></w:abstractNum>' +
      '<w:num w:numId="1"><w:abstractNumId w:val="missing-format"/></w:num>' +
      '<w:num w:numId="2"><w:abstractNumId w:val="bullet"/></w:num>' +
      '</w:numbering>';
    const result = await importDocx(
      createDocx({
        method: 0,
        numbering,
        body: '<w:p><w:pPr><w:numPr><w:numId w:val="2"/></w:numPr></w:pPr></w:p>',
      }),
    );
    expect(result.documentJson.content?.[0]).toMatchObject({ type: 'bulletList' });
  });

  it('recognizes JPEG, GIF, and WEBP signatures and omits unsupported images', async () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0x00]);
    const gif = new TextEncoder().encode('GIF89a');
    const webp = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
    ]);
    const unsupported = new Uint8Array([1, 2, 3, 4, 5, 6]);
    const relationships = relationshipXml(
      imageRelationship('jpeg', 'media/jpeg.bin') +
        imageRelationship('gif', 'media/gif.bin') +
        imageRelationship('webp', 'media/webp.bin') +
        imageRelationship('bad', 'media/bad.bin'),
    );
    const body =
      imageParagraph('jpeg') +
      imageParagraph('gif') +
      imageParagraph('webp') +
      imageParagraph('bad');
    const result = await importDocx(
      createDocx({
        method: 0,
        relationships,
        body,
        extraEntries: {
          'word/media/jpeg.bin': { data: jpeg },
          'word/media/gif.bin': { data: gif },
          'word/media/webp.bin': { data: webp },
          'word/media/bad.bin': { data: unsupported },
        },
      }),
    );
    const sources = result.documentJson.content
      ?.filter((node) => node.type === 'image')
      .map((node) => String(node.attrs?.src));
    expect(sources).toEqual([
      expect.stringMatching(/^data:image\/jpeg;base64,/u),
      expect.stringMatching(/^data:image\/gif;base64,/u),
      expect.stringMatching(/^data:image\/webp;base64,/u),
    ]);
    expect(result.warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining(['unsupported_image', 'image_omitted']),
    );
  });

  it('bounds image count, declared bytes, total bytes, missing targets, wrong relationship types, and alternative text', async () => {
    const relationships = relationshipXml(
      imageRelationship('one', 'media/one.png') +
        imageRelationship('two', 'media/two.png') +
        imageRelationship('missing', 'media/missing.png') +
        imageRelationship('wrong', 'media/one.png', 'urn:not-an-image'),
    );
    const source = createDocx({
      method: 0,
      relationships,
      body:
        imageParagraph('one', 'x'.repeat(1_001)) +
        imageParagraph('two') +
        imageParagraph('missing') +
        imageParagraph('wrong') +
        '<w:p><w:r><w:drawing><wp:docPr/></w:drawing></w:r></w:p>',
      media: {
        'word/media/one.png': PNG_BYTES,
        'word/media/two.png': PNG_BYTES,
      },
    });
    const parsed = ZipArchive.parse(source, limits);
    const rich = await parseDocxPackage(parsed, limits);
    expect(rich.warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining(['image_alt_omitted', 'missing_relationship', 'image_omitted']),
    );

    for (const constrained of [
      { ...limits, maxImageBytes: PNG_BYTES.byteLength - 1 },
      { ...limits, maxImages: 1 },
      { ...limits, maxTotalImageBytes: PNG_BYTES.byteLength - 1 },
    ]) {
      await expectAsyncCode(
        parseDocxPackage(ZipArchive.parse(source, limits), constrained),
        'document_limit_exceeded',
      );
    }

    const real = ZipArchive.parse(
      createDocx({
        method: 0,
        relationships: relationshipXml(imageRelationship('one', 'media/one.png')),
        body: imageParagraph('one'),
        media: { 'word/media/one.png': PNG_BYTES },
      }),
      limits,
    );
    const noDeclaredSize = {
      has: real.has.bind(real),
      read: real.read.bind(real),
      size: (name: string) =>
        name === 'word/media/one.png' ? undefined : real.size(name),
    } as unknown as ZipArchive;
    await expectAsyncCode(
      parseDocxPackage(noDeclaredSize, limits),
      'document_limit_exceeded',
    );
  });

  it('flattens nonzero/list-in-table and list-with-image cases while retaining table merge/header semantics', async () => {
    const numbering =
      `<w:numbering ${WORD_NAMESPACES}>` +
      '<w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/></w:lvl></w:abstractNum>' +
      '<w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num>' +
      '</w:numbering>';
    const relationships = relationshipXml(imageRelationship('image', 'media/image.png'));
    const listProperties = '<w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>';
    const body =
      `<w:p>${listProperties}<w:r><w:drawing><wp:docPr/><a:blip r:embed="image"/></w:drawing></w:r></w:p>` +
      '<w:tbl><w:tr><w:trPr><w:tblHeader w:val="0"/></w:trPr><w:tc><w:tcPr><w:vMerge/></w:tcPr>' +
      `<w:p>${listProperties}<w:r><w:t>cell list</w:t></w:r></w:p>` +
      '</w:tc></w:tr></w:tbl>';
    const result = await importDocx(
      createDocx({
        method: 0,
        numbering,
        relationships,
        body,
        media: { 'word/media/image.png': PNG_BYTES },
      }),
    );
    expect(result.documentJson.content?.some((node) => node.type === 'image')).toBe(true);
    expect(result.documentJson.content?.some((node) => node.type === 'table')).toBe(true);
    expect(result.warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining(['list_flattened', 'table_span_flattened']),
    );
  });

  it('rejects wrong document namespaces, missing bodies, and overly large output trees', async () => {
    await expectAsyncCode(
      importDocx(
        createDocx({
          method: 0,
          document: '<w:document xmlns:w="urn:wrong"><w:body/></w:document>',
        }),
      ),
      'invalid_docx',
    );
    await expectAsyncCode(
      importDocx(
        createDocx({
          method: 0,
          document: `<w:document ${WORD_NAMESPACES}></w:document>`,
        }),
      ),
      'invalid_docx',
    );
    await expectAsyncCode(
      importDocx(createDocx({ method: 0 }), { limits: { maxDocumentNodes: 1 } }),
      'document_limit_exceeded',
    );
  });

  it('keeps equal-mark merging sensitive to mark attributes', () => {
    const parts: InlinePart[] = [];
    appendInline(parts, textNode('a', [{ type: 'link', attrs: { href: 'a' } }]));
    appendInline(parts, textNode('b', [{ type: 'link', attrs: { href: 'b' } }]));
    appendInline(parts, textNode('c', [{ type: 'bold' }, { type: 'italic' }]));
    appendInline(parts, textNode('d', [{ type: 'bold' }]));
    expect(parts).toHaveLength(4);
  });
});