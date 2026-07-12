import { describe, it, expect, vi } from 'vitest';
import {
  render,
  screen,
  waitFor,
  cleanup,
  fireEvent,
  act,
} from '@testing-library/react';
import { afterEach } from 'vitest';
import type { Editor } from '@tiptap/react';
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

  it('renders an empty document when neither value nor defaultValue is given', async () => {
    render(<CwlEditor mode="markdown" />);
    await waitFor(() =>
      expect(document.querySelector('.cwl-editor__content')).toBeTruthy(),
    );
    expect(screen.getByRole('toolbar', { name: /formatting/i })).toBeInTheDocument();
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

describe('CwlEditor change emission', () => {
  it('emits serialized markdown through onChange when the doc changes', async () => {
    const onChange = vi.fn();
    let ed: Editor | undefined;
    render(
      <CwlEditor
        mode="markdown"
        defaultValue="hi"
        onChange={onChange}
        onReady={(e) => {
          ed = e;
        }}
      />,
    );
    await waitFor(() => expect(ed).toBeTruthy());
    await act(async () => {
      ed!.chain().focus().insertContent(' there').run();
    });
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.calls.at(-1)![0]).toContain('hi');
  });

  it('emits serialized html through onChange in html mode', async () => {
    const onChange = vi.fn();
    let ed: Editor | undefined;
    render(
      <CwlEditor
        mode="html"
        defaultValue="<p>hi</p>"
        onChange={onChange}
        onReady={(e) => {
          ed = e;
        }}
      />,
    );
    await waitFor(() => expect(ed).toBeTruthy());
    await act(async () => {
      ed!.chain().focus().insertContent(' x').run();
    });
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.calls.at(-1)![0]).toContain('<p>');
  });

  it('does not throw on updates when no onChange handler is provided', async () => {
    let ed: Editor | undefined;
    render(
      <CwlEditor
        mode="markdown"
        defaultValue="hi"
        onReady={(e) => {
          ed = e;
        }}
      />,
    );
    await waitFor(() => expect(ed).toBeTruthy());
    await act(async () => {
      ed!.chain().focus().insertContent(' more').run();
    });
    expect(ed!.getHTML()).toContain('more');
  });
});

describe('CwlEditor controlled value sync', () => {
  it('pushes new external values into the document', async () => {
    const { rerender } = render(<CwlEditor mode="markdown" value="# One" />);
    await waitFor(() =>
      expect(
        document.querySelector('.cwl-editor__content h1'),
      ).toHaveTextContent('One'),
    );
    rerender(<CwlEditor mode="markdown" value="# Two" />);
    await waitFor(() =>
      expect(
        document.querySelector('.cwl-editor__content h1'),
      ).toHaveTextContent('Two'),
    );
  });

  it('leaves the document untouched when the value already matches', async () => {
    const { rerender } = render(<CwlEditor mode="markdown" value="stable" />);
    await waitFor(() =>
      expect(document.querySelector('.cwl-editor__content')).toHaveTextContent(
        'stable',
      ),
    );
    // Re-render with the same value but a different unrelated prop.
    rerender(<CwlEditor mode="markdown" value="stable" className="tweak" />);
    await waitFor(() =>
      expect(document.querySelector('.cwl-editor')).toHaveClass('tweak'),
    );
    expect(document.querySelector('.cwl-editor__content')).toHaveTextContent(
      'stable',
    );
  });
});

describe('CwlEditor Ctrl/Cmd+K link shortcut', () => {
  function surface(): HTMLElement {
    return document.querySelector('.cwl-editor__surface') as HTMLElement;
  }

  it('creates a link from the prompt URL', async () => {
    let ed: Editor | undefined;
    vi.spyOn(window, 'prompt').mockReturnValue('https://ex.com');
    render(
      <CwlEditor
        mode="markdown"
        defaultValue="hi"
        onReady={(e) => {
          ed = e;
        }}
      />,
    );
    await waitFor(() => expect(ed).toBeTruthy());
    await act(async () => {
      ed!.chain().focus().selectAll().run();
      fireEvent.keyDown(surface(), { key: 'K', metaKey: true });
    });
    await waitFor(() =>
      expect(ed!.getHTML()).toContain('href="https://ex.com"'),
    );
  });

  it('reuses the existing link href as the prompt default', async () => {
    let ed: Editor | undefined;
    const prompt = vi
      .spyOn(window, 'prompt')
      .mockReturnValue('https://second.com');
    render(
      <CwlEditor
        mode="markdown"
        defaultValue="hi"
        onReady={(e) => {
          ed = e;
        }}
      />,
    );
    await waitFor(() => expect(ed).toBeTruthy());
    await act(async () => {
      ed!.chain().focus().selectAll().setLink({ href: 'https://first.com' }).run();
      fireEvent.keyDown(surface(), { key: 'k', ctrlKey: true });
    });
    await waitFor(() =>
      expect(ed!.getHTML()).toContain('href="https://second.com"'),
    );
    expect(prompt).toHaveBeenLastCalledWith('Link URL', 'https://first.com');
  });

  it('removes the link when the prompt is cleared to empty', async () => {
    let ed: Editor | undefined;
    vi.spyOn(window, 'prompt').mockReturnValue('');
    render(
      <CwlEditor
        mode="markdown"
        defaultValue="hi"
        onReady={(e) => {
          ed = e;
        }}
      />,
    );
    await waitFor(() => expect(ed).toBeTruthy());
    await act(async () => {
      ed!.chain().focus().selectAll().setLink({ href: 'https://x.com' }).run();
      fireEvent.keyDown(surface(), { key: 'k', metaKey: true });
    });
    await waitFor(() => expect(ed!.getHTML()).not.toContain('href='));
  });

  it('does nothing when the link prompt is cancelled', async () => {
    let ed: Editor | undefined;
    vi.spyOn(window, 'prompt').mockReturnValue(null);
    render(
      <CwlEditor
        mode="markdown"
        defaultValue="hi"
        onReady={(e) => {
          ed = e;
        }}
      />,
    );
    await waitFor(() => expect(ed).toBeTruthy());
    fireEvent.keyDown(surface(), { key: 'k', metaKey: true });
    expect(ed!.getHTML()).not.toContain('href=');
  });

  it('ignores k without a modifier and modified non-k keys', async () => {
    render(<CwlEditor mode="markdown" defaultValue="hi" />);
    await waitFor(() =>
      expect(document.querySelector('.cwl-editor__surface')).toBeTruthy(),
    );
    fireEvent.keyDown(surface(), { key: 'k' });
    fireEvent.keyDown(surface(), { key: 'b', metaKey: true });
    expect(document.querySelector('.cwl-editor__content')).toBeTruthy();
  });
});
