import { DocxImportError } from './errors.js';
import { headingLevelFromLabel } from './ooxmlHeading.js';
import {
  firstWordChild,
  hasNamespace,
  parseUnsignedInteger,
  wordAttribute,
  wordChildren,
  WORD_NAMESPACES,
} from './ooxmlShared.js';
import type { DocxImportLimits } from './types.js';
import { parseXml } from './xml.js';
import { ZipArchive } from './zip.js';

const STYLES_PATH = 'word/styles.xml';

/** Map direct paragraph styles to supported heading levels. */
export async function parseHeadingStyles(
  archive: ZipArchive,
  limits: Readonly<DocxImportLimits>,
): Promise<ReadonlyMap<string, number>> {
  if (!archive.has(STYLES_PATH)) return new Map();
  const root = parseXml(await archive.read(STYLES_PATH), limits);
  if (root.localName !== 'styles' || !hasNamespace(root, WORD_NAMESPACES)) {
    throw new DocxImportError('invalid_docx');
  }
  const styles = new Map<string, number>();
  const paragraphStyleIds = new Set<string>();
  for (const style of wordChildren(root, 'style')) {
    if (wordAttribute(style, 'type') !== 'paragraph') continue;
    const styleId = wordAttribute(style, 'styleId');
    if (!styleId) continue;
    if (paragraphStyleIds.has(styleId)) {
      throw new DocxImportError('invalid_docx');
    }
    paragraphStyleIds.add(styleId);
    const nameNode = firstWordChild(style, 'name');
    const name = nameNode ? wordAttribute(nameNode, 'val') : undefined;
    const paragraphProperties = firstWordChild(style, 'pPr');
    const outlineNode = paragraphProperties
      ? firstWordChild(paragraphProperties, 'outlineLvl')
      : undefined;
    const outlineLevel = parseUnsignedInteger(
      outlineNode ? wordAttribute(outlineNode, 'val') : undefined,
    );
    const namedLevel = headingLevelFromLabel(name ?? styleId);
    const level =
      namedLevel ??
      (outlineLevel !== undefined && outlineLevel <= 5
        ? outlineLevel + 1
        : undefined);
    if (level !== undefined) styles.set(styleId, level);
  }
  return styles;
}
