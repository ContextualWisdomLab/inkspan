import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { ReferenceHostHydrationGate } from '../examples/reference-host/hydration-gate.js';

const hydrationGateSource = readFileSync(
  resolve(process.cwd(), 'examples/reference-host/hydration-gate.tsx'),
  'utf8',
);

afterEach(cleanup);

describe('reference-host hydration gate', () => {
  it('declares the hydration boundary as a client component for App Router style hosts', () => {
    expect(hydrationGateSource.startsWith("'use client';\n")).toBe(true);
  });

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
