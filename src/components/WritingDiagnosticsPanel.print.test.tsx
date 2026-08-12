import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WritingDiagnosticsController } from './useWritingDiagnosticsController.js';
import { WritingDiagnosticsPanel } from './WritingDiagnosticsPanel.js';

const emptyController: WritingDiagnosticsController = {
  status: 'absent',
  generation: 0,
  editor: null,
  diagnostics: [],
  digestProvider: null,
  focusDiagnostic: vi.fn(() => false),
  applyDiagnostic: vi.fn(async () => null),
  ignoreDiagnostic: vi.fn(() => null),
  dismissDiagnostic: vi.fn(() => null),
  requestDiagnosticExplanation: vi.fn(() => null),
};

afterEach(cleanup);

describe('WritingDiagnosticsPanel print contract', () => {
  it('keeps the appendix disabled unless the host opts in explicitly', () => {
    const { rerender } = render(
      <WritingDiagnosticsPanel
        controller={emptyController}
        label="Writing guidance"
      />,
    );

    expect(
      screen.getByRole('region', { name: 'Writing guidance' }),
    ).not.toHaveAttribute('data-print-enabled');

    rerender(
      <WritingDiagnosticsPanel
        controller={emptyController}
        label="Writing guidance"
        printEnabled
      />,
    );

    expect(
      screen.getByRole('region', { name: 'Writing guidance' }),
    ).toHaveAttribute('data-print-enabled', 'true');
  });
});
