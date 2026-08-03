/** Provider-neutral real-time collaboration entrypoint for Inkspan. */
export {
  CollaborativeCwlEditor,
  default as CollaborativeEditor,
} from './CollaborativeCwlEditor.js';
export {
  assertCollaborationConfiguration,
  collaborationConnectionLabel,
  contrastingTextColor,
  countRemoteCollaborators,
  renderCollaborationCursor,
  renderCollaborationSelection,
  serializeCollaborationUser,
} from './awareness.js';
export type { CollaborationCursorUser } from './awareness.js';
export type {
  CollaborationAwareness,
  CollaborationAwarenessEvent,
  CollaborationConnectionStatus,
  CollaborationProviderLike,
  CollaborationUser,
  CollaborativeCwlEditorProps,
} from './types.js';
