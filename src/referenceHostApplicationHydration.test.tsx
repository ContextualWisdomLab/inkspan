import { act } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ReferenceHostApp } from '../examples/reference-host/reference-host-app.js';

const mountedContainers: HTMLElement[] = [];
const mountedRoots: Root[] = [];

afterEach(async () => {
  while (mountedRoots.length > 0) {
    const root = mountedRoots.pop();
    if (root) {
      await act(async () => {
        root.unmount();
      });
    }
  }
  while (mountedContainers.length > 0) {
    mountedContainers.pop()?.remove();
  }
  vi.restoreAllMocks();
});

describe('reference-host application hydration', () => {
  it('server-renders a deterministic shell and hydrates the real native-form host without a mismatch', async () => {
    const onAuthorizedSubmit = vi.fn();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const serverHtml = renderToString(
      <ReferenceHostApp
        loadingLabel="Loading buyer editor"
        onAuthorizedSubmit={onAuthorizedSubmit}
      />,
    );

    expect(serverHtml).toContain('Inkspan reference host');
    expect(serverHtml).toContain('aria-busy="true"');
    expect(serverHtml).toContain('Loading buyer editor');
    expect(serverHtml).not.toContain('name="message_body"');
    expect(onAuthorizedSubmit).not.toHaveBeenCalled();

    const container = document.createElement('div');
    container.innerHTML = serverHtml;
    document.body.append(container);
    mountedContainers.push(container);

    let root: Root | undefined;
    await act(async () => {
      root = hydrateRoot(
        container,
        <ReferenceHostApp
          loadingLabel="Loading buyer editor"
          onAuthorizedSubmit={onAuthorizedSubmit}
        />,
      );
      await Promise.resolve();
    });
    if (!root) {
      throw new Error('Reference host hydration root was not created.');
    }
    mountedRoots.push(root);

    expect(container.querySelector('input[name="message_body"]')).not.toBeNull();
    expect(container.textContent).toContain('Save document');
    expect(container.textContent).not.toContain('Loading buyer editor');
    expect(onAuthorizedSubmit).not.toHaveBeenCalled();

    const hydrationErrors = consoleError.mock.calls.filter(([first]) =>
      typeof first === 'string'
        ? /hydration|did not match|server html/i.test(first)
        : false,
    );
    expect(hydrationErrors).toEqual([]);
  });

  it('keeps the real hydrated form fail-closed when the host is read-only', async () => {
    const onAuthorizedSubmit = vi.fn();
    const container = document.createElement('div');
    container.innerHTML = renderToString(
      <ReferenceHostApp
        loadingLabel="Loading buyer editor"
        onAuthorizedSubmit={onAuthorizedSubmit}
        readOnly
      />,
    );
    document.body.append(container);
    mountedContainers.push(container);

    let root: Root | undefined;
    await act(async () => {
      root = hydrateRoot(
        container,
        <ReferenceHostApp
          loadingLabel="Loading buyer editor"
          onAuthorizedSubmit={onAuthorizedSubmit}
          readOnly
        />,
      );
      await Promise.resolve();
    });
    if (!root) {
      throw new Error('Reference host hydration root was not created.');
    }
    mountedRoots.push(root);

    const field = container.querySelector<HTMLInputElement>(
      'input[name="message_body"]',
    );
    const submit = container.querySelector<HTMLButtonElement>('button[type="submit"]');
    const reset = container.querySelector<HTMLButtonElement>('button[type="reset"]');

    expect(field).not.toBeNull();
    expect(field?.disabled).toBe(true);
    expect(submit?.disabled).toBe(true);
    expect(reset?.disabled).toBe(true);
    expect(onAuthorizedSubmit).not.toHaveBeenCalled();
  });
});
