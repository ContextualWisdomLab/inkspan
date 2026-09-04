import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { CollaborativeCwlEditor } from './CollaborativeCwlEditor.js';
import type { CollaborativeCwlEditorProps } from './types.js';

const COLLABORATION_FIELD_MAX_CODE_UNITS = 1_024;
const INVALID_COLLABORATION_FIELD_MESSAGE =
  'Collaboration field must be a string within the supported length.';

afterEach(cleanup);

function captureRenderFailure(field: unknown): unknown {
  const consoleError = vi
    .spyOn(console, 'error')
    .mockImplementation(() => undefined);
  let failure: unknown;
  try {
    render(
      <CollaborativeCwlEditor
        document={new Y.Doc()}
        field={field as CollaborativeCwlEditorProps['field']}
      />,
    );
  } catch (error) {
    failure = error;
  } finally {
    consoleError.mockRestore();
  }
  return failure;
}

describe('CollaborativeCwlEditor field resource boundary', () => {
  it('rejects non-string runtime field metadata through a stable redacted error', () => {
    expect(captureRenderFailure(42)).toEqual(
      new RangeError(INVALID_COLLABORATION_FIELD_MESSAGE),
    );
  });

  it('rejects oversized field metadata before normalization without reflecting it', () => {
    const privateMarker = 'private-room-marker';
    const field = `${privateMarker}${'x'.repeat(COLLABORATION_FIELD_MAX_CODE_UNITS)}`;
    const failure = captureRenderFailure(field);

    expect(failure).toEqual(new RangeError(INVALID_COLLABORATION_FIELD_MESSAGE));
    expect(String(failure)).not.toContain(privateMarker);
  });

  it('accepts an in-bound custom field at the local ceiling', () => {
    const field = 'x'.repeat(COLLABORATION_FIELD_MAX_CODE_UNITS);

    render(<CollaborativeCwlEditor document={new Y.Doc()} field={field} />);

    expect(screen.getByRole('status')).toHaveTextContent(
      'Collaboration ready · 0 remote collaborators',
    );
  });
});
