import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CwlEditor } from './CwlEditor.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('CwlEditor form accessibility metadata', () => {
  it('binds language, direction, labels, validation, and live prop updates', async () => {
    const { rerender } = render(
      <>
        <h2 id="compose-title">Compose body</h2>
        <p id="compose-help">Include the decision and cited evidence.</p>
        <p id="compose-error">A body is required.</p>
        <CwlEditor
          defaultValue="Draft"
          hideToolbar
          languageTag="ko-KR"
          textDirection="ltr"
          ariaLabel="Fallback body label"
          ariaLabelledBy="compose-title"
          ariaDescribedBy="compose-help"
          ariaErrorMessage="compose-error"
          ariaInvalid
          ariaRequired
        />
      </>,
    );

    const editor = await screen.findByRole('textbox', { name: 'Compose body' });
    expect(editor).toHaveAttribute('lang', 'ko-KR');
    expect(editor).toHaveAttribute('dir', 'ltr');
    expect(editor).not.toHaveAttribute('aria-label');
    expect(editor).toHaveAttribute('aria-describedby', 'compose-help');
    expect(editor).toHaveAttribute('aria-errormessage', 'compose-error');
    expect(editor).toHaveAttribute('aria-invalid', 'true');
    expect(editor).toHaveAttribute('aria-required', 'true');
    expect(editor).toHaveAttribute('aria-readonly', 'false');

    rerender(
      <>
        <h2 id="compose-title">Compose body</h2>
        <p id="compose-help">Include the decision and cited evidence.</p>
        <CwlEditor
          defaultValue="Draft"
          hideToolbar
          editable={false}
          languageTag="ar-EG"
          textDirection="rtl"
          ariaLabel="Archived body"
          ariaInvalid={false}
          ariaRequired={false}
        />
      </>,
    );

    await waitFor(() => {
      const readOnlyEditor = screen.getByRole('textbox', {
        name: 'Archived body',
      });
      expect(readOnlyEditor).toHaveAttribute('lang', 'ar-EG');
      expect(readOnlyEditor).toHaveAttribute('dir', 'rtl');
      expect(readOnlyEditor).toHaveAttribute('aria-readonly', 'true');
      expect(readOnlyEditor).toHaveAttribute('aria-invalid', 'false');
      expect(readOnlyEditor).toHaveAttribute('aria-required', 'false');
      expect(readOnlyEditor).not.toHaveAttribute('aria-labelledby');
      expect(readOnlyEditor).not.toHaveAttribute('aria-describedby');
      expect(readOnlyEditor).not.toHaveAttribute('aria-errormessage');
    });
  });

  it('does not invoke editing shortcuts while the editor is read-only', async () => {
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue('https://example.com');

    render(
      <CwlEditor
        defaultValue="Archived decision"
        editable={false}
        ariaLabel="Archived body"
      />,
    );

    const editor = await screen.findByRole('textbox', { name: 'Archived body' });
    fireEvent.keyDown(editor, { key: 'k', ctrlKey: true });
    fireEvent.keyDown(editor, { key: 'k', metaKey: true });

    expect(prompt).not.toHaveBeenCalled();
  });
});
