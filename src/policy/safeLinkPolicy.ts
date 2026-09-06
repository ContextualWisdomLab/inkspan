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

/** Default maximum UTF-8 byte length accepted for one hyperlink target. */
export const DEFAULT_SAFE_LINK_MAX_HREF_BYTES = 65_536;
/** Hard maximum caller-selected UTF-8 byte length for one hyperlink target. */
export const MAXIMUM_SAFE_LINK_MAX_HREF_BYTES = 1_048_576;
const SAFE_LINK_CONFIGURATION_KEYS = ['maxHrefBytes'] as const;

/** Runtime configuration for one safe-link validation operation. */
export interface SafeLinkValidationOptions {
  /** Maximum UTF-8 bytes accepted before URI parsing. Defaults to 64 KiB. */
  readonly maxHrefBytes?: number;
}

/** Machine-readable safe-link failure category. */
export type SafeLinkHrefErrorCode =
  | 'invalid_href'
  | 'input_too_large'
  | 'invalid_configuration';

/** Return a bounded, secret-free category for an untrusted hyperlink target. */
function redactLinkHref(href: unknown, code: SafeLinkHrefErrorCode): string {
  if (code === 'input_too_large') return '<oversized>';
  if (code === 'invalid_configuration') return '<configuration>';
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
  /** Stable machine-readable failure category. */
  readonly code: SafeLinkHrefErrorCode;
  /** Redacted target category safe for logs and host telemetry. */
  readonly hrefPreview: string;

  constructor(
    href: unknown,
    code: SafeLinkHrefErrorCode = 'invalid_href',
  ) {
    const hrefPreview = redactLinkHref(href, code);
    const message =
      code === 'input_too_large'
        ? `Link target exceeds the Inkspan resource boundary (${hrefPreview}).`
        : code === 'invalid_configuration'
          ? `Link validation configuration is invalid (${hrefPreview}).`
          : `Link target violates the Inkspan safe-URI policy (${hrefPreview}).`;
    super(message);
    this.name = 'SafeLinkHrefError';
    this.code = code;
    this.hrefPreview = hrefPreview;
  }
}

/** Resolve and validate the caller-selected resource ceiling without invoking accessors. */
function resolveSafeLinkMaxHrefBytes(options: unknown): number {
  if (options === undefined) return DEFAULT_SAFE_LINK_MAX_HREF_BYTES;
  try {
    if (
      typeof options !== 'object' ||
      options === null ||
      Array.isArray(options)
    ) {
      throw new TypeError('invalid configuration container');
    }

    const keys = Reflect.ownKeys(options);
    if (
      keys.some(
        (key) =>
          typeof key !== 'string' ||
          !SAFE_LINK_CONFIGURATION_KEYS.includes(
            key as (typeof SAFE_LINK_CONFIGURATION_KEYS)[number],
          ),
      )
    ) {
      throw new TypeError('unknown configuration key');
    }
    if (!keys.includes('maxHrefBytes')) return DEFAULT_SAFE_LINK_MAX_HREF_BYTES;

    const descriptor = Object.getOwnPropertyDescriptor(options, 'maxHrefBytes');
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
      throw new TypeError('invalid configuration property');
    }
    const value = descriptor.value as unknown;
    if (value === undefined) return DEFAULT_SAFE_LINK_MAX_HREF_BYTES;
    if (
      typeof value !== 'number' ||
      !Number.isSafeInteger(value) ||
      value <= 0 ||
      value > MAXIMUM_SAFE_LINK_MAX_HREF_BYTES
    ) {
      throw new TypeError('invalid resource ceiling');
    }
    return value;
  } catch {
    throw new SafeLinkHrefError(undefined, 'invalid_configuration');
  }
}

/** Enforce one UTF-8 byte ceiling before URI parsing. */
function assertSafeLinkResourceBound(href: string, maxHrefBytes: number): void {
  // UTF-8 uses at least one byte per UTF-16 code unit. Reject the obvious
  // oversize case before allocating a complete encoded copy.
  if (href.length > maxHrefBytes) {
    throw new SafeLinkHrefError(href, 'input_too_large');
  }
  if (new TextEncoder().encode(href).byteLength > maxHrefBytes) {
    throw new SafeLinkHrefError(href, 'input_too_large');
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
 * The complete target must fit the configured local UTF-8 resource ceiling
 * before any HTTP(S) URL parser is invoked.
 */
export function validateSafeLinkHref(
  href: unknown,
  options?: SafeLinkValidationOptions,
): string {
  const maxHrefBytes = resolveSafeLinkMaxHrefBytes(options);
  if (typeof href === 'string') {
    assertSafeLinkResourceBound(href, maxHrefBytes);
  }
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
export function isSafeLinkHref(
  href: unknown,
  options?: SafeLinkValidationOptions,
): href is string {
  try {
    validateSafeLinkHref(href, options);
    return true;
  } catch {
    return false;
  }
}
