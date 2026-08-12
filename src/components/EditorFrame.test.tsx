import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EditorFrame } from './EditorFrame.js';

describe('EditorFrame writing diagnostics slot', () => {
  it('renders a trusted diagnostics slot after the authored document surface', () => {
    const { container } = render(
      <EditorFrame
        editor={null}
        mode="markdown"
        editable={false}
        hideToolbar
        writingDiagnosticsPanel={
          <aside data-testid="writing-diagnostics-slot">Suggestions</aside>
        }
      />,
    );

    const surface = container.querySelector('.cwl-editor__surface');
    const slot = screen.getByTestId('writing-diagnostics-slot');
    expect(surface).not.toBeNull();
    expect(
      surface!.compareDocumentPosition(slot) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
