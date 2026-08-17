import { describe, expect, it, vi } from 'vitest';

const { parserLoad } = vi.hoisted(() => ({ parserLoad: vi.fn() }));

vi.mock('xlsx', () => {
  parserLoad();
  return {};
});

import { parseSheetJsSpreadsheetBytes } from './sheetJsRuntime.js';

describe('SheetJS runtime source preflight ordering', () => {
  it('rejects an unsupported binary envelope before loading the parser package', async () => {
    await expect(
      parseSheetJsSpreadsheetBytes(new Uint8Array([0x00, 0x01, 0x02, 0x03])),
    ).rejects.toMatchObject({
      name: 'SpreadsheetImportError',
      code: 'UNSUPPORTED_OR_CORRUPT',
      message: 'Spreadsheet source is unsupported or corrupt.',
    });

    expect(parserLoad).not.toHaveBeenCalled();
  });
});
