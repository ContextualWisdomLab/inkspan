import { describe, expect, it } from 'vitest';
import { dataUriToBytes, isDataUri, parseDataUri } from './index.js';

describe('data URI payload fidelity', () => {
  it('preserves trailing payload whitespace while retaining leading-input compatibility', () => {
    const dataUri = ' \tdata:text/plain,hello%20 ';

    const parsed = parseDataUri(dataUri);
    expect(parsed).toEqual({
      mimeType: 'text/plain',
      isBase64: false,
      payload: 'hello%20 ',
    });
    expect(isDataUri(dataUri)).toBe(true);
    expect(new TextDecoder().decode(dataUriToBytes(dataUri).bytes)).toBe(
      'hello  ',
    );
  });

  it('preserves trailing forgiving-base64 whitespace for structural inspection', () => {
    const dataUri = 'data:text/plain;base64,aGVsbG8=\n';

    expect(parseDataUri(dataUri).payload).toBe('aGVsbG8=\n');
    expect(new TextDecoder().decode(dataUriToBytes(dataUri).bytes)).toBe('hello');
  });
});
