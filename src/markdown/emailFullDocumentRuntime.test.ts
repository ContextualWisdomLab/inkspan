import { describe, expect, it } from 'vitest';
import { markdownToEmailHtml } from './resourceBoundMarkdown.js';

const INVALID_FULL_DOCUMENT_MESSAGE =
  'Email document fullDocument must be a boolean when provided.';

describe('email full-document runtime contract', () => {
  it.each([
    ['truthy string', 'true'],
    ['falsey number', 0],
    ['null', null],
  ])('rejects a %s instead of coercing document representation', (_label, value) => {
    expect(() =>
      markdownToEmailHtml('Hello', {
        fullDocument: value as unknown as boolean,
      }),
    ).toThrowError(new RangeError(INVALID_FULL_DOCUMENT_MESSAGE));
  });

  it('preserves omitted, fragment, and full-document boolean modes', () => {
    expect(markdownToEmailHtml('Hello')).toBe('<p>Hello</p>');
    expect(markdownToEmailHtml('Hello', { fullDocument: false })).toBe(
      '<p>Hello</p>',
    );
    expect(markdownToEmailHtml('Hello', { fullDocument: true })).toContain(
      '<!DOCTYPE html>',
    );
  });
});
