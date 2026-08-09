import { inspectJsonText } from './jsonObjectNameScanner.js';
import {
  DEFAULT_DOCUMENT_ENVELOPE_LIMITS,
  DocumentEnvelopeError,
  type DocumentEnvelopeLimits,
} from './documentEnvelope.js';

interface ResolvedIdentityLimits {
  readonly maxUtf8Bytes: number;
  readonly maxJsonTextCodeUnits: number;
  readonly maxJsonValues: number;
  readonly maxStringCodeUnits: number;
  readonly maxNestingDepth: number;
}

const LIMIT_FIELDS = new Set([
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
  'Document envelope identity could not be inspected safely';

/**
 * Routing metadata extracted from a complete versioned document envelope.
 *
 * This value intentionally contains no document body or durable-write claim.
 */
export interface CwlEditorDocumentEnvelopeIdentity {
  /** Schema identifier supplied by the envelope for host-owned migration routing. */
  readonly schemaId: string;
  /** Positive safe-integer schema version supplied by the envelope. */
  readonly schemaVersion: number;
}

/**
 * Inspect only the schema identity of a complete document envelope.
 *
 * The inspector preserves the envelope resource ceilings and hostile-object
 * defenses but deliberately does not require the current TipTap/ProseMirror
 * document schema. Hosts may therefore select an explicit migration function
 * without weakening {@link parseDocumentEnvelope} into a permissive parser.
 */
export function inspectDocumentEnvelopeIdentity(
  source: unknown,
  limits?: DocumentEnvelopeLimits,
): Readonly<CwlEditorDocumentEnvelopeIdentity> {
  return withRedactedIdentityErrors(() =>
    inspectIdentityWithLimits(source, resolveIdentityLimits(limits)),
  );
}

/**
 * Strictly decode UTF-8 bytes and inspect only document-envelope schema identity.
 *
 * Byte input is copied, bounded before decoding, rejects a UTF-8 BOM, and uses
 * fatal UTF-8 decoding before delegating to the complete-input identity parser.
 */
export function inspectDocumentEnvelopeIdentityBytes(
  source: unknown,
  limits?: DocumentEnvelopeLimits,
): Readonly<CwlEditorDocumentEnvelopeIdentity> {
  return withRedactedIdentityErrors(() => {
    const resolvedLimits = resolveIdentityLimits(limits);
    if (!hasUint8ArrayBrand(source)) {
      throw new DocumentEnvelopeError(
        'Document envelope identity bytes must be a Uint8Array',
      );
    }
    if (source.byteLength > resolvedLimits.maxUtf8Bytes) {
      throw new DocumentEnvelopeError(
        'Document envelope identity UTF-8 bytes exceed the supported length',
      );
    }

    const bytes = new Uint8Array(source.byteLength);
    bytes.set(source);
    const prefix =
      bytes.length < 3
        ? -1
        : (bytes[0] << 16) | (bytes[1] << 8) | bytes[2];
    if (prefix === UTF8_BYTE_ORDER_MARK) {
      throw new DocumentEnvelopeError(
        'Document envelope identity UTF-8 bytes must not include a byte-order mark',
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
        'Document envelope identity bytes must contain valid UTF-8',
      );
    }

    return inspectIdentityWithLimits(decoded, resolvedLimits);
  });
}

function inspectIdentityWithLimits(
  source: unknown,
  limits: ResolvedIdentityLimits,
): Readonly<CwlEditorDocumentEnvelopeIdentity> {
  let value: unknown = source;
  if (typeof source === 'string') {
    if (source.length > limits.maxJsonTextCodeUnits) {
      throw new DocumentEnvelopeError(
        'Document envelope identity JSON text exceeds the supported length',
      );
    }
    const inspection = inspectJsonText(source, {
      maxValues: Math.min(
        Number.MAX_SAFE_INTEGER,
        limits.maxJsonValues + 3,
      ),
      maxDepth: Math.min(
        Number.MAX_SAFE_INTEGER,
        limits.maxNestingDepth + 1,
      ),
    });
    if (inspection === 'duplicate-object-name') {
      throw new DocumentEnvelopeError(
        'Document envelope identity JSON must not contain duplicate object names',
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
    try {
      value = JSON.parse(source) as unknown;
    } catch {
      throw new DocumentEnvelopeError(
        'Document envelope identity must contain valid JSON',
      );
    }
  }

  if (!isPlainObject(value)) {
    throw new DocumentEnvelopeError(
      'Document envelope identity must be an object',
    );
  }

  const entries = readDataEntries(
    value,
    Math.min(Number.MAX_SAFE_INTEGER, limits.maxJsonValues + 3),
    limits.maxStringCodeUnits,
    'Document envelope identity contains too many top-level fields',
  );
  const fields = new Map(entries);
  if (
    !fields.has('schemaId') ||
    !fields.has('schemaVersion') ||
    !fields.has('documentJson')
  ) {
    throw new DocumentEnvelopeError(
      'Document envelope identity requires schemaId, schemaVersion, and documentJson',
    );
  }

  const schemaId = fields.get('schemaId');
  if (typeof schemaId !== 'string') {
    throw new DocumentEnvelopeError(
      'Document envelope schemaId must be a string',
    );
  }
  assertStringWithinLimit(schemaId, limits.maxStringCodeUnits);

  const schemaVersion = fields.get('schemaVersion');
  if (
    typeof schemaVersion !== 'number' ||
    !Number.isSafeInteger(schemaVersion) ||
    schemaVersion < 1
  ) {
    throw new DocumentEnvelopeError(
      'Document envelope schemaVersion must be a positive safe integer',
    );
  }

  const state: ValidationState = {
    valueCount: 0,
    limits,
    active: new WeakSet<object>(),
  };
  for (const [field, child] of entries) {
    if (field !== 'schemaId' && field !== 'schemaVersion') {
      validateJsonValue(child, 0, state);
    }
  }

  return Object.freeze({ schemaId, schemaVersion });
}

interface ValidationState {
  valueCount: number;
  readonly limits: ResolvedIdentityLimits;
  readonly active: WeakSet<object>;
}

function validateJsonValue(
  value: unknown,
  depth: number,
  state: ValidationState,
): void {
  state.valueCount += 1;
  if (state.valueCount > state.limits.maxJsonValues) {
    throw new DocumentEnvelopeError(
      'Document envelope exceeds the supported JSON value count',
    );
  }
  if (depth > state.limits.maxNestingDepth) {
    throw new DocumentEnvelopeError(
      'Document envelope exceeds the supported document nesting depth',
    );
  }
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'string') {
    assertStringWithinLimit(value, state.limits.maxStringCodeUnits);
    return;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new DocumentEnvelopeError(
        'Document envelope must contain finite numbers',
      );
    }
    return;
  }
  if (typeof value !== 'object') {
    throw new DocumentEnvelopeError(
      'Document envelope must contain JSON-compatible values',
    );
  }
  if (state.active.has(value)) {
    throw new DocumentEnvelopeError(
      'Document envelope contains a cyclic reference',
    );
  }

  state.active.add(value);
  try {
    if (Array.isArray(value)) {
      validateJsonArray(value, depth, state);
      return;
    }
    if (!isPlainObject(value)) {
      throw new DocumentEnvelopeError(
        'Document envelope must contain JSON-compatible values',
      );
    }
    const entries = readDataEntries(
      value,
      state.limits.maxJsonValues,
      state.limits.maxStringCodeUnits,
      'Document envelope exceeds the supported JSON value count',
    );
    for (const [, child] of entries) {
      validateJsonValue(child, depth + 1, state);
    }
  } finally {
    state.active.delete(value);
  }
}

function validateJsonArray(
  value: unknown[],
  depth: number,
  state: ValidationState,
): void {
  const lengthDescriptor = Object.getOwnPropertyDescriptor(
    value,
    'length',
  ) as PropertyDescriptor;
  const length = lengthDescriptor.value as number;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== length + 1) {
    throw new DocumentEnvelopeError(
      'Document envelope arrays must contain only dense JSON elements',
    );
  }
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
    validateJsonValue(descriptor.value, depth + 1, state);
  }
}

function resolveIdentityLimits(
  overrides: DocumentEnvelopeLimits | undefined,
): ResolvedIdentityLimits {
  if (overrides === undefined) {
    return DEFAULT_DOCUMENT_ENVELOPE_LIMITS;
  }
  if (!isPlainObject(overrides)) {
    throw new DocumentEnvelopeError(
      'Document envelope limits must be a plain configuration object',
    );
  }
  const entries = readDataEntries(
    overrides,
    LIMIT_FIELDS.size,
    Number.MAX_SAFE_INTEGER,
    'Document envelope limits contain unsupported fields',
  );
  const values = new Map(entries);
  for (const [field] of entries) {
    if (!LIMIT_FIELDS.has(field)) {
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

function readDataEntries(
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

function withRedactedIdentityErrors<T>(operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    if (error instanceof DocumentEnvelopeError) throw error;
    throw new DocumentEnvelopeError(REDACTED_INSPECTION_ERROR);
  }
}
