import { describe, expect, it } from 'vitest';
import { createDocx } from '../../test/docxFixture.js';
import { importDocx } from './importDocx.js';

const CONTENT_TYPES_NAMESPACE =
  'http://schemas.openxmlformats.org/package/2006/content-types';
const MAIN_DOCUMENT_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml';
const WORD_NAMESPACE =
  'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

describe('DOCX OPC manifest ambiguity', () => {
  it('rejects duplicate content-type overrides for the main document part', async () => {
    const contentTypes =
      `<Types xmlns="${CONTENT_TYPES_NAMESPACE}">` +
      `<Override PartName="/word/document.xml" ContentType="${MAIN_DOCUMENT_CONTENT_TYPE}"/>` +
      '<Override PartName="/word/document.xml" ContentType="application/xml"/>' +
      '</Types>';

    await expect(importDocx(createDocx({ contentTypes }))).rejects.toMatchObject({
      name: 'DocxImportError',
      code: 'invalid_docx',
    });
  });

  it('rejects duplicate paragraph style identifiers', async () => {
    const styles =
      `<w:styles xmlns:w="${WORD_NAMESPACE}">` +
      '<w:style w:type="paragraph" w:styleId="Duplicate"><w:name w:val="Heading 1"/></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Duplicate"><w:name w:val="Heading 2"/></w:style>' +
      '</w:styles>';
    const body =
      '<w:p><w:pPr><w:pStyle w:val="Duplicate"/></w:pPr><w:r><w:t>ambiguous</w:t></w:r></w:p>';

    await expect(importDocx(createDocx({ body, styles }))).rejects.toMatchObject({
      name: 'DocxImportError',
      code: 'invalid_docx',
    });
  });
});
