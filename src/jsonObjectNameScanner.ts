type ObjectFrameState =
  | 'key-or-end'
  | 'key'
  | 'colon'
  | 'value'
  | 'comma-or-end';
type ArrayFrameState = 'value-or-end' | 'value' | 'comma-or-end';

interface ObjectFrame {
  readonly kind: 'object';
  readonly depth: number;
  state: ObjectFrameState;
  readonly names: Set<string>;
}

interface ArrayFrame {
  readonly kind: 'array';
  readonly depth: number;
  state: ArrayFrameState;
}

type ContainerFrame = ObjectFrame | ArrayFrame;

interface JsonStringToken {
  readonly endIndex: number;
  readonly decodedValue?: string;
}

interface JsonValueStart {
  readonly endIndex: number;
  readonly frame?: ContainerFrame;
}

/** Bounds applied while scanning JSON text before native parsing. */
export interface JsonTextInspectionLimits {
  /** Maximum total number of scalar and container values. */
  readonly maxValues: number;
  /** Maximum value depth, with the root value at depth zero. */
  readonly maxDepth: number;
  /** Maximum decoded object-name length in UTF-16 code units. */
  readonly maxStringCodeUnits?: number;
}

/** Result of bounded duplicate-name and structure inspection. */
export type JsonTextInspectionResult =
  | 'valid'
  | 'malformed'
  | 'duplicate-object-name'
  | 'value-count-limit'
  | 'nesting-depth-limit'
  | 'string-length-limit';

const JSON_WHITESPACE = new Set([' ', '\t', '\n', '\r']);
const JSON_VALUE_DELIMITERS = new Set([
  ...JSON_WHITESPACE,
  ',',
  ']',
  '}',
]);
const UNBOUNDED_INSPECTION_LIMITS = Object.freeze({
  maxValues: Number.MAX_SAFE_INTEGER,
  maxDepth: Number.MAX_SAFE_INTEGER,
  maxStringCodeUnits: Number.MAX_SAFE_INTEGER,
}) satisfies JsonTextInspectionLimits;

/**
 * Inspect duplicate names and structural resource use before `JSON.parse()`.
 *
 * Syntax-invalid input returns `malformed` and remains the responsibility of
 * the canonical parser. Valid-looking values are counted with an explicit
 * stack so callers can reject pathological value counts and nesting before a
 * native parser materializes an attacker-controlled object graph. When a
 * decoded object-name ceiling is supplied, plain oversized names are rejected
 * before a decoded copy is allocated; escaped names are decoded only when
 * necessary for strict JSON and duplicate-name semantics.
 */
export function inspectJsonText(
  source: string,
  limits: JsonTextInspectionLimits,
): JsonTextInspectionResult {
  const stack: ContainerFrame[] = [];
  const maxStringCodeUnits =
    limits.maxStringCodeUnits ?? Number.MAX_SAFE_INTEGER;
  let index = 0;
  let rootComplete = false;
  let valueCount = 0;

  const beginValue = (
    startIndex: number,
    depth: number,
  ): JsonValueStart | JsonTextInspectionResult => {
    const valueStart = readJsonValueStart(source, startIndex, depth);
    if (valueStart === null) return 'malformed';
    valueCount += 1;
    if (valueCount > limits.maxValues) return 'value-count-limit';
    if (depth > limits.maxDepth) return 'nesting-depth-limit';
    return valueStart;
  };

  while (true) {
    index = skipJsonWhitespace(source, index);
    if (index >= source.length) return rootComplete ? 'valid' : 'malformed';
    if (rootComplete) return 'malformed';

    const frame = stack.at(-1);
    if (frame === undefined) {
      const valueStart = beginValue(index, 0);
      if (typeof valueStart === 'string') return valueStart;
      index = valueStart.endIndex;
      if (valueStart.frame === undefined) {
        rootComplete = true;
      } else {
        stack.push(valueStart.frame);
      }
      continue;
    }

    if (frame.kind === 'object') {
      if (frame.state === 'key-or-end' && source[index] === '}') {
        index += 1;
        stack.pop();
        rootComplete = completeParentValue(stack);
        continue;
      }
      if (frame.state === 'key-or-end' || frame.state === 'key') {
        const keyToken = readJsonObjectName(
          source,
          index,
          maxStringCodeUnits,
        );
        if (keyToken === 'string-length-limit') return keyToken;
        if (keyToken?.decodedValue === undefined) return 'malformed';
        if (frame.names.has(keyToken.decodedValue)) {
          return 'duplicate-object-name';
        }
        frame.names.add(keyToken.decodedValue);
        frame.state = 'colon';
        index = keyToken.endIndex;
        continue;
      }
      if (frame.state === 'colon') {
        if (source[index] !== ':') return 'malformed';
        frame.state = 'value';
        index += 1;
        continue;
      }
      if (frame.state === 'value') {
        const valueStart = beginValue(index, frame.depth + 1);
        if (typeof valueStart === 'string') return valueStart;
        index = valueStart.endIndex;
        if (valueStart.frame === undefined) {
          frame.state = 'comma-or-end';
        } else {
          stack.push(valueStart.frame);
        }
        continue;
      }
      if (source[index] === ',') {
        frame.state = 'key';
        index += 1;
        continue;
      }
      if (source[index] !== '}') return 'malformed';
      index += 1;
      stack.pop();
      rootComplete = completeParentValue(stack);
      continue;
    }

    if (frame.state === 'value-or-end' && source[index] === ']') {
      index += 1;
      stack.pop();
      rootComplete = completeParentValue(stack);
      continue;
    }
    if (frame.state === 'value-or-end' || frame.state === 'value') {
      const valueStart = beginValue(index, frame.depth + 1);
      if (typeof valueStart === 'string') return valueStart;
      index = valueStart.endIndex;
      if (valueStart.frame === undefined) {
        frame.state = 'comma-or-end';
      } else {
        stack.push(valueStart.frame);
      }
      continue;
    }
    if (source[index] === ',') {
      frame.state = 'value';
      index += 1;
      continue;
    }
    if (source[index] !== ']') return 'malformed';
    index += 1;
    stack.pop();
    rootComplete = completeParentValue(stack);
  }
}

/**
 * Detect duplicate object names in JSON text without recursively parsing it.
 *
 * Invalid JSON returns `false` and remains the responsibility of the canonical
 * `JSON.parse()` call. Escaped-equivalent names such as `"name"` and
 * `"\u006eame"` compare as the same decoded property name.
 */
export function containsDuplicateJsonObjectNames(source: string): boolean {
  return (
    inspectJsonText(source, UNBOUNDED_INSPECTION_LIMITS) ===
    'duplicate-object-name'
  );
}

function completeParentValue(stack: ContainerFrame[]): boolean {
  const parent = stack.at(-1);
  if (parent === undefined) return true;
  parent.state = 'comma-or-end';
  return false;
}

function readJsonValueStart(
  source: string,
  startIndex: number,
  depth: number,
): JsonValueStart | null {
  const firstCharacter = source[startIndex];
  if (firstCharacter === '{') {
    return {
      endIndex: startIndex + 1,
      frame: {
        kind: 'object',
        depth,
        state: 'key-or-end',
        names: new Set(),
      },
    };
  }
  if (firstCharacter === '[') {
    return {
      endIndex: startIndex + 1,
      frame: { kind: 'array', depth, state: 'value-or-end' },
    };
  }
  if (firstCharacter === '"') {
    const stringToken = readJsonString(source, startIndex);
    return stringToken === null
      ? null
      : { endIndex: stringToken.endIndex };
  }

  for (const literal of ['true', 'false', 'null']) {
    if (source.startsWith(literal, startIndex)) {
      return { endIndex: startIndex + literal.length };
    }
  }

  if (!/[-0-9]/u.test(firstCharacter)) return null;

  let endIndex = startIndex + 1;
  while (
    endIndex < source.length &&
    !JSON_VALUE_DELIMITERS.has(source[endIndex])
  ) {
    endIndex += 1;
  }
  return { endIndex };
}

function readJsonObjectName(
  source: string,
  startIndex: number,
  maxStringCodeUnits: number,
): JsonStringToken | 'string-length-limit' | null {
  if (source[startIndex] !== '"') return null;

  let index = startIndex + 1;
  let hasEscape = false;
  let hasRawControlCharacter = false;
  while (index < source.length) {
    const character = source[index];
    if (character === '"') {
      const endIndex = index + 1;
      const rawLength = index - startIndex - 1;
      if (
        !hasEscape &&
        !hasRawControlCharacter &&
        rawLength > maxStringCodeUnits
      ) {
        return 'string-length-limit';
      }

      let decodedValue: string;
      try {
        decodedValue = JSON.parse(
          source.slice(startIndex, endIndex),
        ) as string;
      } catch {
        return null;
      }
      if (decodedValue.length > maxStringCodeUnits) {
        return 'string-length-limit';
      }
      return { endIndex, decodedValue };
    }

    if (character === '\\') {
      hasEscape = true;
      index += 2;
      continue;
    }
    if (source.charCodeAt(index) <= 0x1f) {
      hasRawControlCharacter = true;
    }
    index += 1;
  }
  return null;
}

function readJsonString(
  source: string,
  startIndex: number,
): JsonStringToken | null {
  let index = startIndex + 1;
  while (index < source.length) {
    const character = source[index];
    if (character === '"') {
      return { endIndex: index + 1 };
    }
    index += character === '\\' ? 2 : 1;
  }
  return null;
}

function skipJsonWhitespace(source: string, startIndex: number): number {
  let index = startIndex;
  while (
    index < source.length &&
    JSON_WHITESPACE.has(source[index])
  ) {
    index += 1;
  }
  return index;
}
