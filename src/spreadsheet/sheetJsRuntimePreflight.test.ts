import { describe, expect, it, vi } from 'vitest';
import { parseSheetJsSpreadsheetBytesWithParserLoader } from './sheetJsRuntime.js';

describe('SheetJS runtime source preflight ordering', () => {
  it('rejects an unsupported binary envelope before loading the parser package', async () => {
    const loadParser = vi.fn(async () => {
      throw new Error('parser loader must not run before binary preflight');
    });

    await expect(
      parseSheetJsSpreadsheetBytesWithParserLoader(
        new Uint8Array([0x00, 0x01, 0x02, 0x03]),
        loadParser,
      ),
    ).rejects.toMatchObject({
      name: 'SpreadsheetImportError',
      code: 'UNSUPPORTED_OR_CORRUPT',
      message: 'Spreadsheet source is unsupported or corrupt.',
    });

    expect(loadParser).not.toHaveBeenCalled();
  });
});
