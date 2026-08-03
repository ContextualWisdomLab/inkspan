/**
 * Markdown <-> HTML serialization tuned for the editor.
 *
 * Uses `marked` (CommonMark + GFM) for Markdown -> HTML and `turndown`
 * (+ GFM plugin for tables/strikethrough) for HTML -> Markdown. Both are MIT.
 *
 * The important guarantees for this project: base64 raster data-URI images
 * survive a full round-trip, external/active images never become network-capable
 * standalone HTML, raw Markdown HTML is escaped, and hyperlink targets use the
 * same safe-URI policy as the editor.
 */
import { Marked, type Tokens } from 'marked';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { validateInlineImageSource } from '../extensions/Base64Image.js';
import { isSafeLinkHref } from '../extensions/SafeLink.js';

const SERIALIZED_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

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
    html({ text }: Tokens.HTML) {
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

function createTurndown(): TurndownService {
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
  // Preserve images verbatim — including long base64 data URIs — instead of
  // dropping or truncating the src.
  service.addRule('inlineImage', {
    filter: 'img',
    replacement: (_content, node) => {
      const el = node as unknown as HTMLElement;
      const alt = el.getAttribute('alt') ?? '';
      const src = el.getAttribute('src') ?? '';
      const title = el.getAttribute('title');
      if (!src) return '';
      const titlePart = title ? ` "${title}"` : '';
      return `![${alt}](${src}${titlePart})`;
    },
  });
  return service;
}

const turndown = createTurndown();

/** Convert an HTML string to Markdown. */
export function htmlToMarkdown(html: string): string {
  return turndown.turndown(html);
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
  return [
    '<!DOCTYPE html>',
    '<html>',
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
