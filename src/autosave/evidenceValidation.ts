import { createDocumentEnvelope } from '../documentEnvelope.js';

/** Maximum JSON values accepted by Inkspan's default document envelope. */
const MAX_AUTOSAVE_EVIDENCE_JSON_VALUES = 1_000_000;

/** Maximum JSON nesting depth accepted below the document root by default. */
const MAX_AUTOSAVE_EVIDENCE_NESTING_DEPTH = 128;

const SUPPORTED_DOCUMENT_ENVELOPE_SCHEMA_ID =
  'https://inkspan.io/schemas/document-envelope/v1' as const;
const SUPPORTED_DOCUMENT_ENVELOPE_SCHEMA_VERSION = 1 as const;
const LOWERCASE_SHA256_DIGEST = /^[0-9a-f]{64}$/u;

type ExactDataRecord = Record<string, unknown>;

interface JsonTraversalEntry {
  readonly value: unknown;
  readonly depth: number;
}

type JsonContainerChildren =
  | Readonly<{ kind: 'array'; length: number }>
  | Readonly<{ kind: 'object'; keys: (string | symbol)[] }>;

/** Detached evidence shape returned to the public autosave queue. */
export interface DetachedDocumentAutosaveRevisionEvidence {
  /** Detached active-schema document envelope. */
  readonly envelope: Readonly<{
    readonly schemaId: typeof SUPPORTED_DOCUMENT_ENVELOPE_SCHEMA_ID;
    readonly schemaVersion: typeof SUPPORTED_DOCUMENT_ENVELOPE_SCHEMA_VERSION;
    readonly documentJson: Readonly<object>;
  }>;
  /** Detached SHA-256 equality metadata. */
  readonly revision: Readonly<{
    readonly algorithm: 'SHA-256';
    readonly digestHex: string;
    readonly strongEntityTag: string;
  }>;
}

/**
 * Read one exact frozen object through own data-property descriptors only.
 *
 * @param value - Candidate object.
 * @param expectedKeys - Exact enumerable string keys required by the contract.
 * @returns Descriptor values, or `null` for malformed or hostile input.
 */
function readExactFrozenDataRecord(
  value: unknown,
  expectedKeys: readonly string[],
): ExactDataRecord | null {
  try {
    if (typeof value !== 'object' || value === null) return null;

    for (const expectedKey of expectedKeys) {
      if (Object.getOwnPropertyDescriptor(value, expectedKey) === undefined) {
        return null;
      }
    }

    if (!Object.isFrozen(value)) return null;

    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.length !== expectedKeys.length) return null;

    const record: ExactDataRecord = {};
    for (const expectedKey of expectedKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, expectedKey);
      if (
        descriptor === undefined ||
        !descriptor.enumerable ||
        !Object.prototype.hasOwnProperty.call(descriptor, 'value')
      ) {
        return null;
      }
      record[expectedKey] = descriptor.value;
    }
    return record;
  } catch {
    return null;
  }
}

/**
 * Verify that one value is the descriptor-safe deeply frozen JSON graph emitted
 * by Inkspan's document-envelope boundary.
 *
 * The check is iterative and resource-bounded. It reads only own data-property
 * descriptors, never evaluates accessors, rejects hostile reflection failures,
 * and rejects aliases or cycles that cannot exist in a detached Inkspan
 * envelope. It deliberately does not recompute the SHA-256 revision; callers
 * must still obtain evidence from Inkspan's revision APIs.
 *
 * @param rootValue - Candidate document JSON root from revision evidence.
 * @returns `true` only for a bounded, deeply frozen JSON-compatible graph.
 */
export function isDeeplyFrozenDocumentJson(rootValue: unknown): boolean {
  try {
    const pendingEntries: JsonTraversalEntry[] = [
      { value: rootValue, depth: 0 },
    ];
    const visitedContainers = new WeakSet<object>();
    let inspectedValueCount = 0;

    while (pendingEntries.length > 0) {
      const currentEntry = pendingEntries.pop() as JsonTraversalEntry;
      inspectedValueCount += 1;

      const currentValue = currentEntry.value;
      if (
        currentValue === null ||
        typeof currentValue === 'string' ||
        typeof currentValue === 'boolean'
      ) {
        continue;
      }
      if (typeof currentValue === 'number') {
        if (!Number.isFinite(currentValue) || Object.is(currentValue, -0)) {
          return false;
        }
        continue;
      }
      if (
        typeof currentValue !== 'object' ||
        visitedContainers.has(currentValue) ||
        !Object.isFrozen(currentValue)
      ) {
        return false;
      }
      visitedContainers.add(currentValue);

      const childDepth = currentEntry.depth + 1;
      let children: JsonContainerChildren;
      if (Array.isArray(currentValue)) {
        const length = Object.getOwnPropertyDescriptor(
          currentValue,
          'length',
        )!.value as number;
        children = { kind: 'array', length };
      } else {
        const prototype = Object.getPrototypeOf(currentValue);
        if (prototype !== Object.prototype && prototype !== null) return false;
        children = { kind: 'object', keys: Reflect.ownKeys(currentValue) };
      }

      const childCount =
        children.kind === 'array' ? children.length : children.keys.length;
      const remainingValueCapacity =
        MAX_AUTOSAVE_EVIDENCE_JSON_VALUES -
        inspectedValueCount -
        pendingEntries.length;
      if (childCount > remainingValueCapacity) return false;
      if (
        childCount > 0 &&
        childDepth > MAX_AUTOSAVE_EVIDENCE_NESTING_DEPTH
      ) {
        return false;
      }

      if (children.kind === 'array') {
        const ownKeys = Reflect.ownKeys(currentValue);
        if (ownKeys.length !== children.length + 1) return false;
        for (let index = 0; index < children.length; index += 1) {
          const descriptor = Object.getOwnPropertyDescriptor(
            currentValue,
            String(index),
          );
          if (
            descriptor === undefined ||
            !descriptor.enumerable ||
            !Object.prototype.hasOwnProperty.call(descriptor, 'value')
          ) {
            return false;
          }
          pendingEntries.push({
            value: descriptor.value,
            depth: childDepth,
          });
        }
        continue;
      }

      for (const key of children.keys) {
        if (typeof key !== 'string') return false;
        const descriptor = Object.getOwnPropertyDescriptor(currentValue, key);
        if (
          descriptor === undefined ||
          !descriptor.enumerable ||
          !Object.prototype.hasOwnProperty.call(descriptor, 'value')
        ) {
          return false;
        }
        pendingEntries.push({
          value: descriptor.value,
          depth: childDepth,
        });
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Create one detached autosave snapshot from descriptor-safe frozen evidence.
 *
 * The returned envelope and revision are newly allocated frozen values. This
 * prevents transparent proxy `get` traps from presenting different document
 * content to the host callback after validation. The document clone reuses
 * Inkspan's active envelope parser so root shape, string ceilings, JSON value
 * limits, and nesting limits remain synchronized with persistence behavior.
 *
 * SHA-256 is not recomputed here. A detached immutable snapshot prevents local
 * mutation races but does not authenticate a caller-supplied digest; callers
 * must still use Inkspan-created evidence or an equivalent trusted private
 * canonicalization and hashing boundary.
 *
 * @param evidence - Candidate framework-free revision evidence.
 * @returns A detached frozen snapshot, or `null` for invalid evidence.
 */
export function createDetachedAutosaveRevisionEvidence(
  evidence: unknown,
): DetachedDocumentAutosaveRevisionEvidence | null {
  try {
    const evidenceRecord = readExactFrozenDataRecord(evidence, [
      'envelope',
      'revision',
    ]);
    if (evidenceRecord === null) return null;

    const envelopeRecord = readExactFrozenDataRecord(
      evidenceRecord.envelope,
      ['schemaId', 'schemaVersion', 'documentJson'],
    );
    if (
      envelopeRecord === null ||
      envelopeRecord.schemaId !== SUPPORTED_DOCUMENT_ENVELOPE_SCHEMA_ID ||
      envelopeRecord.schemaVersion !==
        SUPPORTED_DOCUMENT_ENVELOPE_SCHEMA_VERSION ||
      !isDeeplyFrozenDocumentJson(envelopeRecord.documentJson)
    ) {
      return null;
    }

    const revisionRecord = readExactFrozenDataRecord(
      evidenceRecord.revision,
      ['algorithm', 'digestHex', 'strongEntityTag'],
    );
    if (
      revisionRecord === null ||
      revisionRecord.algorithm !== 'SHA-256' ||
      typeof revisionRecord.digestHex !== 'string' ||
      revisionRecord.digestHex.length !== 64 ||
      !LOWERCASE_SHA256_DIGEST.test(revisionRecord.digestHex) ||
      typeof revisionRecord.strongEntityTag !== 'string' ||
      revisionRecord.strongEntityTag !==
        `"sha256-${revisionRecord.digestHex}"`
    ) {
      return null;
    }

    const envelope = createDocumentEnvelope(envelopeRecord.documentJson);
    const revision = Object.freeze({
      algorithm: 'SHA-256' as const,
      digestHex: revisionRecord.digestHex,
      strongEntityTag: revisionRecord.strongEntityTag,
    });
    return Object.freeze({ envelope, revision });
  } catch {
    return null;
  }
}
