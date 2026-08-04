type ObjectFrameState =
  | 'key-or-end'
  | 'key'
  | 'colon'
  | 'value'
  | 'comma-or-end';
type ArrayFrameState = 'value-or-end' | 'value' | 'comma-or-end';

interface ObjectFrame {
  readonly kind: 'object';
  state: ObjectFrameState;
  readonly names: Set<string>;
}

interface ArrayFrame {
  readonly kind: 'array';
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

const JSON_WHITESPACE = new Set([' ', '\t', '\n', '\r']);
const JSON_VALUE_DELIMITERS = new Set([
  ...JSON_WHITESPACE,
  ',',
  ']',
  '}',
]);

/**
 * Detect duplicate object names in JSON text without recursively parsing it.
 *
 * Invalid JSON returns `false` and remains the responsibility of the canonical
 * `JSON.parse()` call. Valid JSON is scanned with an explicit container stack,
 * and escaped-equivalent names such as `"name"` and `"\u006eame"` compare as
 * the same decoded property name.
 */
export function containsDuplicateJsonObjectNames(source: string): boolean {
  const stack: ContainerFrame[] = [];
  let index = 0;
  let rootComplete = false;

  while (true) {
    index = skipJsonWhitespace(source, index);
    if (index >= source.length) return false;
    if (rootComplete) return false;

    const frame = stack.at(-1);
    if (frame === undefined) {
      const valueStart = readJsonValueStart(source, index);
      if (valueStart === null) return false;
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
        const keyToken = readJsonString(source, index, true);
        if (keyToken?.decodedValue === undefined) return false;
        if (frame.names.has(keyToken.decodedValue)) return true;
        frame.names.add(keyToken.decodedValue);
        frame.state = 'colon';
        index = keyToken.endIndex;
        continue;
      }
      if (frame.state === 'colon') {
        if (source[index] !== ':') return false;
        frame.state = 'value';
        index += 1;
        continue;
      }
      if (frame.state === 'value') {
        const valueStart = readJsonValueStart(source, index);
        if (valueStart === null) return false;
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
      if (source[index] !== '}') return false;
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
      const valueStart = readJsonValueStart(source, index);
      if (valueStart === null) return false;
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
    if (source[index] !== ']') return false;
    index += 1;
    stack.pop();
    rootComplete = completeParentValue(stack);
  }
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
): JsonValueStart | null {
  const firstCharacter = source[startIndex];
  if (firstCharacter === '{') {
    return {
      endIndex: startIndex + 1,
      frame: { kind: 'object', state: 'key-or-end', names: new Set() },
    };
  }
  if (firstCharacter === '[') {
    return {
      endIndex: startIndex + 1,
      frame: { kind: 'array', state: 'value-or-end' },
    };
  }
  if (firstCharacter === '"') {
    const stringToken = readJsonString(source, startIndex, false);
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

function readJsonString(
  source: string,
  startIndex: number,
  decode: boolean,
): JsonStringToken | null {
  if (source[startIndex] !== '"') return null;

  let index = startIndex + 1;
  while (index < source.length) {
    const character = source[index];
    if (character === '"') {
      const endIndex = index + 1;
      if (!decode) return { endIndex };
      try {
        return {
          endIndex,
          decodedValue: JSON.parse(
            source.slice(startIndex, endIndex),
          ) as string,
        };
      } catch {
        return null;
      }
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
