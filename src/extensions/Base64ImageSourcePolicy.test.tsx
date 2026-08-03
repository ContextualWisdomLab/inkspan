import { cleanup, render, waitFor } from '@testing-library/react';
import StarterKit from '@tiptap/starter-kit';
import { DOMSerializer } from '@tiptap/pm/model';
import { Editor } from '@tiptap/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CwlEditor } from '../components/CwlEditor.js';
import { Base64SizeError } from '../converter/base64.js';
import type { CwlEditorHandle } from '../types.js';
import {
  Base64Image,
  Base64ImageSourceError,
  validateInlineImageSource,
} from './Base64Image.js';
import { buildExtensions } from './kit.js';

const VALID_IMAGE = 'data:image/png;base64,AAAA';
const LARGE_IMAGE = 'data:image/png;base64,QUJDRA==';
const openEditors: Editor[] = [];

function createEditor(
  content = '<p>Safe text</p>',
  options: { maxSizeBytes?: number; onError?: (error: Error) => void } = {},
): Editor {
  const editor = new Editor({
    extensions: buildExtensions({
      image: {
        maxSizeBytes: options.maxSizeBytes ?? 10 * 1024 * 1024,
        maxDimension: 0,
      },
      onImageError: options.onError,
    }),
    content,
  });
  openEditors.push(editor);
  return editor;
}

afterEach(() => {
  cleanup();
  for (const editor of openEditors.splice(0)) {
    if (!editor.isDestroyed) editor.destroy();
  }
  vi.restoreAllMocks();
});

describe('inline image source validation', () => {
  it.each([
    VALID_IMAGE,
    'DATA:IMAGE/JPEG;BASE64,QUJDRA==',
    'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
  ])('accepts strict inline base64 image source %s', (source) => {
    expect(validateInlineImageSource(source, 0)).toBe(source);
  });

  it.each([
    undefined,
    null,
    42,
    '',
    ' data:image/png;base64,AAAA',
    'data:image/png;base64,AAAA ',
    'https://example.com/image.png',
    'http://example.com/image.png',
    '//example.com/image.png',
    'blob:https://example.com/identifier',
    'file:///tmp/image.png',
    'javascript:alert(1)',
    'data:text/html;base64,AAAA',
    'data:image/png,AAAA',
    'data:image/png;base64,',
    'data:image/png;base64,AAA',
    'data:image/png;base64,AAAA===',
    'data:image/png;base64,AA*A',
  ])('rejects unsafe or malformed source %#', (source) => {
    expect(() => validateInlineImageSource(source, 0)).toThrow(
      Base64ImageSourceError,
    );
  });

  it('enforces the decoded-byte limit on existing data URIs', () => {
    expect(() => validateInlineImageSource(LARGE_IMAGE, 3)).toThrow(
      Base64SizeError,
    );
    expect(validateInlineImageSource(LARGE_IMAGE, 4)).toBe(LARGE_IMAGE);
  });

  it('exposes only a bounded source preview for diagnostics', () => {
    const numeric = new Base64ImageSourceError(42);
    const long = new Base64ImageSourceError('x'.repeat(100));

    expect(numeric.name).toBe('Base64ImageSourceError');
    expect(numeric.sourcePreview).toBe('42');
    expect(long.sourcePreview).toHaveLength(80);
    expect(long.sourcePreview).toBe(`${'x'.repeat(77)}...`);
  });
});

describe('image source ingress enforcement', () => {
  it('rejects an external image during initial HTML parsing and reports it', () => {
    const onError = vi.fn();
    const editor = createEditor(
      '<p>Before</p><img src="https://tracker.example/pixel.png" alt="Tracker"><p>After</p>',
      { onError },
    );

    expect(editor.getHTML()).toContain('Before');
    expect(editor.getHTML()).toContain('After');
    expect(editor.getHTML()).not.toContain('tracker.example');
    expect(editor.getHTML()).not.toContain('<img');
    expect(onError).toHaveBeenCalledWith(expect.any(Base64ImageSourceError));
  });

  it('rejects an oversized initial image while preserving adjacent content', () => {
    const onError = vi.fn();
    const editor = createEditor(
      `<p>Before</p><img src="${LARGE_IMAGE}" alt="Large"><p>After</p>`,
      { maxSizeBytes: 3, onError },
    );

    expect(editor.getHTML()).toBe('<p>Before</p><p>After</p>');
    expect(onError).toHaveBeenCalledWith(expect.any(Base64SizeError));
  });

  it('preserves valid src, alt, and title attributes', () => {
    const editor = createEditor(
      `<img src="${VALID_IMAGE}" alt="Architecture diagram" title="System context">`,
    );

    expect(editor.getHTML()).toContain(`src="${VALID_IMAGE}"`);
    expect(editor.getHTML()).toContain('alt="Architecture diagram"');
    expect(editor.getHTML()).toContain('title="System context"');
  });

  it('rejects an external Markdown image before it enters initial editor state', async () => {
    const onError = vi.fn();
    const onReady = vi.fn();
    render(
      <CwlEditor
        defaultValue="![Remote](https://tracker.example/image.png)"
        onImageError={onError}
        onReady={onReady}
        hideToolbar
      />,
    );

    await waitFor(() => expect(onReady).toHaveBeenCalled());
    const editor = onReady.mock.calls[0]![0] as Editor;
    expect(editor.getHTML()).not.toContain('tracker.example');
    expect(editor.getHTML()).not.toContain('<img');
    expect(onError).toHaveBeenCalledWith(expect.any(Base64ImageSourceError));
  });

  it('sanitizes controlled, setValue, and insertValue inputs through one policy', async () => {
    const editorRef = createRef<CwlEditorHandle>();
    const onError = vi.fn();
    const { rerender } = render(
      <CwlEditor
        ref={editorRef}
        mode="html"
        value="<p>Initial</p>"
        onImageError={onError}
        hideToolbar
      />,
    );
    await waitFor(() => expect(editorRef.current?.getEditor()).toBeTruthy());

    rerender(
      <CwlEditor
        ref={editorRef}
        mode="html"
        value='<p>Controlled</p><img src="https://remote.example/a.png">'
        onImageError={onError}
        hideToolbar
      />,
    );
    await waitFor(() =>
      expect(editorRef.current?.getHTML()).toContain('Controlled'),
    );
    expect(editorRef.current!.getHTML()).not.toContain('remote.example');

    editorRef.current!.setValue(
      '<p>Set value</p><img src="blob:https://example.com/id">',
    );
    expect(editorRef.current!.getHTML()).toContain('Set value');
    expect(editorRef.current!.getHTML()).not.toContain('blob:');

    editorRef.current!.insertValue(
      '<p>Inserted text</p><img src="file:///tmp/secret.png">',
    );
    expect(editorRef.current!.getHTML()).toContain('Inserted text');
    expect(editorRef.current!.getHTML()).not.toContain('file:');
    expect(onError).toHaveBeenCalledTimes(3);
  });

  it('rejects direct image insertion transactions without changing the document', () => {
    const onError = vi.fn();
    const editor = createEditor('<p>Unchanged</p>', { onError });
    const before = editor.getJSON();
    const unsafeNode = editor.schema.nodes.image.create({
      src: 'https://remote.example/image.png',
      alt: 'Remote',
    });

    editor.view.dispatch(editor.state.tr.insert(0, unsafeNode));

    expect(editor.getJSON()).toEqual(before);
    expect(onError).toHaveBeenCalledWith(expect.any(Base64ImageSourceError));
  });

  it('rejects unsafe source updates while preserving the prior inline image', () => {
    const onError = vi.fn();
    const editor = createEditor(`<img src="${VALID_IMAGE}" alt="Safe">`, {
      onError,
    });
    editor.commands.setNodeSelection(0);
    const before = editor.getHTML();

    editor.commands.updateAttributes('image', {
      src: 'javascript:alert(1)',
    });

    expect(editor.getHTML()).toBe(before);
    expect(onError).toHaveBeenCalledWith(expect.any(Base64ImageSourceError));
  });

  it('allows valid image changes and non-document selection transactions', () => {
    const onError = vi.fn();
    const editor = createEditor(`<img src="${VALID_IMAGE}" alt="Old">`, {
      onError,
    });
    editor.commands.setNodeSelection(0);
    editor.commands.updateAttributes('image', { alt: 'Updated' });
    editor.view.dispatch(editor.state.tr.setMeta('selection-only', true));

    expect(editor.getHTML()).toContain('alt="Updated"');
    expect(onError).not.toHaveBeenCalled();
  });
});

describe('defense-in-depth image rendering', () => {
  it.each([
    [false, 'div'],
    [true, 'span'],
  ] as const)('never serializes unsafe %s image state', (inline, expectedTag) => {
    const editor = new Editor({
      extensions: [
        StarterKit,
        Base64Image.configure({
          inline,
          maxSizeBytes: 1024,
          maxDimension: 0,
        }),
      ],
    });
    openEditors.push(editor);
    const image = editor.schema.nodes.image.create({
      src: 'https://remote.example/image.png',
      alt: 'Remote',
    });
    const content = inline
      ? editor.schema.nodes.paragraph.create(null, image)
      : image;
    const doc = editor.schema.nodes.doc.create(null, content);
    const container = document.createElement('div');

    container.append(
      DOMSerializer.fromSchema(editor.schema).serializeFragment(doc.content),
    );

    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector(expectedTag)).toHaveAttribute(
      'data-cwl-rejected-image',
      'true',
    );
  });
});
