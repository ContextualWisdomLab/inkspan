/**
 * SafeClipboard — bounded rich-HTML paste sanitization shared by every Inkspan
 * editor surface before ProseMirror parses or inserts clipboard markup.
 */
import { Extension } from '@tiptap/core';
import { isSafeLinkHref } from './SafeLink.js';

/** Default maximum UTF-8 byte size accepted for one rich clipboard payload. */
export const DEFAULT_CLIPBOARD_HTML_BYTES = 1_048_576;
/** Default maximum number of source nodes traversed for one rich paste. */
export const DEFAULT_CLIPBOARD_MAX_NODES = 10_000;
/** Default maximum source-tree depth traversed for one rich paste. */
export const DEFAULT_CLIPBOARD_MAX_DEPTH = 64;

const MAXIMUM_CLIPBOARD_HTML_BYTES = 16_777_216;
const MAXIMUM_CLIPBOARD_NODES = 100_000;
const MAXIMUM_CLIPBOARD_DEPTH = 256;
const SAFE_CLIPBOARD_PRIORITY = -1_000_000;
const SAFE_LINK_REL = 'noopener noreferrer nofollow';
const CSS_HEX_DIGIT = /^[0-9a-f]$/iu;
const CSS_NEWLINE = /^[\n\r\f]$/u;
const CSS_WHITESPACE = /^[\t\n\f\r ]$/u;
const CONFIGURATION_KEYS = [
  'maxHtmlBytes',
  'maxNodes',
  'maxDepth',
] as const;

/** Bounded configuration for rich clipboard HTML sanitization. */
export interface ClipboardConfig {
  /** Maximum UTF-8 bytes accepted before parsing. Default 1 MiB. */
  maxHtmlBytes?: number;
  /** Maximum source nodes traversed. Default 10,000. */
  maxNodes?: number;
  /** Maximum source-tree depth traversed. Default 64. */
  maxDepth?: number;
}

/** Stable redacted categories reported for rejected rich clipboard input. */
export type ClipboardSanitizationErrorCode =
  | 'dom_unavailable'
  | 'input_too_large'
  | 'node_limit_exceeded'
  | 'depth_limit_exceeded'
  | 'invalid_configuration'
  | 'invalid_html';

const ERROR_MESSAGES: Readonly<Record<ClipboardSanitizationErrorCode, string>> =
  Object.freeze({
    dom_unavailable:
      'Rich clipboard sanitization requires a DOM-capable document.',
    input_too_large: 'Rich clipboard HTML exceeds the configured byte limit.',
    node_limit_exceeded:
      'Rich clipboard HTML exceeds the configured node limit.',
    depth_limit_exceeded:
      'Rich clipboard HTML exceeds the configured depth limit.',
    invalid_configuration: 'Rich clipboard configuration is invalid.',
    invalid_html: 'Rich clipboard HTML could not be sanitized.',
  });

/** Error whose stable code and message never disclose clipboard content. */
export class ClipboardSanitizationError extends Error {
  /** Machine-readable rejection category safe for host telemetry. */
  readonly code: ClipboardSanitizationErrorCode;

  /** Create one redacted sanitizer error from a stable category. */
  constructor(code: ClipboardSanitizationErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = 'ClipboardSanitizationError';
    this.code = code;
  }
}

interface ResolvedClipboardConfig {
  readonly maxHtmlBytes: number;
  readonly maxNodes: number;
  readonly maxDepth: number;
}

interface TraversalFrame {
  readonly sourceNode: globalThis.Node;
  readonly outputParent: globalThis.Node;
  readonly depth: number;
}

const ALLOWED_ELEMENTS = new Set([
  'a',
  'blockquote',
  'br',
  'code',
  'div',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'li',
  'ol',
  'p',
  'pre',
  's',
  'strong',
  'sub',
  'sup',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'u',
  'ul',
]);

const NORMALIZED_ELEMENTS: Readonly<Record<string, string>> = Object.freeze({
  b: 'strong',
  i: 'em',
  strike: 's',
});

const DROPPED_SUBTREES = new Set([
  'applet',
  'audio',
  'base',
  'button',
  'canvas',
  'embed',
  'form',
  'iframe',
  'img',
  'input',
  'link',
  'math',
  'meta',
  'noscript',
  'object',
  'option',
  'picture',
  'script',
  'select',
  'source',
  'style',
  'svg',
  'template',
  'textarea',
  'track',
  'video',
  'xml',
]);

/** Create one stable invalid-configuration error. */
function invalidConfiguration(): ClipboardSanitizationError {
  return new ClipboardSanitizationError('invalid_configuration');
}

/** Validate one optional positive safe integer within its public ceiling. */
function resolveBoundedInteger(
  candidate: unknown,
  fallback: number,
  maximum: number,
): number {
  if (candidate === undefined) return fallback;
  if (
    typeof candidate !== 'number' ||
    !Number.isSafeInteger(candidate) ||
    candidate < 1 ||
    candidate > maximum
  ) {
    throw invalidConfiguration();
  }
  return candidate;
}

/** Read exact own data properties without evaluating configuration accessors. */
function resolveClipboardConfig(
  config: ClipboardConfig | undefined,
): ResolvedClipboardConfig {
  if (config === undefined) {
    return Object.freeze({
      maxHtmlBytes: DEFAULT_CLIPBOARD_HTML_BYTES,
      maxNodes: DEFAULT_CLIPBOARD_MAX_NODES,
      maxDepth: DEFAULT_CLIPBOARD_MAX_DEPTH,
    });
  }
  try {
    if (typeof config !== 'object' || config === null) {
      throw invalidConfiguration();
    }
    const keys = Reflect.ownKeys(config);
    if (
      keys.some(
        (key) =>
          typeof key !== 'string' ||
          !CONFIGURATION_KEYS.includes(
            key as (typeof CONFIGURATION_KEYS)[number],
          ),
      )
    ) {
      throw invalidConfiguration();
    }

    const values: Partial<Record<(typeof CONFIGURATION_KEYS)[number], unknown>> =
      {};
    for (const key of CONFIGURATION_KEYS) {
      const descriptor = Object.getOwnPropertyDescriptor(config, key);
      if (descriptor === undefined) continue;
      if (
        !descriptor.enumerable ||
        !Object.prototype.hasOwnProperty.call(descriptor, 'value')
      ) {
        throw invalidConfiguration();
      }
      values[key] = descriptor.value;
    }
    return Object.freeze({
      maxHtmlBytes: resolveBoundedInteger(
        values.maxHtmlBytes,
        DEFAULT_CLIPBOARD_HTML_BYTES,
        MAXIMUM_CLIPBOARD_HTML_BYTES,
      ),
      maxNodes: resolveBoundedInteger(
        values.maxNodes,
        DEFAULT_CLIPBOARD_MAX_NODES,
        MAXIMUM_CLIPBOARD_NODES,
      ),
      maxDepth: resolveBoundedInteger(
        values.maxDepth,
        DEFAULT_CLIPBOARD_MAX_DEPTH,
        MAXIMUM_CLIPBOARD_DEPTH,
      ),
    });
  } catch (error) {
    if (
      error instanceof ClipboardSanitizationError &&
      error.code === 'invalid_configuration'
    ) {
      throw error;
    }
    throw invalidConfiguration();
  }
}

/** Resolve one DOM-capable document without touching DOM globals at import time. */
function resolveClipboardDocument(
  documentOverride: Document | null | undefined,
): Document {
  const candidate =
    documentOverride === undefined
      ? typeof document === 'undefined'
        ? null
        : document
      : documentOverride;
  if (
    candidate === null ||
    typeof candidate.createElement !== 'function' ||
    typeof candidate.implementation?.createHTMLDocument !== 'function'
  ) {
    throw new ClipboardSanitizationError('dom_unavailable');
  }
  return candidate;
}

/** Decode the CSS escapes needed for exact hidden-property comparisons. */
function decodeCssEscapes(source: string): string | null {
  let decoded = '';
  for (let index = 0; index < source.length; index += 1) {
    const current = source[index];
    if (current !== '\\') {
      decoded += current;
      continue;
    }
    if (index + 1 >= source.length) return null;
    const next = source[index + 1] as string;
    if (CSS_NEWLINE.test(next)) return null;

    let cursor = index + 1;
    let hexadecimal = '';
    while (
      cursor < source.length &&
      hexadecimal.length < 6 &&
      CSS_HEX_DIGIT.test(source[cursor] as string)
    ) {
      hexadecimal += source[cursor] as string;
      cursor += 1;
    }
    if (hexadecimal.length === 0) {
      decoded += next;
      index += 1;
      continue;
    }

    const codePoint = Number.parseInt(hexadecimal, 16);
    if (
      codePoint === 0 ||
      codePoint > 0x10ffff ||
      (codePoint >= 0xd800 && codePoint <= 0xdfff)
    ) {
      return null;
    }
    decoded += String.fromCodePoint(codePoint);
    index = cursor - 1;
    if (
      index + 1 < source.length &&
      CSS_WHITESPACE.test(source[index + 1] as string)
    ) {
      index += 1;
    }
  }
  return decoded;
}

/** Detect Office's hidden-subtree declaration from bounded raw style text. */
function hasOfficeHiddenDeclaration(element: Element): boolean {
  const rawStyle = element.getAttribute('style');
  if (rawStyle === null) return false;
  const withoutComments = rawStyle.replace(/\/\*[\s\S]*?\*\//gu, '');
  return withoutComments.split(';').some((declaration) => {
    const separator = declaration.indexOf(':');
    if (separator < 0) return false;
    const propertyName = decodeCssEscapes(
      declaration.slice(0, separator).trim(),
    )?.toLowerCase();
    if (propertyName !== 'mso-hide') return false;
    const propertyValue = decodeCssEscapes(
      declaration
        .slice(separator + 1)
        .replace(/\s*!important\s*$/iu, '')
        .trim(),
    )?.toLowerCase();
    return propertyValue === 'all';
  });
}

/** Return true when the element marks its complete subtree as hidden. */
function isHiddenClipboardElement(element: Element): boolean {
  if (element.hasAttribute('hidden')) return true;
  if (element.getAttribute('aria-hidden')?.trim().toLowerCase() === 'true') {
    return true;
  }
  const style = (element as HTMLElement).style;
  return (
    style.display.trim().toLowerCase() === 'none' ||
    style.visibility.trim().toLowerCase() === 'hidden' ||
    hasOfficeHiddenDeclaration(element)
  );
}

/** Return semantic wrappers represented by the source element's inline style. */
function semanticStyleWrappers(element: Element): string[] {
  const style = (element as HTMLElement).style;
  const wrappers: string[] = [];
  const fontWeight = style.fontWeight.trim().toLowerCase();
  const numericWeight = Number.parseInt(fontWeight, 10);
  if (
    fontWeight === 'bold' ||
    fontWeight === 'bolder' ||
    (Number.isFinite(numericWeight) && numericWeight >= 600)
  ) {
    wrappers.push('strong');
  }
  const fontStyle = style.fontStyle.trim().toLowerCase();
  if (fontStyle === 'italic' || fontStyle === 'oblique') {
    wrappers.push('em');
  }
  const decoration = `${style.textDecorationLine} ${style.textDecoration}`
    .trim()
    .toLowerCase();
  if (decoration.includes('underline')) wrappers.push('u');
  if (decoration.includes('line-through')) wrappers.push('s');
  return wrappers;
}

/** Return one bounded integer attribute string or null. */
function boundedIntegerAttribute(
  value: string | null,
  minimum: number,
  maximum: number,
): string | null {
  if (value === null || !/^-?\d+$/u.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? String(parsed)
    : null;
}

/** Copy the exact small attribute allowlist to one new output element. */
function copyAllowedAttributes(source: Element, output: HTMLElement): void {
  const tagName = output.localName;
  if (tagName === 'a') {
    const href = source.getAttribute('href');
    if (isSafeLinkHref(href)) {
      output.setAttribute('href', href);
      output.setAttribute('rel', SAFE_LINK_REL);
    }
    return;
  }
  if (tagName === 'ol') {
    const start = boundedIntegerAttribute(
      source.getAttribute('start'),
      -1_000_000,
      1_000_000,
    );
    if (start !== null) output.setAttribute('start', start);
    return;
  }
  if (tagName === 'td' || tagName === 'th') {
    for (const attribute of ['colspan', 'rowspan'] as const) {
      const value = boundedIntegerAttribute(
        source.getAttribute(attribute),
        1,
        100,
      );
      if (value !== null) output.setAttribute(attribute, value);
    }
  }
}

/** Return the output element name for one safe source element, or null to unwrap. */
function normalizedOutputElement(sourceName: string): string | null {
  const normalized = NORMALIZED_ELEMENTS[sourceName] ?? sourceName;
  return ALLOWED_ELEMENTS.has(normalized) ? normalized : null;
}

/** Push child frames in reverse so iterative traversal preserves source order. */
function pushChildren(
  stack: TraversalFrame[],
  sourceNode: globalThis.Node,
  outputParent: globalThis.Node,
  depth: number,
): void {
  for (let index = sourceNode.childNodes.length - 1; index >= 0; index -= 1) {
    const child = sourceNode.childNodes.item(index);
    if (child) stack.push({ sourceNode: child, outputParent, depth });
  }
}

/**
 * Reconstruct bounded untrusted clipboard HTML into Inkspan's semantic allowlist.
 *
 * The function performs no network, filesystem, storage, model, credential, or
 * clipboard-permission operation. It returns a detached HTML fragment string.
 */
export function sanitizeRichClipboardHtml(
  sourceHtml: string,
  config?: ClipboardConfig,
  documentOverride?: Document | null,
): string {
  const resolvedConfig = resolveClipboardConfig(config);
  if (typeof sourceHtml !== 'string') {
    throw new ClipboardSanitizationError('invalid_html');
  }
  if (
    new TextEncoder().encode(sourceHtml).byteLength > resolvedConfig.maxHtmlBytes
  ) {
    throw new ClipboardSanitizationError('input_too_large');
  }
  const sourceDocument = resolveClipboardDocument(documentOverride);

  try {
    const inertDocument = sourceDocument.implementation.createHTMLDocument('');
    const sourceTemplate = inertDocument.createElement('template');
    sourceTemplate.innerHTML = sourceHtml;
    const outputContainer = inertDocument.createElement('div');
    const stack: TraversalFrame[] = [];
    pushChildren(stack, sourceTemplate.content, outputContainer, 1);
    let visitedNodes = 0;

    while (stack.length > 0) {
      const frame = stack.pop();
      /* v8 ignore next -- stack length guarantees a frame. */
      if (!frame) continue;
      visitedNodes += 1;
      if (visitedNodes > resolvedConfig.maxNodes) {
        throw new ClipboardSanitizationError('node_limit_exceeded');
      }
      if (frame.depth > resolvedConfig.maxDepth) {
        throw new ClipboardSanitizationError('depth_limit_exceeded');
      }

      if (frame.sourceNode.nodeType === 3) {
        frame.outputParent.appendChild(
          inertDocument.createTextNode(frame.sourceNode.nodeValue ?? ''),
        );
        continue;
      }
      if (frame.sourceNode.nodeType !== 1) continue;

      const sourceElement = frame.sourceNode as Element;
      const sourceName = sourceElement.localName.toLowerCase();
      if (
        DROPPED_SUBTREES.has(sourceName) ||
        isHiddenClipboardElement(sourceElement)
      ) {
        continue;
      }

      const outputName = normalizedOutputElement(sourceName);
      let childParent = frame.outputParent;
      if (outputName !== null) {
        if (
          outputName === 'a' &&
          !isSafeLinkHref(sourceElement.getAttribute('href'))
        ) {
          childParent = frame.outputParent;
        } else {
          const outputElement = inertDocument.createElement(outputName);
          copyAllowedAttributes(sourceElement, outputElement);
          frame.outputParent.appendChild(outputElement);
          childParent = outputElement;
        }
      }

      const wrappers = semanticStyleWrappers(sourceElement).filter(
        (wrapper) => wrapper !== outputName,
      );
      for (const wrapperName of wrappers) {
        const wrapper = inertDocument.createElement(wrapperName);
        childParent.appendChild(wrapper);
        childParent = wrapper;
      }

      if (sourceName !== 'br' && sourceName !== 'hr') {
        pushChildren(stack, sourceElement, childParent, frame.depth + 1);
      }
    }
    return outputContainer.innerHTML;
  } catch (error) {
    if (error instanceof ClipboardSanitizationError) throw error;
    throw new ClipboardSanitizationError('invalid_html');
  }
}

/** Options held by the TipTap paste transformation extension. */
export interface SafeClipboardOptions extends ResolvedClipboardConfig {
  /** Original host configuration validated fail-closed only when HTML is pasted. */
  config?: ClipboardConfig;
  /** Latest host observer for redacted sanitizer failures. */
  onError?: (error: ClipboardSanitizationError) => void;
  /** Optional deterministic DOM document supplied by tests or controlled hosts. */
  document?: Document | null;
}

/** Shared TipTap extension that sanitizes `text/html` before ProseMirror parsing. */
export const SafeClipboard = Extension.create<SafeClipboardOptions>({
  name: 'safeClipboard',
  priority: SAFE_CLIPBOARD_PRIORITY,

  addOptions() {
    return {
      maxHtmlBytes: DEFAULT_CLIPBOARD_HTML_BYTES,
      maxNodes: DEFAULT_CLIPBOARD_MAX_NODES,
      maxDepth: DEFAULT_CLIPBOARD_MAX_DEPTH,
      config: undefined,
      onError: undefined,
      document: undefined,
    };
  },

  transformPastedHTML(html: string) {
    try {
      const config =
        this.options.config === undefined
          ? {
              maxHtmlBytes: this.options.maxHtmlBytes,
              maxNodes: this.options.maxNodes,
              maxDepth: this.options.maxDepth,
            }
          : this.options.config;
      return sanitizeRichClipboardHtml(html, config, this.options.document);
    } catch (error) {
      const clipboardError =
        error instanceof ClipboardSanitizationError
          ? error
          : new ClipboardSanitizationError('invalid_html');
      try {
        this.options.onError?.(clipboardError);
      } catch {
        // Host observers cannot weaken the fail-closed paste boundary.
      }
      return '';
    }
  },
});

export default SafeClipboard;
