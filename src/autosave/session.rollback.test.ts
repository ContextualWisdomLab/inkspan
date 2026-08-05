import { afterEach, describe, expect, it, vi } from 'vitest';

const blockedSnapshot = Object.freeze({
  state: 'blocked' as const,
  blockedReason: 'conflict' as const,
  activeStrongEntityTag: null,
  pendingStrongEntityTag: null,
  lastSavedStrongEntityTag: null,
});

afterEach(() => {
  vi.doUnmock('./index.js');
  vi.resetModules();
});

describe('durable autosave recovery transition fault handling', () => {
  it('restores the previous validator when the private queue declines a blocked transition', async () => {
    vi.resetModules();
    const resumeQueue = vi.fn(() => false);
    vi.doMock('./index.js', async () => {
      const actual = await vi.importActual<typeof import('./index.js')>(
        './index.js',
      );
      return {
        ...actual,
        createDocumentAutosaveQueue: () =>
          Object.freeze({
            enqueue: vi.fn(),
            resume: resumeQueue,
            flush: vi.fn(async () => blockedSnapshot),
            close: vi.fn(async () => blockedSnapshot),
            getSnapshot: vi.fn(() => blockedSnapshot),
          }),
      };
    });

    const { createDocumentAutosaveSession } = await import('./session.js');
    const session = createDocumentAutosaveSession({
      initialStrongEntityTag: '"server-one"',
      save: () => ({ status: 'conflict' }),
    });

    expect(session.resume('"server-two"')).toBe(false);
    expect(resumeQueue).toHaveBeenCalledOnce();
    expect(session.getSnapshot()).toMatchObject({
      state: 'blocked',
      durableStrongEntityTag: '"server-one"',
    });
  });
});
