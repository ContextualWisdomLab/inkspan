import {
  markdownToEditorHtml as serializeMarkdownToEditorHtml,
  markdownToEmailHtml as serializeMarkdownToEmailHtml,
  markdownToHtml as serializeMarkdownToHtml,
  normalizeMarkdown as serializeNormalizedMarkdown,
} from './serializer.js';
import type { MarkdownToEmailHtmlOptions as SerializerMarkdownToEmailHtmlOptions } from './serializer.js';
import {
  DEFAULT_MARKDOWN_TO_HTML_MAX_BYTES,
  MarkdownToHtmlResourceError,
  assertMarkdownToHtmlInputSize,
  resolveMarkdownToHtmlMaxBytes,
} from './markdownToHtmlResourcePolicy.js';

const EMAIL_LANGUAGE_TAG_MAX_CODE_UNITS = 256;
const EMAIL_TITLE_MAX_CODE_UNITS = 65_536;
const INVALID_EMAIL_FULL_DOCUMENT_MESSAGE =
  'Email document fullDocument must be a boolean when provided.';
const INVALID_EMAIL_LANGUAGE_MESSAGE =
  'Email document language must be a valid BCP 47 language tag within the supported length.';
const INVALID_EMAIL_TITLE_MESSAGE =
  'Email document title must be a string within the supported length.';
const MARKDOWN_OPTION_KEYS = new Set(['maxMarkdownBytes']);
const EMAIL_OPTION_KEYS = new Set([
  'maxMarkdownBytes',
  'fullDocument',
  'title',
  'languageTag',
  'textDirection',
]);

type ResolvedOptionBag = Record<string, unknown>;

/** Options for public Markdown-to-HTML conversion. */
export interface MarkdownToHtmlOptions {
  /** Maximum UTF-8 bytes accepted before Marked lexing. Defaults to 16 MiB. */
  maxMarkdownBytes?: number;
}

/** Options for public Markdown normalization. */
export interface NormalizeMarkdownOptions {
  /** Maximum UTF-8 bytes accepted before Marked lexing. Defaults to 16 MiB. */
  maxMarkdownBytes?: number;
}

/** Options for public Markdown-to-email-HTML conversion. */
export interface MarkdownToEmailHtmlOptions
  extends SerializerMarkdownToEmailHtmlOptions {
  /** Maximum UTF-8 bytes accepted before Marked lexing. Defaults to 16 MiB. */
  maxMarkdownBytes?: number;
}

function resolveOptionBag(
  options: unknown,
  allowedKeys: ReadonlySet<string>,
): ResolvedOptionBag {
  try {
    if (typeof options !== 'object' || options === null || Array.isArray(options)) {
      throw new MarkdownToHtmlResourceError('invalid_configuration');
    }
    const prototype = Object.getPrototypeOf(options);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new MarkdownToHtmlResourceError('invalid_configuration');
    }
    const descriptors = Object.getOwnPropertyDescriptors(options);
    const resolved = Object.create(null) as ResolvedOptionBag;
    for (const key of Reflect.ownKeys(descriptors)) {
      if (typeof key !== 'string' || !allowedKeys.has(key)) {
        throw new MarkdownToHtmlResourceError('invalid_configuration');
      }
      const descriptor = descriptors[key];
      if (!descriptor.enumerable || !('value' in descriptor)) {
        throw new MarkdownToHtmlResourceError('invalid_configuration');
      }
      resolved[key] = descriptor.value;
    }
    return resolved;
  } catch {
    throw new MarkdownToHtmlResourceError('invalid_configuration');
  }
}

/** Apply the owned default Markdown ceiling before an internal conversion. */
function assertDefaultMarkdownInputSize(markdown: string): void {
  assertMarkdownToHtmlInputSize(markdown, DEFAULT_MARKDOWN_TO_HTML_MAX_BYTES);
}

/** Apply one caller-selectable Markdown ceiling before Marked materialization. */
function assertConfiguredMarkdownInputSize(
  markdown: string,
  maxMarkdownBytes: unknown,
): void {
  const resolvedMaxBytes = resolveMarkdownToHtmlMaxBytes(maxMarkdownBytes);
  assertMarkdownToHtmlInputSize(markdown, resolvedMaxBytes);
}

/** Reject malformed runtime document-mode values without coercing representation. */
function assertEmailFullDocumentMode(
  value: unknown,
): asserts value is boolean | undefined {
  if (value !== undefined && typeof value !== 'boolean') {
    throw new RangeError(INVALID_EMAIL_FULL_DOCUMENT_MESSAGE);
  }
}

/** Reject invalid or oversized full-document title metadata before HTML escaping. */
function assertBoundedEmailTitle(value: unknown): void {
  if (value === undefined) return;
  if (typeof value !== 'string' || value.length > EMAIL_TITLE_MAX_CODE_UNITS) {
    throw new RangeError(INVALID_EMAIL_TITLE_MESSAGE);
  }
}

/** Reject invalid or oversized full-document language metadata before Intl work. */
function assertBoundedEmailLanguageTag(value: unknown): void {
  if (value === undefined) return;
  if (
    typeof value !== 'string' ||
    value.length > EMAIL_LANGUAGE_TAG_MAX_CODE_UNITS
  ) {
    throw new RangeError(INVALID_EMAIL_LANGUAGE_MESSAGE);
  }
}

/** Convert bounded Markdown to parser HTML for TipTap ingress. */
export function markdownToEditorHtml(markdown: string): string {
  assertDefaultMarkdownInputSize(markdown);
  return serializeMarkdownToEditorHtml(markdown);
}

/** Convert bounded Markdown to safe standalone HTML. */
export function markdownToHtml(
  markdown: string,
  options: MarkdownToHtmlOptions = {},
): string {
  const resolvedOptions = resolveOptionBag(options, MARKDOWN_OPTION_KEYS);
  assertConfiguredMarkdownInputSize(markdown, resolvedOptions.maxMarkdownBytes);
  return serializeMarkdownToHtml(markdown);
}

/** Normalize bounded Markdown through the existing deterministic serializer. */
export function normalizeMarkdown(
  markdown: string,
  options: NormalizeMarkdownOptions = {},
): string {
  const resolvedOptions = resolveOptionBag(options, MARKDOWN_OPTION_KEYS);
  assertConfiguredMarkdownInputSize(markdown, resolvedOptions.maxMarkdownBytes);
  return serializeNormalizedMarkdown(markdown);
}

/** Convert bounded Markdown to the existing safe email HTML representation. */
export function markdownToEmailHtml(
  markdown: string,
  options: MarkdownToEmailHtmlOptions = {},
): string {
  const resolvedOptions = resolveOptionBag(options, EMAIL_OPTION_KEYS);
  assertConfiguredMarkdownInputSize(markdown, resolvedOptions.maxMarkdownBytes);
  const fullDocument = resolvedOptions.fullDocument;
  assertEmailFullDocumentMode(fullDocument);
  if (fullDocument === true) {
    assertBoundedEmailTitle(resolvedOptions.title);
    assertBoundedEmailLanguageTag(resolvedOptions.languageTag);
  }
  const serializerOptions: SerializerMarkdownToEmailHtmlOptions = {
    fullDocument,
    title: resolvedOptions.title as SerializerMarkdownToEmailHtmlOptions['title'],
    languageTag:
      resolvedOptions.languageTag as SerializerMarkdownToEmailHtmlOptions['languageTag'],
    textDirection:
      resolvedOptions.textDirection as SerializerMarkdownToEmailHtmlOptions['textDirection'],
  };
  return serializeMarkdownToEmailHtml(markdown, serializerOptions);
}
