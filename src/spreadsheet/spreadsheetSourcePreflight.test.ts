import { describe, expect, it } from 'vitest';
import * as spreadsheetImport from './spreadsheetImport.js';

type SpreadsheetBinaryFormat = 'xls' | 'xlsx';
type SpreadsheetBinarySource = Readonly<{
  format: SpreadsheetBinaryFormat;
  bytes: Uint8Array;
}>;
type PreflightSpreadsheetBinarySource = (
  source: Uint8Array,
) => SpreadsheetBinarySource;

function preflightSpreadsheetBinarySource(): PreflightSpreadsheetBinarySource {
  const candidate = (
    spreadsheetImport as unknown as {
      preflightSpreadsheetBinarySource?: PreflightSpreadsheetBinarySource;
    }
  ).preflightSpreadsheetBinarySource;
  expect(candidate).toBeTypeOf('function');
  return candidate!;
}

function xlsxEnvelope(): Uint8Array {
  return Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]);
}

function xlsEnvelope(): Uint8Array {
  return Uint8Array.from([
    0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00, 0x00,
  ]);
}

describe('spreadsheet binary source preflight', () => {
  it('detects an XLSX ZIP envelope without copying source bytes', () => {
    const source = xlsxEnvelope();
    const result = preflightSpreadsheetBinarySource()(source);

    expect(result).toEqual({ format: 'xlsx', bytes: source });
    expect(result.bytes).toBe(source);
  });

  it('detects a legacy XLS compound-file envelope without copying source bytes', () => {
    const source = xlsEnvelope();
    const result = preflightSpreadsheetBinarySource()(source);

    expect(result).toEqual({ format: 'xls', bytes: source });
    expect(result.bytes).toBe(source);
  });

  it('rejects a source larger than the 64 MiB local ceiling before signature inspection', () => {
    const target = xlsxEnvelope();
    const source = new Proxy(target, {
      get(innerTarget, property) {
        if (property === 'byteLength') return 64 * 1024 * 1024 + 1;
        if (property === '0') {
          throw new Error('signature bytes must not be read after the size preflight');
        }
        return Reflect.get(innerTarget, property, innerTarget);
      },
    });

    expect(() => preflightSpreadsheetBinarySource()(source)).toThrowError(
      'Spreadsheet exceeds the configured resource limits.',
    );
  });

  it('rejects empty and unknown binary envelopes with a payload-redacted category', () => {
    const preflight = preflightSpreadsheetBinarySource();

    for (const source of [
      new Uint8Array(0),
      Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]),
    ]) {
      try {
        preflight(source);
        throw new Error('expected spreadsheet preflight to reject unsupported input');
      } catch (error) {
        expect(error).toMatchObject({
          name: 'SpreadsheetImportError',
          code: 'UNSUPPORTED_OR_CORRUPT',
          message: 'Spreadsheet source is unsupported or corrupt.',
        });
      }
    }
  });
});
