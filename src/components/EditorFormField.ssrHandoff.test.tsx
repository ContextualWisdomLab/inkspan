import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
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
