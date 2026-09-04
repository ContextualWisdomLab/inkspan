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

/**
 * Exercise the real ProseMirror paste transform with hostile values thrown by
 * host option access. Unknown thrown values must never escape Inkspan.
 */
describe('SafeClipboard hostile thrown-value containment', () => {
  it('fails closed without prototype inspection when a config getter throws a proxy', () => {
    const privateSentinel = new Error('private prototype sentinel');
    const hostileThrownValue = new Proxy(Object.create(null) as object, {
      getPrototypeOf() {
        throw privateSentinel;
      },
    });
    const onError = vi.fn((_error: ClipboardSanitizationError) => undefined);
    const hostileOptions = {
      get config(): never {
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
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'invalid_html',
        message:
          "This content can't be inserted here. Try pasting as plain text instead.",
      }),
    );
  });

  it('fails closed when a config getter throws a primitive value', () => {
    const onError = vi.fn((_error: ClipboardSanitizationError) => undefined);
    const hostileOptions = {
      get config(): never {
        throw 'private primitive sentinel';
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
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'invalid_html',
        message:
          "This content can't be inserted here. Try pasting as plain text instead.",
      }),
    );
  });
});
