import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

import { CwlEditor } from './CwlEditor.js';

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

afterEach(() => {
  cleanup();
  spreadsheetMocks.importFile.mockReset();
});

describe('CwlEditor spreadsheet import integration', () => {
  it('forwards spreadsheet failures through the public host callback without leaking payload text into status', async () => {
    const parserFailure = new Error('private workbook payload');
    spreadsheetMocks.importFile.mockRejectedValue(parserFailure);
    const onSpreadsheetError = vi.fn();

    render(
      <CwlEditor
        defaultValue="Before"
        onSpreadsheetError={onSpreadsheetError}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Insert XLS/XLSX spreadsheet' }),
      ).toBeInTheDocument(),
    );

    fireEvent.change(spreadsheetInput(), {
      target: { files: [spreadsheetFile()] },
    });

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Spreadsheet import failed.',
      ),
    );
    expect(screen.getByRole('status')).not.toHaveTextContent('private workbook');
    expect(onSpreadsheetError).toHaveBeenCalledTimes(1);
    expect(onSpreadsheetError).toHaveBeenCalledWith(parserFailure);
  });
});