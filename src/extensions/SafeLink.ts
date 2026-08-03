/**
 * SafeLink — a TipTap link extension with one strict URI policy across editor
 * input, commands, paste/autolink, direct ProseMirror transactions,
 * collaboration updates, and HTML serialization.
 *
 * Inkspan permits HTTPS/HTTP, mailto, tel, document-relative, query-only, and
 * fragment links. Protocol-relative URLs, executable/local schemes, embedded
 * credentials, backslashes, literal whitespace/control characters, malformed
 * absolute URLs, and unknown schemes are rejected.
 */
import Link from '@tiptap/extension-link';
import { Plugin, PluginKey } from '@tiptap/pm/state';

const SAFE_ABSOLUTE_SCHEMES = new Set(['http', 'https', 'mailto', 'tel']);
const URI_SCHEME_PATTERN = /^([a-z][a-z0-9+.-]*):/i;
const FORBIDDEN_LINK_CHARACTER_PATTERN = /[\u0000-\u0020\u007f-\u009f\\]/u;

/** Return a bounded, secret-free category for an untrusted hyperlink target. */
function redactLinkHref(href: unknown): string {
  if (typeof href !== 'string') return `<${typeof href}>`;
  if (href.length === 0) return '<empty>';
  if (href.startsWith('//')) return '//<redacted>';
  if (href.startsWith('#')) return '#<redacted>';
  const scheme = URI_SCHEME_PATTERN.exec(href)?.[1];
  if (scheme) return `${scheme.toLowerCase()}:<redacted>`;
  return '<relative>';
}

/** Error thrown when a hyperlink target violates Inkspan's URI policy. */
export class SafeLinkHrefError extends Error {
  /** Redacted target category safe for logs and host telemetry. */
  readonly hrefPreview: string;

  constructor(href: unknown) {
    const hrefPreview = redactLinkHref(href);
    super(`Link target violates the Inkspan safe-URI policy (${hrefPreview}).`);
    this.name = 'SafeLinkHrefError';
    this.hrefPreview = hrefPreview;
  }
}

/** Validate an HTTP(S) URL and reject deceptive embedded credentials. */
function validateWebHref(href: string): void {
  let parsed: URL;
  try {
    parsed = new URL(href);
  } catch {
    throw new SafeLinkHrefError(href);
  }
  if (parsed.username || parsed.password) {
    throw new SafeLinkHrefError(href);
  }
}

/**
 * Validate an untrusted link target without trimming or normalization.
 *
 * Allowed targets are absolute HTTP(S), non-empty mailto/tel, and ordinary
 * document-relative/query/fragment references. Literal whitespace, control
 * characters, and backslashes are rejected rather than canonicalized so an
 * obfuscated executable scheme cannot acquire a different browser meaning.
 */
export function validateSafeLinkHref(href: unknown): string {
  if (
    typeof href !== 'string' ||
    href.length === 0 ||
    FORBIDDEN_LINK_CHARACTER_PATTERN.test(href) ||
    href.startsWith('//')
  ) {
    throw new SafeLinkHrefError(href);
  }

  const scheme = URI_SCHEME_PATTERN.exec(href)?.[1]?.toLowerCase();
  if (!scheme) return href;
  if (!SAFE_ABSOLUTE_SCHEMES.has(scheme)) {
    throw new SafeLinkHrefError(href);
  }

  const payload = href.slice(scheme.length + 1);
  if (payload.length === 0) {
    throw new SafeLinkHrefError(href);
  }
  if (scheme === 'http' || scheme === 'https') {
    if (!href.slice(scheme.length + 1).startsWith('//')) {
      throw new SafeLinkHrefError(href);
    }
    validateWebHref(href);
  }
  return href;
}

/** Boolean adapter for TipTap's URI-validation hooks. */
export function isSafeLinkHref(href: unknown): href is string {
  try {
    validateSafeLinkHref(href);
    return true;
  } catch {
    return false;
  }
}

/** ProseMirror plugin key for the direct-transaction safety boundary. */
export const safeLinkPluginKey = new PluginKey('cwlSafeLink');

/** Return true when every link mark in a document has a safe target. */
function documentHasOnlySafeLinks(documentNode: Parameters<Plugin['spec']['filterTransaction']>[0]['doc']): boolean {
  let safe = true;
  documentNode.descendants((node) => {
    if (!safe) return false;
    for (const mark of node.marks) {
      if (mark.type.name !== 'link') continue;
      if (!isSafeLinkHref(mark.attrs.href)) {
        safe = false;
        return false;
      }
    }
    return true;
  });
  return safe;
}

/**
 * Strict Link extension. Configure `isAllowedUri` when adding it to an editor;
 * the additional transaction filter closes command-bypass and CRDT ingress.
 */
export const SafeLink = Link.extend({
  addProseMirrorPlugins() {
    /* v8 ignore next -- SafeLink always extends TipTap's Link extension. */
    const parentPlugins = this.parent?.() ?? [];
    return [
      ...parentPlugins,
      new Plugin({
        key: safeLinkPluginKey,
        filterTransaction: (transaction) =>
          !transaction.docChanged || documentHasOnlySafeLinks(transaction.doc),
      }),
    ];
  },
});

export default SafeLink;
