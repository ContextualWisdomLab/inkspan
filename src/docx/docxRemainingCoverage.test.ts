import { describe, expect, it } from 'vitest';
import { buildZip, createDocx } from '../../test/docxFixture.js';
import {
  DocxImportError,
  type DocxImportErrorCode,
} from './errors.js';
import { importDocx } from './importDocx.js';
import { DEFAULT_DOCX_IMPORT_LIMITS } from './limits.js';
import {
  appendInline,
  resolvePackageTarget,
  type InlinePart,
} from './ooxmlShared.js';
import { parseXml } from './xml.js';
import { readUint16, readUint32, ZipArchive } from './zip.js';

const limits = DEFAULT_DOCX_IMPORT_LIMITS;

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

function imageRelationship(id: string, target: string): string {
  return `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${target}"/>`;
}

describe('DOCX remaining exact coverage boundaries', () => {
  it('bounds primitive ZIP integer reads and exercises both legacy-name outcomes', () => {
    expectCode(() => readUint16(new Uint8Array(2), -1), 'invalid_zip');
    expectCode(() => readUint16(new Uint8Array(1), 0), 'invalid_zip');
    expectCode(() => readUint32(new Uint8Array(4), -1), 'invalid_zip');
    expectCode(() => readUint32(new Uint8Array(3), 0), 'invalid_zip');

    expectCode(
      () =>
        ZipArchive.parse(
          buildZip(
            {
              logical: {
                data: 'x',
                flags: 0,
                localName: 'logical',
                centralName: '\u001f',
              },
            },
            0,
          ),
          limits,
        ),
      'unsupported_archive',
    );

    const legacyAscii = ZipArchive.parse(
      buildZip(
        {
          'a.txt': {
            data: 'x',
            flags: 0,
          },
        },
        0,
      ),
      limits,
    );
    expect(legacyAscii.has('a.txt')).toBe(true);
  });

  it('reads the native Blob arrayBuffer path before parsing a valid package', async () => {
    const bytes = createDocx({ method: 0 });
    const source = new Blob([]);
    Object.defineProperty(source, 'arrayBuffer', {
      configurable: true,
      value: async () => blobPart(bytes),
    });
    const result = await importDocx(source);
    expect(result.documentJson).toMatchObject({ type: 'doc' });
  });

  it('merges adjacent unmarked text and rejects a target that resolves to package root', () => {
    const parts: InlinePart[] = [];
    appendInline(parts, { type: 'text', text: 'left' });
    appendInline(parts, { type: 'text', text: 'right' });
    expect(parts).toEqual([
      {
        kind: 'inline',
        node: { type: 'text', text: 'leftright' },
      },
    ]);
    expectCode(
      () => resolvePackageTarget('word/document.xml', '..'),
      'invalid_docx',
    );
  });

  it('accepts the remaining legal XML scalar ranges and trailing whitespace', () => {
    const source = '<r>\uE000\u{10000}</r>   ';
    const root = parseXml(new TextEncoder().encode(source), limits);
    expect(root.localName).toBe('r');
    expect(root.children).toEqual(['\uE000\u{10000}']);
  });

  it('encodes a two-byte base64 remainder and imports an image without document properties', async () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0x00]);
    const result = await importDocx(
      createDocx({
        method: 0,
        relationships: relationshipXml(
          imageRelationship('jpeg', 'media/jpeg.bin'),
        ),
        body:
          '<w:p><w:r><w:drawing><a:blip r:embed="jpeg"/></w:drawing></w:r></w:p>',
        media: {
          'word/media/jpeg.bin': jpeg,
        },
      }),
    );
    expect(result.documentJson.content?.[0]).toMatchObject({
      type: 'image',
      attrs: {
        alt: '',
        src: expect.stringMatching(/^data:image\/jpeg;base64,/u),
      },
    });
  });

  it('keeps an image returned from a hyperlink run while warning that hyperlink authority is inert', async () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0x00]);
    const result = await importDocx(
      createDocx({
        method: 0,
        relationships: relationshipXml(
          imageRelationship('image', 'media/image.bin'),
        ),
        body:
          '<w:p><w:hyperlink><w:r><w:drawing><a:blip r:embed="image"/></w:drawing></w:r></w:hyperlink></w:p>',
        media: {
          'word/media/image.bin': jpeg,
        },
      }),
    );
    expect(result.documentJson.content?.[0]).toMatchObject({ type: 'image' });
    expect(result.warnings.map((warning) => warning.code)).toContain(
      'unsafe_hyperlink',
    );
  });

  it('reports unsupported paragraph children and foreign body namespaces without executing them', async () => {
    const result = await importDocx(
      createDocx({
        method: 0,
        body:
          '<w:p><w:unsupported/></w:p>' +
          '<x:foreign xmlns:x="urn:inkspan:test"/>',
      }),
    );
    expect(result.warnings).toContainEqual({
      code: 'unsupported_content',
      count: 2,
    });
  });
});
