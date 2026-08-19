import { describe, expect, it } from 'vitest';
import {
  renderCollaborationCursor,
  renderCollaborationSelection,
} from './awareness.js';

describe('remote collaboration presentation property access', () => {
  it('does not execute an accessor-backed remote cursor name', () => {
    let nameReads = 0;
    const user: Record<string, unknown> = { color: '#000000' };
    Object.defineProperty(user, 'name', {
      enumerable: true,
      get() {
        nameReads += 1;
        throw new Error('private remote name');
      },
    });

    const cursor = renderCollaborationCursor(user);

    expect(nameReads).toBe(0);
    expect(cursor.textContent).toBe('Collaborator');
  });

  it('does not execute an accessor-backed remote selection color', () => {
    let colorReads = 0;
    const user: Record<string, unknown> = {};
    Object.defineProperty(user, 'color', {
      enumerable: true,
      get() {
        colorReads += 1;
        throw new Error('private remote color');
      },
    });

    expect(renderCollaborationSelection(user)).toEqual({
      class: 'collaboration-cursor__selection',
      style: 'background-color: #47556933',
    });
    expect(colorReads).toBe(0);
  });
});
