import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@contextualwisdomlab/cwl-editor', async () => {
  const { createElement: createReactElement } = await import('react');
  return {
    CwlEditor: () =>
      createReactElement('textarea', {
        'aria-label': 'Document body',
        defaultValue: '# Draft',
        name: 'message_body',
      }),
  };
});

import { NativeFormHost } from '../examples/reference-host/native-form-host.js';

const nativeFormHostSource = readFileSync(
  resolve(process.cwd(), 'examples/reference-host/native-form-host.tsx'),
  'utf8',
);

afterEach(cleanup);

describe('reference-host native form journey', () => {
  it('uses the published editor package and delegates serialization to Inkspan native form integration', () => {
    expect(nativeFormHostSource).toContain(
      "from '@contextualwisdomlab/cwl-editor'",
    );
    expect(nativeFormHostSource).toContain('formFieldName="message_body"');
    expect(nativeFormHostSource).toContain('formResetValue="# Draft"');
    expect(nativeFormHostSource).toContain('new FormData(event.currentTarget)');
    expect(nativeFormHostSource).toContain('type="submit"');
    expect(nativeFormHostSource).toContain('type="reset"');

    expect(nativeFormHostSource).not.toMatch(/<input[^>]+type=["']hidden["']/i);
    expect(nativeFormHostSource).not.toContain('/src/');
    expect(nativeFormHostSource).not.toContain('../../src');
  });

  it('keeps host authorization and durable persistence explicitly outside the component submit callback', () => {
    expect(nativeFormHostSource).toContain('onAuthorizedSubmit');
    expect(nativeFormHostSource).toContain('createSingleFlightSubmission');
    expect(nativeFormHostSource).toContain(
      'onAuthorizedSubmitRef.current(messageBody)',
    );
    expect(nativeFormHostSource).toContain(
      'await submitAuthorized(messageBodyEntry)',
    );
    expect(nativeFormHostSource).toContain(
      "disabled={submissionState === 'saving'}",
    );
    expect(nativeFormHostSource).not.toContain('fetch(');
    expect(nativeFormHostSource).not.toContain('localStorage');
  });

  it('blocks reset while durable submission is in flight and clears stale saved status after a later reset', async () => {
    let resolveSave: (() => void) | undefined;
    const saveResult = new Promise<void>((resolve) => {
      resolveSave = resolve;
    });
    const onAuthorizedSubmit = vi.fn(() => saveResult);
    const { container } = render(
      createElement(NativeFormHost, { onAuthorizedSubmit }),
    );
    const form = container.querySelector('form')!;
    const resetButton = screen.getByRole('button', { name: 'Reset draft' });

    fireEvent.submit(form);
    await waitFor(() => expect(screen.getByText('Saving…')).toBeInTheDocument());
    expect(resetButton).toBeDisabled();
    expect(fireEvent.reset(form)).toBe(false);
    expect(screen.getByText('Saving…')).toBeInTheDocument();

    act(() => resolveSave?.());
    await waitFor(() => expect(screen.getByText('Saved')).toBeInTheDocument());
    expect(resetButton).not.toBeDisabled();

    expect(fireEvent.reset(form)).toBe(true);
    await waitFor(() =>
      expect(screen.getByText('Not saved yet')).toBeInTheDocument(),
    );
    expect(onAuthorizedSubmit).toHaveBeenCalledOnce();
  });
});
