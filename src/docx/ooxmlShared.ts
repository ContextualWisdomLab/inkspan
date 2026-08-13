import { DocxImportError } from './errors.js';
import type {
  DocxImportLimits,
  DocxImportWarning,
  DocxImportWarningCode,
  DocxJsonContent,
  DocxJsonMark,
} from './types.js';
import {
  attribute,
  childElements,
  descendantElements,
  type XmlElement,
} from './xml.js';
import { ZipArchive } from './zip.js';

export const DOCUMENT_PATH = 'word/document.xml';
export const WORD_NAMESPACES = new Set([
  'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
  'http://purl.oclc.org/ooxml/wordprocessingml/main',
]);
export const OFFICE_RELATIONSHIP_NAMESPACES = new Set([
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  'http://purl.oclc.org/ooxml/officeDocument/relationships',
]);
export const DRAWING_NAMESPACES = new Set([
  'http://schemas.openxmlformats.org/drawingml/2006/main',
  'http://purl.oclc.org/ooxml/drawingml/main',
]);
export const WORDPROCESSING_DRAWING_NAMESPACES = new Set([
  'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
  'http://purl.oclc.org/ooxml/drawingml/wordprocessingDrawing',
]);
export const HYPERLINK_RELATIONSHIP_TYPES = new Set([
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink',
  'http://purl.oclc.org/ooxml/officeDocument/relationships/hyperlink',
]);
export const IMAGE_RELATIONSHIP_TYPES = new Set([
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
  'http://purl.oclc.org/ooxml/officeDocument/relationships/image',
]);
export const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
]);
export const MAX_IMAGE_ALT_CODE_UNITS = 1_000;

export interface Relationship {
  readonly type: string;
  readonly target: string;
  readonly targetMode?: string;
}

export interface ListDescriptor {
  readonly key: string;
  readonly kind: 'bulletList' | 'orderedList';
  readonly start: number;
}

export interface ParagraphResult {
  readonly blocks: DocxJsonContent[];
  readonly list?: ListDescriptor;
}

export interface InlineTextPart {
  readonly kind: 'inline';
  readonly node: DocxJsonContent;
}

export interface InlineImagePart {
  readonly kind: 'image';
  readonly node: DocxJsonContent;
}

export type InlinePart = InlineTextPart | InlineImagePart;

/** Count and deduplicate payload-free lossy-import warnings. */
export class WarningCollector {
  readonly #counts = new Map<DocxImportWarningCode, number>();

  /** Record one occurrence of a stable warning category. */
  add(code: DocxImportWarningCode): void {
    this.#counts.set(code, (this.#counts.get(code) ?? 0) + 1);
  }

  /** Return an immutable warning snapshot in first-occurrence order. */
  snapshot(): readonly DocxImportWarning[] {
    return Object.freeze(
      [...this.#counts].map(([code, count]) => Object.freeze({ code, count })),
    );
  }
}

export interface ParsingContext {
  readonly archive: ZipArchive;
  readonly limits: Readonly<DocxImportLimits>;
  readonly warnings: WarningCollector;
  readonly relationships: ReadonlyMap<string, Relationship>;
  readonly headingStyles: ReadonlyMap<string, number>;
  readonly numbering: ReadonlyMap<string, ListDescriptor>;
  readonly imageCache: Map<string, Promise<string | undefined>>;
  imageCount: number;
  totalImageBytes: number;
}

export function hasNamespace(
  node: XmlElement,
  namespaces: ReadonlySet<string>,
): boolean {
  return node.namespaceUri !== undefined && namespaces.has(node.namespaceUri);
}

export function wordChildren(
  node: XmlElement,
  wantedLocalName?: string,
): XmlElement[] {
  return childElements(node, wantedLocalName).filter((child) =>
    hasNamespace(child, WORD_NAMESPACES),
  );
}

export function firstWordChild(
  node: XmlElement,
  wantedLocalName: string,
): XmlElement | undefined {
  return wordChildren(node, wantedLocalName)[0];
}

export function descendantsInNamespaces(
  node: XmlElement,
  wantedLocalName: string,
  namespaces: ReadonlySet<string>,
): XmlElement[] {
  return descendantElements(node, wantedLocalName).filter((child) =>
    hasNamespace(child, namespaces),
  );
}

function namespacedAttribute(
  node: XmlElement,
  wantedLocalName: string,
  namespaces: ReadonlySet<string>,
): string | undefined {
  let value: string | undefined;
  for (const namespaceUri of namespaces) {
    const candidate = attribute(node, wantedLocalName, namespaceUri);
    if (candidate === undefined) continue;
    if (value !== undefined) throw new DocxImportError('invalid_docx');
    value = candidate;
  }
  return value;
}

export function wordAttribute(
  node: XmlElement,
  wantedLocalName: string,
): string | undefined {
  return namespacedAttribute(node, wantedLocalName, WORD_NAMESPACES);
}

export function officeRelationshipAttribute(
  node: XmlElement,
  wantedLocalName: string,
): string | undefined {
  return namespacedAttribute(
    node,
    wantedLocalName,
    OFFICE_RELATIONSHIP_NAMESPACES,
  );
}

export function packageAttribute(
  node: XmlElement,
  wantedLocalName: string,
): string | undefined {
  return attribute(node, wantedLocalName, null);
}

export function parseUnsignedInteger(
  value: string | undefined,
): number | undefined {
  if (value === undefined || !/^[0-9]+$/u.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

export function onOffValue(node: XmlElement | undefined): boolean {
  if (!node) return false;
  const value = wordAttribute(node, 'val');
  return value === undefined || !/^(?:0|false|no|off)$/iu.test(value);
}

export function textNode(
  text: string,
  marks: readonly DocxJsonMark[],
): DocxJsonContent {
  return marks.length === 0
    ? { type: 'text', text }
    : { type: 'text', text, marks: [...marks] };
}

function equalMarks(
  left: readonly DocxJsonMark[] | undefined,
  right: readonly DocxJsonMark[] | undefined,
): boolean {
  const leftMarks = left ?? [];
  const rightMarks = right ?? [];
  if (leftMarks.length !== rightMarks.length) return false;
  return leftMarks.every((mark, index) => {
    const other = rightMarks[index]!;
    return (
      mark.type === other.type &&
      JSON.stringify(mark.attrs ?? null) === JSON.stringify(other.attrs ?? null)
    );
  });
}

export function appendInline(
  parts: InlinePart[],
  node: DocxJsonContent,
): void {
  const previous = parts[parts.length - 1];
  if (
    node.type === 'text' &&
    typeof node.text === 'string' &&
    previous?.kind === 'inline' &&
    previous.node.type === 'text' &&
    typeof previous.node.text === 'string' &&
    equalMarks(previous.node.marks, node.marks)
  ) {
    parts[parts.length - 1] = {
      kind: 'inline',
      node: textNode(previous.node.text + node.text, node.marks ?? []),
    };
    return;
  }
  parts.push({ kind: 'inline', node });
}

/** Resolve one internal OPC relationship target against a source part. */
export function resolvePackageTarget(basePart: string, target: string): string {
  if (
    target.length === 0 ||
    target.includes('\\') ||
    target.includes('\0') ||
    target.includes('?') ||
    target.includes('#') ||
    /^[A-Za-z][A-Za-z0-9+.-]*:/u.test(target) ||
    target.startsWith('//')
  ) {
    throw new DocxImportError('invalid_docx');
  }
  const baseSegments = target.startsWith('/')
    ? []
    : basePart.split('/').slice(0, -1);
  const targetSegments = target.replace(/^\//u, '').split('/');
  for (const segment of targetSegments) {
    if (segment.length === 0 || segment === '.') {
      throw new DocxImportError('invalid_docx');
    }
    if (segment === '..') {
      if (baseSegments.length === 0) throw new DocxImportError('invalid_docx');
      baseSegments.pop();
    } else {
      baseSegments.push(segment);
    }
  }
  if (baseSegments.length === 0) throw new DocxImportError('invalid_docx');
  return baseSegments.join('/');
}
