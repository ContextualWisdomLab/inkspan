import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { crc32 } from 'node:zlib';

import {
  exportHangulDocument,
  openHangulDocument,
  type HangulDocumentEngine,
  type HangulEngineDocument,
} from './index.js';

const FIXTURES_DIR = join(process.cwd(), 'src/hangul/fixtures');
const BRIEFING_MINUTES_XML = readFileSync(
  join(FIXTURES_DIR, 'briefing-minutes.section.xml'),
  'utf8',
);
const UNSUPPORTED_SHAPE_XML = readFileSync(
  join(FIXTURES_DIR, 'unsupported-shape.section.xml'),
  'utf8',
);
const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();
const OLE_MAGIC = Uint8Array.from([
  0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
]);
const HWP_FIXTURE_MARKER = TEXT_ENCODER.encode('INKSPAN-HWP-FIXTURE\0');
const HWPX_MIME_TYPE = 'application/hwp+zip';
const HWPX_VERSION_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><ha:HWPML xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app"><ha:VERSION>1.0</ha:VERSION></ha:HWPML>';
const OWPML_SECTION_NAMESPACES =
  'xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph"';
const UNSUPPORTED_OWPML_BLOCKS = new Set([
  'rect',
  'line',
  'ellipse',
  'arc',
  'polygon',
  'curve',
  'equation',
  'chart',
  'pic',
  'ole',
  'btn',
  'video',
]);

const BRIEFING_MINUTES_JSON = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: 'Briefing Minutes' }],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'Attendees reviewed the quarterly status report.',
        },
      ],
    },
    {
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableHeader',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Topic Name' }],
                },
              ],
            },
            {
              type: 'tableHeader',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Owner Team' }],
                },
              ],
            },
          ],
        },
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableCell',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Budget Review' }],
                },
              ],
            },
            {
              type: 'tableCell',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Finance Team' }],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

/** Concatenate owned byte parts into one exact buffer. */
function concatBytes(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

/** Encode a little-endian unsigned 16-bit value. */
function encodeUint16(value: number): Uint8Array {
  const output = new Uint8Array(2);
  new DataView(output.buffer).setUint16(0, value, true);
  return output;
}

/** Encode a little-endian unsigned 32-bit value. */
function encodeUint32(value: number): Uint8Array {
  const output = new Uint8Array(4);
  new DataView(output.buffer).setUint32(0, value, true);
  return output;
}

/** Read a little-endian unsigned 16-bit value. */
function readUint16(source: Uint8Array, offset: number): number {
  return new DataView(source.buffer, source.byteOffset, source.byteLength).getUint16(
    offset,
    true,
  );
}

/** Read a little-endian unsigned 32-bit value. */
function readUint32(source: Uint8Array, offset: number): number {
  return new DataView(source.buffer, source.byteOffset, source.byteLength).getUint32(
    offset,
    true,
  );
}

/** Build an uncompressed ZIP container for a synthetic HWPX fixture. */
function buildZip(entries: readonly ZipEntry[]): Uint8Array {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = TEXT_ENCODER.encode(entry.name);
    const crc = crc32(entry.data) >>> 0;
    const local = concatBytes([
      encodeUint32(0x04034b50),
      encodeUint16(20),
      encodeUint16(0),
      encodeUint16(0),
      encodeUint16(0),
      encodeUint16(0),
      encodeUint32(crc),
      encodeUint32(entry.data.length),
      encodeUint32(entry.data.length),
      encodeUint16(name.length),
      encodeUint16(0),
      name,
      entry.data,
    ]);
    locals.push(local);
    centrals.push(
      concatBytes([
        encodeUint32(0x02014b50),
        encodeUint16(20),
        encodeUint16(20),
        encodeUint16(0),
        encodeUint16(0),
        encodeUint16(0),
        encodeUint16(0),
        encodeUint32(crc),
        encodeUint32(entry.data.length),
        encodeUint32(entry.data.length),
        encodeUint16(name.length),
        encodeUint16(0),
        encodeUint16(0),
        encodeUint16(0),
        encodeUint16(0),
        encodeUint32(0),
        encodeUint32(offset),
        name,
      ]),
    );
    offset += local.length;
  }
  const centralDirectory = concatBytes(centrals);
  return concatBytes([
    ...locals,
    centralDirectory,
    encodeUint32(0x06054b50),
    encodeUint16(0),
    encodeUint16(0),
    encodeUint16(entries.length),
    encodeUint16(entries.length),
    encodeUint32(centralDirectory.length),
    encodeUint32(offset),
    encodeUint16(0),
  ]);
}

/** Read uncompressed ZIP entries from a synthetic HWPX fixture. */
function readZip(source: Uint8Array): ZipEntry[] {
  if (source.length < 22 || readUint32(source, source.length - 22) !== 0x06054b50) {
    throw new Error('invalid hangul fixture');
  }
  const entryCount = readUint16(source, source.length - 12);
  let centralOffset = readUint32(source, source.length - 6);
  const entries: ZipEntry[] = [];
  for (let index = 0; index < entryCount; index += 1) {
    if (readUint32(source, centralOffset) !== 0x02014b50) {
      throw new Error('invalid hangul fixture');
    }
    const nameLength = readUint16(source, centralOffset + 28);
    const extraLength = readUint16(source, centralOffset + 30);
    const commentLength = readUint16(source, centralOffset + 32);
    const localOffset = readUint32(source, centralOffset + 42);
    const name = TEXT_DECODER.decode(
      source.subarray(centralOffset + 46, centralOffset + 46 + nameLength),
    );
    const localNameLength = readUint16(source, localOffset + 26);
    const localExtraLength = readUint16(source, localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const size = readUint32(source, localOffset + 18);
    entries.push({
      name,
      data: source.subarray(dataStart, dataStart + size),
    });
    centralOffset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/** Wrap one OWPML section as a synthetic HWPX ZIP container. */
function buildHwpxFixture(sectionXml: string): Uint8Array {
  return buildZip([
    { name: 'mimetype', data: TEXT_ENCODER.encode(HWPX_MIME_TYPE) },
    { name: 'version.xml', data: TEXT_ENCODER.encode(HWPX_VERSION_XML) },
    { name: 'Contents/section0.xml', data: TEXT_ENCODER.encode(sectionXml) },
  ]);
}

/** Wrap one OWPML section as a synthetic legacy HWP fixture container. */
function buildHwpFixture(sectionXml: string): Uint8Array {
  return concatBytes([
    OLE_MAGIC,
    HWP_FIXTURE_MARKER,
    TEXT_ENCODER.encode(sectionXml),
  ]);
}

/** Return whether the snapshot begins with the OLE compound-document magic. */
function hasOleMagic(source: Uint8Array): boolean {
  return (
    source.length >= OLE_MAGIC.length &&
    OLE_MAGIC.every((value, index) => source[index] === value)
  );
}

/** Extract the OWPML section from a synthetic HWP fixture. */
function readHwpSection(source: Uint8Array): string {
  const markerStart = OLE_MAGIC.length;
  const markerEnd = markerStart + HWP_FIXTURE_MARKER.length;
  const marker = source.subarray(markerStart, markerEnd);
  if (
    marker.length !== HWP_FIXTURE_MARKER.length ||
    HWP_FIXTURE_MARKER.some((value, index) => marker[index] !== value)
  ) {
    throw new Error('invalid hangul fixture');
  }
  return TEXT_DECODER.decode(source.subarray(markerEnd));
}

/** Extract the OWPML section from a synthetic HWPX ZIP fixture. */
function readHwpxSection(source: Uint8Array): string {
  const section = readZip(source).find((entry) => entry.name === 'Contents/section0.xml');
  if (section === undefined) {
    throw new Error('invalid hangul fixture');
  }
  return TEXT_DECODER.decode(section.data);
}

/** Escape text that will be placed into the HTML projection. */
function escapeHtml(value: string): string {
  return value.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;');
}

/** Read the significant text of one OWPML run without pretty-print whitespace. */
function runText(run: Element): string {
  return Array.from(run.children)
    .filter((child) => child.localName === 't')
    .map((text) => text.textContent ?? '')
    .join('');
}

/** Project OWPML inline runs into the HTML the public bridge already accepts. */
function projectRuns(paragraph: Element): string {
  return Array.from(paragraph.children)
    .filter((child) => child.localName === 'run')
    .map((run) => {
      const text = escapeHtml(runText(run));
      const charPr = run.getAttribute('charPrIDRef');
      if (charPr === 'bold') return `<strong>${text}</strong>`;
      if (charPr === 'italic') return `<em>${text}</em>`;
      if (charPr === 'strike') return `<s>${text}</s>`;
      return text;
    })
    .join('');
}

/** Collect significant run text from one OWPML paragraph. */
function runTextFromParagraph(paragraph: Element): string {
  return Array.from(paragraph.children)
    .filter((child) => child.localName === 'run')
    .map(runText)
    .join('');
}

/** Project one OWPML paragraph or heading. */
function projectParagraph(paragraph: Element): string {
  const heading = /^(?:heading-([1-6]))$/u.exec(
    paragraph.getAttribute('paraPrIDRef') ?? '',
  );
  const content = projectRuns(paragraph);
  if (heading) {
    return `<h${heading[1]}>${content}</h${heading[1]}>`;
  }
  return `<p>${content}</p>`;
}

/** Project one OWPML table into header/cell HTML topology. */
function projectTable(table: Element): string {
  const rows = Array.from(table.children)
    .filter((child) => child.localName === 'tr')
    .map((row) => {
      const cells = Array.from(row.children)
        .filter((child) => child.localName === 'tc')
        .map((cell) => {
          const tag = cell.getAttribute('header') === '1' ? 'th' : 'td';
          const paragraphs = Array.from(cell.getElementsByTagName('*')).filter(
            (child) => child.localName === 'p',
          );
          const text = paragraphs.map((paragraph) => runTextFromParagraph(paragraph)).join('');
          return `<${tag}>${escapeHtml(text)}</${tag}>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');
  return `<table>${rows}</table>`;
}

/** Project one top-level OWPML block, failing closed for unsupported structures. */
function projectBlock(element: Element): string {
  switch (element.localName) {
    case 'p':
      return projectParagraph(element);
    case 'tbl':
      return projectTable(element);
    default:
      if (UNSUPPORTED_OWPML_BLOCKS.has(element.localName)) {
        return `<aside>${escapeHtml(element.textContent ?? '')}</aside>`;
      }
      throw new Error('invalid hangul fixture');
  }
}

/** Project a committed OWPML section into the HTML the public bridge consumes. */
function projectSectionXml(sectionXml: string): string {
  const parsed = new DOMParser().parseFromString(sectionXml, 'application/xml');
  if (parsed.querySelector('parsererror')) {
    throw new Error('invalid hangul fixture');
  }
  return Array.from(parsed.documentElement.children).map(projectBlock).join('');
}

/** Render inline HTML back into OWPML runs. */
function htmlInlineToOwpml(parent: Element): string {
  return Array.from(parent.childNodes)
    .map((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent ?? '';
        return text === '' ? '' : `<hp:run><hp:t>${escapeHtml(text)}</hp:t></hp:run>`;
      }
      if (!(child instanceof Element)) return '';
      const tag = child.tagName.toLowerCase();
      const text = `<hp:t>${escapeHtml(child.textContent ?? '')}</hp:t>`;
      if (tag === 'strong' || tag === 'b') {
        return `<hp:run charPrIDRef="bold">${text}</hp:run>`;
      }
      if (tag === 'em' || tag === 'i') {
        return `<hp:run charPrIDRef="italic">${text}</hp:run>`;
      }
      if (tag === 's' || tag === 'strike') {
        return `<hp:run charPrIDRef="strike">${text}</hp:run>`;
      }
      if (tag === 'p') return htmlInlineToOwpml(child);
      throw new Error('invalid hangul fixture');
    })
    .join('');
}

/** Render one exported HTML block back into the fixture OWPML subset. */
function htmlBlockToOwpml(element: Element): string {
  const tag = element.tagName.toLowerCase();
  const heading = /^h([1-6])$/u.exec(tag);
  if (heading) {
    return `<hp:p paraPrIDRef="heading-${heading[1]}">${htmlInlineToOwpml(element)}</hp:p>`;
  }
  if (tag === 'p') {
    return `<hp:p>${htmlInlineToOwpml(element)}</hp:p>`;
  }
  if (tag === 'table') {
    const rows = Array.from((element as HTMLTableElement).rows)
      .map((row) => {
        const cells = Array.from(row.cells)
          .map((cell) => {
            const header = cell.tagName.toLowerCase() === 'th' ? ' header="1"' : '';
            return `<hp:tc${header}><hp:subList><hp:p>${htmlInlineToOwpml(cell)}</hp:p></hp:subList></hp:tc>`;
          })
          .join('');
        return `<hp:tr>${cells}</hp:tr>`;
      })
      .join('');
    return `<hp:tbl>${rows}</hp:tbl>`;
  }
  throw new Error('invalid hangul fixture');
}

/** Convert pasted bridge HTML back into a fixture OWPML section. */
function htmlToSectionXml(html: string): string {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const body = Array.from(parsed.body.children).map(htmlBlockToOwpml).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><hs:sec ${OWPML_SECTION_NAMESPACES}>${body}</hs:sec>`;
}

class FixtureDocument implements HangulEngineDocument {
  freed = false;
  private readonly sourceFormat: 'hwp' | 'hwpx';
  private readonly selectionHtml: string;
  private pastedHtml = '';

  constructor(sourceFormat: 'hwp' | 'hwpx', selectionHtml: string) {
    this.sourceFormat = sourceFormat;
    this.selectionHtml = selectionHtml;
  }

  static fromSource(source: Uint8Array): FixtureDocument {
    if (hasOleMagic(source)) {
      return new FixtureDocument('hwp', projectSectionXml(readHwpSection(source)));
    }
    if (source.length >= 4 && readUint32(source, 0) === 0x04034b50) {
      return new FixtureDocument('hwpx', projectSectionXml(readHwpxSection(source)));
    }
    throw new Error('invalid hangul fixture');
  }

  static createEmpty(format: 'hwp' | 'hwpx'): FixtureDocument {
    return new FixtureDocument(format, '');
  }

  getSourceFormat(): string {
    return this.sourceFormat;
  }

  getSectionCount(): number {
    return 1;
  }

  getParagraphCount(): number {
    return this.selectionHtml === '' && this.pastedHtml === '' ? 0 : 1;
  }

  getParagraphLength(): number {
    return 0;
  }

  exportSelectionHtml(): string {
    return this.selectionHtml;
  }

  deleteText(): string {
    return '{"ok":true}';
  }

  pasteHtml(
    _sectionIndex: number,
    _paragraphIndex: number,
    _charOffset: number,
    html: string,
  ): string {
    this.pastedHtml = html;
    return '{"ok":true}';
  }

  exportHwp(): Uint8Array {
    return buildHwpFixture(htmlToSectionXml(this.pastedHtml));
  }

  exportHwpx(): Uint8Array {
    return buildHwpxFixture(htmlToSectionXml(this.pastedHtml));
  }

  free(): void {
    this.freed = true;
  }
}

/** Create a host-injected engine that only understands committed synthetic fixtures. */
function createFixtureEngine(): HangulDocumentEngine & {
  lastOpened?: FixtureDocument;
} {
  const engine: HangulDocumentEngine & { lastOpened?: FixtureDocument } = {
    id: 'hangul-fixture-engine',
    open: async (source) => {
      const opened = FixtureDocument.fromSource(source);
      engine.lastOpened = opened;
      return opened;
    },
    create: async () => FixtureDocument.createEmpty('hwpx'),
  };
  return engine;
}

describe('Hangul realistic document fixtures', () => {
  it('projects the known HWPX briefing document into the expected paragraphs and table', async () => {
    const engine = createFixtureEngine();
    const result = await openHangulDocument(buildHwpxFixture(BRIEFING_MINUTES_XML), {
      engine,
    });

    expect(result.sourceFormat).toBe('hwpx');
    expect(result.documentJson).toEqual(BRIEFING_MINUTES_JSON);
    expect(result.lossy).toBe(false);
    expect(engine.lastOpened?.freed).toBe(true);
  });

  it('projects the known HWP briefing document into the same paragraphs and table', async () => {
    const result = await openHangulDocument(buildHwpFixture(BRIEFING_MINUTES_XML), {
      engine: createFixtureEngine(),
    });

    expect(result.sourceFormat).toBe('hwp');
    expect(result.documentJson).toEqual(BRIEFING_MINUTES_JSON);
  });

  it('reopens exported HWPX and HWP bytes as the same semantic document', async () => {
    const engine = createFixtureEngine();
    const hwpx = await exportHangulDocument(BRIEFING_MINUTES_JSON, {
      engine,
      format: 'hwpx',
    });
    const hwp = await exportHangulDocument(BRIEFING_MINUTES_JSON, {
      engine,
      format: 'hwp',
    });

    expect(hwpx.format).toBe('hwpx');
    expect(hwp.format).toBe('hwp');
    expect(hwpx.bytes[0]).toBe(0x50);
    expect(hwp.bytes[0]).toBe(0xd0);

    const reopenedHwpx = await openHangulDocument(hwpx.bytes, { engine });
    const reopenedHwp = await openHangulDocument(hwp.bytes, { engine });
    expect(reopenedHwpx.documentJson).toEqual(BRIEFING_MINUTES_JSON);
    expect(reopenedHwp.documentJson).toEqual(BRIEFING_MINUTES_JSON);
  });

  it('fails closed on an HWPX shape instead of keeping the surrounding paragraph', async () => {
    const privateText = 'tenant-secret-shape';
    let caught: unknown;

    try {
      await openHangulDocument(buildHwpxFixture(UNSUPPORTED_SHAPE_XML), {
        engine: createFixtureEngine(),
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toMatchObject({
      name: 'HangulDocumentError',
      code: 'UNSUPPORTED_DOCUMENT_NODE',
      message: 'Hangul import contains an unsupported block node.',
    });
    expect((caught as Error).message).not.toContain(privateText);
    expect((caught as Error).message).not.toContain('Opening Remarks');
  });

  it('fails closed on a legacy HWP shape without reflecting fixture text', async () => {
    const privateText = 'tenant-secret-shape';
    let caught: unknown;

    try {
      await openHangulDocument(buildHwpFixture(UNSUPPORTED_SHAPE_XML), {
        engine: createFixtureEngine(),
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toMatchObject({
      code: 'UNSUPPORTED_DOCUMENT_NODE',
      message: 'Hangul import contains an unsupported block node.',
    });
    expect((caught as Error).message).not.toContain(privateText);
  });

  it('fails closed on bytes that are not a known HWP or HWPX fixture', async () => {
    await expect(
      openHangulDocument(new Uint8Array([0, 1, 2, 3]), {
        engine: createFixtureEngine(),
      }),
    ).rejects.toMatchObject({
      code: 'ENGINE_OPEN_FAILED',
      message: 'The Hangul engine could not open the document.',
    });
  });
});
