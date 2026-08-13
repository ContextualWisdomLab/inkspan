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
