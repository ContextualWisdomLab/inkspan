import { describe, expect, it } from 'vitest';
import {
  SpreadsheetImportError,
  spreadsheetWorkbookToDocumentJson,
} from './spreadsheetImport.js';

describe('spreadsheetWorkbookToDocumentJson', () => {
  it('converts visible worksheet text into an editable heading and table', () => {
    const result = spreadsheetWorkbookToDocumentJson({
      worksheets: [
        {
          name: 'Summary',
          hidden: false,
          rows: [
            ['Name', 'Value'],
            ['매출', '42'],
          ],
        },
        {
          name: 'Private',
          hidden: true,
          rows: [['secret']],
        },
      ],
    });

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
    expect(result.content[1]).toEqual({
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableCell',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Name' }],
                },
              ],
            },
            {
              type: 'tableCell',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Value' }],
                },
              ],
            },
          ],
        },
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableCell',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: '매출' }],
                },
              ],
            },
            {
              type: 'tableCell',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: '42' }],
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it('skips visible worksheets that contain no rows', () => {
    const result = spreadsheetWorkbookToDocumentJson({
      worksheets: [
        { name: 'Empty', hidden: false, rows: [] },
        { name: 'Data', hidden: false, rows: [['kept']] },
      ],
    });

    expect(result).toMatchObject({
      worksheetCount: 1,
      rowCount: 1,
      cellCount: 1,
    });
    expect(result.content[0]).toEqual({
      type: 'heading',
      attrs: { level: 3 },
      content: [{ type: 'text', text: 'Data' }],
    });
  });

  it('pads ragged rows to a rectangular table with valid empty cells', () => {
    const result = spreadsheetWorkbookToDocumentJson({
      worksheets: [
        {
          name: 'Ragged',
          hidden: false,
          rows: [
            ['A', 'B'],
            ['C'],
          ],
        },
      ],
    });

    expect(result).toMatchObject({
      worksheetCount: 1,
      rowCount: 2,
      cellCount: 4,
    });
    expect(result.content[1]).toEqual({
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableCell',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'A' }],
                },
              ],
            },
            {
              type: 'tableCell',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'B' }],
                },
              ],
            },
          ],
        },
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableCell',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'C' }],
                },
              ],
            },
            {
              type: 'tableCell',
              content: [{ type: 'paragraph' }],
            },
          ],
        },
      ],
    });
  });

  it('preserves multiline displayed cell text with hard breaks', () => {
    const result = spreadsheetWorkbookToDocumentJson({
      worksheets: [
        {
          name: 'Multiline',
          hidden: false,
          rows: [['first line\nsecond line']],
        },
      ],
    });

    expect(result.content[1]).toEqual({
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableCell',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', text: 'first line' },
                    { type: 'hardBreak' },
                    { type: 'text', text: 'second line' },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it('fails closed before materializing an over-wide worksheet', () => {
    const workbook = {
      worksheets: [
        {
          name: 'Too wide',
          hidden: false,
          rows: [Array.from({ length: 257 }, (_, index) => String(index))],
        },
      ],
    };

    expect(() => spreadsheetWorkbookToDocumentJson(workbook)).toThrowError(
      'Spreadsheet exceeds the configured resource limits.',
    );
  });

  it('fails closed after 64 visible non-empty worksheets', () => {
    const workbook = {
      worksheets: Array.from({ length: 65 }, (_, index) => ({
        name: `Sheet ${index + 1}`,
        hidden: false,
        rows: [['kept']],
      })),
    };

    expect(() => spreadsheetWorkbookToDocumentJson(workbook)).toThrowError(
      'Spreadsheet exceeds the configured resource limits.',
    );
  });

  it('fails closed before materializing oversized cell text', () => {
    const workbook = {
      worksheets: [
        {
          name: 'Oversized text',
          hidden: false,
          rows: [['x'.repeat(32_769)]],
        },
      ],
    };

    expect(() => spreadsheetWorkbookToDocumentJson(workbook)).toThrowError(
      'Spreadsheet exceeds the configured resource limits.',
    );
  });

  it('exposes a stable payload-redacted import error identity', () => {
    const error = new SpreadsheetImportError(
      'UNSUPPORTED_OR_CORRUPT',
      'Workbook cannot be imported.',
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('SpreadsheetImportError');
    expect(error.code).toBe('UNSUPPORTED_OR_CORRUPT');
    expect(error.message).toBe('Workbook cannot be imported.');
  });
});
