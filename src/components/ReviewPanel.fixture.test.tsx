import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ReviewPanelFixture, type ReviewPanelFixtureState } from './ReviewPanel.fixture.js';

afterEach(cleanup);

describe('ReviewPanel repository-rendered fixture', () => {
  it.each<ReviewPanelFixtureState>([
    'pending-insert',
    'pending-delete',
    'resolved',
    'empty',
  ])('renders the %s state', async (state) => {
    render(<ReviewPanelFixture state={state} />);
    expect(screen.getByRole('region', { name: 'Document review' })).toBeInTheDocument();
    await act(async () => {
      if (state !== 'empty') {
        fireEvent.click(screen.getAllByRole('button')[0]!);
      }
      if (state === 'pending-insert') {
        fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
      }
      if (state === 'pending-delete') {
        fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
      }
      await Promise.resolve();
    });
    if (state === 'empty') {
      expect(screen.getByText('No suggestions.')).toBeInTheDocument();
    }
    if (state === 'pending-insert') {
      expect(screen.getByText(/pending text/)).toBeInTheDocument();
    }
    if (state === 'pending-delete') {
      expect(screen.getByText(/fixture-delete/)).toBeInTheDocument();
    }
    if (state === 'resolved') {
      expect(screen.getByText(/fixture-thread/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Accept' })).toBeDisabled();
    }
  });
});
