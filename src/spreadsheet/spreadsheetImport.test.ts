import { describe, expect, it } from 'vitest';
import { spreadsheetWorkbookToDocumentJson } from './spreadsheetImport.js';

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
    expect(result.content[1]).toMatchObject({
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
      ],
    });
  });
});
