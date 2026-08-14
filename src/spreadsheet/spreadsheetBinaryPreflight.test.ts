import { describe, expect, it } from 'vitest';
import {
  preflightSpreadsheetBinarySource,
  SpreadsheetImportError,
} from './spreadsheetImport.js';

const UNSUPPORTED_SOURCE_MESSAGE = 'Spreadsheet source is unsupported or corrupt.';

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

describe('preflightSpreadsheetBinarySource runtime boundary', () => {
  it('rejects non-Uint8Array views even when their elements mimic an XLSX signature', () => {
    const wordView = new Uint16Array([0x50, 0x4b, 0x03, 0x04]);

    expectUnsupportedSource(() =>
      preflightSpreadsheetBinarySource(wordView as unknown as Uint8Array),
    );
  });

  it('rejects hostile non-byte sources before reading caller-controlled members', () => {
    let byteLengthRead = false;
    let indexRead = false;
    const hostileSource = Object.create(null) as Record<PropertyKey, unknown>;

    Object.defineProperty(hostileSource, 'byteLength', {
      get() {
        byteLengthRead = true;
        throw new Error('private-byte-length-sentinel');
      },
    });
    Object.defineProperty(hostileSource, '0', {
      get() {
        indexRead = true;
        throw new Error('private-index-sentinel');
      },
    });

    expectUnsupportedSource(() =>
      preflightSpreadsheetBinarySource(hostileSource as unknown as Uint8Array),
    );
    expect(byteLengthRead).toBe(false);
    expect(indexRead).toBe(false);
  });
});
