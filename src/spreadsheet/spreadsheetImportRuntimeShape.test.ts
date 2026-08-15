import { describe, expect, it } from 'vitest';
import {
  spreadsheetWorkbookToDocumentJson,
  SpreadsheetImportError,
} from './spreadsheetImport.js';

const UNSUPPORTED_SOURCE_MESSAGE =
  'Spreadsheet source is unsupported or corrupt.';

function expectUnsupportedSource(action: () => unknown): void {
  let thrown: unknown;
  try {
    action();
  } catch (error) {
    thrown = error;
  }

  expect(thrown).toBeInstanceOf(SpreadsheetImportError);
  expect(thrown).toMatchObject({
    code: 'UNSUPPORTED_OR_CORRUPT',
    message: UNSUPPORTED_SOURCE_MESSAGE,
  });
}

describe('spreadsheetWorkbookToDocumentJson runtime metadata boundary', () => {
  it('rejects non-string cells before reading caller-controlled length', () => {
    let lengthRead = false;
    const hostileCell = Object.create(null) as Record<PropertyKey, unknown>;
    Object.defineProperty(hostileCell, 'length', {
      get() {
        lengthRead = true;
        throw new Error('private-cell-length-sentinel');
      },
    });

    expectUnsupportedSource(() =>
      spreadsheetWorkbookToDocumentJson({
        worksheets: [
          {
            name: 'Data',
            hidden: false,
            rows: [[hostileCell as unknown as string]],
          },
        ],
      }),
    );
    expect(lengthRead).toBe(false);
  });

  it('rejects non-string worksheet names before reading caller-controlled length', () => {
    let lengthRead = false;
    const hostileName = Object.create(null) as Record<PropertyKey, unknown>;
    Object.defineProperty(hostileName, 'length', {
      get() {
        lengthRead = true;
        throw new Error('private-name-length-sentinel');
      },
    });

    expectUnsupportedSource(() =>
      spreadsheetWorkbookToDocumentJson({
        worksheets: [
          {
            name: hostileName as unknown as string,
            hidden: false,
            rows: [['kept']],
          },
        ],
      }),
    );
    expect(lengthRead).toBe(false);
  });

  it('rejects non-boolean hidden metadata instead of silently skipping a sheet', () => {
    expectUnsupportedSource(() =>
      spreadsheetWorkbookToDocumentJson({
        worksheets: [
          {
            name: 'Data',
            hidden: 'false' as unknown as boolean,
            rows: [['kept']],
          },
        ],
      }),
    );
  });
});
