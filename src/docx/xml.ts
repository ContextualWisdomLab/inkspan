import { DocxImportError, normalizeDocxImportError } from './errors.js';
import type { DocxImportLimits } from './types.js';

const XML_NAMESPACE = 'http://www.w3.org/XML/1998/namespace';
const XMLNS_NAMESPACE = 'http://www.w3.org/2000/xmlns/';

/** Minimal inert XML tree used only for bounded OOXML interpretation. */
export interface XmlElement {
  readonly name: string;
  readonly localName: string;
  readonly namespaceUri?: string;
  readonly attributes: ReadonlyMap<string, string>;
  readonly attributeNamespaces: ReadonlyMap<string, string | undefined>;
  readonly children: readonly (XmlElement | string)[];
}

interface NamespaceScope {
  readonly parent?: NamespaceScope;
  readonly declarations: ReadonlyMap<string, string | undefined>;
}

interface MutableXmlElement {
  name: string;
  localName: string;
  namespaceUri?: string;
  attributes: Map<string, string>;
  attributeNamespaces: Map<string, string | undefined>;
  children: (MutableXmlElement | string)[];
  namespaces: NamespaceScope;
}

function splitQualifiedName(name: string): readonly [string, string] {
  const separator = name.indexOf(':');
  if (separator < 0) return ['', name];
  if (
    separator === 0 ||
    separator === name.length - 1 ||
    name.indexOf(':', separator + 1) >= 0
  ) {
    throw new DocxImportError('invalid_xml');
  }
  return [name.slice(0, separator), name.slice(separator + 1)];
}

function localName(name: string): string {
  return splitQualifiedName(name)[1];
}

function isNameStart(character: string): boolean {
  return /[A-Za-z_]/u.test(character);
}

function isNameCharacter(character: string): boolean {
  return /[A-Za-z0-9_.:-]/u.test(character);
}

function readName(source: string, start: number): readonly [string, number] {
  if (start >= source.length || !isNameStart(source[start]!)) {
    throw new DocxImportError('invalid_xml');
  }
  let cursor = start + 1;
  while (cursor < source.length && isNameCharacter(source[cursor]!)) cursor += 1;
  const name = source.slice(start, cursor);
  splitQualifiedName(name);
  return [name, cursor];
}

function skipWhitespace(source: string, start: number): number {
  let cursor = start;
  while (cursor < source.length && /[\t\n\r ]/u.test(source[cursor]!)) cursor += 1;
  return cursor;
}

function isXmlScalar(codePoint: number): boolean {
  return (
    codePoint === 0x09 ||
    codePoint === 0x0a ||
    codePoint === 0x0d ||
    (codePoint >= 0x20 && codePoint <= 0xd7ff) ||
    (codePoint >= 0xe000 && codePoint <= 0xfffd) ||
    (codePoint >= 0x10000 && codePoint <= 0x10ffff)
  );
}

const NAMED_ENTITIES: Readonly<Record<string, string>> = Object.freeze({
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  quot: '"',
});

function decodeEntities(source: string): string {
  if (!source.includes('&')) return source;
  let output = '';
  let cursor = 0;
  while (cursor < source.length) {
    const ampersand = source.indexOf('&', cursor);
    if (ampersand < 0) {
      output += source.slice(cursor);
      break;
    }
    output += source.slice(cursor, ampersand);
    const semicolon = source.indexOf(';', ampersand + 1);
    if (semicolon < 0 || semicolon - ampersand > 16) {
      throw new DocxImportError('invalid_xml');
    }
    const entity = source.slice(ampersand + 1, semicolon);
    if (Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, entity)) {
      output += NAMED_ENTITIES[entity]!;
    } else {
      const hexadecimal = entity.startsWith('#x') || entity.startsWith('#X');
      const decimal = entity.startsWith('#') && !hexadecimal;
      if (!hexadecimal && !decimal) throw new DocxImportError('invalid_xml');
      const digits = entity.slice(hexadecimal ? 2 : 1);
      if (
        digits.length === 0 ||
        !(hexadecimal ? /^[0-9A-Fa-f]+$/u : /^[0-9]+$/u).test(digits)
      ) {
        throw new DocxImportError('invalid_xml');
      }
      const codePoint = Number.parseInt(digits, hexadecimal ? 16 : 10);
      if (!Number.isSafeInteger(codePoint) || !isXmlScalar(codePoint)) {
        throw new DocxImportError('invalid_xml');
      }
      output += String.fromCodePoint(codePoint);
    }
    cursor = semicolon + 1;
  }
  return output;
}

function appendNode(
  parent: MutableXmlElement | undefined,
  roots: MutableXmlElement[],
  node: MutableXmlElement | string,
  state: { count: number },
  limits: Readonly<DocxImportLimits>,
): void {
  state.count += 1;
  if (state.count > limits.maxXmlNodes) {
    throw new DocxImportError('archive_limit_exceeded');
  }
  if (typeof node === 'string') {
    if (parent) parent.children.push(node);
    else if (node.trim().length > 0) throw new DocxImportError('invalid_xml');
    return;
  }
  if (parent) parent.children.push(node);
  else roots.push(node);
}

function lookupNamespace(
  scope: NamespaceScope | undefined,
  prefix: string,
): string | undefined {
  for (let current = scope; current; current = current.parent) {
    if (current.declarations.has(prefix)) return current.declarations.get(prefix);
  }
  return prefix === 'xml' ? XML_NAMESPACE : undefined;
}

function resolveNamespaces(
  name: string,
  attributes: ReadonlyMap<string, string>,
  parent: MutableXmlElement | undefined,
): {
  readonly namespaceUri?: string;
  readonly attributeNamespaces: Map<string, string | undefined>;
  readonly namespaces: NamespaceScope;
} {
  const declarations = new Map<string, string | undefined>();
  for (const [attributeName, value] of attributes) {
    if (attributeName === 'xmlns') {
      if (value === XML_NAMESPACE || value === XMLNS_NAMESPACE) {
        throw new DocxImportError('invalid_xml');
      }
      declarations.set('', value.length === 0 ? undefined : value);
      continue;
    }
    if (!attributeName.startsWith('xmlns:')) continue;
    const prefix = attributeName.slice(6);
    if (
      prefix.length === 0 ||
      prefix === 'xmlns' ||
      (prefix === 'xml' && value !== XML_NAMESPACE) ||
      (prefix !== 'xml' &&
        (value.length === 0 || value === XML_NAMESPACE || value === XMLNS_NAMESPACE))
    ) {
      throw new DocxImportError('invalid_xml');
    }
    declarations.set(prefix, value);
  }
  const namespaces: NamespaceScope = {
    ...(parent ? { parent: parent.namespaces } : {}),
    declarations,
  };

  const [prefix] = splitQualifiedName(name);
  const namespaceUri = lookupNamespace(namespaces, prefix);
  if (prefix.length > 0 && namespaceUri === undefined) {
    throw new DocxImportError('invalid_xml');
  }

  const attributeNamespaces = new Map<string, string | undefined>();
  for (const attributeName of attributes.keys()) {
    if (attributeName === 'xmlns' || attributeName.startsWith('xmlns:')) {
      attributeNamespaces.set(attributeName, XMLNS_NAMESPACE);
      continue;
    }
    const [attributePrefix] = splitQualifiedName(attributeName);
    const attributeNamespace =
      attributePrefix.length > 0
        ? lookupNamespace(namespaces, attributePrefix)
        : undefined;
    if (attributePrefix.length > 0 && attributeNamespace === undefined) {
      throw new DocxImportError('invalid_xml');
    }
    attributeNamespaces.set(attributeName, attributeNamespace);
  }
  return { namespaceUri, attributeNamespaces, namespaces };
}

function asXmlElement(node: MutableXmlElement): XmlElement {
  return node as XmlElement;
}

/** Parse one strict, DTD-free, bounded UTF-8 XML part. */
export function parseXml(
  bytes: Uint8Array,
  limits: Readonly<DocxImportLimits>,
): XmlElement {
  if (bytes.byteLength === 0 || bytes.byteLength > limits.maxXmlBytes) {
    throw new DocxImportError('archive_limit_exceeded');
  }
  let source: string;
  try {
    source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (error) {
    throw normalizeDocxImportError(error, 'invalid_xml');
  }
  for (const character of source) {
    if (!isXmlScalar(character.codePointAt(0)!)) {
      throw new DocxImportError('invalid_xml');
    }
  }

  const roots: MutableXmlElement[] = [];
  const stack: MutableXmlElement[] = [];
  const state = { count: 0 };
  let cursor = 0;
  while (cursor < source.length) {
    const opening = source.indexOf('<', cursor);
    const textEnd = opening < 0 ? source.length : opening;
    if (textEnd > cursor) {
      const text = decodeEntities(source.slice(cursor, textEnd));
      if (text.length > 0) appendNode(stack[stack.length - 1], roots, text, state, limits);
    }
    if (opening < 0) break;
    cursor = opening;

    if (source.startsWith('<!--', cursor)) {
      const end = source.indexOf('-->', cursor + 4);
      if (end < 0 || source.slice(cursor + 4, end).includes('--')) {
        throw new DocxImportError('invalid_xml');
      }
      cursor = end + 3;
      continue;
    }
    if (source.startsWith('<?', cursor)) {
      const end = source.indexOf('?>', cursor + 2);
      if (end < 0) throw new DocxImportError('invalid_xml');
      cursor = end + 2;
      continue;
    }
    if (source.startsWith('<!', cursor)) throw new DocxImportError('invalid_xml');
    if (source.startsWith('</', cursor)) {
      const [name, afterName] = readName(source, cursor + 2);
      const endCursor = skipWhitespace(source, afterName);
      if (source[endCursor] !== '>') throw new DocxImportError('invalid_xml');
      const current = stack.pop();
      if (!current || current.name !== name) throw new DocxImportError('invalid_xml');
      cursor = endCursor + 1;
      continue;
    }

    const [name, afterName] = readName(source, cursor + 1);
    const attributes = new Map<string, string>();
    let tagCursor = afterName;
    let selfClosing = false;
    for (;;) {
      tagCursor = skipWhitespace(source, tagCursor);
      if (source.startsWith('/>', tagCursor)) {
        selfClosing = true;
        tagCursor += 2;
        break;
      }
      if (source[tagCursor] === '>') {
        tagCursor += 1;
        break;
      }
      const [attributeName, afterAttributeName] = readName(source, tagCursor);
      if (attributes.has(attributeName)) throw new DocxImportError('invalid_xml');
      let attributeCursor = skipWhitespace(source, afterAttributeName);
      if (source[attributeCursor] !== '=') throw new DocxImportError('invalid_xml');
      attributeCursor = skipWhitespace(source, attributeCursor + 1);
      const quote = source[attributeCursor];
      if (quote !== '"' && quote !== "'") throw new DocxImportError('invalid_xml');
      const valueStart = attributeCursor + 1;
      const valueEnd = source.indexOf(quote, valueStart);
      if (valueEnd < 0 || source.slice(valueStart, valueEnd).includes('<')) {
        throw new DocxImportError('invalid_xml');
      }
      attributes.set(attributeName, decodeEntities(source.slice(valueStart, valueEnd)));
      tagCursor = valueEnd + 1;
    }
    const namespaceState = resolveNamespaces(name, attributes, stack[stack.length - 1]);
    const node: MutableXmlElement = {
      name,
      localName: localName(name),
      ...(namespaceState.namespaceUri ? { namespaceUri: namespaceState.namespaceUri } : {}),
      attributes,
      attributeNamespaces: namespaceState.attributeNamespaces,
      children: [],
      namespaces: namespaceState.namespaces,
    };
    appendNode(stack[stack.length - 1], roots, node, state, limits);
    if (!selfClosing) {
      stack.push(node);
      if (stack.length > limits.maxXmlDepth) {
        throw new DocxImportError('archive_limit_exceeded');
      }
    }
    cursor = tagCursor;
  }
  if (stack.length !== 0 || roots.length !== 1) {
    throw new DocxImportError('invalid_xml');
  }
  return asXmlElement(roots[0]!);
}

/** Return direct element children matching one local name and optional namespace. */
export function childElements(
  node: XmlElement,
  wantedLocalName?: string,
  namespaceUri?: string,
): XmlElement[] {
  return node.children.filter(
    (child): child is XmlElement =>
      typeof child !== 'string' &&
      (wantedLocalName === undefined || child.localName === wantedLocalName) &&
      (namespaceUri === undefined || child.namespaceUri === namespaceUri),
  );
}

/** Return all descendant elements matching one local name and namespace. */
export function descendantElements(
  node: XmlElement,
  wantedLocalName: string,
  namespaceUri?: string,
): XmlElement[] {
  const result: XmlElement[] = [];
  const stack = [...childElements(node)].reverse();
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (
      current.localName === wantedLocalName &&
      (namespaceUri === undefined || current.namespaceUri === namespaceUri)
    ) {
      result.push(current);
    }
    const children = childElements(current);
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push(children[index]!);
    }
  }
  return result;
}

/** Read one unambiguous attribute by local name and optional namespace. */
export function attribute(
  node: XmlElement,
  wantedLocalName: string,
  namespaceUri?: string | null,
): string | undefined {
  let found = false;
  let value: string | undefined;
  for (const [name, candidate] of node.attributes) {
    if (name === 'xmlns' || name.startsWith('xmlns:')) continue;
    if (localName(name) !== wantedLocalName) continue;
    if (
      namespaceUri !== undefined &&
      node.attributeNamespaces.get(name) !== (namespaceUri ?? undefined)
    ) {
      continue;
    }
    if (found) throw new DocxImportError('invalid_docx');
    found = true;
    value = candidate;
  }
  return value;
}

/** Concatenate direct text children without trimming authored text. */
export function directText(node: XmlElement): string {
  return node.children
    .filter((child): child is string => typeof child === 'string')
    .join('');
}
