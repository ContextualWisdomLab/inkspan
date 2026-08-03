import type { Doc } from 'yjs';
import type { CwlEditorProps } from '../types.js';

/** Public, non-sensitive identity propagated through collaboration awareness. */
export interface CollaborationUser {
  /** Descriptive nonnumeric public identifier, stable for the collaboration session. */
  userId: string;
  /** Human-readable name shown beside the remote caret. */
  displayName: string;
  /** Six-digit hexadecimal caret color, for example `#2563eb`. */
  cursorColor: string;
}

/** Awareness event names consumed by TipTap and Inkspan. */
export type CollaborationAwarenessEvent = 'change' | 'update';

/**
 * Minimal Yjs awareness surface required by TipTap collaboration cursors and
 * Inkspan's accessible collaborator count.
 */
export interface CollaborationAwareness {
  readonly clientID: number;
  readonly states: Map<number, Record<string, unknown>>;
  getLocalState(): Record<string, unknown> | null;
  getStates(): Map<number, Record<string, unknown>>;
  setLocalStateField(field: string, value: unknown): void;
  on(
    event: CollaborationAwarenessEvent,
    listener: (...args: unknown[]) => void,
  ): void;
  off(
    event: CollaborationAwarenessEvent,
    listener: (...args: unknown[]) => void,
  ): void;
}

/** Provider-neutral collaboration transport boundary owned by the host. */
export interface CollaborationProviderLike {
  awareness: CollaborationAwareness;
}

/** Host-reported connection state rendered through an accessible status region. */
export type CollaborationConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'offline';

/**
 * Props for the provider-neutral collaborative editor. The Yjs document is the
 * sole source of truth, so static `value` and `defaultValue` props are excluded.
 */
export interface CollaborativeCwlEditorProps
  extends Omit<CwlEditorProps, 'value' | 'defaultValue'> {
  /** Stable, host-owned Yjs document for one authorized collaborative document. */
  document: Doc;
  /** Optional host-owned provider exposing a Yjs awareness instance. */
  provider?: CollaborationProviderLike;
  /** Allowlisted public presence identity; requires `provider`. */
  user?: CollaborationUser;
  /** Yjs XML fragment name. Defaults to `default`. */
  field?: string;
  /** Optional transport state supplied by the host. */
  connectionStatus?: CollaborationConnectionStatus;
}
