import { describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_CLIPBOARD_HTML_BYTES,
  DEFAULT_CLIPBOARD_MAX_DEPTH,
  DEFAULT_CLIPBOARD_MAX_NODES,
  type ClipboardSanitizationError,
} from './SafeClipboard.js';
import {
  SafeClipboard,
  type SafeClipboardOptions,
} from './SafeClipboardExtension.js';

describe('SafeClipboard hostile thrown-value containment', () => {
  it('fails closed without inspecting the prototype of an unknown thrown value', () => {
    const privateSentinel = new Error('private prototype sentinel');
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
});
