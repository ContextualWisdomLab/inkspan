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

/** Structural content kinds the bounded Hangul bridge currently round-trips. */
export type HangulSupportedContent =
  | 'paragraph'
  | 'heading'
  | 'bold'
  | 'italic'
  | 'strike'
  | 'bulletList'
  | 'orderedList'
  | 'blockquote'
  | 'codeBlock'
  | 'table';

/** Deterministic host-visible capability metadata for the bounded Hangul bridge. */
export interface HangulDocumentCapabilities {
  readonly importFormats: readonly ('hwp' | 'hwpx')[];
  readonly exportFormats: readonly ('hwpx' | 'hwp')[];
  readonly recommendedExportFormat: 'hwpx';
  readonly supportedContent: readonly HangulSupportedContent[];
}

export interface HangulDocumentImportResult {
  sourceFormat: 'hwp' | 'hwpx';
  documentJson: Readonly<HangulDocumentJson>;
  warnings: readonly string[];
  lossy: boolean;
  capabilities: HangulDocumentCapabilities;
}

export interface HangulDocumentExportResult {
  format: 'hwp' | 'hwpx';
  bytes: Uint8Array;
  warnings: readonly string[];
}

const HANGUL_DOCUMENT_CAPABILITIES: HangulDocumentCapabilities = Object.freeze({
  importFormats: Object.freeze(['hwp', 'hwpx'] as const),
  exportFormats: Object.freeze(['hwpx', 'hwp'] as const),
  recommendedExportFormat: 'hwpx',
  supportedContent: Object.freeze([
    'paragraph',
    'heading',
    'bold',
    'italic',
    'strike',
    'bulletList',
    'orderedList',
    'blockquote',
    'codeBlock',
    'table',
  ] as const),
});

/** Module-owned identity brand that never reflects over untrusted thrown values. */
const HANGUL_DOCUMENT_ERRORS = new WeakSet<object>();

/** Stable error type for unsupported or unsafe conversion states. */
export class HangulDocumentError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'HangulDocumentError';
    HANGUL_DOCUMENT_ERRORS.add(this);
  }
}

/** Return whether a thrown value was created by this module without prototype traversal. */
function isHangulDocumentError(error: unknown): error is HangulDocumentError {
  return HANGUL_DOCUMENT_ERRORS.has(error as object);
}

/** Read a public Hangul option without allowing hostile accessors to leak values. */
function readHangulOption<T>(read: () => T): T {
  try {
    return read();
  } catch {
    throw new HangulDocumentError(
      'INVALID_CONFIGURATION',
      'Hangul options are invalid.',
    );
  }
}

/** Contain host cleanup failures without replacing an existing Inkspan failure. */
function freeHangulDocument(
  document: HangulEngineDocument,
  primaryError: HangulDocumentError | undefined,
): void {
  try {
    document.free?.();
  } catch {
    if (primaryError === undefined) {
      throw new HangulDocumentError(
        'ENGINE_CLEANUP_FAILED',
        'The Hangul engine failed during cleanup.',
      );
    }
  }
}

const TEXT_ALIGNMENTS = new Set(['left', 'center', 'right', 'justify']);
const DEFAULT_MAX_DOCUMENT_BYTES = 64 * 1024 * 1024;
const HANGUL_IMPORT_FAILURE_MESSAGE = 'The Hangul engine failed during import.';
const HANGUL_EXPORT_FAILURE_MESSAGE = 'The Hangul engine failed during export.';
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(
  Uint8Array.prototype,
) as object;
const TYPED_ARRAY_BUFFER_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  'buffer',
)!.get!;
const TYPED_ARRAY_BYTE_OFFSET_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  'byteOffset',
)!.get!;
const TYPED_ARRAY_BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  'byteLength',
)!.get!;

/** Resolve a public runtime byte ceiling without coercion or fail-open numeric values. */
function resolveHangulByteLimit(limit: number | undefined): number {
  const resolved = limit ?? DEFAULT_MAX_DOCUMENT_BYTES;
  if (!Number.isSafeInteger(resolved) || resolved < 0) {
    throw new HangulDocumentError(
      'INVALID_CONFIGURATION',
      'Hangul byte limit configuration is invalid.',
    );
  }
  return resolved;
}

/** Validate host-engine traversal metadata before using it as an index or bound. */
function resolveHangulEngineCount(value: number, failureMessage: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new HangulDocumentError('ENGINE_OPERATION_FAILED', failureMessage);
  }
  return value;
}

/** Validate host-engine text before caller member access or coercion. */
function resolveHangulEngineString(value: unknown, failureMessage: string): string {
  if (typeof value !== 'string') {
    throw new HangulDocumentError('ENGINE_OPERATION_FAILED', failureMessage);
  }
  return value;
}

/** Validate the runtime export selector before the host engine receives authority. */
function resolveHangulExportFormat(format: unknown): 'hwp' | 'hwpx' {
  const resolved = format === undefined ? 'hwpx' : format;
  if (resolved !== 'hwp' && resolved !== 'hwpx') {
    throw new HangulDocumentError(
      'INVALID_CONFIGURATION',
      'Hangul export format is invalid.',
    );
  }
  return resolved;
}

/** Copy one genuine Uint8Array into an Inkspan-owned immutable import snapshot. */
function snapshotHangulSource(source: Uint8Array, maxSourceBytes: number): Uint8Array {
  let buffer: ArrayBufferLike;
  let byteOffset: number;
  let byteLength: number;
  try {
    buffer = TYPED_ARRAY_BUFFER_GETTER.call(source) as ArrayBufferLike;
    byteOffset = TYPED_ARRAY_BYTE_OFFSET_GETTER.call(source) as number;
    byteLength = TYPED_ARRAY_BYTE_LENGTH_GETTER.call(source) as number;
  } catch {
    throw new HangulDocumentError(
      'INVALID_SOURCE',
      'Hangul source bytes are invalid.',
    );
  }

  if (!(buffer instanceof ArrayBuffer)) {
    throw new HangulDocumentError(
      'INVALID_SOURCE',
      'Hangul source bytes are invalid.',
    );
  }
  if (byteLength > maxSourceBytes) {
    throw new HangulDocumentError(
      'SOURCE_LIMIT_EXCEEDED',
      'Hangul source exceeds the configured limit.',
    );
  }

  const snapshot = new Uint8Array(byteLength);
  snapshot.set(new Uint8Array(buffer, byteOffset, byteLength));
  return snapshot;
}

/** Copy genuine host-engine bytes into an Inkspan-owned immutable export snapshot. */
function snapshotHangulOutput(source: Uint8Array, maxOutputBytes: number): Uint8Array {
  let buffer: ArrayBufferLike;
  let byteOffset: number;
  let byteLength: number;
  try {
    buffer = TYPED_ARRAY_BUFFER_GETTER.call(source) as ArrayBufferLike;
    byteOffset = TYPED_ARRAY_BYTE_OFFSET_GETTER.call(source) as number;
    byteLength = TYPED_ARRAY_BYTE_LENGTH_GETTER.call(source) as number;
  } catch {
    throw new HangulDocumentError(
      'ENGINE_OPERATION_FAILED',
      HANGUL_EXPORT_FAILURE_MESSAGE,
    );
  }

  if (!(buffer instanceof ArrayBuffer)) {
    throw new HangulDocumentError(
      'ENGINE_OPERATION_FAILED',
      HANGUL_EXPORT_FAILURE_MESSAGE,
    );
  }
  if (byteLength > maxOutputBytes) {
    throw new HangulDocumentError(
      'OUTPUT_LIMIT_EXCEEDED',
      'Hangul export exceeds the configured limit.',
    );
  }

  const snapshot = new Uint8Array(byteLength);
  snapshot.set(new Uint8Array(buffer, byteOffset, byteLength));
  return snapshot;
}

function parseInline(parent: ParentNode, marks: HangulDocumentMark[] = []): HangulDocumentJson[] {
  const output: HangulDocumentJson[] = [];
  for (const child of Array.from(parent.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent ?? '';
      if (text) output.push({ type: 'text', text, ...(marks.length ? { marks } : {}) });
    } else if (child instanceof Element) {
      const tag = child.tagName.toLowerCase();
      if (tag === 'span') {
        output.push(...parseInline(child, marks));
        continue;
      }
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

function isListBlockElement(element: Element): boolean {
  const tag = element.tagName.toLowerCase();
  return (
    /^h[1-6]$/u.test(tag) ||
    tag === 'ul' ||
    tag === 'ol' ||
    tag === 'blockquote' ||
    tag === 'pre' ||
    tag === 'table' ||
    tag === 'p'
  );
}

function parseListItem(item: Element): HangulDocumentJson {
  const blockChildren = Array.from(item.children).filter(isListBlockElement);
  if (blockChildren.length === 0) {
    return {
      type: 'listItem',
      content: [{ type: 'paragraph', content: parseInline(item) }],
    };
  }

  const hasDirectInlineContent = Array.from(item.childNodes).some((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      return (child as Text).data.trim().length > 0;
    }
    return child instanceof Element && !isListBlockElement(child);
  });
  if (hasDirectInlineContent || blockChildren.length !== item.children.length) {
    throw new HangulDocumentError(
      'UNSUPPORTED_DOCUMENT_NODE',
      'Hangul import contains an unsupported block node.',
    );
  }

  return {
    type: 'listItem',
    content: blockChildren.map(parseBlock),
  };
}

function parseList(element: Element, type: 'bulletList' | 'orderedList'): HangulDocumentJson {
  return {
    type,
    content: Array.from(element.children).map(parseListItem),
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

/** Render caller-provided document JSON without allowing hostile access failures to escape. */
function renderHangulDocumentJson(documentJson: HangulDocumentJson): string {
  try {
    return jsonToHtml(documentJson);
  } catch (error) {
    if (isHangulDocumentError(error)) throw error;
    throw new HangulDocumentError(
      'INVALID_DOCUMENT',
      'Hangul document JSON is invalid.',
    );
  }
}

/** Project HWP/HWPX bytes into the editor's JSON model. */
export async function openHangulDocument(source: Uint8Array, options: OpenHangulDocumentOptions): Promise<HangulDocumentImportResult> {
  const engine = readHangulOption(() => options.engine);
  const maxSourceBytes = resolveHangulByteLimit(
    readHangulOption(() => options.maxSourceBytes),
  );
  const sourceSnapshot = snapshotHangulSource(source, maxSourceBytes);
  let document: HangulEngineDocument;
  try { document = await engine.open(sourceSnapshot); } catch { throw new HangulDocumentError('ENGINE_OPEN_FAILED', 'The Hangul engine could not open the document.'); }
  let primaryError: HangulDocumentError | undefined;
  try {
    try {
      const sourceFormat = resolveHangulEngineString(
        document.getSourceFormat(),
        HANGUL_IMPORT_FAILURE_MESSAGE,
      ).toLowerCase();
      if (sourceFormat !== 'hwp' && sourceFormat !== 'hwpx') throw new HangulDocumentError('UNSUPPORTED_SOURCE_FORMAT', 'Unsupported Hangul source format.');
      const html: string[] = [];
      const sectionCount = resolveHangulEngineCount(
        document.getSectionCount(),
        HANGUL_IMPORT_FAILURE_MESSAGE,
      );
      for (let section = 0; section < sectionCount; section += 1) {
        const count = resolveHangulEngineCount(
          document.getParagraphCount(section),
          HANGUL_IMPORT_FAILURE_MESSAGE,
        );
        if (count > 0) {
          const paragraphLength = resolveHangulEngineCount(
            document.getParagraphLength(section, count - 1),
            HANGUL_IMPORT_FAILURE_MESSAGE,
          );
          html.push(
            resolveHangulEngineString(
              document.exportSelectionHtml(
                section,
                0,
                0,
                count - 1,
                paragraphLength,
              ),
              HANGUL_IMPORT_FAILURE_MESSAGE,
            ),
          );
        }
      }
      const documentJson = htmlToJson(html.join(''));
      Object.freeze(documentJson);
      return {
        sourceFormat,
        documentJson,
        warnings: Object.freeze([]),
        lossy: false,
        capabilities: HANGUL_DOCUMENT_CAPABILITIES,
      };
    } catch (error) {
      primaryError = isHangulDocumentError(error)
        ? error
        : new HangulDocumentError(
            'ENGINE_OPERATION_FAILED',
            HANGUL_IMPORT_FAILURE_MESSAGE,
          );
      throw primaryError;
    }
  } finally {
    freeHangulDocument(document, primaryError);
  }
}

/** Export edited Inkspan JSON as HWPX by default or HWP explicitly. */
export async function exportHangulDocument(documentJson: HangulDocumentJson, options: ExportHangulDocumentOptions): Promise<HangulDocumentExportResult> {
  const engine = readHangulOption(() => options.engine);
  const maxOutputBytes = resolveHangulByteLimit(
    readHangulOption(() => options.maxOutputBytes),
  );
  const format = resolveHangulExportFormat(
    readHangulOption(() => options.format),
  );
  const html = renderHangulDocumentJson(documentJson);
  let document: HangulEngineDocument;
  try { document = await engine.create(); } catch { throw new HangulDocumentError('ENGINE_CREATE_FAILED', 'The Hangul engine could not create a document.'); }
  let primaryError: HangulDocumentError | undefined;
  try {
    try {
      document.createBlankDocument?.();
      document.beginBatch?.();
      const length = resolveHangulEngineCount(
        document.getParagraphLength(0, 0),
        HANGUL_EXPORT_FAILURE_MESSAGE,
      );
      if (length > 0) document.deleteText(0, 0, 0, length);
      document.pasteHtml(0, 0, 0, html);
      document.endBatch?.();
      const engineBytes = format === 'hwp' ? document.exportHwp() : document.exportHwpx();
      const bytes = snapshotHangulOutput(engineBytes, maxOutputBytes);
      return { format, bytes, warnings: Object.freeze([]) };
    } catch (error) {
      primaryError = isHangulDocumentError(error)
        ? error
        : new HangulDocumentError(
            'ENGINE_OPERATION_FAILED',
            HANGUL_EXPORT_FAILURE_MESSAGE,
          );
      throw primaryError;
    }
  } finally {
    freeHangulDocument(document, primaryError);
  }
}