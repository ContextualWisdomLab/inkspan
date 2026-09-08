import { describe, expect, it, vi } from 'vitest';
import {
  parseSheetJsSpreadsheetBytesWithParserLoader,
} from './sheetJsRuntime.js';
import type { SheetJsParserModule } from './sheetJsAdapter.js';
import { SpreadsheetImportError } from './spreadsheetImport.js';

const BIFF8_SIGNATURE = [
  0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
] as const;

const BIFF8_BOF = 0x0809;
const BIFF8_BOUNDSHEET8 = 0x0085;
const BIFF8_EOF = 0x000a;

function biff8Envelope(minimumLength = 65_536): Uint8Array {
  const bytes = new Uint8Array(Math.max(minimumLength, 8));
  bytes.set(BIFF8_SIGNATURE);
  return bytes;
}

function writeUint16(target: number[], value: number): void {
  target.push(value & 0xff, (value >> 8) & 0xff);
}

function record(type: number, payload: readonly number[]): number[] {
  const encoded: number[] = [];
  writeUint16(encoded, type);
  writeUint16(encoded, payload.length);
  encoded.push(...payload);
  return encoded;
}

function workbookBof(payload: readonly number[] = [0x00, 0x06, 0x05, 0x00]): number[] {
  return record(BIFF8_BOF, payload);
}

function boundSheet(visibility = 0): number[] {
  return record(BIFF8_BOUNDSHEET8, [0, 0, 0, 0, visibility, 0, 0, 0]);
}

function eof(): number[] {
  return record(BIFF8_EOF, []);
}

function validWorkbookStream(): number[] {
  return [...workbookBof(), ...boundSheet(0), ...eof()];
}

function expectUnsupported(promise: Promise<unknown>) {
  return expect(promise).rejects.toMatchObject({
    name: 'SpreadsheetImportError',
    code: 'UNSUPPORTED_OR_CORRUPT',
    message: 'Spreadsheet source is unsupported or corrupt.',
  } satisfies Partial<SpreadsheetImportError>);
}

function expectResourceLimit(promise: Promise<unknown>) {
  return expect(promise).rejects.toMatchObject({
    name: 'SpreadsheetImportError',
    code: 'RESOURCE_LIMIT_EXCEEDED',
    message: 'Spreadsheet exceeds the configured resource limits.',
  } satisfies Partial<SpreadsheetImportError>);
}

function parserWithCfb(
  content: unknown,
  options: {
    readonly cfb?: unknown;
    readonly read?: () => unknown;
    readonly find?: () => unknown;
  } = {},
): SheetJsParserModule {
  const find =
    options.find ??
    (() => ({
      content,
    }));
  const cfb =
    options.cfb ??
    {
      read: options.read ?? (() => ({})),
      find,
    };
  return {
    CFB: cfb,
    read: vi.fn(() => ({
      SheetNames: ['Summary'],
      Sheets: { Summary: {} },
      Workbook: { Sheets: [{ Hidden: 0 }] },
    })),
    utils: {
      decode_range: vi.fn(() => ({
        s: { r: 0, c: 0 },
        e: { r: 0, c: 0 },
      })),
      sheet_to_json: vi.fn(() => []),
    },
  } as unknown as SheetJsParserModule;
}

describe('SheetJS BIFF8 runtime fail-closed boundaries', () => {
  it('rejects a parser without a usable CFB reader', async () => {
    await expectUnsupported(
      parseSheetJsSpreadsheetBytesWithParserLoader(
        biff8Envelope(),
        async () => parserWithCfb([], { cfb: {} }),
      ),
    );
  });

  it('normalizes CFB container and Workbook-entry failures without leaking payload text', async () => {
    await expectUnsupported(
      parseSheetJsSpreadsheetBytesWithParserLoader(
        biff8Envelope(),
        async () =>
          parserWithCfb([], {
            read: () => {
              throw new Error('private compound-file payload');
            },
          }),
      ),
    );
    await expectUnsupported(
      parseSheetJsSpreadsheetBytesWithParserLoader(
        biff8Envelope(),
        async () => parserWithCfb([], { find: () => null }),
      ),
    );
  });

  it('rejects a Workbook entry whose content descriptor is missing or hostile', async () => {
    await expectUnsupported(
      parseSheetJsSpreadsheetBytesWithParserLoader(
        biff8Envelope(),
        async () => parserWithCfb(undefined, { find: () => ({}) }),
      ),
    );

    const accessorEntry = {};
    Object.defineProperty(accessorEntry, 'content', {
      enumerable: true,
      get() {
        throw new Error('private workbook stream');
      },
    });
    await expectUnsupported(
      parseSheetJsSpreadsheetBytesWithParserLoader(
        biff8Envelope(),
        async () => parserWithCfb(undefined, { find: () => accessorEntry }),
      ),
    );

    const descriptorTrap = new Proxy(
      {},
      {
        getOwnPropertyDescriptor() {
          throw new Error('private descriptor trap');
        },
      },
    );
    await expectUnsupported(
      parseSheetJsSpreadsheetBytesWithParserLoader(
        biff8Envelope(),
        async () => parserWithCfb(undefined, { find: () => descriptorTrap }),
      ),
    );
  });

  it('rejects CFB byte views whose length metadata cannot be trusted', async () => {
    const throwingView = new Uint8Array([1]);
    Object.defineProperty(throwingView, 'byteLength', {
      configurable: true,
      get() {
        throw new Error('private view length');
      },
    });
    await expectUnsupported(
      parseSheetJsSpreadsheetBytesWithParserLoader(
        biff8Envelope(),
        async () => parserWithCfb(throwingView),
      ),
    );

    const mismatchedView = new Uint16Array([1]);
    await expectUnsupported(
      parseSheetJsSpreadsheetBytesWithParserLoader(
        biff8Envelope(),
        async () => parserWithCfb(mismatchedView),
      ),
    );
  });

  it('rejects CFB content that is neither a byte view nor a documented byte array', async () => {
    await expectUnsupported(
      parseSheetJsSpreadsheetBytesWithParserLoader(
        biff8Envelope(),
        async () => parserWithCfb({}),
      ),
    );
  });

  it('rejects CFB byte views whose indexed values are not octets', async () => {
    const hostileView = Object.create(null) as {
      byteLength: number;
      length: number;
      0: number;
    };
    hostileView.byteLength = 1;
    hostileView.length = 1;
    Object.defineProperty(hostileView, '0', {
      configurable: true,
      enumerable: true,
      value: 256,
      writable: true,
    });
    const originalIsView = ArrayBuffer.isView.bind(ArrayBuffer);
    const isView = vi.spyOn(ArrayBuffer, 'isView').mockImplementation((value) => {
      return value === hostileView || originalIsView(value);
    });
    try {
      await expectUnsupported(
        parseSheetJsSpreadsheetBytesWithParserLoader(
          biff8Envelope(),
          async () => parserWithCfb(hostileView),
        ),
      );
    } finally {
      isView.mockRestore();
    }
  });

  it('rejects a CFB byte array longer than the original source envelope', async () => {
    await expectUnsupported(
      parseSheetJsSpreadsheetBytesWithParserLoader(
        biff8Envelope(8),
        async () => parserWithCfb(Array.from({ length: 16 }, () => 0)),
      ),
    );
  });

  it('rejects a CFB byte array whose length metadata is not a safe count', async () => {
    const content = new Proxy([] as number[], {
      getOwnPropertyDescriptor(target, property) {
        if (property === 'length') {
          return {
            configurable: true,
            enumerable: false,
            value: -1,
            writable: true,
          };
        }
        return Reflect.getOwnPropertyDescriptor(target, property);
      },
    });
    await expectUnsupported(
      parseSheetJsSpreadsheetBytesWithParserLoader(
        biff8Envelope(),
        async () => parserWithCfb(content),
      ),
    );
  });

  it('rejects a CFB byte array whose indexed values are not octets', async () => {
    await expectUnsupported(
      parseSheetJsSpreadsheetBytesWithParserLoader(
        biff8Envelope(),
        async () => parserWithCfb([256, 0, 0, 0]),
      ),
    );
  });

  it('copies a documented CFB byte array and then rejects a truncated BIFF8 record', async () => {
    await expectUnsupported(
      parseSheetJsSpreadsheetBytesWithParserLoader(
        biff8Envelope(),
        async () => parserWithCfb([...workbookBof(), 0x85, 0x00, 0xff, 0xff]),
      ),
    );
  });

  it('rejects invalid workbook BOF, short BoundSheet8, and illegal visibility bits', async () => {
    await expectUnsupported(
      parseSheetJsSpreadsheetBytesWithParserLoader(
        biff8Envelope(),
        async () => parserWithCfb([...record(0x0000, []), ...eof()]),
      ),
    );
    await expectUnsupported(
      parseSheetJsSpreadsheetBytesWithParserLoader(
        biff8Envelope(),
        async () =>
          parserWithCfb([
            ...workbookBof(),
            ...record(BIFF8_BOUNDSHEET8, [0, 0, 0, 0, 0, 0, 0]),
            ...eof(),
          ]),
      ),
    );
    await expectUnsupported(
      parseSheetJsSpreadsheetBytesWithParserLoader(
        biff8Envelope(),
        async () =>
          parserWithCfb([...workbookBof(), ...boundSheet(0x03), ...eof()]),
      ),
    );
    await expectUnsupported(
      parseSheetJsSpreadsheetBytesWithParserLoader(
        biff8Envelope(),
        async () =>
          parserWithCfb([...workbookBof(), ...boundSheet(0x04), ...eof()]),
      ),
    );
  });

  it('rejects more BoundSheet8 records than the BIFF8 worksheet ceiling', async () => {
    const stream = [...workbookBof()];
    for (let index = 0; index < 257; index += 1) {
      stream.push(...boundSheet(0));
    }
    stream.push(...eof());
    await expectResourceLimit(
      parseSheetJsSpreadsheetBytesWithParserLoader(
        biff8Envelope(stream.length),
        async () => parserWithCfb(stream),
      ),
    );
  });

  it('rejects a workbook stream that never emits EOF', async () => {
    await expectUnsupported(
      parseSheetJsSpreadsheetBytesWithParserLoader(
        biff8Envelope(),
        async () => parserWithCfb([...workbookBof(), ...boundSheet(0)]),
      ),
    );
  });

  it('rejects authoritative-visibility wrapping when the parser result is not an object', async () => {
    const parser = parserWithCfb(validWorkbookStream());
    (parser.read as ReturnType<typeof vi.fn>).mockReturnValue(null);
    await expectUnsupported(
      parseSheetJsSpreadsheetBytesWithParserLoader(
        biff8Envelope(),
        async () => parser,
      ),
    );
  });

  it('rejects a parser result whose sheet-name count disagrees with BoundSheet8 visibility', async () => {
    const parser = parserWithCfb(validWorkbookStream());
    (parser.read as ReturnType<typeof vi.fn>).mockReturnValue({
      SheetNames: ['Summary', 'Extra'],
      Sheets: { Summary: {} },
    });
    await expectUnsupported(
      parseSheetJsSpreadsheetBytesWithParserLoader(
        biff8Envelope(),
        async () => parser,
      ),
    );
  });

  it('rejects hostile or non-array sheet-name containers after visibility wrapping', async () => {
    const nonArray = parserWithCfb(validWorkbookStream());
    (nonArray.read as ReturnType<typeof vi.fn>).mockReturnValue({
      SheetNames: {},
    });
    await expectUnsupported(
      parseSheetJsSpreadsheetBytesWithParserLoader(
        biff8Envelope(),
        async () => nonArray,
      ),
    );

    const originalGetOwnPropertyDescriptor =
      Object.getOwnPropertyDescriptor.bind(Object);

    for (const hostileLength of [Number.NaN, -1]) {
      const invalidLength = parserWithCfb(validWorkbookStream());
      const sheetNames = ['Sheet1'];
      const descriptorSpy = vi
        .spyOn(Object, 'getOwnPropertyDescriptor')
        .mockImplementation((source, key) => {
          if (source === sheetNames && key === 'length') {
            return {
              configurable: false,
              enumerable: false,
              writable: true,
              value: hostileLength,
            };
          }
          return originalGetOwnPropertyDescriptor(source, key);
        });
      try {
        (invalidLength.read as ReturnType<typeof vi.fn>).mockReturnValue({
          SheetNames: sheetNames,
        });
        await expectUnsupported(
          parseSheetJsSpreadsheetBytesWithParserLoader(
            biff8Envelope(),
            async () => invalidLength,
          ),
        );
      } finally {
        descriptorSpy.mockRestore();
      }
    }
  });
});
