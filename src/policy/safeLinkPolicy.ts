/**
 * Framework-neutral hyperlink policy shared by Inkspan serializers and editor adapters.
 *
 * The policy permits HTTPS/HTTP, mailto, tel, document-relative, query-only,
 * and fragment links while rejecting protocol-relative targets, executable or
 * local schemes, embedded credentials, backslashes, literal whitespace/control
 * characters, malformed absolute URLs, unknown schemes, and resource inputs
 * that exceed the configured validation ceiling.
 */
const SAFE_ABSOLUTE_SCHEMES = new Set(['http', 'https', 'mailto', 'tel']);
const URI_SCHEME_PATTERN = /^([a-z][a-z0-9+.-]*):/i;
const FORBIDDEN_LINK_CHARACTER_PATTERN = /[\u0000-\u0020\u007f-\u009f\\]/u;
const SAFE_LINK_CONFIGURATION_KEYS = ['maxHrefBytes'] as const;

/** Default UTF-8 byte ceiling for one untrusted hyperlink target. */
export const DEFAULT_SAFE_LINK_MAX_HREF_BYTES = 65_536;

/** Hard public ceiling for an explicitly raised hyperlink target limit. */
export const MAXIMUM_SAFE_LINK_MAX_HREF_BYTES = 1_048_576;

/** Options for one safe-link validation operation. */
export interface SafeLinkValidationOptions {
  /**
   * Maximum UTF-8 bytes accepted before URI parsing. Defaults to 64 KiB and
   * cannot exceed the 1 MiB public hard maximum.
   */
  readonly maxHrefBytes?: number;
}

/** Stable machine-readable categories for safe-link validation failures. */
export type SafeLinkHrefErrorCode =
  | 'invalid_href'
  | 'input_too_large'
  | 'invalid_configuration';

const ERROR_MESSAGES: Readonly<Record<SafeLinkHrefErrorCode, string>> =
  Object.freeze({
    invalid_href: 'Link target violates the Inkspan safe-URI policy.',
    input_too_large: 'Link target exceeds the configured byte limit.',
    invalid_configuration: 'Safe-link resource configuration is invalid.',
  });

const STATIC_ERROR_PREVIEWS: Readonly<
  Partial<Record<SafeLinkHrefErrorCode, string>>
> = Object.freeze({
  input_too_large: '<oversized>',
  invalid_configuration: '<configuration>',
});

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
  /** Machine-readable rejection category safe for host telemetry. */
  readonly code: SafeLinkHrefErrorCode;

  /** Redacted target category safe for logs and host telemetry. */
  readonly hrefPreview: string;

  /** Create one stable, payload-redacted safe-link validation error. */
  constructor(href: unknown, code: SafeLinkHrefErrorCode = 'invalid_href') {
    const hrefPreview = STATIC_ERROR_PREVIEWS[code] ?? redactLinkHref(href);
    super(ERROR_MESSAGES[code]);
    this.name = 'SafeLinkHrefError';
    this.code = code;
    this.hrefPreview = hrefPreview;
  }
}

/** Create one stable fail-closed configuration error. */
function invalidConfiguration(): SafeLinkHrefError {
  return new SafeLinkHrefError(undefined, 'invalid_configuration');
}

/** Resolve one optional per-call hyperlink byte ceiling without invoking accessors. */
function resolveSafeLinkMaxHrefBytes(
  options: SafeLinkValidationOptions | undefined,
): number {
  if (options === undefined) return DEFAULT_SAFE_LINK_MAX_HREF_BYTES;
  try {
    if (typeof options !== 'object' || options === null || Array.isArray(options)) {
      throw invalidConfiguration();
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
      throw invalidConfiguration();
    }

    const descriptor = Object.getOwnPropertyDescriptor(options, 'maxHrefBytes');
    if (descriptor === undefined) return DEFAULT_SAFE_LINK_MAX_HREF_BYTES;
    if (
      !descriptor.enumerable ||
      !Object.prototype.hasOwnProperty.call(descriptor, 'value')
    ) {
      throw invalidConfiguration();
    }

    const candidate = descriptor.value;
    if (
      typeof candidate !== 'number' ||
      !Number.isSafeInteger(candidate) ||
      candidate < 1 ||
      candidate > MAXIMUM_SAFE_LINK_MAX_HREF_BYTES
    ) {
      throw invalidConfiguration();
    }
    return candidate;
  } catch (error) {
    if (
      error instanceof SafeLinkHrefError &&
      error.code === 'invalid_configuration'
    ) {
      throw error;
    }
    throw invalidConfiguration();
  }
}

/** Reject oversized link targets before URI parsing or unbounded UTF-8 allocation. */
function assertSafeLinkInputSize(href: string, maxHrefBytes: number): void {
  // Every UTF-16 code unit contributes at least one UTF-8 byte. Rejecting on
  // this lower bound avoids allocating a complete UTF-8 copy when oversize is
  // already certain.
  if (href.length > maxHrefBytes) {
    throw new SafeLinkHrefError(undefined, 'input_too_large');
  }
  if (new TextEncoder().encode(href).byteLength > maxHrefBytes) {
    throw new SafeLinkHrefError(undefined, 'input_too_large');
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
 * Caller-controlled input is bounded before regex/URL parser work; callers that
 * need a stricter admission budget can lower `maxHrefBytes` per operation.
 */
export function validateSafeLinkHref(
  href: unknown,
  options?: SafeLinkValidationOptions,
): string {
  if (
    typeof href !== 'string' ||
    href.length === 0 ||
    href.startsWith('//')
  ) {
    throw new SafeLinkHrefError(href);
  }

  const maxHrefBytes = resolveSafeLinkMaxHrefBytes(options);
  assertSafeLinkInputSize(href, maxHrefBytes);

  if (FORBIDDEN_LINK_CHARACTER_PATTERN.test(href)) {
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
