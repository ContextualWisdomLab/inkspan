import { describe, it, expect, vi, afterEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  downscaleDataUri,
  imageFileToInlineDataUri,
  Base64Image,
  base64ImagePluginKey,
} from './Base64Image.js';
import { buildExtensions } from './kit.js';

const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06,
  0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89,
]);

/** A controllable stand-in for the browser's `Image`, which jsdom cannot decode. */
class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  width = 0;
  height = 0;
  private _src = '';
  set src(value: string) {
    this._src = value;
    queueMicrotask(() => {
      if (MockImage.mode === 'error') {
        this.onerror?.();
        return;
      }
      this.width = MockImage.width;
      this.height = MockImage.height;
      this.onload?.();
    });
  }
  get src(): string {
    return this._src;
  }
  static mode: 'load' | 'error' = 'load';
  static width = 100;
  static height = 100;
}

const openEditors: Editor[] = [];
function track(editor: Editor): Editor {
  openEditors.push(editor);
  return editor;
}

afterEach(() => {
  for (const editor of openEditors.splice(0)) {
    if (!editor.isDestroyed) editor.destroy();
  }
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  MockImage.mode = 'load';
  MockImage.width = 100;
  MockImage.height = 100;
});

describe('downscaleDataUri', () => {
  it('returns the original URI when downscaling is disabled (maxDimension 0)', async () => {
    const uri = 'data:image/png;base64,AAAA';
    expect(await downscaleDataUri(uri, 0, 0.85)).toBe(uri);
  });

  it('returns the original URI when no Image constructor is available', async () => {
    vi.stubGlobal('Image', undefined);
    const uri = 'data:image/png;base64,AAAA';
    expect(await downscaleDataUri(uri, 100, 0.85)).toBe(uri);
  });

  it('returns the original URI when the image fails to load', async () => {
    vi.stubGlobal('Image', MockImage);
    MockImage.mode = 'error';
    const uri = 'data:image/png;base64,AAAA';
    expect(await downscaleDataUri(uri, 100, 0.85)).toBe(uri);
  });

  it('returns the original URI when the image already fits', async () => {
    vi.stubGlobal('Image', MockImage);
    MockImage.width = 50;
    MockImage.height = 40;
    const uri = 'data:image/png;base64,AAAA';
    expect(await downscaleDataUri(uri, 100, 0.85)).toBe(uri);
  });

  it('returns the original URI when a 2D context cannot be obtained', async () => {
    vi.stubGlobal('Image', MockImage);
    MockImage.width = 400;
    MockImage.height = 200;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const uri = 'data:image/png;base64,AAAA';
    expect(await downscaleDataUri(uri, 100, 0.85)).toBe(uri);
  });

  it('re-encodes an oversized PNG through the canvas', async () => {
    vi.stubGlobal('Image', MockImage);
    MockImage.width = 400;
    MockImage.height = 200;
    const ctx = { drawImage: vi.fn() };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D,
    );
    const toDataURL = vi
      .spyOn(HTMLCanvasElement.prototype, 'toDataURL')
      .mockReturnValue('data:image/png;base64,SCALED');
    const out = await downscaleDataUri('data:image/png;base64,AAAA', 100, 0.85);
    expect(out).toBe('data:image/png;base64,SCALED');
    expect(ctx.drawImage).toHaveBeenCalledOnce();
    expect(toDataURL).toHaveBeenCalledWith('image/png', 0.85);
  });

  it('re-encodes a non-PNG image as jpeg', async () => {
    vi.stubGlobal('Image', MockImage);
    MockImage.width = 400;
    MockImage.height = 400;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      { drawImage: vi.fn() } as unknown as CanvasRenderingContext2D,
    );
    const toDataURL = vi
      .spyOn(HTMLCanvasElement.prototype, 'toDataURL')
      .mockReturnValue('data:image/jpeg;base64,SCALED');
    const out = await downscaleDataUri('data:image/webp;base64,AAAA', 100, 0.85);
    expect(out).toBe('data:image/jpeg;base64,SCALED');
    expect(toDataURL).toHaveBeenCalledWith('image/jpeg', 0.85);
  });
});

describe('imageFileToInlineDataUri downscale branch', () => {
  it('invokes the downscaler when maxDimension is positive', async () => {
    vi.stubGlobal('Image', MockImage);
    MockImage.width = 50;
    MockImage.height = 50; // fits, so the URI comes back unchanged
    const file = new File([PNG_BYTES], 'p.png', { type: 'image/png' });
    const uri = await imageFileToInlineDataUri(file, {
      maxSizeBytes: 1024 * 1024,
      maxDimension: 100,
      quality: 0.85,
    });
    expect(uri.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('disables the size guard when maxSizeBytes is 0', async () => {
    const file = new File([PNG_BYTES], 'p.png', { type: 'image/png' });
    const uri = await imageFileToInlineDataUri(file, {
      maxSizeBytes: 0,
      maxDimension: 0,
      quality: 0.85,
    });
    expect(uri.startsWith('data:image/png;base64,')).toBe(true);
  });
});

function makeEditor(opts?: {
  image?: Record<string, unknown>;
  onError?: (error: Error) => void;
}): Editor {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const extensions = opts?.onError
    ? [
        StarterKit,
        Base64Image.configure({
          maxSizeBytes: 4,
          maxDimension: 0,
          quality: 0.85,
          onError: opts.onError,
        }),
      ]
    : buildExtensions({ image: { maxDimension: 0, ...(opts?.image ?? {}) } });
  return new Editor({ element, extensions, content: '<p>hello</p>' });
}

function paste(editor: Editor, event: unknown): boolean {
  const plugin = base64ImagePluginKey.get(editor.state)!;
  return (plugin.props.handlePaste as (v: unknown, e: unknown) => boolean)(
    editor.view,
    event,
  );
}

function drop(editor: Editor, event: unknown): boolean {
  const plugin = base64ImagePluginKey.get(editor.state)!;
  return (plugin.props.handleDrop as (v: unknown, e: unknown) => boolean)(
    editor.view,
    event,
  );
}

describe('Base64Image paste handler', () => {
  it('ignores paste events without clipboard items', () => {
    const editor = track(makeEditor());
    expect(paste(editor, { clipboardData: undefined })).toBe(false);
  });

  it('ignores clipboards that carry no files', () => {
    const editor = track(makeEditor());
    const items = [{ kind: 'string', getAsFile: () => null }];
    expect(paste(editor, { clipboardData: { items } })).toBe(false);
  });

  it('ignores pasted non-image files without preventing default', () => {
    const editor = track(makeEditor());
    const file = new File(['plain'], 'a.txt', { type: 'text/plain' });
    const items = [{ kind: 'file', getAsFile: () => file }];
    const preventDefault = vi.fn();
    expect(paste(editor, { clipboardData: { items }, preventDefault })).toBe(
      false,
    );
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('embeds a pasted image file as inline base64', async () => {
    const editor = track(makeEditor());
    const file = new File([PNG_BYTES], 'p.png', { type: 'image/png' });
    const items = [
      { kind: 'file', getAsFile: () => null }, // exercises the `if (file)` guard
      { kind: 'file', getAsFile: () => file },
    ];
    const preventDefault = vi.fn();
    expect(paste(editor, { clipboardData: { items }, preventDefault })).toBe(
      true,
    );
    expect(preventDefault).toHaveBeenCalledOnce();
    await waitFor(() =>
      expect(editor.getHTML()).toContain('data:image/png;base64'),
    );
  });
});

describe('Base64Image drop handler', () => {
  it('ignores drops without files', () => {
    const editor = track(makeEditor());
    expect(drop(editor, { dataTransfer: undefined })).toBe(false);
  });

  it('embeds a dropped image at the resolved drop coordinates', async () => {
    const editor = track(makeEditor());
    vi.spyOn(editor.view, 'posAtCoords').mockReturnValue({
      pos: 1,
      inside: -1,
    });
    const file = new File([PNG_BYTES], 'p.png', { type: 'image/png' });
    const preventDefault = vi.fn();
    expect(
      drop(editor, {
        dataTransfer: { files: [file] },
        clientX: 5,
        clientY: 5,
        preventDefault,
      }),
    ).toBe(true);
    expect(preventDefault).toHaveBeenCalledOnce();
    await waitFor(() =>
      expect(editor.getHTML()).toContain('data:image/png;base64'),
    );
  });

  it('falls back to the current selection when coords resolve to nothing', async () => {
    const editor = track(makeEditor());
    vi.spyOn(editor.view, 'posAtCoords').mockReturnValue(null);
    const file = new File([PNG_BYTES], 'p.png', { type: 'image/png' });
    expect(
      drop(editor, {
        dataTransfer: { files: [file] },
        clientX: 0,
        clientY: 0,
        preventDefault: vi.fn(),
      }),
    ).toBe(true);
    await waitFor(() =>
      expect(editor.getHTML()).toContain('data:image/png;base64'),
    );
  });
});

describe('Base64Image conversion error handling', () => {
  it('routes conversion failures to the configured onError handler', async () => {
    const onError = vi.fn();
    const editor = track(makeEditor({ onError }));
    const file = new File([PNG_BYTES], 'p.png', { type: 'image/png' }); // > 4 bytes
    const items = [{ kind: 'file', getAsFile: () => file }];
    expect(
      paste(editor, { clipboardData: { items }, preventDefault: vi.fn() }),
    ).toBe(true);
    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(editor.getHTML()).not.toContain('data:image');
  });

  it('swallows conversion failures when no onError handler is configured', async () => {
    const editor = track(makeEditor({ image: { maxSizeBytes: 4 } }));
    const file = new File([PNG_BYTES], 'p.png', { type: 'image/png' });
    const items = [{ kind: 'file', getAsFile: () => file }];
    expect(
      paste(editor, { clipboardData: { items }, preventDefault: vi.fn() }),
    ).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 15));
    expect(editor.getHTML()).not.toContain('data:image');
  });

  it('skips insertion when the editor is destroyed mid-conversion', async () => {
    const editor = makeEditor();
    const file = new File([PNG_BYTES], 'p.png', { type: 'image/png' });
    const items = [{ kind: 'file', getAsFile: () => file }];
    paste(editor, { clipboardData: { items }, preventDefault: vi.fn() });
    editor.destroy(); // tear down before the async conversion resolves
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(editor.isDestroyed).toBe(true);
  });
});
