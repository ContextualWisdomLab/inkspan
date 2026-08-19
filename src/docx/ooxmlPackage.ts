import { DocxImportError } from './errors.js';
import { parseRelationships, validateContentTypes } from './ooxmlManifest.js';
import { parseNumbering } from './ooxmlNumbering.js';
import { parseHeadingStyles } from './ooxmlStyles.js';
import {
  DOCUMENT_PATH,
  type ListDescriptor,
  type Relationship,
} from './ooxmlShared.js';
import type { DocxImportLimits } from './types.js';
import { ZipArchive } from './zip.js';

export interface DocxPackageMetadata {
  readonly relationships: ReadonlyMap<string, Relationship>;
  readonly headingStyles: ReadonlyMap<string, number>;
  readonly numbering: ReadonlyMap<string, ListDescriptor>;
  readonly documentBytes: Uint8Array;
}

/** Validate the package manifest and read bounded optional Word metadata. */
export async function readDocxPackageMetadata(
  archive: ZipArchive,
  limits: Readonly<DocxImportLimits>,
): Promise<DocxPackageMetadata> {
  await validateContentTypes(archive, limits);
  if (!archive.has(DOCUMENT_PATH)) throw new DocxImportError('invalid_docx');
  const [relationships, headingStyles, numbering, documentBytes] =
    await Promise.all([
      parseRelationships(archive, limits),
      parseHeadingStyles(archive, limits),
      parseNumbering(archive, limits),
      archive.read(DOCUMENT_PATH),
    ]);
  return { relationships, headingStyles, numbering, documentBytes };
}
