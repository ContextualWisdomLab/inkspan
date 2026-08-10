/**
 * Markdown <-> HTML serialization tuned for the editor.
 *
 * Uses `marked` (CommonMark + GFM) for Markdown -> HTML and `turndown`
 * (+ GFM plugin for tables/strikethrough) for HTML -> Markdown. Both are MIT.
 *
 * The important guarantees for this project: base64 raster data-URI images
 * survive a full round-trip, external/active images never become network-capable
 * standalone HTML or Markdown, raw Markdown HTML is escaped, and hyperlink
 * targets use the same safe-URI policy as the editor.
 */
import { Marked, type Tokens } from 'marked';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { validateInlineImageSource } from '../policy/inlineImagePolicy.js';
import { isSafeLinkHref } from '../policy/safeLinkPolicy.js';

const SERIALIZED_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

const REMOVED_HTML_ELEMENTS = new Set([
  'audio',
  'base',
  'canvas',
  'embed',
  'iframe',
  'link',
  'math',
  'meta',
  'noscript',
  'object',
  'picture',
  'script',
  'source',
  'style',
  'svg',
  'template',
  'track',
  'video',
]);

const ALLOWED_HTML_ATTRIBUTES = new Map<string, ReadonlySet<string>>([
  ['a', new Set(['href', 'title'])],
  ['code', new Set(['class'])],
  ['img', new Set(['alt', 'src', 'title'])],
  ['input', new Set(['checked', 'type'])],
  ['ol', new Set(['start'])],
]);

const editorMarked = new Marked({
  gfm: true,
  breaks: false,
});

const marked = new Marked({
  gfm: true,
  breaks: false,
});

marked.use({
  renderer: {
    html({ text }: Tokens.HTML | Tokens.Tag) {
      return escapeHtml(text);
    },
    link({ href, title, tokens }: Tokens.Link) {
      const content = this.parser.parseInline(tokens);
      if (!isSafeLinkHref(href)) return content;
      const titleAttribute = title
        ? ` title="${escapeHtml(title)}"`
        : '';
      return `<a href="${escapeHtml(href)}"${titleAttribute} rel="noopener noreferrer nofollow">${content}</a>`;
    },
    image({ href, title, text }: Tokens.Image) {
      let source: string;
      try {
        source = validateInlineImageSource(
          href,
          SERIALIZED_IMAGE_MAX_BYTES,
        );
      } catch {
        return `<span data-cwl-rejected-image="true">${escapeHtml(text)}</span>`;
      }
      const titleAttribute = title
        ? ` title="${escapeHtml(title)}"`
        : '';
      return `<img src="${escapeHtml(source)}" alt="${escapeHtml(text)}"${titleAttribute}>`;
    },
  },
});

/**
 * Convert Markdown to parser HTML for TipTap ingress.
 *
 * This internal path intentionally leaves image/link source attributes for the
 * TipTap extensions to validate. That lets `Base64Image` report rejected image
 * sources through the host's `onImageError` callback before discarding them.
 * Standalone callers must use {@link markdownToHtml}, which escapes raw HTML and
 * emits only safe links and strict inline raster images.
 */
export function markdownToEditorHtml(markdown: string): string {
  return editorMarked.parse(markdown, { async: false }) as string;
}

/** Convert a Markdown string to safe standalone HTML. */
export function markdownToHtml(markdown: string): string {
  return marked.parse(markdown, { async: false }) as string;
}

/** Format a safe URI as a CommonMark inline-link destination. */
function formatMarkdownDestination(value: string): string {
  const escaped = value.replace(/</g, '%3C').replace(/>/g, '%3E');
  return /[()<>]/u.test(value) ? `<${escaped}>` : escaped;
}

/** Escape authored text used inside a Markdown link/image label. */
function escapeMarkdownLabel(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/[\r\n]+/g, ' ');
}

/** Escape rejected image alternative text as ordinary Markdown text. */
function escapeMarkdownText(value: string): string {
  return value
    .replace(/[\r\n]+/g, ' ')
    .replace(/([\\`*_[\]{}()#+\-.!>|])/g, '\\$1');
}

/** Format a bounded Markdown title without permitting line-break injection. */
function formatMarkdownTitle(value: string | null): string {
  if (!value) return '';
  const escaped = value
    .replace(/[\u0000-\u001f\u007f-\u009f]+/gu, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');
  return ` "${escaped}"`;
}

/**
 * Remove non-text elements and unrelated/resource-bearing attributes from an
 * inert browser template fragment before Turndown sees it.
 */
function sanitizeInertHtmlFragment(fragment: DocumentFragment): DocumentFragment {
  for (const element of Array.from(fragment.querySelectorAll('*'))) {
    const elementName = element.localName;
    if (REMOVED_HTML_ELEMENTS.has(elementName)) {
      element.remove();
      continue;
    }

    const allowedAttributes = ALLOWED_HTML_ATTRIBUTES.get(elementName);
    for (const attribute of Array.from(element.attributes)) {
      if (!allowedAttributes?.has(attribute.name.toLowerCase())) {
        element.removeAttribute(attribute.name);
      }
    }

    if (elementName === 'a') {
      const href = element.getAttribute('href');
      if (!isSafeLinkHref(href)) {
        element.removeAttribute('href');
        element.removeAttribute('title');
      }
    } else if (elementName === 'img') {
      const source = element.getAttribute('src');
      try {
        element.setAttribute(
          'src',
          validateInlineImageSource(source, SERIALIZED_IMAGE_MAX_BYTES),
        );
      } catch {
        element.removeAttribute('src');
        element.removeAttribute('title');
      }
    } else if (elementName === 'input') {
      if (element.getAttribute('type')?.toLowerCase() === 'checkbox') {
        element.setAttribute('type', 'checkbox');
      } else {
        element.removeAttribute('type');
        element.removeAttribute('checked');
      }
    }
  }
  return fragment;
}

/** Parse browser HTML into an inert, detached template document fragment. */
function createInertBrowserFragment(html: string): DocumentFragment | null {
  /* v8 ignore next -- browserless runtimes must not touch ambient document. */
  if (typeof window === 'undefined') return null;
  const template = window.document.createElement('template');
  template.innerHTML = html;
  return sanitizeInertHtmlFragment(template.content);
}

function createTurndown(includeImageAlt: boolean): TurndownService {
  const service = new TurndownService({
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    fence: '```',
    emDelimiter: '*',
    strongDelimiter: '**',
    linkStyle: 'inlined',
  });
  service.use(gfm);
  service.remove(
    Array.from(REMOVED_HTML_ELEMENTS) as Array<keyof HTMLElementTagNameMap>,
  );
  service.addRule('safeLink', {
    filter: 'a',
    replacement: (content, node) => {
      const element = node as unknown as HTMLElement;
      const href = element.getAttribute('href');
      if (!isSafeLinkHref(href)) return content;
      return `[${content}](${formatMarkdownDestination(href)}${formatMarkdownTitle(element.getAttribute('title'))})`;
    },
  });
  service.addRule('inlineImage', {
    filter: 'img',
    replacement: (_content, node) => {
      const element = node as unknown as HTMLElement;
      const alt = includeImageAlt ? (element.getAttribute('alt') ?? '') : '';
      const source = element.getAttribute('src');
      let validatedSource: string;
      try {
        validatedSource = validateInlineImageSource(
          source,
          SERIALIZED_IMAGE_MAX_BYTES,
        );
      } catch {
        return escapeMarkdownText(alt);
      }
      return `![${escapeMarkdownLabel(alt)}](${formatMarkdownDestination(validatedSource)}${formatMarkdownTitle(element.getAttribute('title'))})`;
    },
  });
  return service;
}

const turndownWithImageAlt = createTurndown(true);
const turndownWithoutImageAlt = createTurndown(false);

/** Options for {@link htmlToMarkdown}. */
export interface HtmlToMarkdownOptions {
  /** Include image alternative text in converted Markdown. Defaults to true. */
  includeImageAlt?: boolean;
}

/**
 * Convert an HTML string to Markdown through an inert, fail-closed boundary.
 *
 * In browsers, the raw string is parsed only inside a detached `<template>` and
 * sanitized before the resulting `DocumentFragment` reaches Turndown. In
 * browserless Node runtimes, Turndown 7 uses its non-fetching Domino parser.
 * Both paths emit Markdown links only for Inkspan-safe targets and Markdown
 * images only for strict inline base64 raster sources.
 */
export function htmlToMarkdown(
  html: string,
  options: HtmlToMarkdownOptions = {},
): string {
  const fragment = createInertBrowserFragment(html);
  const turndown = options.includeImageAlt === false
    ? turndownWithoutImageAlt
    : turndownWithImageAlt;
  /* v8 ignore next 3 -- packed Node consumer verification exercises this DOM-free fallback. */
  if (!fragment) {
    return turndown.turndown(html);
  }
  return turndown.turndown(fragment as unknown as HTMLElement);
}

/** Round-trip helper: Markdown -> safe HTML -> Markdown. */
export function normalizeMarkdown(markdown: string): string {
  return htmlToMarkdown(markdownToHtml(markdown));
}

/** Options for {@link markdownToEmailHtml}. */
export interface MarkdownToEmailHtmlOptions {
  /**
   * When true, wrap the body fragment in a minimal HTML document with a
   * UTF-8 charset meta (many MUAs need this). Default false — fragment only.
   */
  fullDocument?: boolean;
  /** Document `<title>` when `fullDocument` is true. Default `"Message"`. */
  title?: string;
  /**
   * Primary document language for the generated root `<html>` element.
   *
   * Applied only when `fullDocument` is true. Blank values are omitted. A
   * non-blank value must be accepted by the runtime's ECMA-402 locale parser;
   * the canonicalized locale is emitted as the BCP 47 `lang` value.
   */
  languageTag?: string;
  /**
   * Base writing direction for the generated root `<html>` element.
   * Applied only when `fullDocument` is true. Runtime callers are validated as
   * well as TypeScript callers so untyped input cannot create raw attributes.
   */
  textDirection?: 'ltr' | 'rtl' | 'auto';
}

/** Canonicalize one optional full-document language tag or fail closed. */
function canonicalizeEmailLanguageTag(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  try {
    return Intl.getCanonicalLocales(normalized).join('');
  } catch {
    throw new RangeError(
      'Email document language must be a valid BCP 47 language tag supported by Intl.',
    );
  }
}

/** Validate one optional full-document direction at the runtime trust boundary. */
function validateEmailTextDirection(
  value: MarkdownToEmailHtmlOptions['textDirection'],
): 'ltr' | 'rtl' | 'auto' | undefined {
  if (value === undefined || value === 'ltr' || value === 'rtl' || value === 'auto') {
    return value;
  }
  throw new RangeError('Email document direction must be ltr, rtl, or auto.');
}

/**
 * Convert Markdown to HTML suitable for **email compose / send** paths
 * (inkspan.io, naruon mail, etc.).
 *
 * - Same GFM/CommonMark pipeline as {@link markdownToHtml}
 * - Raw HTML in Markdown is escaped rather than interpreted
 * - Only strict inline base64 raster images can become `<img>` elements
 * - Unsafe, local, executable, credential-bearing, and protocol-relative link
 *   targets are emitted as ordinary text rather than clickable anchors
 * - Returns a body fragment by default; set `fullDocument: true` for a
 *   self-contained document shell
 * - Full documents can preserve a canonicalized document language and explicit
 *   runtime-validated `ltr`, `rtl`, or `auto` base direction on the root
 *   `<html>` element
 *
 * This is the intentional commercial bridge from the editor's Markdown mode
 * to an HTML email body — not a full MIME multipart builder.
 */
export function markdownToEmailHtml(
  markdown: string,
  options: MarkdownToEmailHtmlOptions = {},
): string {
  const body = markdownToHtml(markdown).trim();
  if (!options.fullDocument) return body;
  const title = escapeHtml(options.title ?? 'Message');
  const languageTag = canonicalizeEmailLanguageTag(options.languageTag);
  const textDirection = validateEmailTextDirection(options.textDirection);
  const languageAttribute = languageTag
    ? ` lang="${escapeHtml(languageTag)}"`
    : '';
  const directionAttribute = textDirection
    ? ` dir="${textDirection}"`
    : '';
  return [
    '<!DOCTYPE html>',
    `<html${languageAttribute}${directionAttribute}>`,
    '<head>',
    '<meta charset="utf-8" />',
    `<title>${title}</title>`,
    '</head>',
    `<body>${body}</body>`,
    '</html>',
  ].join('');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
