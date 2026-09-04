import { describe, expect, it } from 'vitest';
import { ClipboardSanitizationError } from './SafeClipboard.js';

describe('SafeClipboard customer guidance', () => {
  it.each([
    [
      'input_too_large',
      'The pasted content is too large to insert. Try pasting less content at once.',
    ],
    [
      'node_limit_exceeded',
      'The pasted content is too complex to insert. Try pasting less content at once.',
    ],
    [
      'depth_limit_exceeded',
      'The pasted content is too deeply nested to insert. Try pasting less content at once.',
    ],
    [
      'invalid_html',
      "This content can't be inserted here. Try pasting as plain text instead.",
    ],
  ] as const)('gives %s rejection an actionable next step', (code, message) => {
    expect(new ClipboardSanitizationError(code)).toMatchObject({ code, message });
  });
});
