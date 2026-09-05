import { afterEach, describe, expect, it, vi } from 'vitest';
import { Lexer } from 'marked';
import { markdownToEmailHtml } from './resourceBoundMarkdown.js';

const INVALID_FULL_DOCUMENT_MESSAGE =
  'Email document fullDocument must be a boolean when provided.';
const INVALID_TEXT_DIRECTION_MESSAGE =
  'Email document direction must be ltr, rtl, or auto.';

afterEach(() => {
  vi.restoreAllMocks();
});

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

  it('rejects invalid text direction before Markdown parser materialization', () => {
    const lex = vi.spyOn(Lexer, 'lex');

    expect(() =>
      markdownToEmailHtml('Hello', {
        fullDocument: true,
        textDirection: 'sideways' as never,
      }),
    ).toThrowError(new RangeError(INVALID_TEXT_DIRECTION_MESSAGE));
    expect(lex).not.toHaveBeenCalled();
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