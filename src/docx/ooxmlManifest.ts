import { DocxImportError } from './errors.js';
import {
  DOCUMENT_PATH,
  packageAttribute,
  type Relationship,
} from './ooxmlShared.js';
import type { DocxImportLimits } from './types.js';
import { childElements, parseXml } from './xml.js';
import { ZipArchive } from './zip.js';

const MAIN_DOCUMENT_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml';
const RELATIONSHIPS_PATH = 'word/_rels/document.xml.rels';
const CONTENT_TYPES_PATH = '[Content_Types].xml';
const CONTENT_TYPES_NAMESPACE =
  'http://schemas.openxmlformats.org/package/2006/content-types';
const PACKAGE_RELATIONSHIPS_NAMESPACE =
  'http://schemas.openxmlformats.org/package/2006/relationships';

/** Assert that the OPC manifest identifies an ordinary Word DOCX. */
export async function validateContentTypes(
  archive: ZipArchive,
  limits: Readonly<DocxImportLimits>,
): Promise<void> {
  if (!archive.has(CONTENT_TYPES_PATH)) {
    throw new DocxImportError('invalid_docx');
  }
  const root = parseXml(await archive.read(CONTENT_TYPES_PATH), limits);
  if (
    root.localName !== 'Types' ||
    root.namespaceUri !== CONTENT_TYPES_NAMESPACE
  ) {
    throw new DocxImportError('invalid_docx');
  }
  const accepted = childElements(
    root,
    'Override',
    CONTENT_TYPES_NAMESPACE,
  ).some(
    (entry) =>
      packageAttribute(entry, 'PartName') === `/${DOCUMENT_PATH}` &&
      packageAttribute(entry, 'ContentType') === MAIN_DOCUMENT_CONTENT_TYPE,
  );
  if (!accepted) throw new DocxImportError('invalid_docx');
}

/** Parse document relationships without following any target. */
export async function parseRelationships(
  archive: ZipArchive,
  limits: Readonly<DocxImportLimits>,
): Promise<ReadonlyMap<string, Relationship>> {
  if (!archive.has(RELATIONSHIPS_PATH)) return new Map();
  const root = parseXml(await archive.read(RELATIONSHIPS_PATH), limits);
  if (
    root.localName !== 'Relationships' ||
    root.namespaceUri !== PACKAGE_RELATIONSHIPS_NAMESPACE
  ) {
    throw new DocxImportError('invalid_docx');
  }
  const relationships = new Map<string, Relationship>();
  for (const node of childElements(
    root,
    'Relationship',
    PACKAGE_RELATIONSHIPS_NAMESPACE,
  )) {
    const id = packageAttribute(node, 'Id');
    const type = packageAttribute(node, 'Type');
    const target = packageAttribute(node, 'Target');
    const targetMode = packageAttribute(node, 'TargetMode');
    if (!id || !type || !target || relationships.has(id)) {
      throw new DocxImportError('invalid_docx');
    }
    relationships.set(
      id,
      Object.freeze({ type, target, ...(targetMode ? { targetMode } : {}) }),
    );
  }
  return relationships;
}
