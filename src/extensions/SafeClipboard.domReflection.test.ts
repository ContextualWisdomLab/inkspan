import { describe, expect, it } from 'vitest';
import {
  ClipboardSanitizationError,
  sanitizeRichClipboardHtml,
} from './SafeClipboard.js';

describe('SafeClipboard DOM capability reflection boundary', () => {
  it('redacts hostile document capability access before parsing', () => {
    const cases: ReadonlyArray<{
      readonly document: Document;
      readonly secret: string;
    }> = [
      {
        document: new Proxy({} as Document, {
          get(_target, property) {
            if (property === 'createElement') {
              throw new Error('private createElement capability detail');
            }
            return undefined;
          },
        }),
        secret: 'private createElement capability detail',
      },
      {
        document: new Proxy({} as Document, {
          get(_target, property) {
            if (property === 'createElement') {
              return globalThis.document.createElement.bind(globalThis.document);
            }
            if (property === 'implementation') {
              throw new Error('private implementation capability detail');
            }
            return undefined;
          },
        }),
        secret: 'private implementation capability detail',
      },
    ];

    for (const testCase of cases) {
      let observed: unknown;
      try {
        sanitizeRichClipboardHtml('<p>safe</p>', {}, testCase.document);
      } catch (error) {
        observed = error;
      }

      expect(observed).toBeInstanceOf(ClipboardSanitizationError);
      expect(observed).toEqual(
        expect.objectContaining({
          code: 'dom_unavailable',
          message:
            'Rich clipboard sanitization requires a DOM-capable document.',
        }),
      );
      expect(String(observed)).not.toContain(testCase.secret);
    }
  });
});
