/** Framework-neutral structural document JSON used at the Hangul package boundary. */
interface HangulDocumentMark {
  type?: string;
  attrs?: Record<string, unknown>;
}

/** Framework-neutral structural document JSON used at the Hangul package boundary. */
interface HangulDocumentJson {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: HangulDocumentJson[];
  marks?: HangulDocumentMark[];
  text?: string;
}

/** A Hangul document opened by a host-provided parser/serializer. */
export interface HangulEngineDocument {
  getSourceFormat(): string;
  getSectionCount(): number;
  getParagraphCount(sectionIndex: number): number;
  getParagraphLength(sectionIndex: number, paragraphIndex: number): number;
  exportSelectionHtml(sectionIndex: number, startParagraphIndex: number, startCharOffset: number, endParagraphIndex: number, endCharOffset: number): string;
  createBlankDocument?(): string;
  beginBatch?(): string;
  endBatch?(): string;
  deleteText(sectionIndex: number, paragraphIndex: number, charOffset: number, count: number): string;
  pasteHtml(sectionIndex: number, paragraphIndex: number, charOffset: number, html: string): string;
  exportHwp(): Uint8Array;
  exportHwpx(): Uint8Array;
  free?(): void;
}

/** Host-owned engine boundary so Inkspan never acquires filesystem or network authority. */
export interface HangulDocumentEngine {
  readonly id: string;
  open(source: Uint8Array): HangulEngineDocument | Promise<HangulEngineDocument>;
  create(): HangulEngineDocument | Promise<HangulEngineDocument>;
}

export interface OpenHangulDocumentOptions {
  engine: HangulDocumentEngine;
  maxSourceBytes?: number;
}

export interface ExportHangulDocumentOptions {
  engine: HangulDocumentEngine;
  format?: 'hwp' | 'hwpx';
  maxOutputBytes?: number;
}

export interface HangulDocumentImportResult {
  sourceFormat: 'hwp' | 'hwpx';
  documentJson: Readonly<HangulDocumentJson>;
  warnings: readonly string[];
  lossy: boolean;
}

export interface HangulDocumentExportResult {
  format: 'hwp' | 'hwpx';
  bytes: Uint8Array;
  warnings: readonly string[];
}

/** Stable error type for unsupported or unsafe conversion states. */
export class HangulDocumentError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'HangulDocumentError';
  }
}

const TEXT_ALIGNMENTS = new Set(['left', 'center', 'right', 'justify']);

function parseInline(parent: ParentNode, marks: HangulDocumentMark[] = []): HangulDocumentJson[] {
  const output: HangulDocumentJson[] = [];
  for (const child of Array.from(parent.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent ?? '';
      if (text) output.push({ type: 'text', text, ...(marks.length ? { marks } : {}) });
    } else if (child instanceof Element) {
      const tag = child.tagName.toLowerCase();
      let mark: HangulDocumentMark;
      if (tag === 'strong' || tag === 'b') mark = { type: 'bold' };
      else if (tag === 'em' || tag === 'i') mark = { type: 'italic' };
      else if (tag === 's' || tag === 'strike') mark = { type: 'strike' };
      else {
        throw new HangulDocumentError(
          'UNSUPPORTED_DOCUMENT_MARK',
          'Hangul import contains an unsupported inline mark.',
        );
      }
      output.push(...parseInline(child, [...marks, mark]));
    }
  }
  return output;
}

function readTextAlignment(element: Element): string | undefined {
  const style = Reflect.get(element, 'style') as { textAlign?: unknown } | undefined;
  const textAlign = style?.textAlign;
  return typeof textAlign === 'string' && TEXT_ALIGNMENTS.has(textAlign)
    ? textAlign
    : undefined;
}

function parseParagraph(element: Element): HangulDocumentJson {
  const textAlign = readTextAlignment(element);
  const content = parseInline(element);
  return textAlign === undefined
    ? { type: 'paragraph', content }
    : { type: 'paragraph', attrs: { textAlign }, content };
}

function parseList(element: Element, type: 'bulletList' | 'orderedList'): HangulDocumentJson {
  return {
    type,
    content: Array.from(element.children).map((item) => ({
      type: 'listItem',
      content: Array.from(item.children).map(parseBlock),
    })),
  };
}

function parseTable(element: Element): HangulDocumentJson {
  return {
    type: 'table',
    content: Array.from((element as HTMLTableElement).rows).map((row) => ({
      type: 'tableRow',
      content: Array.from(row.cells).map((cell) => ({
        type: cell.tagName.toLowerCase() === 'th' ? 'tableHeader' : 'tableCell',
        content: [{ type: 'paragraph', content: parseInline(cell) }],
      })),
    })),
  };
}

function parseBlock(element: Element): HangulDocumentJson {
  const tag = element.tagName.toLowerCase();
  if (/^h[1-6]$/u.test(tag)) {
    return {
      type: 'heading',
      attrs: { level: Number(tag.slice(1)) },
      content: parseInline(element),
    };
  }
  if (tag === 'ul') return parseList(element, 'bulletList');
  if (tag === 'ol') return parseList(element, 'orderedList');
  if (tag === 'blockquote') {
    return { type: 'blockquote', content: Array.from(element.children).map(parseBlock) };
  }
  if (tag === 'pre') {
    return { type: 'codeBlock', content: [{ type: 'text', text: element.textContent as string }] };
  }
  if (tag === 'table') return parseTable(element);
  if (tag === 'p') return parseParagraph(element);
  throw new HangulDocumentError(
    'UNSUPPORTED_DOCUMENT_NODE',
    'Hangul import contains an unsupported block node.',
  );
}

function htmlToJson(html: string): HangulDocumentJson {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  return {
    type: 'doc',
    content: Array.from(parsed.body.children).map(parseBlock),
  };
}

function escapeHtml(value: string): string {
  return value.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;');
}

function renderInline(node: HangulDocumentJson): string {
  if (node.type !== 'text') throw new HangulDocumentError('UNSUPPORTED_DOCUMENT_NODE', 'Only text inline nodes are currently exportable.');
  let value = escapeHtml(node.text ?? '');
  for (const mark of node.marks ?? []) {
    if (mark.type === 'bold') value = `<strong>${value}</strong>`;
    else if (mark.type === 'italic') value = `<em>${value}</em>`;
    else if (mark.type === 'strike') value = `<s>${value}</s>`;
    else throw new HangulDocumentError('UNSUPPORTED_DOCUMENT_MARK', 'Hangul export contains an unsupported inline mark.');
  }
  return value;
}

function contentOf(node: HangulDocumentJson): HangulDocumentJson[] {
  return node.content ?? [];
}

function paragraphStyle(node: HangulDocumentJson): string {
  const textAlign = node.attrs?.textAlign;
  return typeof textAlign === 'string' && TEXT_ALIGNMENTS.has(textAlign)
    ? ` style="text-align: ${textAlign}"`
    : '';
}

function renderBlock(node: HangulDocumentJson): string {
  if (node.type === 'paragraph') {
    return `<p${paragraphStyle(node)}>${contentOf(node).map(renderInline).join('')}</p>`;
  }
  if (node.type === 'heading') {
    const level = Number(node.attrs?.level);
    if (!Number.isInteger(level) || level < 1 || level > 6) throw new HangulDocumentError('UNSUPPORTED_DOCUMENT_NODE', 'Invalid heading level.');
    return `<h${level}>${contentOf(node).map(renderInline).join('')}</h${level}>`;
  }
  if (node.type === 'bulletList' || node.type === 'orderedList') {
    const tag = node.type === 'bulletList' ? 'ul' : 'ol';
    return `<${tag}>${contentOf(node).map(renderBlock).join('')}</${tag}>`;
  }
  if (node.type === 'listItem') {
    return `<li>${contentOf(node).map(renderBlock).join('')}</li>`;
  }
  if (node.type === 'blockquote') {
    return `<blockquote>${contentOf(node).map(renderBlock).join('')}</blockquote>`;
  }
  if (node.type === 'codeBlock') {
    return `<pre><code>${contentOf(node).map(renderInline).join('')}</code></pre>`;
  }
  if (node.type === 'table') {
    return `<table>${contentOf(node).map(renderBlock).join('')}</table>`;
  }
  if (node.type === 'tableRow') {
    return `<tr>${contentOf(node).map(renderBlock).join('')}</tr>`;
  }
  if (node.type === 'tableHeader') {
    return `<th>${contentOf(node).map(renderBlock).join('')}</th>`;
  }
  if (node.type === 'tableCell') {
    return `<td>${contentOf(node).map(renderBlock).join('')}</td>`;
  }
  throw new HangulDocumentError('UNSUPPORTED_DOCUMENT_NODE', 'Hangul export contains an unsupported block node.');
}

function jsonToHtml(documentJson: HangulDocumentJson): string {
  if (documentJson.type !== 'doc') throw new HangulDocumentError('UNSUPPORTED_DOCUMENT_NODE', 'Hangul export requires a doc root.');
  return contentOf(documentJson).map(renderBlock).join('');
}

/** Project HWP/HWPX bytes into the editor's JSON model. */
export async function openHangulDocument(source: Uint8Array, options: OpenHangulDocumentOptions): Promise<HangulDocumentImportResult> {
  if (source.byteLength > (options.maxSourceBytes ?? 64 * 1024 * 1024)) throw new HangulDocumentError('SOURCE_LIMIT_EXCEEDED', 'Hangul source exceeds the configured limit.');
  let document: HangulEngineDocument;
  try { document = await options.engine.open(source); } catch { throw new HangulDocumentError('ENGINE_OPEN_FAILED', 'The Hangul engine could not open the document.'); }
  try {
    const sourceFormat = document.getSourceFormat().toLowerCase();
    if (sourceFormat !== 'hwp' && sourceFormat !== 'hwpx') throw new HangulDocumentError('UNSUPPORTED_SOURCE_FORMAT', 'Unsupported Hangul source format.');
    const html: string[] = [];
    for (let section = 0; section < document.getSectionCount(); section += 1) {
      const count = document.getParagraphCount(section);
      if (count > 0) html.push(document.exportSelectionHtml(section, 0, 0, count - 1, document.getParagraphLength(section, count - 1)));
    }
    const documentJson = htmlToJson(html.join(''));
    Object.freeze(documentJson);
    return { sourceFormat, documentJson, warnings: Object.freeze([]), lossy: false };
  } finally { document.free?.(); }
}

/** Export edited Inkspan JSON as HWPX by default or HWP explicitly. */
export async function exportHangulDocument(documentJson: HangulDocumentJson, options: ExportHangulDocumentOptions): Promise<HangulDocumentExportResult> {
  const format = options.format ?? 'hwpx';
  const html = jsonToHtml(documentJson);
  let document: HangulEngineDocument;
  try { document = await options.engine.create(); } catch { throw new HangulDocumentError('ENGINE_CREATE_FAILED', 'The Hangul engine could not create a document.'); }
  try {
    try {
      document.createBlankDocument?.();
      document.beginBatch?.();
      const length = document.getParagraphLength(0, 0);
      if (length > 0) document.deleteText(0, 0, 0, length);
      document.pasteHtml(0, 0, 0, html);
      document.endBatch?.();
      const bytes = format === 'hwp' ? document.exportHwp() : document.exportHwpx();
      if (bytes.byteLength > (options.maxOutputBytes ?? 64 * 1024 * 1024)) throw new HangulDocumentError('OUTPUT_LIMIT_EXCEEDED', 'Hangul export exceeds the configured limit.');
      return { format, bytes, warnings: Object.freeze([]) };
    } catch (error) {
      if (error instanceof HangulDocumentError) throw error;
      throw new HangulDocumentError('ENGINE_OPERATION_FAILED', 'The Hangul engine failed during export.');
    }
  } finally { document.free?.(); }
}
