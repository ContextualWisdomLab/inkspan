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

  it('normalizes a hostile returned ArrayBuffer byteLength accessor', async () => {
    const hostileBuffer = new ArrayBuffer(4);
    Object.defineProperty(hostileBuffer, 'byteLength', {
      configurable: true,
      get() {
        throw new Error('private returned buffer length');
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

  it('rejects a non-ArrayBuffer body before reading its byteLength member', async () => {
    let byteLengthReads = 0;
    const hostileBody = {
      get byteLength() {
        byteLengthReads += 1;
        throw new Error('private non-buffer length');
      },
    };
    const source = {
      size: 4,
      async arrayBuffer() {
        return hostileBody as unknown as ArrayBuffer;
      },
    } as SpreadsheetFileSource;

    await expectUnsupported(spreadsheetFileToDocumentJson(source));
    expect(byteLengthReads).toBe(0);
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
