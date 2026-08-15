import { describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_CLIPBOARD_HTML_BYTES,
  DEFAULT_CLIPBOARD_MAX_DEPTH,
  DEFAULT_CLIPBOARD_MAX_NODES,
  sanitizeRichClipboardHtml,
  type ClipboardConfig,
  type ClipboardSanitizationError,
} from './SafeClipboard.js';
import {
  SafeClipboard,
  type SafeClipboardOptions,
} from './SafeClipboardExtension.js';

describe('SafeClipboard hostile thrown-value containment', () => {
  it('fails closed without inspecting the prototype of an unknown adapter failure', () => {
    const privateSentinel = new Error('private adapter prototype sentinel');
    const getPrototypeOf = vi.fn(() => {
      throw privateSentinel;
    });
    const hostileThrownValue = new Proxy(Object.create(null) as object, {
      getPrototypeOf,
    });
    const onError = vi.fn((_error: ClipboardSanitizationError) => undefined);
    const hostileOptions = {
      get config() {
        throw hostileThrownValue;
      },
      maxHtmlBytes: DEFAULT_CLIPBOARD_HTML_BYTES,
      maxNodes: DEFAULT_CLIPBOARD_MAX_NODES,
      maxDepth: DEFAULT_CLIPBOARD_MAX_DEPTH,
      onError,
      document,
    } as SafeClipboardOptions;
    const addPlugins = SafeClipboard.config.addProseMirrorPlugins;
    if (!addPlugins) throw new Error('SafeClipboard plugin factory is unavailable');
    const plugins = addPlugins.call({ options: hostileOptions } as never);
    const plugin = plugins[0];
    const transform = plugin?.props.transformPastedHTML;
    if (!plugin || !transform) {
      throw new Error('SafeClipboard paste transform is unavailable');
    }

    let transformed: string | undefined;
    expect(() => {
      transformed = transform.call(plugin, '<p>private source</p>', {} as never);
    }).not.toThrow();
    expect(transformed).toBe('');
    expect(getPrototypeOf).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'invalid_html',
        message: 'Rich clipboard HTML could not be sanitized.',
      }),
    );
  });

  it('normalizes hostile sanitizer configuration failures without prototype inspection', () => {
    const privateSentinel = new Error('private sanitizer prototype sentinel');
    const getPrototypeOf = vi.fn(() => {
      throw privateSentinel;
    });
    const hostileThrownValue = new Proxy(Object.create(null) as object, {
      getPrototypeOf,
    });
    const hostileConfig = new Proxy(Object.create(null) as ClipboardConfig, {
      ownKeys() {
        throw hostileThrownValue;
      },
    });

    let observed: unknown;
    try {
      sanitizeRichClipboardHtml('<p>private source</p>', hostileConfig, document);
    } catch (error) {
      observed = error;
    }

    expect(getPrototypeOf).not.toHaveBeenCalled();
    expect(observed).toEqual(
      expect.objectContaining({
        name: 'ClipboardSanitizationError',
        code: 'invalid_configuration',
        message: 'Rich clipboard configuration is invalid.',
      }),
    );
  });
});
