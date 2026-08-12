import type { Editor } from '@tiptap/react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { CollaborativeCwlEditor } from '../collaboration/CollaborativeCwlEditor.js';
import type { CwlEditorHandle } from '../types.js';
import { CwlEditor } from './CwlEditor.js';
import { EditorFormField } from './EditorFormField.js';

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

function submittedValue(
  form: HTMLFormElement,
  name: string,
): FormDataEntryValue | null {
  return new FormData(form).get(name);
}

async function dispatchReset(form: HTMLFormElement): Promise<boolean> {
  const allowed = form.dispatchEvent(
    new Event('reset', { bubbles: true, cancelable: true }),
  );
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  return allowed;
}

function reactActWarnings(
  consoleError: ReturnType<typeof vi.spyOn>,
): string[] {
  return consoleError.mock.calls
    .map((arguments_) => arguments_.map(String).join(' '))
    .filter((message) => message.includes('not wrapped in act'));
}

describe('native form serialization', () => {
  it('renders an empty native field safely before an editor or form exists', () => {
    const { container } = render(
      <EditorFormField
        editor={null}
        mode="markdown"
        name="message_body"
        onFormReset={() => undefined}
      />,
    );

    expect(
      container.querySelector<HTMLInputElement>('[data-inkspan-form-field]')
        ?.value,
    ).toBe('');
  });

  it('commits document transactions to FormData synchronously', () => {
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
        />
      </form>,
    );
    const form = container.querySelector('form')!;

    expect(submittedValue(form, 'message_body')).toBe('<p>Initial</p>');

    editorHtml = '<p>Changed</p>';
    transactionListener!({ transaction: { docChanged: false } });
    expect(submittedValue(form, 'message_body')).toBe('<p>Initial</p>');

    transactionListener!({ transaction: { docChanged: true } });
    expect(submittedValue(form, 'message_body')).toBe('<p>Changed</p>');
  });

  it('omits the hidden field when no form integration is configured', async () => {
    const { container } = render(
      <CwlEditor defaultValue="Draft" hideToolbar />,
    );

    await waitFor(() =>
      expect(container.querySelector('.cwl-editor__content')).toBeTruthy(),
    );
    expect(container.querySelector('[data-inkspan-form-field]')).toBeNull();
  });

  it('submits live markdown and observes imperative replacements without serializing selection-only transactions', async () => {
    const editorRef = createRef<CwlEditorHandle>();
    const { container } = render(
      <form>
        <CwlEditor
          ref={editorRef}
          mode="markdown"
          defaultValue="# Draft"
          hideToolbar
          formFieldName="message_body"
        />
      </form>,
    );
    const form = container.querySelector('form')!;

    await waitFor(() => {
      expect(editorRef.current).toBeTruthy();
      expect(String(submittedValue(form, 'message_body'))).toContain('# Draft');
    });

    act(() => {
      editorRef.current!.getEditor()!.commands.setTextSelection(1);
    });
    expect(String(submittedValue(form, 'message_body'))).toContain('# Draft');

    act(() => {
      editorRef.current!.setValue('# Final');
    });
    expect(String(submittedValue(form, 'message_body'))).toContain('# Final');
  });

  it('supports external form association, disabled submission, and live mode changes', async () => {
    const { container, rerender } = render(
      <>
        <form id="compose_form" />
        <CwlEditor
          mode="html"
          defaultValue="<p>Body</p>"
          hideToolbar
          formFieldName="message_body"
          formId="compose_form"
          formFieldDisabled
        />
      </>,
    );
    const form = container.querySelector('#compose_form') as HTMLFormElement;

    await waitFor(() =>
      expect(
        container.querySelector<HTMLInputElement>('[data-inkspan-form-field]')
          ?.value,
      ).toContain('<p>Body</p>'),
    );
    expect(new FormData(form).has('message_body')).toBe(false);

    rerender(
      <>
        <form id="compose_form" />
        <CwlEditor
          mode="html"
          defaultValue="<p>Body</p>"
          hideToolbar
          formFieldName="message_body"
          formId="compose_form"
        />
      </>,
    );
    await waitFor(() =>
      expect(String(submittedValue(form, 'message_body'))).toContain(
        '<p>Body</p>',
      ),
    );

    rerender(
      <>
        <form id="compose_form" />
        <CwlEditor
          mode="markdown"
          defaultValue="ignored after mount"
          hideToolbar
          formFieldName="message_body"
          formId="compose_form"
        />
      </>,
    );
    await waitFor(() =>
      expect(submittedValue(form, 'message_body')).toBe('Body'),
    );
  });

  it('does not notify when another listener cancels the reset', async () => {
    const editorRef = createRef<CwlEditorHandle>();
    const onFormReset = vi.fn();
    const { container } = render(
      <form onReset={(event) => event.preventDefault()}>
        <CwlEditor
          ref={editorRef}
          defaultValue="Draft"
          hideToolbar
          formFieldName="message_body"
          onFormReset={onFormReset}
        />
      </form>,
    );
    const form = container.querySelector('form')!;

    await waitFor(() => expect(editorRef.current).toBeTruthy());
    act(() => {
      editorRef.current!.setValue('Changed');
    });
    await waitFor(() => expect(editorRef.current!.getValue()).toBe('Changed'));

    expect(await dispatchReset(form)).toBe(false);
    expect(editorRef.current!.getValue()).toBe('Changed');
    expect(onFormReset).not.toHaveBeenCalled();
  });

  it('observes reset-only form ownership and ignores unrelated forms', async () => {
    const editorRef = createRef<CwlEditorHandle>();
    const onFormReset = vi.fn();
    const { container } = render(
      <>
        <form id="reset_target" />
        <form id="unrelated_form" />
        <CwlEditor
          ref={editorRef}
          defaultValue="Draft"
          hideToolbar
          formId="reset_target"
          onFormReset={onFormReset}
        />
      </>,
    );
    const resetTarget = container.querySelector(
      '#reset_target',
    ) as HTMLFormElement;
    const unrelatedForm = container.querySelector(
      '#unrelated_form',
    ) as HTMLFormElement;

    await waitFor(() => expect(editorRef.current).toBeTruthy());
    act(() => {
      editorRef.current!.setValue('Changed');
    });

    expect(await dispatchReset(unrelatedForm)).toBe(true);
    expect(editorRef.current!.getValue()).toBe('Changed');
    expect(onFormReset).not.toHaveBeenCalled();
    expect(Array.from(new FormData(resetTarget).entries())).toHaveLength(0);

    expect(await dispatchReset(resetTarget)).toBe(true);
    expect(editorRef.current!.getValue()).toBe('Changed');
    expect(onFormReset).toHaveBeenCalledTimes(1);
  });

  it('notifies an externally associated host without forcing a reset value', async () => {
    const editorRef = createRef<CwlEditorHandle>();
    const onFormReset = vi.fn();
    const { container } = render(
      <>
        <form id="external_compose_form" />
        <CwlEditor
          ref={editorRef}
          defaultValue="Draft"
          hideToolbar
          formFieldName="message_body"
          formId="external_compose_form"
          onFormReset={onFormReset}
        />
      </>,
    );
    const form = container.querySelector(
      '#external_compose_form',
    ) as HTMLFormElement;

    await waitFor(() => expect(editorRef.current).toBeTruthy());
    act(() => {
      editorRef.current!.setValue('Changed');
    });
    expect(await dispatchReset(form)).toBe(true);

    expect(onFormReset).toHaveBeenCalledTimes(1);
    expect(editorRef.current!.getValue()).toBe('Changed');
    expect(submittedValue(form, 'message_body')).toBe('Changed');
  });

  it('rejects automatic reset values for collaborative editors', () => {
    const collaborationDocument = new Y.Doc();
    const expectedMessage =
      'collaborative editors require host-authorized reset handling through onFormReset; formResetValue is not allowed';
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    try {
      expect(() =>
        render(
          <CollaborativeCwlEditor
            document={collaborationDocument}
            hideToolbar
            {...({ formResetValue: 'Shared reset' } as Record<string, unknown>)}
          />,
        ),
      ).toThrow(expectedMessage);
      expect(consoleError).toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
      collaborationDocument.destroy();
    }
  });

  it('reports collaborative form resets without mutating shared state', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const collaborationDocument = new Y.Doc();
    const editorRef = createRef<CwlEditorHandle>();
    const onFormReset = vi.fn();
    const { container, unmount } = render(
      <form>
        <CollaborativeCwlEditor
          ref={editorRef}
          document={collaborationDocument}
          mode="markdown"
          hideToolbar
          formFieldName="shared_body"
          onFormReset={onFormReset}
        />
      </form>,
    );
    const form = container.querySelector('form')!;

    await waitFor(() => expect(editorRef.current).toBeTruthy());
    act(() => {
      editorRef.current!.insertValue('Shared body');
    });
    await waitFor(() =>
      expect(String(submittedValue(form, 'shared_body'))).toContain(
        'Shared body',
      ),
    );

    expect(await dispatchReset(form)).toBe(true);
    expect(onFormReset).toHaveBeenCalledTimes(1);
    expect(editorRef.current!.getValue()).toContain('Shared body');
    expect(String(submittedValue(form, 'shared_body'))).toContain('Shared body');
    expect(reactActWarnings(consoleError)).toEqual([]);

    unmount();
    collaborationDocument.destroy();
  });
});
