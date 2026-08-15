import { describe, expect, it } from 'vitest';
import { createDocx } from '../../test/docxFixture.js';
import { importDocx } from './importDocx.js';

const CONTENT_TYPES_NAMESPACE =
  'http://schemas.openxmlformats.org/package/2006/content-types';
const MAIN_DOCUMENT_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml';

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
});
