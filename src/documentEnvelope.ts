import type { JSONContent } from '@tiptap/core';
import type { DocumentEnvelopeLimits } from './documentEnvelopeLimits.js';
import { inspectJsonText } from './jsonObjectNameScanner.js';

export type { DocumentEnvelopeLimits } from './documentEnvelopeLimits.js';

/** Canonical identifier for Inkspan's first portable document envelope. */
export const DOCUMENT_ENVELOPE_SCHEMA_ID =
  'https://inkspan.io/schemas/document-envelope/v1' as const;

/** Current document-envelope schema version. */
export const DOCUMENT_ENVELOPE_SCHEMA_VERSION = 1 as const;

interface ResolvedDocumentEnvelopeLimits {
  readonly maxUtf8Bytes: number;
  readonly maxJsonTextCodeUnits: number;
  readonly maxJsonValues: number;
  readonly maxStringCodeUnits: number;
  readonly maxNestingDepth: number;
}

/**
 * Generous fail-closed defaults that bound pathological client input while
 * preserving large, image-bearing commercial documents.
 */
export const DEFAULT_DOCUMENT_ENVELOPE_LIMITS = Object.freeze({
  maxUtf8Bytes: 64 * 1024 * 1024,
  maxJsonTextCodeUnits: 64 * 1024 * 1024,
  maxJsonValues: 1_000_000,
  maxStringCodeUnits: 32 * 1024 * 1024,
  maxNestingDepth: 128,
}) satisfies Readonly<ResolvedDocumentEnvelopeLimits>;

const DOCUMENT_ENVELOPE_LIMIT_FIELDS = new Set([
  'maxUtf8Bytes',
  'maxJsonTextCodeUnits',
  'maxJsonValues',
  'maxStringCodeUnits',
  'maxNestingDepth',
]);
const UTF8_BYTE_ORDER_MARK = 0xefbbbf;
const TYPED_ARRAY_TAG_GETTER = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype),
  Symbol.toStringTag,
)!.get!;
const REDACTED_INSPECTION_ERROR =
  'Document envelope could not be inspected safely';

/** Portable, versioned wrapper for lossless TipTap/ProseMirror JSON. */
export interface CwlEditorDocumentEnvelope {
  /** Stable schema identifier used for routing and migration. */
  readonly schemaId: typeof DOCUMENT_ENVELOPE_SCHEMA_ID;
  /** Integer schema version used for compatibility checks. */
  readonly schemaVersion: typeof DOCUMENT_ENVELOPE_SCHEMA_VERSION;
  /** Detached, deeply frozen TipTap/ProseMirror document JSON. */
  readonly documentJson: Readonly<JSONContent>;
}

/** Raised when a persistence envelope is malformed or incompatible. */
export class DocumentEnvelopeError extends TypeError {
  /** Create a redacted public contract error. */
  constructor(message: string) {
    super(message);
    this.name = 'DocumentEnvelopeError';
  }
}

/**
 * Create a detached, deeply frozen, versioned persistence envelope.
 *
 * Input is treated as untrusted JSON-like data. Values that JSON cannot
 * represent losslessly, cycles, accessors, resource-limit violations, and
 * pathological nesting are rejected without exposing source values in public
 * errors.
 */
export function createDocumentEnvelope(
  documentJson: unknown,
  limits?: DocumentEnvelopeLimits,
): CwlEditorDocumentEnvelope {
  return withRedactedInspectionErrors(() =>
    createDocumentEnvelopeWithLimits(
      documentJson,
      resolveDocumentEnvelopeLimits(limits),
    ),
  );
}

/**
 * Parse and validate an Inkspan document envelope from JSON text or a value.
 *
 * Unknown fields, duplicate JSON object names, unsupported schema identifiers
 * or versions, and configured resource-limit violations fail closed so hosts
 * can route older envelopes through an explicit migration layer.
 */
export function parseDocumentEnvelope(
  source: unknown,
  limits?: DocumentEnvelopeLimits,
): CwlEditorDocumentEnvelope {
  return withRedactedInspectionErrors(() =>
    parseDocumentEnvelopeWithLimits(
      source,
      resolveDocumentEnvelopeLimits(limits),
    ),
  );
}

/**
 * Strictly decode and parse one UTF-8 document-envelope byte sequence.
 *
 * The input is copied before decoding, bounded in bytes before allocation,
 * decoded with fatal error handling, and rejected when it begins with a UTF-8
 * byte-order mark. This is the inverse persistence boundary for
 * {@link encodeDocumentEnvelope} without accepting replacement characters or
 * alternate encodings.
 */
export function parseDocumentEnvelopeBytes(
  source: unknown,
  limits?: DocumentEnvelopeLimits,
): CwlEditorDocumentEnvelope {
  return withRedactedInspectionErrors(() => {
    const resolvedLimits = resolveDocumentEnvelopeLimits(limits);
    if (!hasUint8ArrayBrand(source)) {
      throw new DocumentEnvelopeError(
        'Document envelope bytes must be a Uint8Array',
      );
    }

    const byteLength = source.byteLength;
    if (byteLength > resolvedLimits.maxUtf8Bytes) {
      throw new DocumentEnvelopeError(
        'Document envelope UTF-8 bytes exceed the supported length',
      );
    }

    const bytes = new Uint8Array(byteLength);
    bytes.set(source);
    const prefix =
      bytes.length < 3
        ? -1
        : (bytes[0] << 16) | (bytes[1] << 8) | bytes[2];
    if (prefix === UTF8_BYTE_ORDER_MARK) {
      throw new DocumentEnvelopeError(
        'Document envelope UTF-8 bytes must not include a byte-order mark',
      );
    }

    let decoded: string;
    try {
      decoded = new TextDecoder('utf-8', {
        fatal: true,
        ignoreBOM: true,
      }).decode(bytes);
    } catch {
      throw new DocumentEnvelopeError(
        'Document envelope bytes must contain valid UTF-8',
      );
    }

    return parseDocumentEnvelopeWithLimits(decoded, resolvedLimits);
  });
}

function parseDocumentEnvelopeWithLimits(
  source: unknown,
  resolvedLimits: ResolvedDocumentEnvelopeLimits,
): CwlEditorDocumentEnvelope {
  let value: unknown = source;
  if (typeof source === 'string') {
    if (source.length > resolvedLimits.maxJsonTextCodeUnits) {
      throw new DocumentEnvelopeError(
        'Document envelope JSON text exceeds the supported length',
      );
    }
    const inspection = inspectJsonText(source, {
      maxValues: Math.min(
        Number.MAX_SAFE_INTEGER,
        resolvedLimits.maxJsonValues + 3,
      ),
      maxDepth: Math.min(
        Number.MAX_SAFE_INTEGER,
        resolvedLimits.maxNestingDepth + 1,
      ),
      maxStringCodeUnits: resolvedLimits.maxStringCodeUnits,
    });
    if (inspection === 'duplicate-object-name') {
      throw new DocumentEnvelopeError(
        'Document envelope JSON must not contain duplicate object names',
      );
    }
    if (inspection === 'value-count-limit') {
      throw new DocumentEnvelopeError(
        'Document envelope exceeds the supported JSON value count',
      );
    }
    if (inspection === 'nesting-depth-limit') {
      throw new DocumentEnvelopeError(
        'Document envelope exceeds the supported document nesting depth',
      );
    }
    if (inspection === 'string-length-limit') {
      throw new DocumentEnvelopeError(
        'Document envelope strings exceed the supported length',
      );
    }
    try {
      value = JSON.parse(source) as unknown;
    } catch {
      throw new DocumentEnvelopeError(
        'Document envelope must contain valid JSON',
      );
    }
  }

  if (!isPlainObject(value)) {
    throw new DocumentEnvelopeError('Document envelope must be an object');
  }

  const fields = readJsonObjectEntries(
    value,
    3,
    resolvedLimits.maxStringCodeUnits,
    'Document envelope fields do not match the supported schema',
  );
  const fieldMap = new Map(fields);
  if (
    fields.length !== 3 ||
    !fieldMap.has('schemaId') ||
    !fieldMap.has('schemaVersion') ||
    !fieldMap.has('documentJson')
  ) {
    throw new DocumentEnvelopeError(
      'Document envelope fields do not match the supported schema',
    );
  }

  if (fieldMap.get('schemaId') !== DOCUMENT_ENVELOPE_SCHEMA_ID) {
    throw new DocumentEnvelopeError(
      'Document envelope schema is unsupported',
    );
  }
  if (
    fieldMap.get('schemaVersion') !== DOCUMENT_ENVELOPE_SCHEMA_VERSION
  ) {
    throw new DocumentEnvelopeError(
      'Document envelope version is unsupported',
    );
  }

  return createDocumentEnvelopeWithLimits(
    fieldMap.get('documentJson'),
    resolvedLimits,
  );
}

function createDocumentEnvelopeWithLimits(
  documentJson: unknown,
  limits: ResolvedDocumentEnvelopeLimits,
): CwlEditorDocumentEnvelope {
  const cloneState = { valueCount: 0, limits };
  const cloned = cloneJsonValue(
    documentJson,
    0,
    new WeakSet<object>(),
    cloneState,
  );
  assertDocumentRoot(cloned);

  return Object.freeze({
    schemaId: DOCUMENT_ENVELOPE_SCHEMA_ID,
    schemaVersion: DOCUMENT_ENVELOPE_SCHEMA_VERSION,
    documentJson: cloned as Readonly<JSONContent>,
  });
}

function resolveDocumentEnvelopeLimits(
  overrides: DocumentEnvelopeLimits | undefined,
): ResolvedDocumentEnvelopeLimits {
  if (overrides === undefined) return DEFAULT_DOCUMENT_ENVELOPE_LIMITS;
  if (!isPlainObject(overrides)) {
    throw new DocumentEnvelopeError(
      'Document envelope limits must be a plain configuration object',
    );
  }

  const entries = readJsonObjectEntries(
    overrides,
    DOCUMENT_ENVELOPE_LIMIT_FIELDS.size,
    Number.MAX_SAFE_INTEGER,
    'Document envelope limits contain unsupported fields',
  );
  const values = new Map(entries);
  for (const [field] of entries) {
    if (!DOCUMENT_ENVELOPE_LIMIT_FIELDS.has(field)) {
      throw new DocumentEnvelopeError(
        'Document envelope limits contain unsupported fields',
      );
    }
  }

  return Object.freeze({
    maxUtf8Bytes: readPositiveSafeIntegerLimit(
      values,
      'maxUtf8Bytes',
      DEFAULT_DOCUMENT_ENVELOPE_LIMITS.maxUtf8Bytes,
    ),
    maxJsonTextCodeUnits: readPositiveSafeIntegerLimit(
      values,
      'maxJsonTextCodeUnits',
      DEFAULT_DOCUMENT_ENVELOPE_LIMITS.maxJsonTextCodeUnits,
    ),
    maxJsonValues: readPositiveSafeIntegerLimit(
      values,
      'maxJsonValues',
      DEFAULT_DOCUMENT_ENVELOPE_LIMITS.maxJsonValues,
    ),
    maxStringCodeUnits: readPositiveSafeIntegerLimit(
      values,
      'maxStringCodeUnits',
      DEFAULT_DOCUMENT_ENVELOPE_LIMITS.maxStringCodeUnits,
    ),
    maxNestingDepth: readPositiveSafeIntegerLimit(
      values,
      'maxNestingDepth',
      DEFAULT_DOCUMENT_ENVELOPE_LIMITS.maxNestingDepth,
    ),
  });
}

function readPositiveSafeIntegerLimit(
  values: Map<string, unknown>,
  field: string,
  fallback: number,
): number {
  if (!values.has(field) || values.get(field) === undefined) return fallback;
  const value = values.get(field);
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < 1
  ) {
    throw new DocumentEnvelopeError(
      'Document envelope limits must be positive safe integers',
    );
  }
  return value;
}

function assertDocumentRoot(value: unknown): asserts value is JSONContent {
  if (!isPlainObject(value) || value.type !== 'doc') {
    throw new DocumentEnvelopeError(
      'documentJson must be a TipTap/ProseMirror doc root',
    );
  }
}

interface CloneState {
  valueCount: number;
  readonly limits: ResolvedDocumentEnvelopeLimits;
}

function cloneJsonValue(
  value: unknown,
  depth: number,
  active: WeakSet<object>,
  state: CloneState,
): unknown {
  state.valueCount += 1;
  if (depth > state.limits.maxNestingDepth) {
    throw new DocumentEnvelopeError(
      'Document envelope exceeds the supported document nesting depth',
    );
  }
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    assertStringWithinLimit(value, state.limits.maxStringCodeUnits);
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new DocumentEnvelopeError(
        'Document envelope must contain finite numbers',
      );
    }
    return value;
  }
  if (typeof value !== 'object') {
    throw new DocumentEnvelopeError(
      'Document envelope must contain JSON-compatible values',
    );
  }
  if (active.has(value)) {
    throw new DocumentEnvelopeError(
      'Document envelope contains a cyclic reference',
    );
  }

  active.add(value);
  try {
    if (Array.isArray(value)) {
      return cloneJsonArray(value, depth, active, state);
    }
    if (!isPlainObject(value)) {
      throw new DocumentEnvelopeError(
        'Document envelope must contain JSON-compatible values',
      );
    }

    const remainingValues = state.limits.maxJsonValues - state.valueCount;
    const entries = readJsonObjectEntries(
      value,
      remainingValues,
      state.limits.maxStringCodeUnits,
      'Document envelope exceeds the supported JSON value count',
    );
    const clone: Record<string, unknown> = {};
    for (const [key, child] of entries) {
      Object.defineProperty(clone, key, {
        value: cloneJsonValue(child, depth + 1, active, state),
        enumerable: true,
        configurable: false,
        writable: false,
      });
    }
    return Object.freeze(clone);
  } finally {
    active.delete(value);
  }
}

function cloneJsonArray(
  value: unknown[],
  depth: number,
  active: WeakSet<object>,
  state: CloneState,
): readonly unknown[] {
  const lengthDescriptor = Object.getOwnPropertyDescriptor(
    value,
    'length',
  ) as PropertyDescriptor;
  const length = lengthDescriptor.value as number;
  if (length > state.limits.maxJsonValues - state.valueCount) {
    throw new DocumentEnvelopeError(
      'Document envelope exceeds the supported JSON value count',
    );
  }

  const keys = Reflect.ownKeys(value);
  if (keys.length !== length + 1) {
    throw new DocumentEnvelopeError(
      'Document envelope arrays must contain only dense JSON elements',
    );
  }

  const clone: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (
      descriptor === undefined ||
      !descriptor.enumerable ||
      !('value' in descriptor)
    ) {
      throw new DocumentEnvelopeError(
        'Document envelope arrays must contain only dense JSON elements',
      );
    }
    clone.push(
      cloneJsonValue(descriptor.value, depth + 1, active, state),
    );
  }
  return Object.freeze(clone);
}

function readJsonObjectEntries(
  value: Record<string, unknown>,
  maximumEntries: number,
  maximumStringCodeUnits: number,
  limitErrorMessage: string,
): Array<[string, unknown]> {
  const keys = Reflect.ownKeys(value);
  if (keys.length > maximumEntries) {
    throw new DocumentEnvelopeError(limitErrorMessage);
  }

  const entries: Array<[string, unknown]> = [];
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      typeof key !== 'string' ||
      descriptor === undefined ||
      !descriptor.enumerable ||
      !('value' in descriptor)
    ) {
      throw new DocumentEnvelopeError(
        'Document envelope objects must contain enumerable JSON data fields',
      );
    }
    assertStringWithinLimit(key, maximumStringCodeUnits);
    entries.push([key, descriptor.value]);
  }

  return entries;
}

function assertStringWithinLimit(
  value: string,
  maximumStringCodeUnits: number,
): void {
  if (value.length > maximumStringCodeUnits) {
    throw new DocumentEnvelopeError(
      'Document envelope strings exceed the supported length',
    );
  }
}

function hasUint8ArrayBrand(value: unknown): value is Uint8Array {
  return TYPED_ARRAY_TAG_GETTER.call(value) === 'Uint8Array';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function withRedactedInspectionErrors<T>(operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    if (error instanceof DocumentEnvelopeError) {
      throw error;
    }
    throw new DocumentEnvelopeError(REDACTED_INSPECTION_ERROR);
  }
}
