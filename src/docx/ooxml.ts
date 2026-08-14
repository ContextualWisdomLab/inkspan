import { DocxImportError } from './errors.js';
import { readDocxPackageMetadata } from './ooxmlPackage.js';
import {
  appendInline,
  descendantsInNamespaces,
  DOCUMENT_PATH,
  DRAWING_NAMESPACES,
  firstWordChild,
  hasNamespace,
  IMAGE_RELATIONSHIP_TYPES,
  MAX_IMAGE_ALT_CODE_UNITS,
  officeRelationshipAttribute,
  onOffValue,
  packageAttribute,
  type InlinePart,
  type ListDescriptor,
  type ParagraphResult,
  type ParsingContext,
  parseUnsignedInteger,
  resolvePackageTarget,
  textNode,
  WarningCollector,
  wordAttribute,
  wordChildren,
  WORD_NAMESPACES,
  WORDPROCESSING_DRAWING_NAMESPACES,
} from './ooxmlShared.js';
import type {
  DocxImportLimits,
  DocxImportResult,
  DocxJsonContent,
  DocxJsonMark,
} from './types.js';
import {
  attribute,
  childElements,
  directText,
  parseXml,
  type XmlElement,
} from './xml.js';
import { ZipArchive } from './zip.js';

const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function bytesToBase64(bytes: Uint8Array): string {
  let output = '';
  let offset = 0;
  while (offset + 2 < bytes.byteLength) {
    const value =
      (bytes[offset]! << 16) |
      (bytes[offset + 1]! << 8) |
      bytes[offset + 2]!;
    output +=
      BASE64_ALPHABET[(value >>> 18) & 63]! +
      BASE64_ALPHABET[(value >>> 12) & 63]! +
      BASE64_ALPHABET[(value >>> 6) & 63]! +
      BASE64_ALPHABET[value & 63]!;
    offset += 3;
  }
  const remaining = bytes.byteLength - offset;
  if (remaining === 1) {
    const value = bytes[offset]! << 16;
    output +=
      BASE64_ALPHABET[(value >>> 18) & 63]! +
      BASE64_ALPHABET[(value >>> 12) & 63]! +
      '==';
  } else if (remaining === 2) {
    const value = (bytes[offset]! << 16) | (bytes[offset + 1]! << 8);
    output +=
      BASE64_ALPHABET[(value >>> 18) & 63]! +
      BASE64_ALPHABET[(value >>> 12) & 63]! +
      BASE64_ALPHABET[(value >>> 6) & 63]! +
      '=';
  }
  return output;
}

function imageMimeType(bytes: Uint8Array): string | undefined {
  if (
    bytes.byteLength >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    bytes.byteLength >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return 'image/jpeg';
  }
  if (bytes.byteLength >= 6) {
    const signature = String.fromCharCode(...bytes.subarray(0, 6));
    if (signature === 'GIF87a' || signature === 'GIF89a') return 'image/gif';
  }
  if (
    bytes.byteLength >= 12 &&
    String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return undefined;
}

function freezeJson(node: DocxJsonContent): DocxJsonContent {
  const content = node.content?.map((child) => freezeJson(child));
  const marks = node.marks?.map((mark) =>
    Object.freeze({
      type: mark.type,
      ...(mark.attrs ? { attrs: Object.freeze({ ...mark.attrs }) } : {}),
    }),
  );
  return Object.freeze({
    ...(node.type ? { type: node.type } : {}),
    ...(node.attrs ? { attrs: Object.freeze({ ...node.attrs }) } : {}),
    ...(content ? { content: Object.freeze(content) } : {}),
    ...(marks ? { marks: Object.freeze(marks) } : {}),
    ...(node.text !== undefined ? { text: node.text } : {}),
  });
}

function assertDocumentNodeLimit(
  documentJson: DocxJsonContent,
  maxDocumentNodes: number,
): void {
  const pending = [documentJson];
  let count = 0;
  while (pending.length > 0) {
    const node = pending.pop()!;
    count += 1;
    if (count > maxDocumentNodes) {
      throw new DocxImportError('document_limit_exceeded');
    }
    for (const child of node.content ?? []) pending.push(child);
  }
}

function supportedRunMarks(runProperties: XmlElement | undefined): DocxJsonMark[] {
  if (!runProperties) return [];
  const marks: DocxJsonMark[] = [];
  if (onOffValue(firstWordChild(runProperties, 'b'))) marks.push({ type: 'bold' });
  if (onOffValue(firstWordChild(runProperties, 'i'))) marks.push({ type: 'italic' });
  if (onOffValue(firstWordChild(runProperties, 'strike'))) {
    marks.push({ type: 'strike' });
  }
  return marks;
}

async function parseImage(
  drawing: XmlElement,
  context: ParsingContext,
): Promise<DocxJsonContent | undefined> {
  const blip = descendantsInNamespaces(
    drawing,
    'blip',
    DRAWING_NAMESPACES,
  )[0];
  const relationshipId = blip
    ? officeRelationshipAttribute(blip, 'embed')
    : undefined;
  const relationship = relationshipId
    ? context.relationships.get(relationshipId)
    : undefined;
  if (
    !relationship ||
    !IMAGE_RELATIONSHIP_TYPES.has(relationship.type) ||
    relationship.targetMode?.toLowerCase() === 'external'
  ) {
    context.warnings.add('missing_relationship');
    context.warnings.add('image_omitted');
    return undefined;
  }

  const target = resolvePackageTarget(DOCUMENT_PATH, relationship.target);
  if (!context.archive.has(target)) {
    context.warnings.add('missing_relationship');
    context.warnings.add('image_omitted');
    return undefined;
  }
  const declaredBytes = context.archive.size(target);
  if (
    declaredBytes === undefined ||
    declaredBytes > context.limits.maxImageBytes ||
    context.imageCount + 1 > context.limits.maxImages ||
    context.totalImageBytes + declaredBytes > context.limits.maxTotalImageBytes
  ) {
    throw new DocxImportError('document_limit_exceeded');
  }
  const bytes = await context.archive.read(target);
  const mimeType = imageMimeType(bytes);
  if (!mimeType) {
    context.warnings.add('unsupported_image');
    context.warnings.add('image_omitted');
    return undefined;
  }

  context.imageCount += 1;
  context.totalImageBytes += bytes.byteLength;
  const documentProperties = descendantsInNamespaces(
    drawing,
    'docPr',
    WORDPROCESSING_DRAWING_NAMESPACES,
  )[0];
  const authoredAlt = documentProperties
    ? (packageAttribute(documentProperties, 'descr') ??
      packageAttribute(documentProperties, 'title') ??
      '')
    : '';
  const alt =
    authoredAlt.length <= MAX_IMAGE_ALT_CODE_UNITS
      ? authoredAlt
      : '';
  if (authoredAlt.length > MAX_IMAGE_ALT_CODE_UNITS) {
    context.warnings.add('image_alt_omitted');
  }
  return {
    type: 'image',
    attrs: {
      src: `data:${mimeType};base64,${bytesToBase64(bytes)}`,
      alt,
    },
  };
}

async function parseRun(
  run: XmlElement,
  context: ParsingContext,
): Promise<InlinePart[]> {
  const runProperties = firstWordChild(run, 'rPr');
  if (onOffValue(runProperties ? firstWordChild(runProperties, 'vanish') : undefined)) {
    context.warnings.add('hidden_text_omitted');
    return [];
  }
  const marks = supportedRunMarks(runProperties);
  if (
    runProperties &&
    ['u', 'vertAlign', 'highlight', 'color'].some((name) =>
      Boolean(firstWordChild(runProperties, name)),
    )
  ) {
    context.warnings.add('unsupported_text_formatting');
  }

  const parts: InlinePart[] = [];
  for (const child of wordChildren(run)) {
    if (child.localName === 'rPr') continue;
    if (child.localName === 't') {
      const value = directText(child);
      if (value.length > 0) appendInline(parts, textNode(value, marks));
      continue;
    }
    if (child.localName === 'tab') {
      appendInline(parts, textNode('\t', marks));
      continue;
    }
    if (child.localName === 'br' || child.localName === 'cr') {
      const breakType = child.localName === 'br' ? wordAttribute(child, 'type') : undefined;
      if (breakType === 'page') context.warnings.add('page_break_flattened');
      appendInline(parts, { type: 'hardBreak' });
      continue;
    }
    if (child.localName === 'drawing') {
      const image = await parseImage(child, context);
      if (image) parts.push({ kind: 'image', node: image });
      continue;
    }
    context.warnings.add('unsupported_content');
  }
  return parts;
}

function paragraphHeadingLevel(
  paragraphProperties: XmlElement | undefined,
  context: ParsingContext,
): number | undefined {
  if (!paragraphProperties) return undefined;
  const outline = firstWordChild(paragraphProperties, 'outlineLvl');
  const outlineLevel = parseUnsignedInteger(
    outline ? wordAttribute(outline, 'val') : undefined,
  );
  if (outlineLevel !== undefined && outlineLevel <= 5) return outlineLevel + 1;
  const style = firstWordChild(paragraphProperties, 'pStyle');
  const styleId = style ? wordAttribute(style, 'val') : undefined;
  return styleId ? context.headingStyles.get(styleId) : undefined;
}

function paragraphList(
  paragraphProperties: XmlElement | undefined,
  context: ParsingContext,
): ListDescriptor | undefined {
  if (!paragraphProperties) return undefined;
  const numberingProperties = firstWordChild(paragraphProperties, 'numPr');
  if (!numberingProperties) return undefined;
  const levelNode = firstWordChild(numberingProperties, 'ilvl');
  const level = parseUnsignedInteger(
    levelNode ? wordAttribute(levelNode, 'val') : undefined,
  );
  const numberIdNode = firstWordChild(numberingProperties, 'numId');
  const numberId = numberIdNode ? wordAttribute(numberIdNode, 'val') : undefined;
  if (level !== undefined && level !== 0) {
    context.warnings.add('list_flattened');
    return undefined;
  }
  return numberId ? context.numbering.get(numberId) : undefined;
}

async function parseParagraph(
  paragraph: XmlElement,
  context: ParsingContext,
): Promise<ParagraphResult> {
  const properties = firstWordChild(paragraph, 'pPr');
  const headingLevel = paragraphHeadingLevel(properties, context);
  const parts: InlinePart[] = [];
  for (const child of wordChildren(paragraph)) {
    if (child.localName === 'pPr') continue;
    if (child.localName === 'r') {
      for (const part of await parseRun(child, context)) {
        if (part.kind === 'inline') appendInline(parts, part.node);
        else parts.push(part);
      }
      continue;
    }
    if (child.localName === 'hyperlink') {
      context.warnings.add('unsafe_hyperlink');
      for (const run of wordChildren(child, 'r')) {
        for (const part of await parseRun(run, context)) {
          if (part.kind === 'inline') appendInline(parts, part.node);
          else parts.push(part);
        }
      }
      continue;
    }
    context.warnings.add('unsupported_content');
  }

  const blocks: DocxJsonContent[] = [];
  let inline: DocxJsonContent[] = [];
  const flushInline = (): void => {
    if (inline.length === 0) return;
    blocks.push({
      type: headingLevel ? 'heading' : 'paragraph',
      ...(headingLevel ? { attrs: { level: headingLevel } } : {}),
      content: inline,
    });
    inline = [];
  };
  for (const part of parts) {
    if (part.kind === 'inline') inline.push(part.node);
    else {
      flushInline();
      blocks.push(part.node);
    }
  }
  flushInline();
  if (blocks.length === 0) {
    blocks.push({
      type: headingLevel ? 'heading' : 'paragraph',
      ...(headingLevel ? { attrs: { level: headingLevel } } : {}),
    });
  }

  const list = paragraphList(properties, context);
  if (
    list &&
    (blocks.length !== 1 || blocks[0]!.type !== 'paragraph')
  ) {
    context.warnings.add('list_flattened');
    return { blocks };
  }
  return list ? { blocks, list } : { blocks };
}

async function parseTable(
  table: XmlElement,
  context: ParsingContext,
): Promise<DocxJsonContent | undefined> {
  const rows: DocxJsonContent[] = [];
  for (const row of wordChildren(table, 'tr')) {
    const rowProperties = firstWordChild(row, 'trPr');
    const header = onOffValue(
      rowProperties ? firstWordChild(rowProperties, 'tblHeader') : undefined,
    );
    const cells: DocxJsonContent[] = [];
    for (const cell of wordChildren(row, 'tc')) {
      const cellProperties = firstWordChild(cell, 'tcPr');
      if (
        cellProperties &&
        (firstWordChild(cellProperties, 'gridSpan') ||
          firstWordChild(cellProperties, 'vMerge'))
      ) {
        context.warnings.add('table_span_flattened');
      }
      const content: DocxJsonContent[] = [];
      for (const child of wordChildren(cell)) {
        if (child.localName === 'tcPr') continue;
        if (child.localName === 'p') {
          const paragraph = await parseParagraph(child, context);
          if (paragraph.list) context.warnings.add('list_flattened');
          content.push(...paragraph.blocks);
        } else {
          context.warnings.add('unsupported_content');
        }
      }
      if (content.length === 0) content.push({ type: 'paragraph' });
      cells.push({
        type: header ? 'tableHeader' : 'tableCell',
        content,
      });
    }
    if (cells.length > 0) rows.push({ type: 'tableRow', content: cells });
  }
  if (rows.length === 0) {
    context.warnings.add('unsupported_content');
    return undefined;
  }
  return { type: 'table', content: rows };
}

interface PendingList {
  readonly descriptor: ListDescriptor;
  readonly items: DocxJsonContent[];
}

function flushList(
  pending: PendingList | undefined,
  blocks: DocxJsonContent[],
): void {
  if (!pending) return;
  blocks.push({
    type: pending.descriptor.kind,
    ...(pending.descriptor.kind === 'orderedList'
      ? { attrs: { start: pending.descriptor.start } }
      : {}),
    content: pending.items.map((paragraph) => ({
      type: 'listItem',
      content: [paragraph],
    })),
  });
}

function sameList(
  pending: PendingList | undefined,
  descriptor: ListDescriptor,
): boolean {
  return (
    pending?.descriptor.key === descriptor.key &&
    pending.descriptor.kind === descriptor.kind &&
    pending.descriptor.start === descriptor.start
  );
}

/** Parse one validated OPC package into a detached immutable Inkspan document. */
export async function parseDocxPackage(
  archive: ZipArchive,
  limits: Readonly<DocxImportLimits>,
): Promise<DocxImportResult> {
  const metadata = await readDocxPackageMetadata(archive, limits);
  const root = parseXml(metadata.documentBytes, limits);
  if (root.localName !== 'document' || !hasNamespace(root, WORD_NAMESPACES)) {
    throw new DocxImportError('invalid_docx');
  }
  const body = wordChildren(root, 'body')[0];
  if (!body) throw new DocxImportError('invalid_docx');

  const warnings = new WarningCollector();
  const context: ParsingContext = {
    archive,
    limits,
    warnings,
    relationships: metadata.relationships,
    headingStyles: metadata.headingStyles,
    numbering: metadata.numbering,
    imageCache: new Map(),
    imageCount: 0,
    totalImageBytes: 0,
  };
  const blocks: DocxJsonContent[] = [];
  let pendingList: PendingList | undefined;
  for (const child of childElements(body)) {
    if (!hasNamespace(child, WORD_NAMESPACES)) {
      warnings.add('unsupported_content');
      continue;
    }
    if (child.localName === 'p') {
      const paragraph = await parseParagraph(child, context);
      if (paragraph.list) {
        if (!sameList(pendingList, paragraph.list)) {
          flushList(pendingList, blocks);
          pendingList = {
            descriptor: paragraph.list,
            items: [],
          };
        }
        pendingList.items.push(paragraph.blocks[0]!);
      } else {
        flushList(pendingList, blocks);
        pendingList = undefined;
        blocks.push(...paragraph.blocks);
      }
      continue;
    }
    flushList(pendingList, blocks);
    pendingList = undefined;
    if (child.localName === 'tbl') {
      const table = await parseTable(child, context);
      if (table) blocks.push(table);
    } else if (child.localName !== 'sectPr') {
      warnings.add('unsupported_content');
    }
  }
  flushList(pendingList, blocks);

  const documentJson: DocxJsonContent = {
    type: 'doc',
    content: blocks,
  };
  assertDocumentNodeLimit(documentJson, limits.maxDocumentNodes);
  const frozenDocument = freezeJson(documentJson);
  return Object.freeze({
    documentJson: frozenDocument,
    warnings: warnings.snapshot(),
  });
}
