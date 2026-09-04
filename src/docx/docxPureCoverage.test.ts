import { describe, expect, it } from 'vitest';
import {
  DocxImportError,
  normalizeDocxImportError,
  type DocxImportErrorCode,
} from './errors.js';
import {
  DEFAULT_DOCX_IMPORT_LIMITS,
  resolveDocxImportLimits,
} from './limits.js';
import { headingLevelFromLabel } from './ooxmlHeading.js';
import { classifyNumberFormat } from './ooxmlNumberFormats.js';
import {
  appendInline,
  descendantsInNamespaces,
  DRAWING_NAMESPACES,
  firstWordChild,
  hasNamespace,
  officeRelationshipAttribute,
  onOffValue,
  packageAttribute,
  parseUnsignedInteger,
  resolvePackageTarget,
  textNode,
  WarningCollector,
  wordAttribute,
  wordChildren,
  WORD_NAMESPACES,
  type InlinePart,
} from './ooxmlShared.js';
import type { DocxImportLimits, DocxImportOptions } from './types.js';
import {
  attribute,
  childElements,
  descendantElements,
  directText,
  parseXml,
} from './xml.js';

const encode = (value: string): Uint8Array => new TextEncoder().encode(value);

function expectCode(operation: () => unknown, code: DocxImportErrorCode): void {
  let thrown: unknown;
  try {
    operation();
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(DocxImportError);
  expect(thrown).toMatchObject({ name: 'DocxImportError', code });
}

function xml(
  source: string,
  limits: Readonly<DocxImportLimits> = DEFAULT_DOCX_IMPORT_LIMITS,
) {
  return parseXml(encode(source), limits);
}

describe('DOCX stable errors', () => {
  it('constructs every payload-redacted public error and preserves known errors', () => {
    const codes: readonly DocxImportErrorCode[] = [
      'archive_limit_exceeded',
      'decompression_unavailable',
      'document_limit_exceeded',
      'editor_rejected_document',
      'encrypted_archive',
      'incompatible_editor_schema',
      'input_too_large',
      'invalid_configuration',
      'invalid_docx',
      'invalid_source',
      'invalid_xml',
      'invalid_zip',
      'unsupported_archive',
    ];
    for (const code of codes) {
      const error = new DocxImportError(code);
      expect(error).toMatchObject({ name: 'DocxImportError', code });
      expect(error.message).toBeTruthy();
      expect(error.message).not.toContain('caller-secret');
      expect(normalizeDocxImportError(error, 'invalid_docx')).toBe(error);
    }
  });

  it('normalizes unknown failures to the requested stable fallback', () => {
    expect(normalizeDocxImportError(new Error('caller-secret'), 'invalid_source')).toMatchObject({
      name: 'DocxImportError',
      code: 'invalid_source',
    });
  });
});

describe('DOCX strict resource configuration', () => {
  it('returns the canonical default object when no override is present', () => {
    expect(resolveDocxImportLimits()).toBe(DEFAULT_DOCX_IMPORT_LIMITS);
    expect(resolveDocxImportLimits({})).toBe(DEFAULT_DOCX_IMPORT_LIMITS);
  });

  it('accepts a null-prototype partial override and freezes a complete result', () => {
    const limits = Object.create(null) as Record<string, unknown>;
    limits.maxEntries = 17;
    limits.maxXmlDepth = 9;
    const resolved = resolveDocxImportLimits({ limits } as DocxImportOptions);
    expect(resolved).toEqual({
      ...DEFAULT_DOCX_IMPORT_LIMITS,
      maxEntries: 17,
      maxXmlDepth: 9,
    });
    expect(Object.isFrozen(resolved)).toBe(true);
  });

  it.each([
    null,
    [],
    new Date(),
    Object.create({ inherited: true }),
  ])('rejects a non-plain options record %#', (options) => {
    expectCode(
      () => resolveDocxImportLimits(options as unknown as DocxImportOptions),
      'invalid_configuration',
    );
  });

  it('rejects symbols, unknown keys, accessors, and non-enumerable fields', () => {
    expectCode(
      () =>
        resolveDocxImportLimits({
          [Symbol('secret')]: 1,
        } as unknown as DocxImportOptions),
      'invalid_configuration',
    );
    expectCode(
      () =>
        resolveDocxImportLimits({
          unexpected: 1,
        } as unknown as DocxImportOptions),
      'invalid_configuration',
    );

    const accessor = {} as Record<string, unknown>;
    Object.defineProperty(accessor, 'limits', {
      enumerable: true,
      get: () => ({ maxEntries: 1 }),
    });
    expectCode(
      () => resolveDocxImportLimits(accessor as DocxImportOptions),
      'invalid_configuration',
    );

    const hidden = {} as Record<string, unknown>;
    Object.defineProperty(hidden, 'limits', {
      enumerable: false,
      value: { maxEntries: 1 },
    });
    expectCode(
      () => resolveDocxImportLimits(hidden as DocxImportOptions),
      'invalid_configuration',
    );
  });

  it('rejects malformed limit records and invalid numeric values', () => {
    for (const limits of [null, [], new Date(), { unknown: 1 }]) {
      expectCode(
        () => resolveDocxImportLimits({ limits } as unknown as DocxImportOptions),
        'invalid_configuration',
      );
    }
    for (const value of ['1', 1.5, 0, 20_001]) {
      expectCode(
        () =>
          resolveDocxImportLimits({
            limits: { maxEntries: value },
          } as unknown as DocxImportOptions),
        'invalid_configuration',
      );
    }
  });

  it('fails closed when reflection itself throws', () => {
    const options = new Proxy(
      {},
      {
        getPrototypeOf() {
          throw new Error('caller-secret');
        },
      },
    );
    expectCode(
      () => resolveDocxImportLimits(options as DocxImportOptions),
      'invalid_configuration',
    );
  });
});

describe('DOCX heading and numbering helpers', () => {
  it('normalizes all supported heading labels and rejects ordinary labels', () => {
    for (let level = 1; level <= 6; level += 1) {
      expect(headingLevelFromLabel(`  HeAdInG ${level} `)).toBe(level);
    }
    expect(headingLevelFromLabel('Heading 7')).toBeUndefined();
    expect(headingLevelFromLabel('Body Text')).toBeUndefined();
  });

  it('classifies bullet and every supported ordered numbering format', () => {
    expect(classifyNumberFormat('bullet')).toBe('bulletList');
    for (const format of [
      'decimal',
      'decimalZero',
      'lowerLetter',
      'lowerRoman',
      'ordinal',
      'upperLetter',
      'upperRoman',
    ]) {
      expect(classifyNumberFormat(format)).toBe('orderedList');
    }
    expect(classifyNumberFormat(undefined)).toBeUndefined();
    expect(classifyNumberFormat('none')).toBeUndefined();
  });
});

describe('DOCX OOXML shared helpers', () => {
  const root = xml(
    '<w:root xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
      'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" plain="yes">' +
      '<w:p w:val="3" r:id="rel"><a:blip/><w:t>one</w:t><w:t>two</w:t></w:p>' +
      '<other/>' +
      '</w:root>',
  );

  it('selects Word children, descendants, namespaces, and attributes', () => {
    expect(hasNamespace(root, WORD_NAMESPACES)).toBe(true);
    expect(hasNamespace(root, DRAWING_NAMESPACES)).toBe(false);
    expect(wordChildren(root).map((node) => node.localName)).toEqual(['p']);
    expect(wordChildren(root, 'missing')).toEqual([]);
    const paragraph = firstWordChild(root, 'p')!;
    expect(firstWordChild(root, 'missing')).toBeUndefined();
    expect(descendantsInNamespaces(root, 'blip', DRAWING_NAMESPACES)).toHaveLength(1);
    expect(wordAttribute(paragraph, 'val')).toBe('3');
    expect(officeRelationshipAttribute(paragraph, 'id')).toBe('rel');
    expect(packageAttribute(root, 'plain')).toBe('yes');
    expect(packageAttribute(root, 'missing')).toBeUndefined();
  });

  it('rejects ambiguous namespaced attributes', () => {
    const ambiguous = xml(
      '<root xmlns:a="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
        'xmlns:b="http://purl.oclc.org/ooxml/wordprocessingml/main" a:val="1" b:val="2"/>',
    );
    expectCode(() => wordAttribute(ambiguous, 'val'), 'invalid_docx');
  });

  it('parses unsigned integers and Word on/off values', () => {
    expect(parseUnsignedInteger(undefined)).toBeUndefined();
    expect(parseUnsignedInteger('-1')).toBeUndefined();
    expect(parseUnsignedInteger('12')).toBe(12);
    expect(parseUnsignedInteger('999999999999999999999')).toBeUndefined();

    expect(onOffValue(undefined)).toBe(false);
    const values = xml(
      '<w:root xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
        '<w:on/><w:false w:val="off"/><w:true w:val="yes"/>' +
        '</w:root>',
    );
    expect(onOffValue(firstWordChild(values, 'on'))).toBe(true);
    expect(onOffValue(firstWordChild(values, 'false'))).toBe(false);
    expect(onOffValue(firstWordChild(values, 'true'))).toBe(true);
  });

  it('creates text nodes and merges only adjacent text with equal marks', () => {
    expect(textNode('plain', [])).toEqual({ type: 'text', text: 'plain' });
    expect(textNode('bold', [{ type: 'bold' }])).toEqual({
      type: 'text',
      text: 'bold',
      marks: [{ type: 'bold' }],
    });

    const parts: InlinePart[] = [];
    appendInline(parts, textNode('a', [{ type: 'bold' }]));
    appendInline(parts, textNode('b', [{ type: 'bold' }]));
    appendInline(parts, textNode('c', [{ type: 'italic' }]));
    appendInline(parts, { type: 'hardBreak' });
    appendInline(parts, textNode('d', []));
    expect(parts).toEqual([
      {
        kind: 'inline',
        node: { type: 'text', text: 'ab', marks: [{ type: 'bold' }] },
      },
      {
        kind: 'inline',
        node: { type: 'text', text: 'c', marks: [{ type: 'italic' }] },
      },
      { kind: 'inline', node: { type: 'hardBreak' } },
      { kind: 'inline', node: { type: 'text', text: 'd' } },
    ]);
  });

  it('resolves safe package targets and rejects every unsafe target shape', () => {
    expect(resolvePackageTarget('word/document.xml', 'media/image.png')).toBe(
      'word/media/image.png',
    );
    expect(resolvePackageTarget('word/document.xml', '../docProps/core.xml')).toBe(
      'docProps/core.xml',
    );
    expect(resolvePackageTarget('word/document.xml', '/word/styles.xml')).toBe(
      'word/styles.xml',
    );
    for (const target of [
      '',
      'media\\image.png',
      'media\0image.png',
      'media/image.png?x',
      'media/image.png#x',
      'https://example.test/x',
      '//server/share',
      'media//image.png',
      './image.png',
      '../../escape.xml',
      '/',
    ]) {
      expectCode(
        () => resolvePackageTarget('word/document.xml', target),
        'invalid_docx',
      );
    }
  });

  it('deduplicates warning categories in first-occurrence order', () => {
    const warnings = new WarningCollector();
    warnings.add('unsupported_content');
    warnings.add('image_omitted');
    warnings.add('unsupported_content');
    const snapshot = warnings.snapshot();
    expect(snapshot).toEqual([
      { code: 'unsupported_content', count: 2 },
      { code: 'image_omitted', count: 1 },
    ]);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(snapshot.every(Object.isFrozen)).toBe(true);
  });
});

describe('DOCX inert XML parser', () => {
  it('parses declarations, comments, namespaces, entities, and traversal helpers', () => {
    const root = xml(
      '<?xml version="1.0"?>\n<!--safe-->' +
        '<r xmlns="urn:root" xmlns:p="urn:parts" xml:lang="ko" plain="x">' +
        'A&amp;&apos;&gt;&lt;&quot;&#65;&#x42;' +
        '<p:item p:id="1"><p:child/>tail</p:item>' +
        '<p:item p:id="2"/>' +
        '</r>',
    );
    expect(root.localName).toBe('r');
    expect(root.namespaceUri).toBe('urn:root');
    expect(attribute(root, 'plain', null)).toBe('x');
    expect(attribute(root, 'lang', 'http://www.w3.org/XML/1998/namespace')).toBe('ko');
    expect(directText(root)).toBe(`A&'><"AB`);
    expect(childElements(root, 'item', 'urn:parts')).toHaveLength(2);
    expect(childElements(root, 'item', 'urn:missing')).toEqual([]);
    expect(descendantElements(root, 'child', 'urn:parts')).toHaveLength(1);
    expect(descendantElements(root, 'missing')).toEqual([]);
  });

  it('supports inherited prefixes and an explicitly empty default namespace', () => {
    const root = xml(
      '<p:root xmlns:p="urn:p"><child xmlns=""><p:leaf plain="v"/></child></p:root>',
    );
    const child = childElements(root)[0]!;
    const leaf = childElements(child)[0]!;
    expect(child.namespaceUri).toBeUndefined();
    expect(leaf.namespaceUri).toBe('urn:p');
    expect(attribute(leaf, 'plain')).toBe('v');
  });

  it('enforces XML byte, node, and depth ceilings', () => {
    expectCode(
      () => parseXml(new Uint8Array(), DEFAULT_DOCX_IMPORT_LIMITS),
      'archive_limit_exceeded',
    );
    expectCode(
      () =>
        xml('<r/>', {
          ...DEFAULT_DOCX_IMPORT_LIMITS,
          maxXmlBytes: 1,
        }),
      'archive_limit_exceeded',
    );
    expectCode(
      () =>
        xml('<r><a/></r>', {
          ...DEFAULT_DOCX_IMPORT_LIMITS,
          maxXmlNodes: 1,
        }),
      'archive_limit_exceeded',
    );
    expectCode(
      () =>
        xml('<r><a></a></r>', {
          ...DEFAULT_DOCX_IMPORT_LIMITS,
          maxXmlDepth: 1,
        }),
      'archive_limit_exceeded',
    );
  });

  it('rejects malformed UTF-8 and invalid XML scalar values', () => {
    expectCode(
      () => parseXml(new Uint8Array([0xc3, 0x28]), DEFAULT_DOCX_IMPORT_LIMITS),
      'invalid_xml',
    );
    expectCode(() => xml('<r>\0</r>'), 'invalid_xml');
  });

  it.each([
    '<1r/>',
    '<:r/>',
    '<r:/>',
    '<a:b:c/>',
    '<r><!--',
    '<r><!--bad--comment--></r>',
    '<?unfinished',
    '<!DOCTYPE r><r/>',
    '<r></r ',
    '<r></x>',
    '</r>',
    '<r a="1" a="2"/>',
    '<r a "1"/>',
    '<r a=one/>',
    '<r a="unterminated/>',
    '<r a="bad<value"/>',
    '<r>&unterminated</r>',
    '<r>&thisentitynameistoolong;</r>',
    '<r>&unknown;</r>',
    '<r>&#;</r>',
    '<r>&#xZZ;</r>',
    '<r>&#0;</r>',
    '<r xmlns="http://www.w3.org/XML/1998/namespace"/>',
    '<r xmlns="http://www.w3.org/2000/xmlns/"/>',
    '<r xmlns:xmlns="urn:x"/>',
    '<r xmlns:xml="urn:not-xml"/>',
    '<r xmlns:p=""/>',
    '<r xmlns:p="http://www.w3.org/XML/1998/namespace"/>',
    '<r xmlns:p="http://www.w3.org/2000/xmlns/"/>',
    '<p:r/>',
    '<r p:a="1"/>',
    'outside<r/>',
    '<r/><s/>',
    '<r>',
  ])('rejects malformed or namespace-unsafe XML %#', (source) => {
    expectCode(() => xml(source), 'invalid_xml');
  });

  it('rejects duplicate local-name attributes when the caller does not disambiguate namespace', () => {
    const root = xml('<r xmlns:a="urn:a" xmlns:b="urn:b" a:id="1" b:id="2"/>');
    expectCode(() => attribute(root, 'id'), 'invalid_docx');
    expect(attribute(root, 'id', 'urn:a')).toBe('1');
  });
});
