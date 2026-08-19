import { describe, expect, it } from 'vitest';
import { buildZip, createDocx, PNG_BYTES, WORD_NAMESPACES } from '../../test/docxFixture.js';
import { DocxImportError } from './errors.js';
import { importDocx } from './importDocx.js';
import { DEFAULT_DOCX_IMPORT_LIMITS } from './limits.js';
import { parseRelationships, validateContentTypes } from './ooxmlManifest.js';
import { parseNumbering } from './ooxmlNumbering.js';
import { parseHeadingStyles } from './ooxmlStyles.js';
import { ZipArchive } from './zip.js';

const limits = DEFAULT_DOCX_IMPORT_LIMITS;

function archive(entries: Readonly<Record<string, string | Uint8Array>>): ZipArchive {
  return ZipArchive.parse(buildZip(entries, 0), limits);
}

async function expectInvalid(operation: Promise<unknown>): Promise<void> {
  await expect(operation).rejects.toMatchObject({
    name: 'DocxImportError',
    code: 'invalid_docx',
  });
}

describe('DOCX OOXML package parsers', () => {
  it('parses paragraph heading styles from names and outline levels', async () => {
    const styles = await parseHeadingStyles(
      archive({
        'word/styles.xml':
          `<w:styles ${WORD_NAMESPACES}>` +
          '<w:style w:type="character" w:styleId="Ignored"><w:name w:val="Heading 1"/></w:style>' +
          '<w:style w:type="paragraph"><w:name w:val="Heading 1"/></w:style>' +
          '<w:style w:type="paragraph" w:styleId="Named"><w:name w:val="Heading 3"/></w:style>' +
          '<w:style w:type="paragraph" w:styleId="Outlined"><w:name w:val="Body Text"/><w:pPr><w:outlineLvl w:val="4"/></w:pPr></w:style>' +
          '<w:style w:type="paragraph" w:styleId="TooDeep"><w:pPr><w:outlineLvl w:val="7"/></w:pPr></w:style>' +
          '<w:style w:type="paragraph" w:styleId="Plain"><w:name w:val="Body Text"/></w:style>' +
          '</w:styles>',
      }),
      limits,
    );
    expect([...styles]).toEqual([
      ['Named', 3],
      ['Outlined', 5],
    ]);
    expect(await parseHeadingStyles(archive({ 'other.txt': 'x' }), limits)).toEqual(new Map());
    await expectInvalid(
      parseHeadingStyles(archive({ 'word/styles.xml': '<styles/>' }), limits),
    );
  });

  it('parses only supported level-zero numbering instances with safe starts', async () => {
    const numbering = await parseNumbering(
      archive({
        'word/numbering.xml':
          `<w:numbering ${WORD_NAMESPACES}>` +
          '<w:abstractNum><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/></w:lvl></w:abstractNum>' +
          '<w:abstractNum w:abstractNumId="bullet"><w:lvl w:ilvl="1"><w:numFmt w:val="bullet"/></w:lvl></w:abstractNum>' +
          '<w:abstractNum w:abstractNumId="unsupported"><w:lvl w:ilvl="0"><w:numFmt w:val="none"/></w:lvl></w:abstractNum>' +
          '<w:abstractNum w:abstractNumId="ordered"><w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/><w:start w:val="3"/></w:lvl></w:abstractNum>' +
          '<w:abstractNum w:abstractNumId="zero"><w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/><w:start w:val="0"/></w:lvl></w:abstractNum>' +
          '<w:num w:numId="7"><w:abstractNumId w:val="ordered"/></w:num>' +
          '<w:num w:numId="8"><w:abstractNumId w:val="zero"/></w:num>' +
          '<w:num><w:abstractNumId w:val="ordered"/></w:num>' +
          '<w:num w:numId="9"/>' +
          '<w:num w:numId="10"><w:abstractNumId w:val="missing"/></w:num>' +
          '</w:numbering>',
      }),
      limits,
    );
    expect([...numbering]).toEqual([
      ['7', { key: '7', kind: 'orderedList', start: 3 }],
      ['8', { key: '8', kind: 'orderedList', start: 1 }],
    ]);
    expect(await parseNumbering(archive({ 'other.txt': 'x' }), limits)).toEqual(new Map());
    await expectInvalid(
      parseNumbering(archive({ 'word/numbering.xml': '<numbering/>' }), limits),
    );
  });

  it('validates the content-type manifest and relationship map without following targets', async () => {
    const contentTypes =
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '</Types>';
    const relationships =
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="one" Type="urn:type" Target="media/a.png"/>' +
      '<Relationship Id="two" Type="urn:type" Target="https://example.invalid/x" TargetMode="External"/>' +
      '</Relationships>';
    const parsed = archive({
      '[Content_Types].xml': contentTypes,
      'word/_rels/document.xml.rels': relationships,
    });
    await expect(validateContentTypes(parsed, limits)).resolves.toBeUndefined();
    expect([...(await parseRelationships(parsed, limits))]).toEqual([
      ['one', { type: 'urn:type', target: 'media/a.png' }],
      ['two', { type: 'urn:type', target: 'https://example.invalid/x', targetMode: 'External' }],
    ]);
    expect(await parseRelationships(archive({ 'other.txt': 'x' }), limits)).toEqual(new Map());

    await expectInvalid(validateContentTypes(archive({ 'other.txt': 'x' }), limits));
    await expectInvalid(
      validateContentTypes(
        archive({ '[Content_Types].xml': '<Types xmlns="urn:wrong"/>' }),
        limits,
      ),
    );
    await expectInvalid(
      validateContentTypes(
        archive({
          '[Content_Types].xml':
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/other.xml" ContentType="text/xml"/></Types>',
        }),
        limits,
      ),
    );
    await expectInvalid(
      parseRelationships(
        archive({ 'word/_rels/document.xml.rels': '<Relationships xmlns="urn:wrong"/>' }),
        limits,
      ),
    );
    for (const relationship of [
      '<Relationship Type="urn:type" Target="a"/>',
      '<Relationship Id="x" Target="a"/>',
      '<Relationship Id="x" Type="urn:type"/>',
      '<Relationship Id="x" Type="urn:type" Target="a"/><Relationship Id="x" Type="urn:type" Target="b"/>',
    ]) {
      await expectInvalid(
        parseRelationships(
          archive({
            'word/_rels/document.xml.rels':
              '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
              relationship +
              '</Relationships>',
          }),
          limits,
        ),
      );
    }
  });
});

describe('DOCX rich OOXML integration coverage', () => {
  it('normalizes styles, lists, hyperlinks, run controls, images, tables, and unsupported content deterministically', async () => {
    const relationships =
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="image" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image.png"/>' +
      '<Relationship Id="external" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="https://example.invalid/image.png" TargetMode="External"/>' +
      '</Relationships>';
    const styles =
      `<w:styles ${WORD_NAMESPACES}>` +
      '<w:style w:type="paragraph" w:styleId="Titleish"><w:name w:val="Heading 2"/></w:style>' +
      '</w:styles>';
    const numbering =
      `<w:numbering ${WORD_NAMESPACES}>` +
      '<w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/><w:start w:val="2"/></w:lvl></w:abstractNum>' +
      '<w:num w:numId="4"><w:abstractNumId w:val="1"/></w:num>' +
      '</w:numbering>';
    const body =
      '<w:p><w:pPr><w:pStyle w:val="Titleish"/></w:pPr><w:r><w:rPr><w:b/><w:i/><w:strike/><w:u/><w:color w:val="FF0000"/></w:rPr><w:t>Rich</w:t><w:tab/><w:br w:type="page"/><w:cr/><w:unknown/></w:r></w:p>' +
      '<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="4"/></w:numPr></w:pPr><w:r><w:t>First</w:t></w:r></w:p>' +
      '<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="4"/></w:numPr></w:pPr><w:r><w:t>Second</w:t></w:r></w:p>' +
      '<w:p><w:pPr><w:numPr><w:ilvl w:val="2"/><w:numId w:val="4"/></w:numPr></w:pPr><w:r><w:t>Flattened</w:t></w:r></w:p>' +
      '<w:p><w:hyperlink r:id="unsafe"><w:r><w:t>Link text</w:t></w:r></w:hyperlink></w:p>' +
      '<w:p><w:r><w:drawing><wp:docPr title="Fallback alt"/><a:blip r:embed="image"/></w:drawing></w:r></w:p>' +
      '<w:p><w:r><w:drawing><wp:docPr/><a:blip r:embed="external"/></w:drawing></w:r></w:p>' +
      '<w:p><w:r><w:rPr><w:vanish/></w:rPr><w:t>Hidden</w:t></w:r></w:p>' +
      '<w:tbl><w:tr><w:tc><w:tcPr><w:gridSpan w:val="2"/></w:tcPr><w:p/><w:unsupported/></w:tc></w:tr></w:tbl>' +
      '<w:tbl><w:unsupported/></w:tbl>' +
      '<w:unsupported/>';
    const result = await importDocx(
      createDocx({
        body,
        relationships,
        styles,
        numbering,
        media: { 'word/media/image.png': PNG_BYTES },
        method: 0,
      }),
    );

    expect(result.documentJson.type).toBe('doc');
    expect(result.documentJson.content?.some((node) => node.type === 'heading')).toBe(true);
    expect(result.documentJson.content?.some((node) => node.type === 'orderedList')).toBe(true);
    expect(result.documentJson.content?.some((node) => node.type === 'image')).toBe(true);
    expect(result.documentJson.content?.some((node) => node.type === 'table')).toBe(true);
    expect(result.warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining([
        'unsupported_text_formatting',
        'page_break_flattened',
        'unsupported_content',
        'list_flattened',
        'unsafe_hyperlink',
        'missing_relationship',
        'image_omitted',
        'hidden_text_omitted',
        'table_span_flattened',
      ]),
    );
  });

  it('preserves the public error type when malformed package content is rejected', async () => {
    await expect(importDocx(createDocx({ document: '<document/>' }))).rejects.toBeInstanceOf(
      DocxImportError,
    );
  });
});
