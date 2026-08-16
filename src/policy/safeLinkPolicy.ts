/**
 * Framework-neutral hyperlink policy shared by Inkspan serializers and editor adapters.
 *
 * The policy permits HTTPS/HTTP, mailto, tel, document-relative, query-only,
 * and fragment links while rejecting protocol-relative targets, executable or
 * local schemes, embedded credentials, backslashes, literal whitespace/control
 * characters, malformed absolute URLs, and unknown schemes.
 */
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

/** Error thrown when a hyperlink target violates Inkspan's safe-URI policy. */
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
    if (!payload.startsWith('//')) {
      throw new SafeLinkHrefError(href);
    }
    validateWebHref(href);
  }
  return href;
}

/** Boolean adapter for callers that need predicate-style URI validation. */
export function isSafeLinkHref(href: unknown): href is string {
  try {
    validateSafeLinkHref(href);
    return true;
  } catch {
    return false;
  }
}
