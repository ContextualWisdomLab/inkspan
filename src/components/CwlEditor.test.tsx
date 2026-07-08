import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { CwlEditor } from './CwlEditor.js';
import { imageFileToInlineDataUri } from '../extensions/Base64Image.js';

afterEach(cleanup);

const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06,
  0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89,
]);

describe('CwlEditor smoke', () => {
  it('renders the editable surface and toolbar in markdown mode', async () => {
    render(<CwlEditor mode="markdown" defaultValue="# Hello" />);
    // Toolbar present.
    expect(
      screen.getByRole('toolbar', { name: /formatting/i }),
    ).toBeInTheDocument();
    // ProseMirror editable region renders the heading.
    await waitFor(() => {
      expect(document.querySelector('.cwl-editor__content h1')).toHaveTextContent(
        'Hello',
      );
    });
  });

  it('hydrates markdown content (bold + list) into the DOM', async () => {
    render(
      <CwlEditor
        mode="markdown"
        defaultValue={'Some **bold** text\n\n- one\n- two'}
      />,
    );
    await waitFor(() => {
      expect(document.querySelector('.cwl-editor__content strong')).toHaveTextContent(
        'bold',
      );
      expect(document.querySelectorAll('.cwl-editor__content li')).toHaveLength(
        2,
      );
    });
  });

  it('renders HTML mode content', async () => {
    render(
      <CwlEditor
        mode="html"
        defaultValue="<h2>Title</h2><p>body</p>"
      />,
    );
    await waitFor(() => {
      expect(document.querySelector('.cwl-editor__content h2')).toHaveTextContent(
        'Title',
      );
    });
  });

  it('hides the toolbar when hideToolbar is set', async () => {
    render(<CwlEditor mode="markdown" hideToolbar defaultValue="x" />);
    await waitFor(() =>
      expect(document.querySelector('.cwl-editor__content')).toBeTruthy(),
    );
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
  });

  it('exposes the editor instance via onReady', async () => {
    const onReady = vi.fn();
    render(<CwlEditor mode="markdown" defaultValue="hi" onReady={onReady} />);
    await waitFor(() => expect(onReady).toHaveBeenCalled());
    const editor = onReady.mock.calls[0][0];
    expect(typeof editor.getHTML).toBe('function');
    expect(editor.getHTML()).toContain('hi');
  });

  it('does not render the toolbar when not editable', async () => {
    render(<CwlEditor mode="markdown" editable={false} defaultValue="ro" />);
    await waitFor(() =>
      expect(document.querySelector('.cwl-editor__content')).toBeTruthy(),
    );
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
  });
});

describe('inline image helper (used by paste/drop/upload)', () => {
  it('turns an image File into a base64 data URI', async () => {
    const file = new File([PNG_BYTES], 'pic.png', { type: 'image/png' });
    const uri = await imageFileToInlineDataUri(file, {
      maxSizeBytes: 1024 * 1024,
      maxDimension: 0, // skip canvas downscale in jsdom
      quality: 0.85,
    });
    expect(uri.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('enforces the size guard on oversized files', async () => {
    const file = new File([PNG_BYTES], 'pic.png', { type: 'image/png' });
    await expect(
      imageFileToInlineDataUri(file, {
        maxSizeBytes: 4,
        maxDimension: 0,
        quality: 0.85,
      }),
    ).rejects.toThrow(/exceeds/);
  });
});
