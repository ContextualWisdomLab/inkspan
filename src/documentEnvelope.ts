import type { JSONContent } from '@tiptap/core';

/** Canonical identifier for Inkspan's first portable document envelope. */
export const DOCUMENT_ENVELOPE_SCHEMA_ID =
  'https://inkspan.io/schemas/document-envelope/v1' as const;

/** Current document-envelope schema version. */
export const DOCUMENT_ENVELOPE_SCHEMA_VERSION = 1 as const;

const MAX_DOCUMENT_NESTING_DEPTH = 128;

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
 * represent losslessly, cycles, and pathological nesting are rejected.
 */
export function createDocumentEnvelope(
  documentJson: unknown,
): CwlEditorDocumentEnvelope {
  const cloned = cloneJsonValue(
    documentJson,
    'documentJson',
    0,
    new WeakSet<object>(),
  );
  assertDocumentRoot(cloned);

  return Object.freeze({
    schemaId: DOCUMENT_ENVELOPE_SCHEMA_ID,
    schemaVersion: DOCUMENT_ENVELOPE_SCHEMA_VERSION,
    documentJson: cloned as Readonly<JSONContent>,
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
  let value: unknown = source;
  if (typeof source === 'string') {
    try {
      value = JSON.parse(source) as unknown;
    } catch {
      throw new DocumentEnvelopeError('Document envelope must contain valid JSON');
    }
  }

  if (!isPlainObject(value)) {
    throw new DocumentEnvelopeError('Document envelope must be an object');
  }

  const keys = Object.keys(value);
  if (
    keys.length !== 3 ||
    !keys.includes('schemaId') ||
    !keys.includes('schemaVersion') ||
    !keys.includes('documentJson')
  ) {
    throw new DocumentEnvelopeError(
      'Document envelope fields do not match the supported schema',
    );
  }

  if (value.schemaId !== DOCUMENT_ENVELOPE_SCHEMA_ID) {
    throw new DocumentEnvelopeError('Document envelope schema is unsupported');
  }
  if (value.schemaVersion !== DOCUMENT_ENVELOPE_SCHEMA_VERSION) {
    throw new DocumentEnvelopeError('Document envelope version is unsupported');
  }

  return createDocumentEnvelope(value.documentJson);
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
  path: string,
  depth: number,
  active: WeakSet<object>,
): unknown {
  if (depth > MAX_DOCUMENT_NESTING_DEPTH) {
    throw new DocumentEnvelopeError(
      `${path} exceeds the supported document nesting depth`,
    );
  }
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new DocumentEnvelopeError(`${path} must contain finite numbers`);
    }
    return value;
  }
  if (typeof value !== 'object') {
    throw new DocumentEnvelopeError(`${path} must be JSON-compatible`);
  }
  if (active.has(value)) {
    throw new DocumentEnvelopeError(`${path} contains a cyclic reference`);
  }

  active.add(value);
  try {
    if (Array.isArray(value)) {
      return Object.freeze(
        value.map((item, index) =>
          cloneJsonValue(item, `${path}[${index}]`, depth + 1, active),
        ),
      );
    }
    if (!isPlainObject(value)) {
      throw new DocumentEnvelopeError(`${path} must be JSON-compatible`);
    }

    const clone: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      clone[key] = cloneJsonValue(
        child,
        `${path}.${key}`,
        depth + 1,
        active,
      );
    }
    return Object.freeze(clone);
  } finally {
    active.delete(value);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
