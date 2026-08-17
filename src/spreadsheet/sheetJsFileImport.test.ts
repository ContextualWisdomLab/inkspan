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

function xlsxBytes(): Uint8Array {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([
    ['Name', 'Value'],
    ['Revenue', 42],
  ]);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Summary');
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as Uint8Array;
}

describe('spreadsheetFileToDocumentJson', () => {
  it('converts a real local XLSX source into bounded editable TipTap content', async () => {
    const result = await spreadsheetFileToDocumentJson(
      sourceFromBytes(xlsxBytes()),
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
  });

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

  it('normalizes unreadable local sources without leaking parser payload details', async () => {
    const source: SpreadsheetFileSource = {
      size: 4,
      async arrayBuffer() {
        throw new Error('private local path and workbook payload');
      },
    };

    await expect(spreadsheetFileToDocumentJson(source)).rejects.toMatchObject({
      name: 'SpreadsheetImportError',
      code: 'UNSUPPORTED_OR_CORRUPT',
      message: 'Spreadsheet source is unsupported or corrupt.',
    } satisfies Partial<SpreadsheetImportError>);
  });
});
