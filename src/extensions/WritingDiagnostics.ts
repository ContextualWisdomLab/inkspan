/**
 * Revision-scoped writing-diagnostic decorations for TipTap/ProseMirror.
 *
 * This module accepts only already-validated, already-resolved structural ranges.
 * It does not call models, providers, networks, databases, host callbacks, or
 * revision hashers, and it never infers language semantics from category text.
 */
import { Extension } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import {
  Plugin,
  PluginKey,
  type EditorState,
  type Transaction,
} from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { CwlWritingDiagnosticPriority } from '../writingDiagnostics.js';

const MAX_DECORATIONS = 256;
const MAX_DIAGNOSTIC_ID_CODE_UNITS = 256;
const RESOLVED_DIAGNOSTIC_FIELDS = Object.freeze([
  'diagnosticId',
  'from',
  'to',
  'priority',
  'ariaInvalid',
] as const);
const REQUIRED_RESOLVED_DIAGNOSTIC_FIELDS = Object.freeze([
  'diagnosticId',
  'from',
  'to',
  'priority',
] as const);
const PRIORITIES = new Set<CwlWritingDiagnosticPriority>([
  'advisory',
  'important',
  'critical',
]);

/** Explicit host-approved ARIA invalidity mapping for mechanics guidance. */
export type CwlWritingDiagnosticAriaInvalid = 'spelling';

/**
 * Privacy-minimized structural range that may be rendered as one decoration.
 *
 * Semantic prose, source text, replacement text, model output, and confidence
 * are deliberately absent. `ariaInvalid` is explicit host policy output; the
 * extension never derives it from `diagnosticId` or any category-like string.
 */
export interface CwlResolvedWritingDiagnosticDecoration {
  /** Opaque identifier already validated by the host contract. */
  readonly diagnosticId: string;
  /** Inclusive ProseMirror position in the exact current document. */
  readonly from: number;
  /** Exclusive ProseMirror position in the exact current document. */
  readonly to: number;
  /** Host-selected visual priority. */
  readonly priority: CwlWritingDiagnosticPriority;
  /** Optional explicit host mapping for mechanics-related accessibility state. */
  readonly ariaInvalid?: CwlWritingDiagnosticAriaInvalid;
}

/** Immutable state owned by the writing-diagnostic ProseMirror plugin. */
export interface WritingDiagnosticsPluginState {
  /** Highest accepted monotonically increasing installation generation. */
  readonly generation: number;
  /** Detached structural diagnostics for the active exact document. */
  readonly diagnostics: readonly CwlResolvedWritingDiagnosticDecoration[];
  /** Opaque focused identifier, or null when no diagnostic is focused. */
  readonly focusedDiagnosticId: string | null;
  /** Inline decorations derived only from non-empty structural ranges. */
  readonly decorations: DecorationSet;
}

interface InstallMeta {
  readonly type: 'install';
  readonly generation: number;
  readonly diagnostics: readonly CwlResolvedWritingDiagnosticDecoration[];
}

interface FocusMeta {
  readonly type: 'focus';
  readonly generation: number;
  readonly diagnosticId: string;
}

interface ClearMeta {
  readonly type: 'clear';
}

type WritingDiagnosticsMeta = InstallMeta | FocusMeta | ClearMeta;

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    writingDiagnostics: {
      /** Install one exact resolved diagnostic generation. */
      installWritingDiagnostics: (
        generation: number,
        diagnostics: readonly CwlResolvedWritingDiagnosticDecoration[],
      ) => ReturnType;
      /** Focus one diagnostic in the active generation without changing the document. */
      focusWritingDiagnostic: (
        generation: number,
        diagnosticId: string,
      ) => ReturnType;
      /** Clear active diagnostics while retaining the monotonic generation fence. */
      clearWritingDiagnostics: () => ReturnType;
    };
  }
}

/** Stable plugin key used by commands, controllers, and deterministic tests. */
export const writingDiagnosticsPluginKey =
  new PluginKey<WritingDiagnosticsPluginState>('cwlWritingDiagnostics');

/** Attach a typed install operation to one ProseMirror transaction. */
export function installWritingDiagnostics(
  transaction: Transaction,
  generation: number,
  diagnostics: readonly CwlResolvedWritingDiagnosticDecoration[],
): Transaction {
  return transaction.setMeta(writingDiagnosticsPluginKey, {
    type: 'install',
    generation,
    diagnostics,
  } satisfies InstallMeta);
}

/** Attach a typed focus operation to one ProseMirror transaction. */
export function focusWritingDiagnostic(
  transaction: Transaction,
  generation: number,
  diagnosticId: string,
): Transaction {
  return transaction.setMeta(writingDiagnosticsPluginKey, {
    type: 'focus',
    generation,
    diagnosticId,
  } satisfies FocusMeta);
}

/** Attach a typed clear operation to one ProseMirror transaction. */
export function clearWritingDiagnostics(transaction: Transaction): Transaction {
  return transaction.setMeta(writingDiagnosticsPluginKey, {
    type: 'clear',
  } satisfies ClearMeta);
}

/** Create the standalone ProseMirror plugin used by every Inkspan surface. */
export function createWritingDiagnosticsPlugin(): Plugin<WritingDiagnosticsPluginState> {
  return new Plugin<WritingDiagnosticsPluginState>({
    key: writingDiagnosticsPluginKey,
    state: {
      init: () => emptyPluginState(-1),
      apply(transaction, previous) {
        if (transaction.docChanged) {
          return hasActiveDiagnostics(previous)
            ? emptyPluginState(previous.generation)
            : previous;
        }

        const meta = transaction.getMeta(
          writingDiagnosticsPluginKey,
        ) as WritingDiagnosticsMeta | undefined;
        if (meta === undefined) {
          return previous;
        }
        if (meta.type === 'clear') {
          return hasActiveDiagnostics(previous)
            ? emptyPluginState(previous.generation)
            : previous;
        }
        if (meta.type === 'focus') {
          return applyFocusMeta(previous, meta);
        }
        return applyInstallMeta(transaction.doc, previous, meta);
      },
    },
    props: {
      decorations(editorState: EditorState) {
        return writingDiagnosticsPluginKey.getState(editorState)?.decorations ?? null;
      },
    },
  });
}

/** Shared TipTap extension installed exactly once in standalone and CRDT editors. */
export const WritingDiagnostics = Extension.create({
  name: 'writingDiagnostics',

  addCommands() {
    return {
      installWritingDiagnostics:
        (generation, diagnostics) =>
        ({ transaction, dispatch }) => {
          if (
            !Number.isSafeInteger(generation) ||
            generation < 0 ||
            normalizeResolvedDiagnostics(transaction.doc, diagnostics) === null
          ) {
            return false;
          }
          if (dispatch) {
            dispatch(
              installWritingDiagnostics(transaction, generation, diagnostics),
            );
          }
          return true;
        },
      focusWritingDiagnostic:
        (generation, diagnosticId) =>
        ({ transaction, dispatch }) => {
          if (
            !Number.isSafeInteger(generation) ||
            generation < 0 ||
            typeof diagnosticId !== 'string' ||
            diagnosticId.length === 0 ||
            diagnosticId.length > MAX_DIAGNOSTIC_ID_CODE_UNITS
          ) {
            return false;
          }
          if (dispatch) {
            dispatch(
              focusWritingDiagnostic(transaction, generation, diagnosticId),
            );
          }
          return true;
        },
      clearWritingDiagnostics:
        () =>
        ({ transaction, dispatch }) => {
          if (dispatch) {
            dispatch(clearWritingDiagnostics(transaction));
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [createWritingDiagnosticsPlugin()];
  },
});

/** Return an immutable empty state while retaining the latest generation fence. */
function emptyPluginState(generation: number): WritingDiagnosticsPluginState {
  return Object.freeze({
    generation,
    diagnostics: Object.freeze([]),
    focusedDiagnosticId: null,
    decorations: DecorationSet.empty,
  });
}

/** Determine whether clearing would materially change plugin state. */
function hasActiveDiagnostics(state: WritingDiagnosticsPluginState): boolean {
  return state.diagnostics.length > 0 || state.focusedDiagnosticId !== null;
}

/** Apply one monotonic, structurally valid install operation. */
function applyInstallMeta(
  documentNode: ProseMirrorNode,
  previous: WritingDiagnosticsPluginState,
  meta: InstallMeta,
): WritingDiagnosticsPluginState {
  if (
    !Number.isSafeInteger(meta.generation) ||
    meta.generation < 0 ||
    meta.generation <= previous.generation
  ) {
    return previous;
  }
  const diagnostics = normalizeResolvedDiagnostics(
    documentNode,
    meta.diagnostics,
  );
  if (diagnostics === null) {
    return previous;
  }

  const decorations = diagnostics.flatMap((diagnostic) => {
    if (diagnostic.from === diagnostic.to) {
      return [];
    }
    const attributes: Record<string, string> = {
      class: `cwl-writing-diagnostic cwl-writing-diagnostic--${diagnostic.priority}`,
      'data-cwl-diagnostic-id': diagnostic.diagnosticId,
    };
    if (diagnostic.ariaInvalid === 'spelling') {
      attributes['aria-invalid'] = 'spelling';
    }
    return [
      Decoration.inline(diagnostic.from, diagnostic.to, attributes, {
        inclusiveStart: false,
        inclusiveEnd: false,
      }),
    ];
  });

  return Object.freeze({
    generation: meta.generation,
    diagnostics,
    focusedDiagnosticId: null,
    decorations: DecorationSet.create(documentNode, decorations),
  });
}

/** Apply a focus request only to the exact active generation and identifier. */
function applyFocusMeta(
  previous: WritingDiagnosticsPluginState,
  meta: FocusMeta,
): WritingDiagnosticsPluginState {
  if (
    meta.generation !== previous.generation ||
    !previous.diagnostics.some(
      (diagnostic) => diagnostic.diagnosticId === meta.diagnosticId,
    ) ||
    previous.focusedDiagnosticId === meta.diagnosticId
  ) {
    return previous;
  }
  return Object.freeze({
    ...previous,
    focusedDiagnosticId: meta.diagnosticId,
  });
}

/**
 * Detach one bounded exact structural diagnostic array without invoking accessors.
 */
function normalizeResolvedDiagnostics(
  documentNode: ProseMirrorNode,
  input: unknown,
): readonly CwlResolvedWritingDiagnosticDecoration[] | null {
  if (!Array.isArray(input) || input.length > MAX_DECORATIONS) {
    return null;
  }
  const result: CwlResolvedWritingDiagnosticDecoration[] = [];
  const identifiers = new Set<string>();
  for (const candidate of input) {
    const normalized = normalizeResolvedDiagnostic(documentNode, candidate);
    if (normalized === null || identifiers.has(normalized.diagnosticId)) {
      return null;
    }
    identifiers.add(normalized.diagnosticId);
    result.push(normalized);
  }
  return Object.freeze(result);
}

/** Detach one exact resolved diagnostic object. */
function normalizeResolvedDiagnostic(
  documentNode: ProseMirrorNode,
  value: unknown,
): CwlResolvedWritingDiagnosticDecoration | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  let prototype: object | null;
  let keys: PropertyKey[];
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    return null;
  }
  if (prototype !== Object.prototype && prototype !== null) {
    return null;
  }
  const allowed = new Set<string>(RESOLVED_DIAGNOSTIC_FIELDS);
  const record: Record<string, unknown> = {};
  for (const key of keys) {
    if (typeof key !== 'string' || !allowed.has(key)) {
      return null;
    }
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      return null;
    }
    if (
      descriptor === undefined ||
      descriptor.enumerable !== true ||
      !Object.prototype.hasOwnProperty.call(descriptor, 'value')
    ) {
      return null;
    }
    Object.defineProperty(record, key, {
      value: descriptor.value,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  for (const requiredField of REQUIRED_RESOLVED_DIAGNOSTIC_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(record, requiredField)) {
      return null;
    }
  }

  const diagnosticId = record.diagnosticId;
  const from = record.from;
  const to = record.to;
  const priority = record.priority;
  const ariaInvalid = record.ariaInvalid;
  if (
    typeof diagnosticId !== 'string' ||
    diagnosticId.length === 0 ||
    diagnosticId.length > MAX_DIAGNOSTIC_ID_CODE_UNITS ||
    !Number.isSafeInteger(from) ||
    !Number.isSafeInteger(to) ||
    (from as number) < 0 ||
    (to as number) < (from as number) ||
    (to as number) > documentNode.content.size ||
    typeof priority !== 'string' ||
    !PRIORITIES.has(priority as CwlWritingDiagnosticPriority) ||
    (ariaInvalid !== undefined && ariaInvalid !== 'spelling')
  ) {
    return null;
  }

  const normalized: CwlResolvedWritingDiagnosticDecoration = {
    diagnosticId,
    from: from as number,
    to: to as number,
    priority: priority as CwlWritingDiagnosticPriority,
  };
  if (ariaInvalid === 'spelling') {
    Object.defineProperty(normalized, 'ariaInvalid', {
      value: 'spelling',
      enumerable: true,
      configurable: false,
      writable: false,
    });
  }
  return Object.freeze(normalized);
}

export default WritingDiagnostics;
