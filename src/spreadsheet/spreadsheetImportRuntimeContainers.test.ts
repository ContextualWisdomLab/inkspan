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

function revokedArrayProxy(): readonly unknown[] {
  const { proxy, revoke } = Proxy.revocable([], {});
  revoke();
  return proxy;
}

describe('spreadsheetWorkbookToDocumentJson runtime containers', () => {
  it.each([null, undefined, 0, 'workbook']) (
    'rejects non-object workbook containers with the stable domain error',
    (invalidWorkbook) => {
      expectUnsupportedSource(() =>
        spreadsheetWorkbookToDocumentJson(
          invalidWorkbook as unknown as Parameters<
            typeof spreadsheetWorkbookToDocumentJson
          >[0],
        ),
      );
    },
  );

  it('rejects a non-array worksheet collection before reading its iterator', () => {
    let iteratorRead = false;
    const hostileWorksheets = Object.create(null) as Record<PropertyKey, unknown>;
    Object.defineProperty(hostileWorksheets, Symbol.iterator, {
      get() {
        iteratorRead = true;
        throw new Error('private-worksheets-iterator-sentinel');
      },
    });

    expectUnsupportedSource(() =>
      spreadsheetWorkbookToDocumentJson({
        worksheets: hostileWorksheets as unknown as readonly [],
      }),
    );
    expect(iteratorRead).toBe(false);
  });

  it('normalizes a revoked worksheet-array proxy to the stable domain error', () => {
    expectUnsupportedSource(() =>
      spreadsheetWorkbookToDocumentJson({
        worksheets: revokedArrayProxy() as unknown as readonly [],
      }),
    );
  });

  it.each([null, undefined])(
    'rejects nullish worksheet entries with the stable domain error',
    (invalidWorksheet) => {
      expectUnsupportedSource(() =>
        spreadsheetWorkbookToDocumentJson({
          worksheets: [
            invalidWorksheet as unknown as Parameters<
              typeof spreadsheetWorkbookToDocumentJson
            >[0]['worksheets'][number],
          ],
        }),
      );
    },
  );

  it('rejects a non-array row collection before reading its length', () => {
    let lengthRead = false;
    const hostileRows = Object.create(null) as Record<PropertyKey, unknown>;
    Object.defineProperty(hostileRows, 'length', {
      get() {
        lengthRead = true;
        throw new Error('private-rows-length-sentinel');
      },
    });

    expectUnsupportedSource(() =>
      spreadsheetWorkbookToDocumentJson({
        worksheets: [
          {
            name: 'Data',
            hidden: false,
            rows: hostileRows as unknown as readonly (readonly string[])[],
          },
        ],
      }),
    );
    expect(lengthRead).toBe(false);
  });

  it('normalizes a revoked rows-array proxy to the stable domain error', () => {
    expectUnsupportedSource(() =>
      spreadsheetWorkbookToDocumentJson({
        worksheets: [
          {
            name: 'Data',
            hidden: false,
            rows: revokedArrayProxy() as unknown as readonly (readonly string[])[],
          },
        ],
      }),
    );
  });

  it('rejects a non-array row before reading its length', () => {
    let lengthRead = false;
    const hostileRow = Object.create(null) as Record<PropertyKey, unknown>;
    Object.defineProperty(hostileRow, 'length', {
      get() {
        lengthRead = true;
        throw new Error('private-row-length-sentinel');
      },
    });

    expectUnsupportedSource(() =>
      spreadsheetWorkbookToDocumentJson({
        worksheets: [
          {
            name: 'Data',
            hidden: false,
            rows: [hostileRow as unknown as readonly string[]],
          },
        ],
      }),
    );
    expect(lengthRead).toBe(false);
  });

  it('normalizes a revoked row-array proxy to the stable domain error', () => {
    expectUnsupportedSource(() =>
      spreadsheetWorkbookToDocumentJson({
        worksheets: [
          {
            name: 'Data',
            hidden: false,
            rows: [revokedArrayProxy() as unknown as readonly string[]],
          },
        ],
      }),
    );
  });
});
