import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { Editor } from '@tiptap/react';
import { buildExtensions } from '../extensions/kit.js';
import { CwlEditor } from './CwlEditor.js';
import { Toolbar } from './Toolbar.js';

const openEditors: Editor[] = [];

function spreadsheetInput(): HTMLInputElement {
  return document.querySelector(
    'input[data-cwl-spreadsheet-input="true"]',
  ) as HTMLInputElement;
}

function serializeWorkbook(bookType: 'xlsx' | 'biff8'): Uint8Array {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([
    ['Product Name', 'Unit Count'],
    ['Alpha Widget', 12],
    ['Beta Gadget', 7],
  ]);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Quarterly Revenue');
  const serialized = XLSX.write(workbook, { type: 'array', bookType });
  return serialized instanceof Uint8Array
    ? serialized
    : new Uint8Array(serialized as ArrayBuffer);
}

function quarterlyRevenueFile(bookType: 'xlsx' | 'biff8'): File {
  const bytes = serializeWorkbook(bookType);
  return new File([bytes], 'quarterly-revenue.xlsx', {
    type:
      bookType === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/vnd.ms-excel',
  });
}

function expectQuarterlyRevenueTable(root: ParentNode): void {
  const cells = [...root.querySelectorAll('table td')].map(
    (cell) => cell.textContent ?? '',
  );
  expect(cells).toEqual([
    'Product Name',
    'Unit Count',
    'Alpha Widget',
    '12',
    'Beta Gadget',
    '7',
  ]);
  expect(root).toHaveTextContent('Quarterly Revenue');
}

function makeEditor(content = '<p>Before</p><p>After</p>'): Editor {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = new Editor({
    element,
    extensions: buildExtensions({ image: { maxDimension: 0 } }),
    content,
  });
  openEditors.push(editor);
  return editor;
}

afterEach(() => {
  cleanup();
  for (const editor of openEditors.splice(0)) {
    if (!editor.isDestroyed) editor.destroy();
  }
});

describe('real spreadsheet worksheet insertion into the document body', () => {
  it.each([
    ['XLSX', 'xlsx'],
    ['BIFF8 XLS', 'biff8'],
  ] as const)(
    'inserts a known %s worksheet as an editable heading and table cells',
    async (_label, bookType) => {
      const editor = makeEditor();
      editor.commands.setTextSelection(7);
      render(<Toolbar editor={editor} />);

      fireEvent.change(spreadsheetInput(), {
        target: { files: [quarterlyRevenueFile(bookType)] },
      });

      await waitFor(() =>
        expect(screen.getByRole('status')).toHaveTextContent(
          'Imported 1 worksheet, 3 rows, and 6 cells.',
        ),
      );

      const html = editor.getHTML();
      expect(html.indexOf('Before')).toBeLessThan(html.indexOf('Quarterly Revenue'));
      expect(html.indexOf('Quarterly Revenue')).toBeLessThan(html.indexOf('After'));
      expectQuarterlyRevenueTable(editor.view.dom);
      expect(editor.getJSON().content).toEqual(
        expect.arrayContaining([
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Quarterly Revenue' }],
          },
        ]),
      );
    },
  );

  it('inserts the same known XLSX fixture through the public CwlEditor toolbar', async () => {
    render(<CwlEditor defaultValue="Before" />);

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Insert XLS/XLSX spreadsheet' }),
      ).toBeInTheDocument(),
    );

    fireEvent.change(spreadsheetInput(), {
      target: { files: [quarterlyRevenueFile('xlsx')] },
    });

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Imported 1 worksheet, 3 rows, and 6 cells.',
      ),
    );

    const documentRoot = document.querySelector('.ProseMirror');
    expect(documentRoot).not.toBeNull();
    expectQuarterlyRevenueTable(documentRoot!);
    expect(documentRoot).toHaveTextContent('Before');
  });
});
