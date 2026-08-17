import { describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';
import {
  SpreadsheetImportError,
  spreadsheetFileToDocumentJson,
  type SpreadsheetFileSource,
} from './index.js';

type WorkbookFormat = 'xlsx' | 'biff8';

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

function serializeWorkbook(
  workbook: XLSX.WorkBook,
  bookType: WorkbookFormat,
): Uint8Array {
  const serialized = XLSX.write(workbook, { type: 'array', bookType });
  return serialized instanceof Uint8Array
    ? serialized
    : new Uint8Array(serialized as ArrayBuffer);
}

function workbookBytes(bookType: WorkbookFormat): Uint8Array {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([
    ['Name', 'Value'],
    ['Revenue', 42],
  ]);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Summary');
  return serializeWorkbook(workbook, bookType);
}

function richWorkbookBytes(bookType: WorkbookFormat): Uint8Array {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([
    ['Kind', 'Value'],
    ['Unicode', '매출'],
    ['Multiline', 'line 1\nline 2'],
    ['Boolean', true],
    [
      'Date',
      {
        t: 'd',
        v: new Date(Date.UTC(2026, 7, 17)),
        z: 'yyyy-mm-dd',
      } satisfies XLSX.CellObject,
    ],
    [
      'Formula',
      {
        t: 'n',
        v: 42,
        f: 'SUM(40,2)',
      } satisfies XLSX.CellObject,
    ],
    [
      'Hyperlink',
      {
        t: 's',
        v: 'Reference',
        l: { Target: 'https://secret.invalid/workbook' },
      } satisfies XLSX.CellObject,
    ],
  ]);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Summary');
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([['private hidden value']]),
    'Hidden',
  );
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([]), 'Empty');

  if (!workbook.Workbook) workbook.Workbook = {};
  if (!workbook.Workbook.Sheets) workbook.Workbook.Sheets = [];
  workbook.Workbook.Sheets[1] = { Hidden: 1 };

  return serializeWorkbook(workbook, bookType);
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

  it.each([
    ['XLSX', 'xlsx'],
    ['BIFF8 XLS', 'biff8'],
  ] as const)(
    'materializes only inert visible displayed values from a real %s workbook',
    async (_label, bookType) => {
      const result = await spreadsheetFileToDocumentJson(
        sourceFromBytes(richWorkbookBytes(bookType)),
      );
      const materialized = JSON.stringify(result.content);

      expect(result).toMatchObject({
        worksheetCount: 1,
        rowCount: 7,
        cellCount: 14,
      });
      expect(materialized).toContain('매출');
      expect(materialized).toContain('hardBreak');
      expect(materialized).toContain('2026-08-17');
      expect(materialized).toContain('Reference');
      expect(materialized).toContain('42');
      expect(materialized).not.toContain('SUM(40,2)');
      expect(materialized).not.toContain('https://secret.invalid/workbook');
      expect(materialized).not.toContain('private hidden value');
      expect(materialized).not.toContain('Hidden');
      expect(materialized).not.toContain('Empty');
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