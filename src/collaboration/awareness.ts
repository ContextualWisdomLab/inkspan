import type {
  CollaborationAwareness,
  CollaborationAwarenessEvent,
  CollaborationConnectionStatus,
  CollaborationProviderLike,
  CollaborationUser,
} from './types.js';

/** Sanitized cursor payload expected by TipTap's Yjs cursor integration. */
export interface CollaborationCursorUser {
  id: string;
  name: string;
  color: string;
}

/** Scoped provider adapter whose listeners can be detached on editor unmount. */
export interface ScopedCollaborationProvider extends CollaborationProviderLike {
  dispose(): void;
}

const CURSOR_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const NUMERIC_IDENTIFIER_PATTERN = /^\d+$/;
const FALLBACK_CURSOR_COLOR = '#475569';
const MAX_CURSOR_LABEL_LENGTH = 80;

/** Validate and serialize the only public fields permitted in awareness. */
export function serializeCollaborationUser(
  user: CollaborationUser,
): CollaborationCursorUser {
  const id = user.userId.trim();
  const name = user.displayName.trim();
  const color = user.cursorColor.trim();

  if (id === '') {
    throw new Error('collaboration userId must not be empty');
  }
  if (NUMERIC_IDENTIFIER_PATTERN.test(id)) {
    throw new Error('collaboration userId must be descriptive and nonnumeric');
  }
  if (name === '') {
    throw new Error('collaboration displayName must not be empty');
  }
  if (!CURSOR_COLOR_PATTERN.test(color)) {
    throw new Error(
      'collaboration cursorColor must be a six-digit hexadecimal color',
    );
  }

  return { id, name, color: color.toLowerCase() };
}

/** Validate the structural provider boundary before installing cursor plugins. */
export function assertCollaborationConfiguration(
  provider: CollaborationProviderLike | undefined,
  user: CollaborationUser | undefined,
): void {
  if (user && !provider) {
    throw new Error('collaboration user requires an awareness provider');
  }
  if (!provider) return;

  const awareness = provider.awareness as Partial<CollaborationAwareness> | undefined;
  if (
    !awareness ||
    typeof awareness.clientID !== 'number' ||
    !(awareness.states instanceof Map) ||
    typeof awareness.getLocalState !== 'function' ||
    typeof awareness.getStates !== 'function' ||
    typeof awareness.setLocalStateField !== 'function' ||
    typeof awareness.on !== 'function' ||
    typeof awareness.off !== 'function'
  ) {
    throw new Error(
      'collaboration provider must expose a compatible Yjs awareness instance',
    );
  }
}

/**
 * Isolate TipTap cursor listeners from the host awareness object so upstream
 * extension listeners can be released even when they do not unregister.
 */
export function createScopedCollaborationProvider(
  provider: CollaborationProviderLike,
): ScopedCollaborationProvider {
  const source = provider.awareness;
  const listeners: Record<
    CollaborationAwarenessEvent,
    Set<(...args: unknown[]) => void>
  > = {
    change: new Set(),
    update: new Set(),
  };
  const relay = {
    change: (...args: unknown[]) => {
      for (const listener of listeners.change) listener(...args);
    },
    update: (...args: unknown[]) => {
      for (const listener of listeners.update) listener(...args);
    },
  };

  source.on('change', relay.change);
  source.on('update', relay.update);

  const awareness: CollaborationAwareness = {
    get clientID() {
      return source.clientID;
    },
    get states() {
      return source.states;
    },
    getLocalState: () => source.getLocalState(),
    getStates: () => source.getStates(),
    setLocalStateField: (field, value) =>
      source.setLocalStateField(field, value),
    on: (event, listener) => listeners[event].add(listener),
    off: (event, listener) => listeners[event].delete(listener),
  };

  let disposed = false;
  return {
    awareness,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      source.off('change', relay.change);
      source.off('update', relay.update);
      listeners.change.clear();
      listeners.update.clear();
    },
  };
}

/** Count remote awareness clients carrying a valid public user identifier. */
export function countRemoteCollaborators(
  awareness: CollaborationAwareness | undefined,
): number {
  if (!awareness) return 0;
  let count = 0;
  for (const [clientId, state] of awareness.getStates()) {
    if (clientId === awareness.clientID) continue;
    const user = state.user;
    if (
      typeof user === 'object' &&
      user !== null &&
      typeof (user as Record<string, unknown>).id === 'string' &&
      (user as Record<string, unknown>).id !== ''
    ) {
      count += 1;
    }
  }
  return count;
}

/** Convert a host connection state into concise status-region text. */
export function collaborationConnectionLabel(
  status: CollaborationConnectionStatus | undefined,
): string {
  switch (status) {
    case 'connecting':
      return 'Connecting';
    case 'connected':
      return 'Connected';
    case 'disconnected':
      return 'Disconnected';
    case 'offline':
      return 'Offline';
    default:
      return 'Collaboration ready';
  }
}

/**
 * Render a remote caret using text-only DOM and a computed high-contrast label.
 * Untrusted remote awareness values are length-bounded and color-sanitized.
 */
export function renderCollaborationCursor(
  user: Record<string, unknown>,
): HTMLElement {
  const color =
    typeof user.color === 'string' && CURSOR_COLOR_PATTERN.test(user.color)
      ? user.color.toLowerCase()
      : FALLBACK_CURSOR_COLOR;
  const name =
    typeof user.name === 'string' && user.name.trim() !== ''
      ? user.name.trim().slice(0, MAX_CURSOR_LABEL_LENGTH)
      : 'Collaborator';

  const caret = document.createElement('span');
  caret.classList.add('collaboration-cursor__caret');
  caret.style.borderColor = color;

  const label = document.createElement('span');
  label.classList.add('collaboration-cursor__label');
  label.style.backgroundColor = color;
  label.style.color = contrastingTextColor(color);
  label.textContent = name;
  caret.append(label);
  return caret;
}

/** Select black or white text using the WCAG relative-luminance threshold. */
export function contrastingTextColor(hexColor: string): '#000000' | '#ffffff' {
  const red = Number.parseInt(hexColor.slice(1, 3), 16) / 255;
  const green = Number.parseInt(hexColor.slice(3, 5), 16) / 255;
  const blue = Number.parseInt(hexColor.slice(5, 7), 16) / 255;
  const convert = (channel: number) =>
    channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  const luminance =
    0.2126 * convert(red) + 0.7152 * convert(green) + 0.0722 * convert(blue);
  return luminance > 0.179 ? '#000000' : '#ffffff';
}
