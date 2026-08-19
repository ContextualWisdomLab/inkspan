import { describe, expect, it, vi } from 'vitest';
import {
  createDocx,
  PNG_BYTES,
  WORD_NAMESPACES,
} from '../../test/docxFixture.js';
import {
  DocxImportError,
  importDocx,
  openDocx,
  type DocxJsonContent,
  type DocxSource,
} from './index.js';

const SOURCE_CASES: readonly [
  string,
  (bytes: Uint8Array) => DocxSource,
][] = [
  ['ArrayBuffer', (bytes) => Uint8Array.from(bytes).buffer],
  ['Uint8Array', (bytes) => bytes],
  [
    'DataView',
    (bytes) => {
      const copied = Uint8Array.from(bytes);
      return new DataView(copied.buffer);
    },
  ],
  ['Blob', (bytes) => new Blob([Uint8Array.from(bytes)])],
];

describe('DOCX open/import contract', () => {
  it.each(SOURCE_CASES)(
    'imports bounded document content from %s',
    async (_label, source) => {
      const relationships =
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="image" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image.png"/>' +
        '</Relationships>';
      const body =
        '<w:p><w:pPr><w:outlineLvl w:val="1"/></w:pPr><w:r><w:rPr><w:b/><w:i/></w:rPr><w:t>Hello &amp; 안녕</w:t></w:r></w:p>' +
        '<w:p><w:r><w:drawing><wp:docPr descr="Chart"/><a:blip r:embed="image"/></w:drawing></w:r></w:p>' +
        '<w:tbl><w:tr><w:trPr><w:tblHeader/></w:trPr><w:tc><w:p><w:r><w:t>Cell</w:t></w:r></w:p></w:tc></w:tr></w:tbl>';
      const bytes = createDocx({
        body,
        relationships,
        media: { 'word/media/image.png': PNG_BYTES },
      });

      const result = await importDocx(source(bytes));

      expect(result.documentJson).toEqual({
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [
              {
                type: 'text',
                text: 'Hello & 안녕',
                marks: [{ type: 'bold' }, { type: 'italic' }],
              },
            ],
          },
          {
            type: 'image',
            attrs: {
              src: expect.stringMatching(/^data:image\/png;base64,/u),
              alt: 'Chart',
            },
          },
          {
            type: 'table',
            content: [
              {
                type: 'tableRow',
                content: [
                  {
                    type: 'tableHeader',
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', text: 'Cell' }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });
      expect(result.warnings).toEqual([]);
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.documentJson)).toBe(true);
      expect(Object.isFrozen(result.documentJson.content)).toBe(true);
    },
  );

  it('uses intrinsic Blob metadata and bytes instead of caller overrides', async () => {
    const source = new Blob([Uint8Array.from(createDocx())]);
    const sizeGetter = vi.fn(() => {
      throw new Error('private size getter');
    });
    const arrayBufferGetter = vi.fn(() => {
      throw new Error('private arrayBuffer getter');
    });
    Object.defineProperty(source, 'size', {
      configurable: true,
      get: sizeGetter,
    });
    Object.defineProperty(source, 'arrayBuffer', {
      configurable: true,
      get: arrayBufferGetter,
    });

    const result = await importDocx(source);

    expect(result.documentJson.type).toBe('doc');
    expect(sizeGetter).not.toHaveBeenCalled();
    expect(arrayBufferGetter).not.toHaveBeenCalled();
  });

  it('uses a callable platform Blob byte reader captured at module initialization', async () => {
    const bytes = createDocx();
    const source = new Blob([Uint8Array.from(bytes)]);
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      Blob.prototype,
      'arrayBuffer',
    );
    const platformArrayBuffer = vi.fn(async function (this: Blob) {
      expect(this).toBe(source);
      return Uint8Array.from(bytes).buffer;
    });
    const callerOverride = vi.fn(async () => new ArrayBuffer(0));

    Object.defineProperty(Blob.prototype, 'arrayBuffer', {
      configurable: true,
      value: platformArrayBuffer,
      writable: true,
    });
    vi.resetModules();
    const { importDocx: importWithCapturedPlatformReader } = await import(
      './importDocx.js'
    );
    Object.defineProperty(source, 'arrayBuffer', {
      configurable: true,
      value: callerOverride,
    });

    try {
      const result = await importWithCapturedPlatformReader(source);

      expect(result.documentJson.type).toBe('doc');
      expect(platformArrayBuffer).toHaveBeenCalledTimes(1);
      expect(callerOverride).not.toHaveBeenCalled();
    } finally {
      if (originalDescriptor === undefined) {
        Reflect.deleteProperty(Blob.prototype, 'arrayBuffer');
      } else {
        Object.defineProperty(
          Blob.prototype,
          'arrayBuffer',
          originalDescriptor,
        );
      }
      vi.resetModules();
    }
  });

  it('ignores caller Blob data-function overrides while reading intrinsic bytes', async () => {
    const source = new Blob([Uint8Array.from(createDocx())]);
    const arrayBufferOverride = vi.fn(async () => new ArrayBuffer(0));
    Object.defineProperty(source, 'arrayBuffer', {
      configurable: true,
      value: arrayBufferOverride,
    });

    const result = await importDocx(source);

    expect(result.documentJson.type).toBe('doc');
    expect(arrayBufferOverride).not.toHaveBeenCalled();
  });

  it('uses intrinsic view byte-range metadata instead of caller overrides', async () => {
    const source = Uint8Array.from(createDocx());
    const bufferGetter = vi.fn(() => {
      throw new Error('private buffer getter');
    });
    const byteOffsetGetter = vi.fn(() => {
      throw new Error('private byteOffset getter');
    });
    const byteLengthGetter = vi.fn(() => {
      throw new Error('private byteLength getter');
    });
    Object.defineProperty(source, 'buffer', {
      configurable: true,
      get: bufferGetter,
    });
    Object.defineProperty(source, 'byteOffset', {
      configurable: true,
      get: byteOffsetGetter,
    });
    Object.defineProperty(source, 'byteLength', {
      configurable: true,
      get: byteLengthGetter,
    });

    const result = await importDocx(source);

    expect(result.documentJson.type).toBe('doc');
    expect(bufferGetter).not.toHaveBeenCalled();
    expect(byteOffsetGetter).not.toHaveBeenCalled();
    expect(byteLengthGetter).not.toHaveBeenCalled();
  });

  it('fails closed for SharedArrayBuffer-backed views', async () => {
    const bytes = createDocx();
    const source = new Uint8Array(new SharedArrayBuffer(bytes.byteLength));
    source.set(bytes);

    await expect(importDocx(source)).rejects.toMatchObject({
      name: 'DocxImportError',
      code: 'invalid_source',
    });
  });

  it('rejects ambiguous documents with multiple Word bodies', async () => {
    const document =
      `<w:document ${WORD_NAMESPACES}>` +
      '<w:body><w:p><w:r><w:t>first</w:t></w:r></w:p></w:body>' +
      '<w:body><w:p><w:r><w:t>second</w:t></w:r></w:p></w:body>' +
      '</w:document>';

    await expect(importDocx(createDocx({ document }))).rejects.toMatchObject({
      name: 'DocxImportError',
      code: 'invalid_docx',
    });
  });

  it('validates the complete imported document before one atomic editor mutation', async () => {
    const validateDocumentJson = vi.fn(
      (documentJson: DocxJsonContent) => documentJson.type === 'doc',
    );
    const setDocumentJson = vi.fn((_documentJson: DocxJsonContent) => undefined);
    const target = { validateDocumentJson, setDocumentJson };

    const result = await openDocx(target, createDocx());

    expect(validateDocumentJson).toHaveBeenCalledTimes(1);
    expect(setDocumentJson).toHaveBeenCalledTimes(1);
    const imported = validateDocumentJson.mock.calls[0]![0];
    expect(setDocumentJson).toHaveBeenCalledWith(imported);
    expect(result.documentJson).toBe(imported);
  });

  it('does not mutate the editor when schema validation rejects the import', async () => {
    const setDocumentJson = vi.fn((_documentJson: DocxJsonContent) => undefined);
    const operation = openDocx(
      {
        validateDocumentJson: () => false,
        setDocumentJson,
      },
      createDocx(),
    );

    await expect(operation).rejects.toMatchObject({
      name: 'DocxImportError',
      code: 'incompatible_editor_schema',
    });
    expect(setDocumentJson).not.toHaveBeenCalled();
  });

  it('fails closed for invalid archives and bounded input', async () => {
    await expect(importDocx(new Uint8Array([1, 2, 3]))).rejects.toBeInstanceOf(
      DocxImportError,
    );
    await expect(
      importDocx(createDocx(), { limits: { maxArchiveBytes: 8 } }),
    ).rejects.toMatchObject({ code: 'input_too_large' });
  });
});
