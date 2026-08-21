import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { ReferenceHostHydrationGate } from '../examples/reference-host/hydration-gate.js';

afterEach(cleanup);

describe('reference-host hydration gate', () => {
  it('keeps the browser editor out of server markup and mounts it only after client hydration', async () => {
    const renderEditor = vi.fn(() => (
      <div data-reference-editor="ready">Hydrated editor</div>
    ));

    const serverHtml = renderToString(
      <ReferenceHostHydrationGate
        loadingLabel="Loading editor"
        renderEditor={renderEditor}
      />,
    );

    expect(renderEditor).not.toHaveBeenCalled();
    expect(serverHtml).toContain('aria-busy="true"');
    expect(serverHtml).toContain('Loading editor');
    expect(serverHtml).not.toContain('data-reference-editor="ready"');

    render(
      <ReferenceHostHydrationGate
        loadingLabel="Loading editor"
        renderEditor={renderEditor}
      />,
    );

    await waitFor(() => {
      expect(renderEditor).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Hydrated editor')).toBeInTheDocument();
    });
    expect(screen.queryByText('Loading editor')).not.toBeInTheDocument();
  });
});
