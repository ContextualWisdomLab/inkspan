import { describe, expect, it } from 'vitest';
import { containsDuplicateJsonObjectNames } from './jsonObjectNameScanner.js';

describe('duplicate JSON object-name scanning', () => {
  it('detects duplicate names at the root and in nested containers', () => {
    expect(
      containsDuplicateJsonObjectNames('{"name":1,"name":2}'),
    ).toBe(true);
    expect(
      containsDuplicateJsonObjectNames(
        '{"items":[{"safe":1},{"nested":{"token":1,"token":2}}]}',
      ),
    ).toBe(true);
  });

  it('compares decoded names instead of their source spelling', () => {
    expect(
      containsDuplicateJsonObjectNames(
        '{"name":1,"\\u006eame":2}',
      ),
    ).toBe(true);
    expect(
      containsDuplicateJsonObjectNames(
        '{"quoted\\\"name":1,"quoted\\\"name":2}',
      ),
    ).toBe(true);
  });

  it('scopes names independently for every object', () => {
    expect(
      containsDuplicateJsonObjectNames(
        '{"left":{"name":1},"right":{"name":2}}',
      ),
    ).toBe(false);
  });

  it('handles every JSON value form with an explicit container stack', () => {
    const source = [
      ' { ',
      '"values" : [ true, false, null, -12.5e+2,',
      '"escaped \\\" braces { }", {}, [] ],',
      '"nested" : { "array" : [ { "value" : 1 } ] }',
      ' } ',
    ].join('');

    expect(containsDuplicateJsonObjectNames(source)).toBe(false);
    expect(JSON.parse(source)).toBeTruthy();
  });

  it.each([
    '',
    '   \t\n\r',
    'invalid',
    'true false',
    '"unterminated',
    '{',
    '{1:2}',
    '{"\\uZZZZ":1}',
    '{"name" 1}',
    '{"name":@}',
    '{"name":1 "other":2}',
    '{"name":1,}',
    '[',
    '[@]',
    '[1 2]',
    '[1,]',
  ])('defers malformed JSON to JSON.parse without throwing: %j', (source) => {
    expect(() => containsDuplicateJsonObjectNames(source)).not.toThrow();
    expect(containsDuplicateJsonObjectNames(source)).toBe(false);
  });

  it.each(['{}', '[]', 'true', 'false', 'null', '0', '-1.25e3', '"text"'])(
    'accepts a duplicate-free root value: %s',
    (source) => {
      expect(containsDuplicateJsonObjectNames(source)).toBe(false);
    },
  );
});
