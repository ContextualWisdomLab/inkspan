/**
 * Base64Image — a TipTap/ProseMirror extension that guarantees images live
 * **inline as base64 raster data URIs** inside the document.
 *
 * Every ingress path uses the same source policy: initial HTML/Markdown,
 * controlled and imperative content, paste/drop/upload, direct ProseMirror
 * transactions, collaboration, and serialization. The extension never fetches
 * a remote source and never renders an unsafe source as an `<img>`.
 */
import Image from '@tiptap/extension-image';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { blobToDataUri } from '../converter/base64.js';
import {
  Base64ImageSourceError,
  validateInlineImageSource,
} from '../policy/inlineImagePolicy.js';

export {
  Base64ImageSourceError,
  validateInlineImageSource,
} from '../policy/inlineImagePolicy.js';

export interface Base64ImageOptions {
  /** Passed through to the underlying TipTap Image extension. */
  inline: boolean;
  allowBase64: boolean;
  HTMLAttributes: Record<string, unknown>;
  /**
   * Reject source files and existing inline images larger than this many bytes.
   * Default 10 MB. Set to 0 to disable the size limit.
   */
  maxSizeBytes: number;
  /**
   * If set, downscale images so neither dimension exceeds this many pixels,
   * re-encoding via a canvas. Requires a DOM; skipped in non-browser envs.
   */
  maxDimension?: number;
  /** JPEG/WebP quality (0..1) used when re-encoding during downscale. */
  quality: number;
  /**
   * Called when an image is rejected. Lets host apps surface a safe message
   * without the extension owning presentation or telemetry.
   */
  onError?: (error: Error) => void;
}

export const base64ImagePluginKey = new PluginKey('cwlBase64Image');

/**
 * Downscale an image data URI using an offscreen canvas when it exceeds
 * `maxDimension`. Returns the original URI unchanged when no DOM is available
 * or the image already fits.
 */
export async function downscaleDataUri(
  dataUri: string,
  maxDimension: number,
  quality: number,
): Promise<string> {
  if (
    typeof document === 'undefined' ||
    typeof globalThis.Image === 'undefined' ||
    maxDimension <= 0
  ) {
    return dataUri;
  }
  return new Promise<string>((resolve) => {
    const img = new globalThis.Image();
    img.onload = () => {
      const { width, height } = img;
      if (width <= maxDimension && height <= maxDimension) {
        resolve(dataUri);
        return;
      }
      const scale = Math.min(maxDimension / width, maxDimension / height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUri);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const mime = dataUri.toLowerCase().startsWith('data:image/png')
        ? 'image/png'
        : 'image/jpeg';
      resolve(canvas.toDataURL(mime, quality));
    };
    img.onerror = () => resolve(dataUri);
    img.src = dataUri;
  });
}

/**
 * Convert a File/Blob to an allowed inline base64 data URI, honoring the size
 * guard and optional downscaling. Unsupported or active-vector MIME types are
 * rejected before the browser image decoder is invoked.
 */
export async function imageFileToInlineDataUri(
  file: Blob,
  options: Pick<Base64ImageOptions, 'maxSizeBytes' | 'maxDimension' | 'quality'>,
): Promise<string> {
  const dataUri = await blobToDataUri(file, {
    maxBytes: options.maxSizeBytes > 0 ? options.maxSizeBytes : undefined,
  });
  validateInlineImageSource(dataUri, options.maxSizeBytes);
  if (options.maxDimension && options.maxDimension > 0) {
    const scaled = await downscaleDataUri(
      dataUri,
      options.maxDimension,
      options.quality,
    );
    return validateInlineImageSource(scaled, options.maxSizeBytes);
  }
  return dataUri;
}

/** Normalize a caught value to the Error contract exposed to hosts. */
function normalizeImageError(error: unknown): Error {
  /* v8 ignore next -- all shipped validation and conversion paths throw Error. */
  return error instanceof Error ? error : new Error('Image processing failed.');
}

export const Base64Image = Image.extend<Base64ImageOptions>({
  name: 'image',

  addOptions() {
    return {
      ...this.parent?.(),
      inline: false,
      allowBase64: true,
      HTMLAttributes: {},
      maxSizeBytes: 10 * 1024 * 1024,
      maxDimension: 1600,
      quality: 0.85,
      onError: undefined,
    };
  },

  parseHTML() {
    return [
      {
        tag: 'img[src]',
        getAttrs: (element) => {
          /* v8 ignore next -- a tag parse rule receives an HTMLElement. */
          if (!(element instanceof HTMLElement)) return false;
          try {
            const src = validateInlineImageSource(
              element.getAttribute('src'),
              this.options.maxSizeBytes,
            );
            return {
              src,
              alt: element.getAttribute('alt'),
              title: element.getAttribute('title'),
            };
          } catch (error) {
            this.options.onError?.(normalizeImageError(error));
            return false;
          }
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    try {
      const src = validateInlineImageSource(
        HTMLAttributes.src,
        this.options.maxSizeBytes,
      );
      return [
        'img',
        {
          ...this.options.HTMLAttributes,
          ...HTMLAttributes,
          src,
        },
      ];
    } catch {
      return [
        this.options.inline ? 'span' : 'div',
        { 'data-cwl-rejected-image': 'true' },
      ];
    }
  },

  addProseMirrorPlugins() {
    const options = this.options;
    const editor = this.editor;

    const insertFiles = (files: File[], at?: number) => {
      const images = files.filter((file) => file.type.startsWith('image/'));
      if (images.length === 0) return false;
      for (const file of images) {
        imageFileToInlineDataUri(file, options)
          .then((src) => {
            if (editor.isDestroyed) return;
            // New images are explicitly decorative until an author supplies
            // meaningful replacement text through the toolbar.
            const node = editor.schema.nodes.image.create({ src, alt: '' });
            const pos =
              typeof at === 'number' ? at : editor.state.selection.from;
            const transaction = editor.state.tr.insert(pos, node);
            editor.view.dispatch(transaction);
          })
          .catch((error: unknown) => {
            options.onError?.(normalizeImageError(error));
          });
      }
      return true;
    };

    return [
      new Plugin({
        key: base64ImagePluginKey,
        filterTransaction: (transaction) => {
          if (!transaction.docChanged) return true;
          let rejection: Error | undefined;
          transaction.doc.descendants((node) => {
            if (rejection) return false;
            if (node.type.name !== 'image') return true;
            try {
              validateInlineImageSource(
                node.attrs.src,
                options.maxSizeBytes,
              );
              return true;
            } catch (error) {
              rejection = normalizeImageError(error);
              return false;
            }
          });
          if (!rejection) return true;
          options.onError?.(rejection);
          return false;
        },
        props: {
          handlePaste: (_view, event) => {
            const items = event.clipboardData?.items;
            if (!items) return false;
            const files: File[] = [];
            for (const item of Array.from(items)) {
              if (item.kind === 'file') {
                const file = item.getAsFile();
                if (file) files.push(file);
              }
            }
            if (files.length === 0) return false;
            const handled = insertFiles(files);
            if (handled) event.preventDefault();
            return handled;
          },
          handleDrop: (view, event) => {
            const dataTransfer = (event as DragEvent).dataTransfer;
            const files = dataTransfer?.files
              ? Array.from(dataTransfer.files)
              : [];
            if (files.length === 0) return false;
            const coordinates = view.posAtCoords({
              left: (event as DragEvent).clientX,
              top: (event as DragEvent).clientY,
            });
            const handled = insertFiles(files, coordinates?.pos);
            if (handled) event.preventDefault();
            return handled;
          },
        },
      }),
    ];
  },
});

// Keep the long-standing named error export source-compatible while the pure
// implementation is shared with the headless serializer package.
void Base64ImageSourceError;

export default Base64Image;
