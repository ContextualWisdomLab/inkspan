import type { Editor } from '@tiptap/react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorFormField } from './EditorFormField.js';

afterEach(cleanup);

/** Return the native field created by the focused pre-hydration fixture. */
function nativeField(container: HTMLElement): HTMLInputElement {
  const field = container.querySelector<HTMLInputElement>(
    '[data-inkspan-form-field]',
  );
  if (!field) throw new Error('Inkspan native form field was not rendered');
  return field;
}

describe('EditorFormField SSR-to-editor handoff', () => {
  it('retains and updates the selected value until TipTap exists', () => {
    const { container, rerender } = render(
      <EditorFormField
        editor={null}
        mode="markdown"
        name="message_body"
        initialValue="# Server draft"
      />,
    );

    expect(nativeField(container).value).toBe('# Server draft');

    rerender(
      <EditorFormField
        editor={null}
        mode="markdown"
        name="message_body"
        initialValue="# Updated before hydration"
      />,
    );

    expect(nativeField(container).value).toBe('# Updated before hydration');
  });

  it('keeps the server value until a delayed TipTap create event becomes authoritative', () => {
    let editorHtml = '';
    let createListener: (() => void) | undefined;
    const editor = {
      isInitialized: false,
      getHTML: vi.fn(() => editorHtml),
      on: vi.fn((event: string, listener: () => void) => {
        if (event === 'create') createListener = listener;
      }),
      off: vi.fn(),
    } as unknown as Editor;
    const { container, rerender } = render(
      <EditorFormField
        editor={null}
        mode="markdown"
        name="message_body"
        initialValue="# Server draft"
      />,
    );

    rerender(
      <EditorFormField
        editor={editor}
        mode="markdown"
        name="message_body"
        initialValue="# Server draft"
      />,
    );

    expect(nativeField(container).value).toBe('# Server draft');

    editorHtml = '<h1>Client draft</h1>';
    createListener?.();

    expect(nativeField(container).value).toContain('# Client draft');
  });

  it('restores the live editor value after an unhandled native form reset', async () => {
    let editorHtml = '<p>Initial</p>';
    let transactionListener:
      | ((event: { transaction: { docChanged: boolean } }) => void)
      | undefined;
    const editor = {
      getHTML: vi.fn(() => editorHtml),
      on: vi.fn(
        (
          event: string,
          listener: (event: { transaction: { docChanged: boolean } }) => void,
        ) => {
          if (event === 'transaction') transactionListener = listener;
        },
      ),
      off: vi.fn(),
    } as unknown as Editor;
    const { container } = render(
      <form>
        <EditorFormField
          editor={editor}
          mode="html"
          name="message_body"
          initialValue="<p>Initial</p>"
        />
      </form>,
    );
    const form = container.querySelector('form');
    if (!form) throw new Error('Focused form fixture was not rendered');

    editorHtml = '<p>Current</p>';
    transactionListener?.({ transaction: { docChanged: true } });
    expect(nativeField(container).value).toBe('<p>Current</p>');

    form.reset();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(nativeField(container).value).toBe('<p>Current</p>');
  });

  it('does not retain a document value for an unnamed reset-only field', () => {
    const { container } = render(
      <EditorFormField
        editor={null}
        mode="html"
        initialValue="<p>Private reset value</p>"
        onFormReset={() => undefined}
      />,
    );

    expect(nativeField(container).value).toBe('');
    expect(nativeField(container).name).toBe('');
  });
});
