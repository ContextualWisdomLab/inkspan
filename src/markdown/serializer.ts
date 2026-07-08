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
