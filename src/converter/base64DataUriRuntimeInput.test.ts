import { describe, expect, it } from 'vitest';
import {
  DataUriParseError,
  dataUriToBytes,
  isDataUri,
  parseDataUri,
} from './base64.js';

describe('data URI runtime input authority', () => {
  it('rejects non-string parse input without evaluating caller trim behavior', () => {
    let trimRead = false;
    const hostile = Object.defineProperty({}, 'trim', {
      get() {
        trimRead = true;
        throw new Error('private trim getter');
      },
    });

    expect(() => parseDataUri(hostile as unknown as string)).toThrow(
      DataUriParseError,
    );
    expect(trimRead).toBe(false);
  });

  it('rejects non-string decode input without invoking caller trim behavior', () => {
    let trimCalled = false;
    const hostile = {
      trim() {
        trimCalled = true;
        return 'data:text/plain,forged';
      },
    };

    expect(() => dataUriToBytes(hostile as unknown as string)).toThrow(
      DataUriParseError,
    );
    expect(trimCalled).toBe(false);
  });

  it('returns false for non-string predicate input without evaluating caller trim behavior', () => {
    let trimRead = false;
    const hostile = Object.defineProperty({}, 'trim', {
      get() {
        trimRead = true;
        throw new Error('private trim getter');
      },
    });

    expect(isDataUri(hostile as unknown as string)).toBe(false);
    expect(trimRead).toBe(false);
  });

  it('does not accept a non-string predicate input with a forged trim result', () => {
    let trimCalled = false;
    const hostile = {
      trim() {
        trimCalled = true;
        return 'data:text/plain,forged';
      },
    };

    expect(isDataUri(hostile as unknown as string)).toBe(false);
    expect(trimCalled).toBe(false);
  });
});
