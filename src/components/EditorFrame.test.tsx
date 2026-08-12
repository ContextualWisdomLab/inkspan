import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { EditorFrame } from './EditorFrame.js';

afterEach(cleanup);

describe('EditorFrame writing diagnostics slot', () => {
  it('renders the trusted panel slot immediately before the editor surface', () => {
    const { container } = render(
      <EditorFrame
        editable
        editor={null}
        hideToolbar
        mode="markdown"
        writingDiagnosticsPanel={
          <section aria-label="Writing guidance">Trusted guidance</section>
        }
      />,
    );

    const panel = screen.getByRole('region', { name: 'Writing guidance' });
    const surface = container.querySelector('.cwl-editor__surface');
    expect(surface).not.toBeNull();
    expect(surface?.previousElementSibling).toBe(panel);
  });

  it('adds no diagnostic markup when the internal slot is omitted', () => {
    const { container } = render(
      <EditorFrame
        editable
        editor={null}
        hideToolbar
        mode="markdown"
      />,
    );

    expect(container.querySelector('.cwl-writing-diagnostics')).toBeNull();
    expect(container.querySelector('.cwl-editor__surface')).not.toBeNull();
  });
});
