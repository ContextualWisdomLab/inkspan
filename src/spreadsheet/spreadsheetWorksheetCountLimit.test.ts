import { describe, expect, it } from 'vitest';

import {
  SpreadsheetImportError,
  spreadsheetWorkbookToDocumentJson,
} from './spreadsheetImport';

const MAX_BOUNDED_WORKSHEET_DESCRIPTORS = 256;

function hiddenWorksheet(name: string) {
  return { hidden: true, name, rows: [] as string[][] };
}

describe('spreadsheet workbook worksheet-count resource boundary', () => {
  it('accepts the maximum bounded hidden-sheet descriptor count', () => {
    const worksheets = Array.from(
      { length: MAX_BOUNDED_WORKSHEET_DESCRIPTORS },
      (_, index) => hiddenWorksheet(`hidden-${index}`),
    );

    expect(spreadsheetWorkbookToDocumentJson({ worksheets })).toEqual({
      content: [],
      worksheetCount: 0,
      rowCount: 0,
      cellCount: 0,
    });
  });

  it('rejects an oversized worksheet descriptor set before inspecting worksheet members', () => {
    const worksheets = Array.from(
      { length: MAX_BOUNDED_WORKSHEET_DESCRIPTORS + 1 },
      (_, index) => hiddenWorksheet(`hidden-${index}`),
    );
    Object.defineProperty(worksheets[0]!, 'hidden', {
      configurable: true,
      get() {
        throw new Error('private worksheet getter should not execute');
      },
    });

    expect(() => spreadsheetWorkbookToDocumentJson({ worksheets })).toThrowError(
      expect.objectContaining({
        name: 'SpreadsheetImportError',
        code: 'RESOURCE_LIMIT_EXCEEDED',
        message: 'Spreadsheet exceeds the configured resource limits.',
      }) as SpreadsheetImportError,
    );
  });
});
