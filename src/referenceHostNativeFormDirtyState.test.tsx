import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NativeFormHost } from '../examples/reference-host/native-form-host.js';

type MockEditorProps = {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  editable?: boolean;
  formFieldName?: string;
  formFieldDisabled?: boolean;
};

vi.mock('@contextualwisdomlab/cwl-editor', async () => {
  const React = await import('react');

  function MockEditor({
    value,
    defaultValue,
    onChange,
    editable = true,
    formFieldName,
    formFieldDisabled = false,
  }: MockEditorProps) {
    const [uncontrolledValue, setUncontrolledValue] = React.useState(
      defaultValue ?? '',
    );
    const currentValue = value ?? uncontrolledValue;

    return (
      <>
        <textarea
          aria-label="Document editor"
          disabled={!editable}
          value={currentValue}
          onChange={(event) => {
            const nextValue = event.currentTarget.value;
            if (value === undefined) {
              setUncontrolledValue(nextValue);
            }
            onChange?.(nextValue);
          }}
        />
        <input
          type="hidden"
          name={formFieldName}
          value={currentValue}
          disabled={formFieldDisabled}
          readOnly
        />
      </>
    );
  }

  return { CwlEditor: MockEditor };
});

afterEach(cleanup);

describe('reference-host native form dirty-state presentation', () => {
  it('stops claiming the document is saved after a later controlled edit', async () => {
    const onAuthorizedSubmit = vi.fn(async () => undefined);

    render(
      <NativeFormHost
        controlMode="controlled"
        onAuthorizedSubmit={onAuthorizedSubmit}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save document' }));

    await waitFor(() => {
      expect(screen.getByText('Saved')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Document editor'), {
      target: { value: '# Edited after save' },
    });

    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
    expect(screen.getByText('Not saved yet')).toBeInTheDocument();
  });

  it('does not report saved when the document changes while persistence is in flight', async () => {
    let resolveSave: (() => void) | undefined;
    const onAuthorizedSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );

    render(
      <NativeFormHost
        controlMode="controlled"
        onAuthorizedSubmit={onAuthorizedSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText('Document editor'), {
      target: { value: '# Submitted version' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save document' }));

    expect(screen.getByText('Saving…')).toBeInTheDocument();
    expect(onAuthorizedSubmit).toHaveBeenCalledWith('# Submitted version');

    fireEvent.change(screen.getByLabelText('Document editor'), {
      target: { value: '# Newer unsaved version' },
    });
    resolveSave?.();

    await waitFor(() => {
      expect(screen.getByText('Not saved yet')).toBeInTheDocument();
    });
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });
});
