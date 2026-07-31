/**
 * Markdown <-> HTML serialization tuned for the editor.
 *
 * Uses `marked` (CommonMark + GFM) for Markdown -> HTML and `turndown`
 * (+ GFM plugin for tables/strikethrough) for HTML -> Markdown. Both are MIT.
 *
 * The important guarantee for this project: **base64 data-URI images survive a
 * full round-trip** in both directions, so an embedded figure stays inline and
 * remains readable by a downstream LLM.
 */
import { Marked } from 'marked';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

const marked = new Marked({
  gfm: true,
  breaks: false,
});

/** Convert a Markdown string to HTML. */
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

/** Round-trip helper: Markdown -> HTML -> Markdown (useful in tests/tools). */
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
 * - **Base64 data-URI images are preserved** so figures stay inline in the
 *   message body without a separate attachment pipeline
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
