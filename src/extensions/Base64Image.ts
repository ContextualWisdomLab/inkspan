/**
 * Base64Image — a TipTap/ProseMirror extension that guarantees images live
 * **inline as base64 data URIs** inside the document.
 *
 * Whenever an image is pasted, dropped, or inserted, its bytes are read,
 * optionally downscaled, and embedded as a `data:` URI on the node's `src`.
 * Local files always become base64 so the content is fully self-contained,
 * works offline / air-gapped, and is directly consumable by an LLM. By design
 * the extension never fetches remote URLs — nothing leaves the document.
 */
import Image from '@tiptap/extension-image';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import {
  blobToDataUri,
  dataUriByteLength,
  Base64SizeError,
} from '../converter/base64.js';

export interface Base64ImageOptions {
  /** Passed through to the underlying TipTap Image extension. */
  inline: boolean;
  allowBase64: boolean;
  HTMLAttributes: Record<string, unknown>;
  /**
   * Reject source files larger than this many bytes (before downscaling).
   * Default 10 MB. Set to 0 to disable.
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
   * Called when an image is rejected (too large, decode failure, etc.). Lets
   * host apps surface a toast without the extension owning any UI.
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
      const mime = dataUri.startsWith('data:image/png')
        ? 'image/png'
        : 'image/jpeg';
      resolve(canvas.toDataURL(mime, quality));
    };
    img.onerror = () => resolve(dataUri);
    img.src = dataUri;
  });
}

/**
 * Convert a File/Blob to an inline base64 data URI honoring the size guard and
 * optional downscaling. Exported for reuse and unit testing.
 */
export async function imageFileToInlineDataUri(
  file: Blob,
  options: Pick<Base64ImageOptions, 'maxSizeBytes' | 'maxDimension' | 'quality'>,
): Promise<string> {
  const dataUri = await blobToDataUri(file, {
    maxBytes: options.maxSizeBytes > 0 ? options.maxSizeBytes : undefined,
  });
  if (options.maxDimension && options.maxDimension > 0) {
    const scaled = await downscaleDataUri(
      dataUri,
      options.maxDimension,
      options.quality,
    );
    // Re-apply the size guard to the re-encoded output: canvas re-encoding can
    // change (and occasionally inflate) the byte length, so the guard must hold
    // for what actually lands in the document, not just the source file.
    if (options.maxSizeBytes > 0) {
      const scaledBytes = dataUriByteLength(scaled);
      if (scaledBytes > options.maxSizeBytes) {
        throw new Base64SizeError(scaledBytes, options.maxSizeBytes);
      }
    }
    return scaled;
  }
  return dataUri;
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

  addProseMirrorPlugins() {
    const options = this.options;
    const editor = this.editor;

    const insertFiles = (files: File[], at?: number) => {
      const images = files.filter((f) => f.type.startsWith('image/'));
      if (images.length === 0) return false;
      for (const file of images) {
        imageFileToInlineDataUri(file, options)
          .then((src) => {
            if (editor.isDestroyed) return;
            const node = editor.schema.nodes.image.create({ src });
            const pos =
              typeof at === 'number' ? at : editor.state.selection.from;
            const tr = editor.state.tr.insert(pos, node);
            editor.view.dispatch(tr);
          })
          .catch((err: unknown) => {
            options.onError?.(
              // Conversion only ever rejects with an Error; the String() branch
              // is a defensive normalization that does not run in practice.
              /* v8 ignore next */
              err instanceof Error ? err : new Error(String(err)),
            );
          });
      }
      return true;
    };

    return [
      new Plugin({
        key: base64ImagePluginKey,
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
            const dt = (event as DragEvent).dataTransfer;
            const files = dt?.files ? Array.from(dt.files) : [];
            if (files.length === 0) return false;
            const coords = view.posAtCoords({
              left: (event as DragEvent).clientX,
              top: (event as DragEvent).clientY,
            });
            const handled = insertFiles(files, coords?.pos);
            if (handled) event.preventDefault();
            return handled;
          },
        },
      }),
    ];
  },
});

export default Base64Image;
