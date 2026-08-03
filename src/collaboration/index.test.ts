import { describe, expect, it } from 'vitest';
import * as collaboration from './index.js';

describe('collaboration entrypoint', () => {
  it('exports the collaborative editor and public safety helpers', () => {
    expect(collaboration.CollaborativeEditor).toBe(
      collaboration.CollaborativeCwlEditor,
    );
    expect(collaboration.serializeCollaborationUser).toBeTypeOf('function');
    expect(collaboration.assertCollaborationConfiguration).toBeTypeOf(
      'function',
    );
    expect(collaboration.countRemoteCollaborators).toBeTypeOf('function');
    expect(collaboration.collaborationConnectionLabel).toBeTypeOf('function');
    expect(collaboration.renderCollaborationCursor).toBeTypeOf('function');
    expect(collaboration.renderCollaborationSelection).toBeTypeOf('function');
    expect(collaboration.contrastingTextColor).toBeTypeOf('function');
  });
});
