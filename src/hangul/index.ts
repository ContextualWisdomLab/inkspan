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

function parseInline(parent: ParentNode, marks: HangulDocumentMark[] = []): HangulDocumentJson[] {
  const output: HangulDocumentJson[] = [];
  for (const child of Array.from(parent.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent ?? '';
      if (text) output.push({ type: 'text', text, ...(marks.length ? { marks } : {}) });
    } else if (child instanceof Element) {
      const tag = child.tagName.toLowerCase();
      const next = tag === 'strong' || tag === 'b'
        ? [...marks, { type: 'bold' }]
        : tag === 'em' || tag === 'i'
          ? [...marks, { type: 'italic' }]
          : tag === 's' || tag === 'strike'
            ? [...marks, { type: 'strike' }]
            : marks;
      output.push(...parseInline(child, next));
    }
  }
  return output;
}

function htmlToJson(html: string): HangulDocumentJson {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  return {
    type: 'doc',
    content: Array.from(parsed.body.children).map((element) => {
      const tag = element.tagName.toLowerCase();
      const content = parseInline(element);
      return /^h[1-6]$/u.test(tag)
        ? { type: 'heading', attrs: { level: Number(tag.slice(1)) }, content }
        : { type: 'paragraph', content };
    }),
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
    else throw new HangulDocumentError('UNSUPPORTED_DOCUMENT_MARK', `Unsupported mark: ${mark.type ?? '<missing>'}.`);
  }
  return value;
}

function jsonToHtml(documentJson: HangulDocumentJson): string {
  if (documentJson.type !== 'doc') throw new HangulDocumentError('UNSUPPORTED_DOCUMENT_NODE', 'Hangul export requires a doc root.');
  return (documentJson.content ?? []).map((node) => {
    const body = (node.content ?? []).map(renderInline).join('');
    if (node.type === 'paragraph') return `<p>${body}</p>`;
    if (node.type === 'heading') {
      const level = Number(node.attrs?.level);
      if (!Number.isInteger(level) || level < 1 || level > 6) throw new HangulDocumentError('UNSUPPORTED_DOCUMENT_NODE', 'Invalid heading level.');
      return `<h${level}>${body}</h${level}>`;
    }
    throw new HangulDocumentError('UNSUPPORTED_DOCUMENT_NODE', `Unsupported block: ${node.type ?? '<missing>'}.`);
  }).join('');
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
