import { DocxImportError, normalizeDocxImportError } from './errors.js';
import type { DocxImportLimits, DocxImportOptions } from './types.js';

/** Default resource profile for one untrusted DOCX package. */
export const DEFAULT_DOCX_IMPORT_LIMITS: Readonly<DocxImportLimits> = Object.freeze({
  maxArchiveBytes: 32 * 1024 * 1024,
  maxEntries: 2_048,
  maxEntryBytes: 32 * 1024 * 1024,
  maxTotalUncompressedBytes: 128 * 1024 * 1024,
  maxCompressionRatio: 200,
  maxXmlBytes: 16 * 1024 * 1024,
  maxXmlNodes: 200_000,
  maxXmlDepth: 128,
  maxImages: 256,
  maxImageBytes: 10 * 1024 * 1024,
  maxTotalImageBytes: 40 * 1024 * 1024,
  maxDocumentNodes: 100_000,
});

const HARD_LIMITS: Readonly<DocxImportLimits> = Object.freeze({
  maxArchiveBytes: 256 * 1024 * 1024,
  maxEntries: 20_000,
  maxEntryBytes: 128 * 1024 * 1024,
  maxTotalUncompressedBytes: 512 * 1024 * 1024,
  maxCompressionRatio: 10_000,
  maxXmlBytes: 64 * 1024 * 1024,
  maxXmlNodes: 1_000_000,
  maxXmlDepth: 512,
  maxImages: 2_048,
  maxImageBytes: 64 * 1024 * 1024,
  maxTotalImageBytes: 256 * 1024 * 1024,
  maxDocumentNodes: 1_000_000,
});

const LIMIT_KEYS = Object.keys(DEFAULT_DOCX_IMPORT_LIMITS) as (keyof DocxImportLimits)[];

function rejectConfiguration(): never {
  throw new DocxImportError('invalid_configuration');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function readDataRecord(value: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!isRecord(value) || Object.getOwnPropertySymbols(value).length > 0) rejectConfiguration();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const result: Record<string, unknown> = Object.create(null);
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (!allowed.includes(key) || !descriptor.enumerable || !('value' in descriptor)) {
      rejectConfiguration();
    }
    result[key] = descriptor.value;
  }
  return result;
}

function resolveLimit(key: keyof DocxImportLimits, value: unknown): number {
  if (value === undefined) return DEFAULT_DOCX_IMPORT_LIMITS[key];
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > HARD_LIMITS[key]
  ) {
    rejectConfiguration();
  }
  return value;
}

/** Resolve and freeze one strict DOCX import resource profile. */
export function resolveDocxImportLimits(
  options?: DocxImportOptions,
): Readonly<DocxImportLimits> {
  if (options === undefined) return DEFAULT_DOCX_IMPORT_LIMITS;
  try {
    const optionRecord = readDataRecord(options, ['limits']);
    if (optionRecord.limits === undefined) return DEFAULT_DOCX_IMPORT_LIMITS;
    const limitRecord = readDataRecord(optionRecord.limits, LIMIT_KEYS);
    const resolved = {} as Record<keyof DocxImportLimits, number>;
    for (const key of LIMIT_KEYS) resolved[key] = resolveLimit(key, limitRecord[key]);
    return Object.freeze(resolved);
  } catch (error) {
    throw normalizeDocxImportError(error, 'invalid_configuration');
  }
}
