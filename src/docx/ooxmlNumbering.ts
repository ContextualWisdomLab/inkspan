import { DocxImportError } from './errors.js';
import { classifyNumberFormat } from './ooxmlNumberFormats.js';
import {
  firstWordChild,
  hasNamespace,
  type ListDescriptor,
  parseUnsignedInteger,
  wordAttribute,
  wordChildren,
  WORD_NAMESPACES,
} from './ooxmlShared.js';
import type { DocxImportLimits } from './types.js';
import { parseXml } from './xml.js';
import { ZipArchive } from './zip.js';

const NUMBERING_PATH = 'word/numbering.xml';

/** Parse level-zero numbering definitions into flat list descriptors. */
export async function parseNumbering(
  archive: ZipArchive,
  limits: Readonly<DocxImportLimits>,
): Promise<ReadonlyMap<string, ListDescriptor>> {
  if (!archive.has(NUMBERING_PATH)) return new Map();
  const root = parseXml(await archive.read(NUMBERING_PATH), limits);
  if (root.localName !== 'numbering' || !hasNamespace(root, WORD_NAMESPACES)) {
    throw new DocxImportError('invalid_docx');
  }
  const abstract = new Map<
    string,
    { readonly kind: 'bulletList' | 'orderedList'; readonly start: number }
  >();
  for (const definition of wordChildren(root, 'abstractNum')) {
    const id = wordAttribute(definition, 'abstractNumId');
    if (!id) continue;
    const level = wordChildren(definition, 'lvl').find(
      (candidate) => wordAttribute(candidate, 'ilvl') === '0',
    );
    if (!level) continue;
    const numberFormat = firstWordChild(level, 'numFmt');
    const kind = classifyNumberFormat(
      numberFormat ? wordAttribute(numberFormat, 'val') : undefined,
    );
    if (!kind) continue;
    const startNode = firstWordChild(level, 'start');
    const declaredStart = parseUnsignedInteger(
      startNode ? wordAttribute(startNode, 'val') : undefined,
    );
    abstract.set(
      id,
      Object.freeze({
        kind,
        start: declaredStart && declaredStart > 0 ? declaredStart : 1,
      }),
    );
  }
  const result = new Map<string, ListDescriptor>();
  for (const instance of wordChildren(root, 'num')) {
    const numId = wordAttribute(instance, 'numId');
    const abstractIdNode = firstWordChild(instance, 'abstractNumId');
    const abstractId = abstractIdNode
      ? wordAttribute(abstractIdNode, 'val')
      : undefined;
    const definition = abstractId ? abstract.get(abstractId) : undefined;
    if (!numId || !definition) continue;
    result.set(
      numId,
      Object.freeze({
        key: numId,
        kind: definition.kind,
        start: definition.start,
      }),
    );
  }
  return result;
}
