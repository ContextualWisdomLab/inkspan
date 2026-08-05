/** Maximum JSON values accepted by Inkspan's default document envelope. */
const MAX_AUTOSAVE_EVIDENCE_JSON_VALUES = 1_000_000;

/** Maximum JSON nesting depth accepted below the document root by default. */
const MAX_AUTOSAVE_EVIDENCE_NESTING_DEPTH = 128;

interface JsonTraversalEntry {
  readonly value: unknown;
  readonly depth: number;
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
      if (
        inspectedValueCount > MAX_AUTOSAVE_EVIDENCE_JSON_VALUES ||
        currentEntry.depth > MAX_AUTOSAVE_EVIDENCE_NESTING_DEPTH
      ) {
        return false;
      }

      const currentValue = currentEntry.value;
      if (
        currentValue === null ||
        typeof currentValue === 'string' ||
        typeof currentValue === 'boolean'
      ) {
        continue;
      }
      if (typeof currentValue === 'number') {
        if (!Number.isFinite(currentValue)) return false;
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
      if (Array.isArray(currentValue)) {
        const length = currentValue.length;
        const ownKeys = Reflect.ownKeys(currentValue);
        if (ownKeys.length !== length + 1) return false;
        for (let index = 0; index < length; index += 1) {
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

      const prototype = Object.getPrototypeOf(currentValue);
      if (prototype !== Object.prototype && prototype !== null) return false;
      for (const key of Reflect.ownKeys(currentValue)) {
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
 * Verify that one candidate evidence object contains deeply frozen document JSON.
 *
 * Only own data-property descriptors are inspected. The function never invokes
 * candidate accessors and returns `false` for malformed objects or reflection
 * failures so the public queue can reject them synchronously and without
 * exposing private document content.
 *
 * @param evidence - Candidate framework-free revision evidence.
 * @returns `true` when the candidate envelope contains deeply frozen JSON.
 */
export function hasDeeplyFrozenEvidenceDocumentJson(evidence: unknown): boolean {
  try {
    if (typeof evidence !== 'object' || evidence === null) return false;
    const envelopeDescriptor = Object.getOwnPropertyDescriptor(
      evidence,
      'envelope',
    );
    if (
      envelopeDescriptor === undefined ||
      !envelopeDescriptor.enumerable ||
      !Object.prototype.hasOwnProperty.call(envelopeDescriptor, 'value')
    ) {
      return false;
    }
    const envelope = envelopeDescriptor.value;
    if (typeof envelope !== 'object' || envelope === null) return false;
    const documentJsonDescriptor = Object.getOwnPropertyDescriptor(
      envelope,
      'documentJson',
    );
    if (
      documentJsonDescriptor === undefined ||
      !documentJsonDescriptor.enumerable ||
      !Object.prototype.hasOwnProperty.call(documentJsonDescriptor, 'value')
    ) {
      return false;
    }
    return isDeeplyFrozenDocumentJson(documentJsonDescriptor.value);
  } catch {
    return false;
  }
}
