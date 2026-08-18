import { describe, expect, it } from 'vitest';
import type { SheetJsParserModule } from './sheetJsAdapter.js';
import {
  parseSheetJsSpreadsheetBytesWithParserLoader,
} from './sheetJsRuntime.js';

const OLE_SIGNATURE = [
  0xd0,
  0xcf,
  0x11,
  0xe0,
  0xa1,
  0xb1,
  0x1a,
  0xe1,
] as const;

function littleEndian16(value: number): readonly number[] {
  return [value & 0xff, (value >>> 8) & 0xff];
}

function record(type: number, payload: readonly number[]): readonly number[] {
  return [
    ...littleEndian16(type),
    ...littleEndian16(payload.length),
    ...payload,
  ];
}

const BOF = record(0x0809, [0x00, 0x06, 0x05, 0x00]);
const EOF = record(0x000a, []);

function boundSheet(visibility: number): readonly number[] {
  return record(0x0085, [0, 0, 0, 0, visibility, 0, 0, 0]);
}

function workbookStream(
  visibilities: readonly number[] = [0],
  extraRecords: readonly (readonly number[])[] = [],
): Uint8Array {
  return Uint8Array.from([
    ...BOF,
    ...extraRecords.flat(),
    ...visibilities.flatMap((visibility) => boundSheet(visibility)),
    ...EOF,
  ]);
}

function sourceFor(stream: Uint8Array): Uint8Array {
  const source = new Uint8Array(Math.max(64, stream.byteLength + 8));
  source.set(OLE_SIGNATURE);
  return source;
}

function workbookFor(names: readonly string[]): object {
  return {
    SheetNames: [...names],
    Sheets: Object.fromEntries(names.map((name) => [name, {}])),
  };
}

function parserWith(
  cfb: unknown,
  workbook: unknown = workbookFor(['Visible']),
): SheetJsParserModule {
  return {
    CFB: cfb,
    read: () => workbook,
    utils: {
      decode_range: () => ({ s: { r: 0, c: 0 }, e: { r: 0, c: 0 } }),
      sheet_to_json: () => [],
    },
  } as unknown as SheetJsParserModule;
}

function parserForStream(
  stream: Uint8Array | readonly number[],
  workbook: unknown = workbookFor(['Visible']),
): SheetJsParserModule {
  return parserWith(
    {
      read: () => ({}),
      find: () => ({ content: stream }),
    },
    workbook,
  );
}

async function expectUnsupported(promise: Promise<unknown>): Promise<void> {
  await expect(promise).rejects.toMatchObject({
    name: 'SpreadsheetImportError',
    code: 'UNSUPPORTED_OR_CORRUPT',
    message: 'Spreadsheet source is unsupported or corrupt.',
  });
}

async function expectResourceLimit(promise: Promise<unknown>): Promise<void> {
  await expect(promise).rejects.toMatchObject({
    name: 'SpreadsheetImportError',
    code: 'RESOURCE_LIMIT_EXCEEDED',
    message: 'Spreadsheet exceeds the configured resource limits.',
  });
}

async function parseWith(
  stream: Uint8Array,
  parser: SheetJsParserModule,
): Promise<unknown> {
  return parseSheetJsSpreadsheetBytesWithParserLoader(
    sourceFor(stream),
    async () => parser,
  );
}

describe('BIFF8 raw visibility validation', () => {
  it('accepts parser-owned numeric-array CFB bytes and projects visible/hidden state', async () => {
    const stream = workbookStream([0, 1]);
    const workbook = await parseWith(
      stream,
      parserForStream(Array.from(stream), workbookFor(['Visible', 'Hidden'])),
    );

    expect(workbook).toEqual({
      worksheets: [
        { name: 'Visible', hidden: false, rows: [] },
        { name: 'Hidden', hidden: true, rows: [] },
      ],
    });
  });

  it.each([
    ['missing CFB module', undefined],
    ['non-object CFB module', 'not a cfb module'],
    ['missing CFB read', { find: () => null }],
    ['missing CFB find', { read: () => ({}) }],
    ['non-callable CFB find', { read: () => ({}), find: 1 }],
  ])('rejects a parser with %s', async (_label, cfb) => {
    const stream = workbookStream();
    await expectUnsupported(parseWith(stream, parserWith(cfb)));
  });

  it('normalizes a throwing CFB reader', async () => {
    const stream = workbookStream();
    await expectUnsupported(
      parseWith(
        stream,
        parserWith({
          read() {
            throw new Error('private parser detail');
          },
          find: () => null,
        }),
      ),
    );
  });

  it('normalizes a throwing CFB finder', async () => {
    const stream = workbookStream();
    await expectUnsupported(
      parseWith(
        stream,
        parserWith({
          read: () => ({}),
          find() {
            throw new Error('private parser detail');
          },
        }),
      ),
    );
  });

  it('rejects a missing Workbook CFB entry', async () => {
    const stream = workbookStream();
    await expectUnsupported(
      parseWith(
        stream,
        parserWith({ read: () => ({}), find: () => null }),
      ),
    );
  });

  it.each([
    ['missing content', {}],
    [
      'accessor content',
      Object.defineProperty({}, 'content', {
        get() {
          return workbookStream();
        },
      }),
    ],
    [
      'throwing content descriptor',
      new Proxy(
        {},
        {
          getOwnPropertyDescriptor() {
            throw new Error('private parser descriptor');
          },
        },
      ),
    ],
  ])('rejects a Workbook entry with %s', async (_label, entry) => {
    const stream = workbookStream();
    await expectUnsupported(
      parseWith(
        stream,
        parserWith({ read: () => ({}), find: () => entry }),
      ),
    );
  });

  it('rejects a non-byte CFB Workbook entry', async () => {
    const stream = workbookStream();
    await expectUnsupported(
      parseWith(
        stream,
        parserWith({
          read: () => ({}),
          find: () => ({ content: 'not workbook bytes' }),
        }),
      ),
    );
  });

  it.each([
    ['view longer than the source', new Uint8Array(65)],
    ['multi-byte element view', new Uint16Array([1, 2])],
    ['negative byte value', new Int8Array([-1])],
  ])('rejects hostile typed CFB content: %s', async (_label, content) => {
    const stream = workbookStream();
    await expectUnsupported(
      parseWith(
        stream,
        parserWith({ read: () => ({}), find: () => ({ content }) }),
      ),
    );
  });

  it('normalizes a throwing typed-view length accessor', async () => {
    const stream = workbookStream();
    const content = new Uint8Array(stream);
    Object.defineProperty(content, 'length', {
      get() {
        throw new Error('private parser detail');
      },
    });

    await expectUnsupported(
      parseWith(
        stream,
        parserWith({
          read: () => ({}),
          find: () => ({ content }),
        }),
      ),
    );
  });

  it('rejects an array CFB entry longer than the local source envelope', async () => {
    const stream = workbookStream();
    const content = new Array<number>(65).fill(0);
    await expectUnsupported(
      parseWith(
        stream,
        parserWith({ read: () => ({}), find: () => ({ content }) }),
      ),
    );
  });

  it.each([
    ['non-integer', [1.5]],
    ['negative', [-1]],
    ['above one byte', [256]],
  ])('rejects invalid numeric-array CFB content: %s', async (_label, content) => {
    const stream = workbookStream();
    await expectUnsupported(
      parseWith(
        stream,
        parserWith({ read: () => ({}), find: () => ({ content }) }),
      ),
    );
  });

  it.each([
    ['record extends beyond stream', Uint8Array.from([0x09, 0x08, 0xff, 0xff])],
    ['wrong first record type', Uint8Array.from([...record(1, [0, 6, 5, 0]), ...EOF])],
    ['short workbook BOF', Uint8Array.from([...record(0x0809, [0, 6, 5]), ...EOF])],
    ['wrong BIFF version', Uint8Array.from([...record(0x0809, [0, 5, 5, 0]), ...EOF])],
    ['wrong BOF substream', Uint8Array.from([...record(0x0809, [0, 6, 0, 0]), ...EOF])],
    ['short BoundSheet8', Uint8Array.from([...BOF, ...record(0x0085, [0, 0, 0, 0, 0, 0, 0]), ...EOF])],
    ['reserved BoundSheet8 visibility bits', workbookStream([4])],
    ['reserved BoundSheet8 visibility value', workbookStream([3])],
    ['missing workbook EOF', Uint8Array.from(BOF)],
  ])('rejects malformed BIFF8 workbook globals: %s', async (_label, stream) => {
    await expectUnsupported(parseWith(stream, parserForStream(stream)));
  });

  it('rejects more than the bounded BIFF8 worksheet count', async () => {
    const stream = workbookStream(new Array<number>(257).fill(0));
    await expectResourceLimit(parseWith(stream, parserForStream(stream)));
  });

  it('ignores unrelated workbook-global records before EOF', async () => {
    const stream = workbookStream([], [record(0x002f, [1, 2])]);
    const workbook = await parseWith(
      stream,
      parserForStream(stream, workbookFor([])),
    );

    expect(workbook).toEqual({ worksheets: [] });
  });

  it('rejects a parser workbook whose wrapped result is not an object', async () => {
    const stream = workbookStream();
    await expectUnsupported(parseWith(stream, parserForStream(stream, null)));
  });

  it('rejects non-array parser SheetNames before exposing visibility metadata', async () => {
    const stream = workbookStream();
    await expectUnsupported(
      parseWith(
        stream,
        parserForStream(stream, { SheetNames: 'Visible', Sheets: {} }),
      ),
    );
  });

  it('normalizes a revoked parser SheetNames array proxy', async () => {
    const stream = workbookStream();
    const { proxy, revoke } = Proxy.revocable<string[]>(['Visible'], {});
    const workbook = { SheetNames: proxy, Sheets: { Visible: {} } };
    revoke();

    await expectUnsupported(parseWith(stream, parserForStream(stream, workbook)));
  });

  it('rejects parser SheetNames that disagree with raw BoundSheet8 count', async () => {
    const stream = workbookStream();
    await expectUnsupported(
      parseWith(
        stream,
        parserForStream(stream, workbookFor(['Visible', 'Unexpected'])),
      ),
    );
  });

  it('normalizes a throwing parser SheetNames descriptor', async () => {
    const stream = workbookStream();
    const workbook = new Proxy(
      workbookFor(['Visible']),
      {
        getOwnPropertyDescriptor(target, property) {
          if (property === 'SheetNames') {
            throw new Error('private parser descriptor');
          }
          return Reflect.getOwnPropertyDescriptor(target, property);
        },
      },
    );

    await expectUnsupported(parseWith(stream, parserForStream(stream, workbook)));
  });
});
