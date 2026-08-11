import { afterEach, describe, expect, it, vi } from 'vitest';
import { inspectJsonText } from './jsonObjectNameScanner.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('JSON object-name preflight bounds', () => {
  it('rejects an obviously oversized object name before decoding it with JSON.parse', () => {
    const parse = vi.spyOn(JSON, 'parse');
    const limits = {
      maxValues: 10,
      maxDepth: 10,
      maxStringCodeUnits: 4,
    } as Parameters<typeof inspectJsonText>[1];

    expect(inspectJsonText('{"oversized":1}', limits)).toBe(
      'string-length-limit',
    );
    expect(parse).not.toHaveBeenCalled();
  });
});
