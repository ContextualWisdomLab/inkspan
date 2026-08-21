/**
 * TipTap v2 adapter that installs Inkspan's SafeClipboard policy in the actual
 * ProseMirror HTML-paste transform chain used before clipboard parsing.
 */
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import {
  ClipboardSanitizationError,
  DEFAULT_CLIPBOARD_HTML_BYTES,
  DEFAULT_CLIPBOARD_MAX_DEPTH,
  DEFAULT_CLIPBOARD_MAX_NODES,
  isClipboardSanitizationError,
  sanitizeRichClipboardHtml,
  type ClipboardConfig,
} from './SafeClipboard.js';

const SAFE_CLIPBOARD_PRIORITY = -1_000_000;

/** ProseMirror plugin key for the rich-clipboard pre-parse safety boundary. */
export const safeClipboardPluginKey = new PluginKey('cwlSafeClipboard');

/** Options held by the TipTap v2 SafeClipboard extension adapter. */
export interface SafeClipboardOptions {
  /** Maximum UTF-8 bytes accepted when no nested config object is supplied. */
  maxHtmlBytes: number;
  /** Maximum source nodes accepted when no nested config object is supplied. */
  maxNodes: number;
  /** Maximum source depth accepted when no nested config object is supplied. */
  maxDepth: number;
  /** Original host configuration validated fail-closed only when HTML is pasted. */
  config?: ClipboardConfig;
  /** Latest host observer for redacted sanitizer failures. */
  onError?: (error: ClipboardSanitizationError) => void;
  /** Optional deterministic DOM document supplied by tests or controlled hosts. */
  document?: Document | null;
}

/**
 * Apply one configured clipboard policy and contain every observer failure.
 *
 * Access to extension options is inside the same redaction boundary as the
 * sanitizer so hostile option access cannot disclose private exception text.
 */
function transformPastedClipboardHtml(
  options: SafeClipboardOptions,
  html: string,
): string {
  try {
    const config =
      options.config === undefined
        ? {
            maxHtmlBytes: options.maxHtmlBytes,
            maxNodes: options.maxNodes,
            maxDepth: options.maxDepth,
          }
        : options.config;
    return sanitizeRichClipboardHtml(html, config, options.document);
  } catch (error) {
    const clipboardError = isClipboardSanitizationError(error)
      ? error
      : new ClipboardSanitizationError('invalid_html');
    try {
      options.onError?.(clipboardError);
    } catch {
      // Host observers cannot weaken the fail-closed paste boundary.
    }
    return '';
  }
}

/**
 * Shared TipTap v2 extension that sanitizes rich HTML in ProseMirror's real
 * `transformPastedHTML` pipeline before the browser fragment is parsed.
 *
 * The deliberately low priority places this plugin after ordinary host
 * transforms in TipTap v2's plugin order, making sanitization the final
 * supported HTML transform before ProseMirror parsing.
 */
export const SafeClipboard = Extension.create<SafeClipboardOptions>({
  name: 'safeClipboard',
  priority: SAFE_CLIPBOARD_PRIORITY,

  addOptions() {
    return {
      maxHtmlBytes: DEFAULT_CLIPBOARD_HTML_BYTES,
      maxNodes: DEFAULT_CLIPBOARD_MAX_NODES,
      maxDepth: DEFAULT_CLIPBOARD_MAX_DEPTH,
      config: undefined,
      onError: undefined,
      document: undefined,
    };
  },

  addProseMirrorPlugins() {
    const options = this.options;
    return [
      new Plugin({
        key: safeClipboardPluginKey,
        props: {
          transformPastedHTML: (html) =>
            transformPastedClipboardHtml(options, html),
        },
      }),
    ];
  },
});

export default SafeClipboard;
