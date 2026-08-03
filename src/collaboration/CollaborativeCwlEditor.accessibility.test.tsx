import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { CollaborativeCwlEditor } from './CollaborativeCwlEditor.js';

afterEach(cleanup);

describe('CollaborativeCwlEditor form accessibility metadata', () => {
  it('shares the standalone language, direction, naming, and validation contract', async () => {
    const collaborationDocument = new Y.Doc();
    const { rerender, unmount } = render(
      <>
        <h2 id="shared-title">Shared decision draft</h2>
        <p id="shared-help">Changes synchronize with authorized peers.</p>
        <CollaborativeCwlEditor
          document={collaborationDocument}
          hideToolbar
          languageTag="ja-JP"
          textDirection="ltr"
          ariaLabelledBy="shared-title"
          ariaDescribedBy="shared-help"
          ariaInvalid="spelling"
          ariaRequired
        />
      </>,
    );

    const editor = await screen.findByRole('textbox', {
      name: 'Shared decision draft',
    });
    expect(editor).toHaveAttribute('lang', 'ja-JP');
    expect(editor).toHaveAttribute('dir', 'ltr');
    expect(editor).toHaveAttribute('aria-describedby', 'shared-help');
    expect(editor).toHaveAttribute('aria-invalid', 'spelling');
    expect(editor).toHaveAttribute('aria-required', 'true');
    expect(editor).toHaveAttribute('aria-readonly', 'false');

    rerender(
      <CollaborativeCwlEditor
        document={collaborationDocument}
        hideToolbar
        editable={false}
        languageTag="fa-IR"
        textDirection="rtl"
        ariaLabel="Shared decision archive"
        ariaInvalid={false}
      />,
    );

    await waitFor(() => {
      const readOnlyEditor = screen.getByRole('textbox', {
        name: 'Shared decision archive',
      });
      expect(readOnlyEditor).toHaveAttribute('lang', 'fa-IR');
      expect(readOnlyEditor).toHaveAttribute('dir', 'rtl');
      expect(readOnlyEditor).toHaveAttribute('aria-readonly', 'true');
      expect(readOnlyEditor).toHaveAttribute('aria-invalid', 'false');
      expect(readOnlyEditor).not.toHaveAttribute('aria-labelledby');
      expect(readOnlyEditor).not.toHaveAttribute('aria-describedby');
      expect(readOnlyEditor).not.toHaveAttribute('aria-required');
    });

    unmount();
    collaborationDocument.destroy();
  });
});
