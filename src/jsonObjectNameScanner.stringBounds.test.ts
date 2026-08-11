import { afterEach, describe, expect, it, vi } from 'vitest';
import { inspectJsonText } from './jsonObjectNameScanner.js';

afterEach(() => {
  vi.restoreAllMocks();
});

const STRING_LIMITS = {
  maxValues: 10,
  maxDepth: 10,
  maxStringCodeUnits: 4,
} as Parameters<typeof inspectJsonText>[1];

describe('JSON object-name preflight bounds', () => {
  it('rejects an obviously oversized object name before decoding it with JSON.parse', () => {
    const parse = vi.spyOn(JSON, 'parse');

    expect(inspectJsonText('{"oversized":1}', STRING_LIMITS)).toBe(
      'string-length-limit',
    );
    expect(parse).not.toHaveBeenCalled();
  });

  it('decodes escaped object names only when necessary before enforcing the decoded ceiling', () => {
    const parse = vi.spyOn(JSON, 'parse');

    expect(
      inspectJsonText(
        '{"\\u0061\\u0062\\u0063\\u0064\\u0065":1}',
        STRING_LIMITS,
      ),
    ).toBe('string-length-limit');
    expect(parse).toHaveBeenCalledTimes(1);
  });

  it('keeps malformed raw-control object names classified as malformed', () => {
    expect(inspectJsonText('{"bad\nname":1}', STRING_LIMITS)).toBe(
      'malformed',
    );
  });
});
