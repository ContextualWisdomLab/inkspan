import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EditorFormField } from './EditorFormField.js';

describe('native form reset lifecycle', () => {
  it('cancels queued reset work when the observer unmounts', async () => {
    const onFormReset = vi.fn();
    const { container, unmount } = render(
      <form>
        <EditorFormField
          editor={null}
          mode="markdown"
          onFormReset={onFormReset}
        />
      </form>,
    );
    const form = container.querySelector('form')!;

    await act(async () => {
      form.reset();
      unmount();
      await Promise.resolve();
    });

    expect(onFormReset).not.toHaveBeenCalled();
  });
});
