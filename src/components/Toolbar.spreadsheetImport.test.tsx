import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Editor } from '@tiptap/react';
import { buildExtensions } from '../extensions/kit.js';

const spreadsheetMocks = vi.hoisted(() => ({
  importFile: vi.fn(),
}));

vi.mock('../spreadsheet/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../spreadsheet/index.js')>();
  return {
    ...actual,
    spreadsheetFileToDocumentJson: spreadsheetMocks.importFile,
  };
});

import { Toolbar } from './Toolbar.js';

const openEditors: Editor[] = [];

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

function spreadsheetInput(): HTMLInputElement {
  return document.querySelector(
    'input[data-cwl-spreadsheet-input="true"]',
  ) as HTMLInputElement;
}

function spreadsheetFile(): File {
  return new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], 'book.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

function importedResult() {
  return {
    worksheetCount: 1,
    rowCount: 1,
    cellCount: 1,
    content: [
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Summary' }],
      },
      {
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
                    content: [{ type: 'text', text: '42' }],
                  },
                ],
              },
            ],
          },
        ],
      },
      { type: 'paragraph' },
    ],
  } as const;
}

afterEach(() => {
  cleanup();
  spreadsheetMocks.importFile.mockReset();
  for (const editor of openEditors.splice(0)) {
    if (!editor.isDestroyed) editor.destroy();
  }
});

describe('Toolbar spreadsheet import', () => {
  it('exposes a keyboard toolbar control and the exact local XLS/XLSX picker contract', async () => {
    const editor = makeEditor();
    render(<Toolbar editor={editor} />);

    const button = screen.getByRole('button', {
      name: 'Insert XLS/XLSX spreadsheet',
    });
    expect(button).not.toBeDisabled();

    const input = spreadsheetInput();
    expect(input).toHaveAttribute(
      'accept',
      '.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(input).toHaveAttribute('hidden');

    fireEvent.focus(button);
    fireEvent.keyDown(button, { key: 'ArrowRight' });
    expect(document.activeElement).not.toBe(button);
  });

  it('inserts one validated JSON batch at the active selection and remains normally undoable', async () => {
    spreadsheetMocks.importFile.mockResolvedValue(importedResult());
    const editor = makeEditor();
    editor.commands.setTextSelection(7);
    const insertContent = vi.spyOn(editor.commands, 'insertContent');
    render(<Toolbar editor={editor} />);

    const input = spreadsheetInput();
    fireEvent.change(input, { target: { files: [spreadsheetFile()] } });

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Imported 1 worksheet, 1 row, and 1 cell.',
      ),
    );
    expect(spreadsheetMocks.importFile).toHaveBeenCalledTimes(1);
    expect(insertContent).toHaveBeenCalledTimes(1);
    expect(editor.getHTML()).toContain('Summary');
    expect(editor.getHTML()).toContain('<table');
    expect(input.value).toBe('');

    act(() => editor.commands.undo());
    expect(editor.getHTML()).not.toContain('Summary');
    expect(editor.getHTML()).not.toContain('<table');
  });

  it('disables import while parsing and permits the same file to be selected again', async () => {
    let resolveImport: ((result: ReturnType<typeof importedResult>) => void) | undefined;
    spreadsheetMocks.importFile.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveImport = resolve;
        }),
    );
    const editor = makeEditor();
    render(<Toolbar editor={editor} />);

    const button = screen.getByRole('button', {
      name: 'Insert XLS/XLSX spreadsheet',
    });
    const input = spreadsheetInput();
    const file = spreadsheetFile();
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(button).toBeDisabled());
    expect(screen.getByRole('status')).toHaveTextContent('Importing spreadsheet…');
    expect(input.value).toBe('');

    await act(async () => resolveImport?.(importedResult()));
    await waitFor(() => expect(button).not.toBeDisabled());

    spreadsheetMocks.importFile.mockResolvedValueOnce(importedResult());
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(spreadsheetMocks.importFile).toHaveBeenCalledTimes(2));
  });

  it('announces a stable payload-redacted failure and leaves the document unchanged', async () => {
    spreadsheetMocks.importFile.mockRejectedValue(
      new Error('secret workbook cell and local filesystem path'),
    );
    const editor = makeEditor();
    const before = editor.getJSON();
    render(<Toolbar editor={editor} />);

    fireEvent.change(spreadsheetInput(), {
      target: { files: [spreadsheetFile()] },
    });

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Spreadsheet import failed.',
      ),
    );
    expect(screen.getByRole('status')).not.toHaveTextContent('secret workbook');
    expect(editor.getJSON()).toEqual(before);
  });

  it('ignores a picker change with no selected file', async () => {
    const editor = makeEditor();
    render(<Toolbar editor={editor} />);

    fireEvent.change(spreadsheetInput(), { target: { files: [] } });

    expect(spreadsheetMocks.importFile).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
