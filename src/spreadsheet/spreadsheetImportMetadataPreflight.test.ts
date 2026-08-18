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

describe('spreadsheet workbook metadata preflight', () => {
  it('rejects a missing worksheets data property', () => {
    expectUnsupportedSource(() =>
      spreadsheetWorkbookToDocumentJson(Object.create(null) as never),
    );
  });

  it('rejects an accessor-backed worksheets field without invoking it', () => {
    let accessed = false;
    const workbook = Object.create(null) as Record<PropertyKey, unknown>;
    Object.defineProperty(workbook, 'worksheets', {
      enumerable: true,
      get() {
        accessed = true;
        throw new Error('private-workbook-worksheets-sentinel');
      },
    });

    expectUnsupportedSource(() =>
      spreadsheetWorkbookToDocumentJson(workbook as never),
    );
    expect(accessed).toBe(false);
  });

  it('redacts a hostile metadata reflection failure', () => {
    const workbook = new Proxy(Object.create(null) as object, {
      getOwnPropertyDescriptor() {
        throw new Error('private-metadata-reflection-sentinel');
      },
    });

    expectUnsupportedSource(() =>
      spreadsheetWorkbookToDocumentJson(workbook as never),
    );
  });

  it('does not invoke a hostile worksheets iterator getter', () => {
    let iteratorRead = false;
    const worksheet = {
      name: 'Data',
      hidden: false,
      rows: [['kept']],
    };
    const worksheets = new Proxy([worksheet], {
      get(target, property, receiver) {
        if (property === Symbol.iterator) {
          iteratorRead = true;
          throw new Error('private-worksheets-iterator-sentinel');
        }
        return Reflect.get(target, property, receiver);
      },
    });

    const result = spreadsheetWorkbookToDocumentJson({ worksheets });
    expect(result).toMatchObject({
      worksheetCount: 1,
      rowCount: 1,
      cellCount: 1,
    });
    expect(iteratorRead).toBe(false);
  });

  it('does not invoke hostile worksheet-row length access', () => {
    let lengthRead = false;
    const rows = new Proxy([['kept']], {
      get(target, property, receiver) {
        if (property === 'length') {
          lengthRead = true;
          throw new Error('private-rows-length-sentinel');
        }
        return Reflect.get(target, property, receiver);
      },
    });

    const result = spreadsheetWorkbookToDocumentJson({
      worksheets: [{ name: 'Data', hidden: false, rows }],
    });
    expect(result).toMatchObject({
      worksheetCount: 1,
      rowCount: 1,
      cellCount: 1,
    });
    expect(lengthRead).toBe(false);
  });

  it('does not invoke hostile row index access', () => {
    let indexRead = false;
    const row = new Proxy(['kept'], {
      get(target, property, receiver) {
        if (property === '0') {
          indexRead = true;
          throw new Error('private-row-index-sentinel');
        }
        return Reflect.get(target, property, receiver);
      },
    });

    const result = spreadsheetWorkbookToDocumentJson({
      worksheets: [{ name: 'Data', hidden: false, rows: [row] }],
    });
    expect(result).toMatchObject({
      worksheetCount: 1,
      rowCount: 1,
      cellCount: 1,
    });
    expect(indexRead).toBe(false);
  });

  it.each(['name', 'hidden', 'rows'] as const)(
    'rejects an accessor-backed worksheet %s field without invoking it',
    (field) => {
      let accessed = false;
      const worksheet = Object.create(null) as Record<PropertyKey, unknown>;
      const values = {
        name: 'Data',
        hidden: false,
        rows: [['kept']],
      } as const;

      for (const key of ['name', 'hidden', 'rows'] as const) {
        if (key === field) {
          Object.defineProperty(worksheet, key, {
            configurable: true,
            enumerable: true,
            get() {
              accessed = true;
              throw new Error(`private-${key}-sentinel`);
            },
          });
        } else {
          Object.defineProperty(worksheet, key, {
            configurable: true,
            enumerable: true,
            value: values[key],
          });
        }
      }

      expectUnsupportedSource(() =>
        spreadsheetWorkbookToDocumentJson({
          worksheets: [worksheet as never],
        }),
      );
      expect(accessed).toBe(false);
    },
  );
});
