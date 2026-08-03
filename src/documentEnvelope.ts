import type { JSONContent } from '@tiptap/core';

/** Canonical identifier for Inkspan's first portable document envelope. */
export const DOCUMENT_ENVELOPE_SCHEMA_ID =
  'https://inkspan.io/schemas/document-envelope/v1' as const;

/** Current document-envelope schema version. */
export const DOCUMENT_ENVELOPE_SCHEMA_VERSION = 1 as const;

const MAX_DOCUMENT_NESTING_DEPTH = 128;
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
 * represent losslessly, cycles, accessors, and pathological nesting are
 * rejected without exposing source values in public errors.
 */
export function createDocumentEnvelope(
  documentJson: unknown,
): CwlEditorDocumentEnvelope {
  return withRedactedInspectionErrors(() => {
    const cloned = cloneJsonValue(
      documentJson,
      0,
      new WeakSet<object>(),
    );
    assertDocumentRoot(cloned);

    return Object.freeze({
      schemaId: DOCUMENT_ENVELOPE_SCHEMA_ID,
      schemaVersion: DOCUMENT_ENVELOPE_SCHEMA_VERSION,
      documentJson: cloned as Readonly<JSONContent>,
    });
  });
}

/**
 * Parse and validate an Inkspan document envelope from JSON text or a value.
 *
 * Unknown fields and unsupported schema identifiers or versions fail closed so
 * hosts can route older envelopes through an explicit migration layer.
 */
export function parseDocumentEnvelope(
  source: string | unknown,
): CwlEditorDocumentEnvelope {
  return withRedactedInspectionErrors(() => {
    let value: unknown = source;
    if (typeof source === 'string') {
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

    const fields = readJsonObjectEntries(value);
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

    return createDocumentEnvelope(fieldMap.get('documentJson'));
  });
}

function assertDocumentRoot(value: unknown): asserts value is JSONContent {
  if (!isPlainObject(value) || value.type !== 'doc') {
    throw new DocumentEnvelopeError(
      'documentJson must be a TipTap/ProseMirror doc root',
    );
  }
}

function cloneJsonValue(
  value: unknown,
  depth: number,
  active: WeakSet<object>,
): unknown {
  if (depth > MAX_DOCUMENT_NESTING_DEPTH) {
    throw new DocumentEnvelopeError(
      'Document envelope exceeds the supported document nesting depth',
    );
  }
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
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
      return cloneJsonArray(value, depth, active);
    }
    if (!isPlainObject(value)) {
      throw new DocumentEnvelopeError(
        'Document envelope must contain JSON-compatible values',
      );
    }

    const clone: Record<string, unknown> = {};
    for (const [key, child] of readJsonObjectEntries(value)) {
      Object.defineProperty(clone, key, {
        value: cloneJsonValue(child, depth + 1, active),
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
): readonly unknown[] {
  const descriptors = Object.getOwnPropertyDescriptors(value) as Record<
    PropertyKey,
    PropertyDescriptor
  >;
  const length = descriptors.length.value as number;
  if (Reflect.ownKeys(descriptors).length !== length + 1) {
    throw new DocumentEnvelopeError(
      'Document envelope arrays must contain only dense JSON elements',
    );
  }

  const clone: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (
      descriptor === undefined ||
      !descriptor.enumerable ||
      !('value' in descriptor)
    ) {
      throw new DocumentEnvelopeError(
        'Document envelope arrays must contain only dense JSON elements',
      );
    }
    clone.push(cloneJsonValue(descriptor.value, depth + 1, active));
  }
  return Object.freeze(clone);
}

function readJsonObjectEntries(
  value: Record<string, unknown>,
): Array<[string, unknown]> {
  const descriptors = Object.getOwnPropertyDescriptors(value) as Record<
    PropertyKey,
    PropertyDescriptor
  >;
  const entries: Array<[string, unknown]> = [];

  for (const key of Reflect.ownKeys(descriptors)) {
    const descriptor = descriptors[key];
    if (
      typeof key !== 'string' ||
      !descriptor.enumerable ||
      !('value' in descriptor)
    ) {
      throw new DocumentEnvelopeError(
        'Document envelope objects must contain enumerable JSON data fields',
      );
    }
    entries.push([key, descriptor.value]);
  }

  return entries;
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
