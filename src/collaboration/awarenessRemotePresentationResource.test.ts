import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderCollaborationCursor } from './awareness.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('remote collaboration presentation resource preflight', () => {
  it('rejects an oversized remote cursor name before trimming it', () => {
    const originalTrim = String.prototype.trim;
    vi.spyOn(String.prototype, 'trim').mockImplementation(function (this: string) {
      if (this.length > 1_024) {
        throw new Error('oversized remote name reached trim');
      }
      return originalTrim.call(this);
    });

    const cursor = renderCollaborationCursor({
      name: 'x'.repeat(1_025),
      color: '#000000',
    });

    expect(cursor.textContent).toBe('Collaborator');
  });
});
