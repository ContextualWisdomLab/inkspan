import type { DecorationAttrs } from '@tiptap/pm/view';
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
const MAX_PUBLIC_IDENTIFIER_LENGTH = 80;
const MAX_REMOTE_FIELD_SOURCE_LENGTH = 1_024;
const MAX_LOCAL_FIELD_SOURCE_LENGTH = 1_024;
type CollaborationUserField = 'userId' | 'displayName' | 'cursorColor';

/** Reject malformed or oversized local identity fields before normalization. */
function assertCollaborationUserStringField(
  field: CollaborationUserField,
  value: unknown,
): asserts value is string {
  if (typeof value !== 'string') {
    throw new Error(`collaboration ${field} must be a string`);
  }
  if (value.length > MAX_LOCAL_FIELD_SOURCE_LENGTH) {
    throw new Error(
      `collaboration ${field} must be at most ${MAX_LOCAL_FIELD_SOURCE_LENGTH} UTF-16 code units before normalization`,
    );
  }
}

/** Read one host-owned local identity field without leaking getter failures. */
function readCollaborationUserStringField(
  user: CollaborationUser,
  field: CollaborationUserField,
): string {
  let value: unknown;
  try {
    value = user[field];
  } catch {
    throw new Error(`collaboration ${field} must be a string`);
  }
  assertCollaborationUserStringField(field, value);
  return value;
}

/** Trim and bound a public cursor label without splitting Unicode code points. */
function truncateCursorLabel(value: string): string {
  const trimmed = value.trim();
  let bounded = '';
  let count = 0;
  for (const codePoint of trimmed) {
    if (count >= MAX_CURSOR_LABEL_LENGTH) break;
    bounded += codePoint;
    count += 1;
  }
  return bounded;
}

/** Return whether public awareness metadata exceeds its Unicode code-point bound. */
function exceedsPublicIdentifierLength(value: string): boolean {
  let count = 0;
  for (const _codePoint of value) {
    count += 1;
    if (count > MAX_PUBLIC_IDENTIFIER_LENGTH) return true;
  }
  return false;
}

/** Read and validate the host-owned awareness capability without leaking failures. */
function readCompatibleCollaborationAwareness(
  provider: CollaborationProviderLike,
): CollaborationAwareness {
  try {
    const awareness = provider.awareness as
      | Partial<CollaborationAwareness>
      | undefined;
    if (
      awareness !== undefined &&
      typeof awareness.clientID === 'number' &&
      awareness.states instanceof Map &&
      typeof awareness.getLocalState === 'function' &&
      typeof awareness.getStates === 'function' &&
      typeof awareness.setLocalStateField === 'function' &&
      typeof awareness.on === 'function' &&
      typeof awareness.off === 'function'
    ) {
      return awareness as CollaborationAwareness;
    }
  } catch {
    // Normalize host capability access failures at the public Inkspan boundary.
  }

  throw new Error(
    'collaboration provider must expose a compatible Yjs awareness instance',
  );
}

/** Validate and serialize the only public fields permitted in awareness. */
export function serializeCollaborationUser(
  user: CollaborationUser,
): CollaborationCursorUser {
  const sourceId = readCollaborationUserStringField(user, 'userId');
  const sourceName = readCollaborationUserStringField(user, 'displayName');
  const sourceColor = readCollaborationUserStringField(user, 'cursorColor');
  const id = sourceId.trim();
  const name = truncateCursorLabel(sourceName);
  const color = sourceColor.trim();

  if (id === '') {
    throw new Error('collaboration userId must not be empty');
  }
  if (NUMERIC_IDENTIFIER_PATTERN.test(id)) {
    throw new Error('collaboration userId must be descriptive and nonnumeric');
  }
  if (exceedsPublicIdentifierLength(id)) {
    throw new Error(
      'collaboration userId must be at most 80 Unicode code points',
    );
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

  readCompatibleCollaborationAwareness(provider);
}

/**
 * Isolate TipTap cursor listeners from the host awareness object so upstream
 * extension listeners can always be released at editor unmount.
 */
export function createScopedCollaborationProvider(
  provider: CollaborationProviderLike,
): ScopedCollaborationProvider {
  const source = readCompatibleCollaborationAwareness(provider);
  const listenerWrappers: Record<
    CollaborationAwarenessEvent,
    Map<(...args: unknown[]) => void, (...args: unknown[]) => void>
  > = {
    change: new Map(),
    update: new Map(),
  };

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
    on: (event, listener) => {
      if (listenerWrappers[event].has(listener)) return;
      const wrapper = (...args: unknown[]) => listener(...args);
      listenerWrappers[event].set(listener, wrapper);
      source.on(event, wrapper);
    },
    off: (event, listener) => {
      const wrapper = listenerWrappers[event].get(listener);
      if (!wrapper) return;
      source.off(event, wrapper);
      listenerWrappers[event].delete(listener);
    },
  };

  let disposed = false;
  return {
    awareness,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      for (const event of ['change', 'update'] as const) {
        for (const wrapper of listenerWrappers[event].values()) {
          try {
            source.off(event, wrapper);
          } catch {
            // Host-owned listener teardown must not abort remaining cleanup or
            // leak a private provider failure through React effect disposal.
          }
        }
        listenerWrappers[event].clear();
      }
    },
  };
}

/** Read one own enumerable data field without invoking caller-defined accessors. */
function ownEnumerableDataValue(
  value: unknown,
  property: string,
): unknown {
  if (typeof value !== 'object' || value === null) return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, property);
    if (!descriptor) return undefined;
    if (!descriptor.enumerable) return undefined;
    if (!('value' in descriptor)) return undefined;
    return descriptor.value;
  } catch {
    return undefined;
  }
}

/** Count valid remote collaborators without leaking host awareness failures. */
export function countRemoteCollaborators(
  awareness: CollaborationAwareness | undefined,
): number {
  if (!awareness) return 0;
  try {
    const localClientId = awareness.clientID;
    let count = 0;
    for (const [clientId, state] of awareness.getStates()) {
      if (clientId === localClientId) continue;
      const user = ownEnumerableDataValue(state, 'user');
      if (typeof user !== 'object' || user === null) continue;
      const id = ownEnumerableDataValue(user, 'id');
      if (typeof id !== 'string') continue;
      if (id.length > MAX_REMOTE_FIELD_SOURCE_LENGTH) continue;
      const normalizedId = id.trim();
      if (
        normalizedId === '' ||
        NUMERIC_IDENTIFIER_PATTERN.test(normalizedId) ||
        exceedsPublicIdentifierLength(normalizedId)
      ) {
        continue;
      }
      count += 1;
    }
    return count;
  } catch {
    return 0;
  }
}

/** Convert a host connection state into concise status-region text. */
export function collaborationConnectionLabel(
  status: CollaborationConnectionStatus | undefined,
): string {
  switch (status) {
    case undefined:
      return 'Collaboration ready';
    case 'connecting':
      return 'Connecting';
    case 'connected':
      return 'Connected';
    case 'disconnected':
      return 'Disconnected';
    case 'offline':
      return 'Offline';
    default:
      throw new RangeError(
        'Collaboration connection status must be connecting, connected, disconnected, or offline.',
      );
  }
}

/**
 * Render a remote caret using text-only DOM and a computed high-contrast label.
 * Untrusted remote awareness values are length-bounded and color-sanitized.
 */
export function renderCollaborationCursor(
  user: Record<string, unknown>,
): HTMLElement {
  const color = collaborationCursorColor(user);
  const remoteName = ownEnumerableDataValue(user, 'name');
  const name =
    typeof remoteName === 'string' &&
    remoteName.length <= MAX_REMOTE_FIELD_SOURCE_LENGTH &&
    remoteName.trim() !== ''
      ? truncateCursorLabel(remoteName)
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

/** Return safe attributes for a remote collaborative selection highlight. */
export function renderCollaborationSelection(
  user: Record<string, unknown>,
): DecorationAttrs {
  const color = collaborationCursorColor(user);
  return {
    class: 'collaboration-cursor__selection',
    style: `background-color: ${color}33`,
  };
}

/** Select black or white text using the WCAG relative-luminance threshold. */
export function contrastingTextColor(hexColor: string): '#000000' | '#ffffff' {
  if (
    typeof hexColor !== 'string' ||
    !CURSOR_COLOR_PATTERN.test(hexColor)
  ) {
    throw new RangeError(
      'collaboration contrast color must be a six-digit hexadecimal color',
    );
  }

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

/** Normalize untrusted remote awareness colors to a strict CSS-safe token. */
function collaborationCursorColor(user: Record<string, unknown>): string {
  const remoteColor = ownEnumerableDataValue(user, 'color');
  return typeof remoteColor === 'string' &&
    CURSOR_COLOR_PATTERN.test(remoteColor)
    ? remoteColor.toLowerCase()
    : FALLBACK_CURSOR_COLOR;
}
