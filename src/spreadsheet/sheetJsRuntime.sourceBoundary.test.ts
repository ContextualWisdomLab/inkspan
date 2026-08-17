import { describe, expect, it } from 'vitest';
import {
  SpreadsheetImportError,
  spreadsheetFileToDocumentJson,
  type SpreadsheetFileSource,
} from './index.js';

function expectUnsupported(promise: Promise<unknown>) {
  return expect(promise).rejects.toMatchObject({
    name: 'SpreadsheetImportError',
    code: 'UNSUPPORTED_OR_CORRUPT',
    message: 'Spreadsheet source is unsupported or corrupt.',
  } satisfies Partial<SpreadsheetImportError>);
}

describe('spreadsheet local source boundary', () => {
  it('normalizes a hostile returned ArrayBuffer identity trap', async () => {
    const privatePrototypeError = new Error('private returned buffer prototype');
    const hostileBuffer = new Proxy(new ArrayBuffer(4), {
      getPrototypeOf() {
        throw privatePrototypeError;
      },
    });
    const source = {
      size: 4,
      async arrayBuffer() {
        return hostileBuffer;
      },
    } as SpreadsheetFileSource;

    await expectUnsupported(spreadsheetFileToDocumentJson(source));
  });

  it('normalizes a hostile non-Blob source prototype trap when arrayBuffer is absent', async () => {
    const privatePrototypeError = new Error('private source prototype');
    const source = new Proxy(
      { size: 4 } as SpreadsheetFileSource,
      {
        getPrototypeOf() {
          throw privatePrototypeError;
        },
      },
    );

    await expectUnsupported(spreadsheetFileToDocumentJson(source));
  });
});
