import { describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';
import {
  SpreadsheetImportError,
  spreadsheetFileToDocumentJson,
  type SpreadsheetFileSource,
} from './index.js';

function sourceFromBytes(bytes: Uint8Array): SpreadsheetFileSource {
  return {
    size: bytes.byteLength,
    async arrayBuffer() {
      return bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer;
    },
  };
}

function workbookBytes(bookType: 'xlsx' | 'biff8'): Uint8Array {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([
    ['Name', 'Value'],
    ['Revenue', 42],
  ]);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Summary');
  const serialized = XLSX.write(workbook, { type: 'array', bookType });
  return serialized instanceof Uint8Array
    ? serialized
    : new Uint8Array(serialized as ArrayBuffer);
}

function expectUnsupported(promise: Promise<unknown>) {
  return expect(promise).rejects.toMatchObject({
    name: 'SpreadsheetImportError',
    code: 'UNSUPPORTED_OR_CORRUPT',
    message: 'Spreadsheet source is unsupported or corrupt.',
  } satisfies Partial<SpreadsheetImportError>);
}

describe('spreadsheetFileToDocumentJson', () => {
  it.each([
    ['XLSX', 'xlsx'],
    ['BIFF8 XLS', 'biff8'],
  ] as const)(
    'converts a real local %s source into bounded editable TipTap content',
    async (_label, bookType) => {
      const result = await spreadsheetFileToDocumentJson(
        sourceFromBytes(workbookBytes(bookType)),
      );

      expect(result).toMatchObject({
        worksheetCount: 1,
        rowCount: 2,
        cellCount: 4,
      });
      expect(result.content.map((node) => node.type)).toEqual([
        'heading',
        'table',
        'paragraph',
      ]);
      expect(result.content[0]).toEqual({
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Summary' }],
      });
    },
  );

  it('rejects an oversized source before reading its bytes', async () => {
    const arrayBuffer = vi.fn(async () => new ArrayBuffer(0));
    const source: SpreadsheetFileSource = {
      size: 64 * 1024 * 1024 + 1,
      arrayBuffer,
    };

    await expect(spreadsheetFileToDocumentJson(source)).rejects.toMatchObject({
      name: 'SpreadsheetImportError',
      code: 'RESOURCE_LIMIT_EXCEEDED',
      message: 'Spreadsheet exceeds the configured resource limits.',
    } satisfies Partial<SpreadsheetImportError>);
    expect(arrayBuffer).not.toHaveBeenCalled();
  });

  it.each([-1, 1.5])('rejects an invalid declared source size %s', async (size) => {
    const arrayBuffer = vi.fn(async () => new ArrayBuffer(0));
    await expectUnsupported(
      spreadsheetFileToDocumentJson({ size, arrayBuffer }),
    );
    expect(arrayBuffer).not.toHaveBeenCalled();
  });

  it('normalizes an unreadable source-size accessor', async () => {
    const source = {
      arrayBuffer: vi.fn(async () => new ArrayBuffer(0)),
    } as unknown as SpreadsheetFileSource;
    Object.defineProperty(source, 'size', {
      get() {
        throw new Error('private local path');
      },
    });

    await expectUnsupported(spreadsheetFileToDocumentJson(source));
    expect(source.arrayBuffer).not.toHaveBeenCalled();
  });

  it('normalizes unreadable local bytes without leaking parser payload details', async () => {
    const source: SpreadsheetFileSource = {
      size: 4,
      async arrayBuffer() {
        throw new Error('private local path and workbook payload');
      },
    };

    await expectUnsupported(spreadsheetFileToDocumentJson(source));
  });

  it('rejects a non-ArrayBuffer body from a hostile source adapter', async () => {
    const source = {
      size: 4,
      async arrayBuffer() {
        return 'not bytes';
      },
    } as unknown as SpreadsheetFileSource;

    await expectUnsupported(spreadsheetFileToDocumentJson(source));
  });

  it('rejects a source whose declared size changes at the byte boundary', async () => {
    const source: SpreadsheetFileSource = {
      size: 4,
      async arrayBuffer() {
        return new ArrayBuffer(5);
      },
    };

    await expectUnsupported(spreadsheetFileToDocumentJson(source));
  });
});