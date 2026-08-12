/**
 * Revision-bound controller for host-supplied writing diagnostics.
 *
 * The controller validates hostile host data before reading editor state, hashes
 * one immutable document snapshot, resolves every selector against that same
 * snapshot, and installs only a complete verified generation. It performs no
 * semantic language judgment and never calls a model, provider, network, or
 * persistence service.
 */
import type { Editor } from '@tiptap/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createDocumentEnvelope } from '../documentEnvelope.js';
import {
  createValidatedDocumentEnvelopeRevision,
  type CwlEditorDocumentRevision,
  type DocumentEnvelopeDigestProvider,
} from '../documentEnvelopeRevision.js';
import type { CwlResolvedWritingDiagnosticDecoration } from '../extensions/WritingDiagnostics.js';
import { resolveTextPositionSelector } from '../writingDiagnosticProjection.js';
import {
  WritingDiagnosticError,
  validateWritingDiagnostics,
  type CwlWritingDiagnostic,
} from '../writingDiagnostics.js';
import { useLatestRef } from './useLatestRef.js';

/** Stable lifecycle states exposed to built-in Inkspan diagnostic UI. */
export type WritingDiagnosticsControllerStatus =
  | 'absent'
  | 'verifying'
  | 'active'
  | 'invalid'
  | 'stale';

/** Privacy-minimized host-visible action classifications. */
export type CwlWritingDiagnosticAction =
  | 'applied'
  | 'ignored'
  | 'dismissed'
  | 'requested_explanation'
  | 'stale'
  | 'conflict';

/** Stable reason codes that never embed authored or model-produced text. */
export type CwlWritingDiagnosticActionReasonCode =
  | 'explicit'
  | 'document_changed'
  | 'revision_mismatch'
  | 'projection_mismatch'
  | 'selector_invalid'
  | 'verification_failed'
  | 'lifecycle_ended'
  | 'diagnostic_missing';

/** Redacted result/callback payload for one writing-diagnostic action. */
export interface CwlWritingDiagnosticActionEvent {
  readonly action: CwlWritingDiagnosticAction;
  readonly reasonCode: CwlWritingDiagnosticActionReasonCode;
  readonly diagnosticId: string;
  readonly documentRevision: CwlEditorDocumentRevision;
  readonly categoryCode: string;
  readonly generation: number;
}

/** One validated diagnostic plus its exact current ProseMirror range. */
export interface CwlVerifiedWritingDiagnostic {
  readonly diagnostic: CwlWritingDiagnostic;
  readonly from: number;
  readonly to: number;
}

/** Internal hook inputs shared later by standalone and collaborative surfaces. */
export interface UseWritingDiagnosticsControllerOptions {
  readonly editor: Editor | null;
  readonly diagnostics?: unknown;
  readonly digestProvider?: DocumentEnvelopeDigestProvider | null;
  readonly onAction?: (event: CwlWritingDiagnosticActionEvent) => void;
  readonly onError?: (error: WritingDiagnosticError) => void;
}

/** Stable controller surface consumed by the built-in panel and editor adapters. */
export interface WritingDiagnosticsController {
  readonly status: WritingDiagnosticsControllerStatus;
  readonly generation: number;
  readonly editor: Editor | null;
  readonly diagnostics: readonly CwlVerifiedWritingDiagnostic[];
  /** Exposed only for deterministic integration tests and later adapter plumbing. */
  readonly digestProvider: DocumentEnvelopeDigestProvider | null | undefined;
  readonly focusDiagnostic: (diagnosticId: string) => boolean;
  readonly ignoreDiagnostic: (
    diagnosticId: string,
  ) => CwlWritingDiagnosticActionEvent | null;
  readonly dismissDiagnostic: (
    diagnosticId: string,
  ) => CwlWritingDiagnosticActionEvent | null;
  readonly requestDiagnosticExplanation: (
    diagnosticId: string,
  ) => CwlWritingDiagnosticActionEvent | null;
}

interface ControllerSnapshot {
  readonly status: WritingDiagnosticsControllerStatus;
  readonly generation: number;
  readonly editor: Editor | null;
  readonly diagnostics: readonly CwlVerifiedWritingDiagnostic[];
}

interface ValidProcessedInput {
  readonly kind: 'valid';
  readonly rawInput: unknown;
  readonly editor: Editor | null;
  readonly digestProvider: DocumentEnvelopeDigestProvider | null | undefined;
  readonly diagnostics: readonly CwlWritingDiagnostic[];
}

interface InvalidProcessedInput {
  readonly kind: 'invalid';
  readonly rawInput: unknown;
  readonly editor: Editor | null;
  readonly digestProvider: DocumentEnvelopeDigestProvider | null | undefined;
  readonly errorCode: WritingDiagnosticError['code'];
}

interface AbsentProcessedInput {
  readonly kind: 'absent';
  readonly rawInput: undefined;
  readonly editor: Editor | null;
  readonly digestProvider: DocumentEnvelopeDigestProvider | null | undefined;
}

type ProcessedInput =
  | ValidProcessedInput
  | InvalidProcessedInput
  | AbsentProcessedInput;

const EMPTY_VERIFIED_DIAGNOSTICS = Object.freeze(
  [] as CwlVerifiedWritingDiagnostic[],
);

function snapshot(
  status: WritingDiagnosticsControllerStatus,
  generation: number,
  editor: Editor | null,
  diagnostics: readonly CwlVerifiedWritingDiagnostic[] = EMPTY_VERIFIED_DIAGNOSTICS,
): ControllerSnapshot {
  return Object.freeze({ status, generation, editor, diagnostics });
}

function notifyError(
  callback: ((error: WritingDiagnosticError) => void) | undefined,
  error: WritingDiagnosticError,
): void {
  try {
    callback?.(error);
  } catch {
    // Host callbacks are advisory observers and never own editor determinism.
  }
}

function notifyAction(
  callback: ((event: CwlWritingDiagnosticActionEvent) => void) | undefined,
  event: CwlWritingDiagnosticActionEvent,
): void {
  try {
    callback?.(event);
  } catch {
    // Host callback failure must not roll back or corrupt local controller state.
  }
}

function revisionsEqual(
  left: CwlEditorDocumentRevision,
  right: CwlEditorDocumentRevision,
): boolean {
  return (
    left.algorithm === right.algorithm &&
    left.digestHex === right.digestHex &&
    left.strongEntityTag === right.strongEntityTag
  );
}

function diagnosticsEqual(
  left: readonly CwlWritingDiagnostic[],
  right: readonly CwlWritingDiagnostic[],
): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index]!;
    const b = right[index]!;
    if (
      a.diagnosticId !== b.diagnosticId ||
      !revisionsEqual(a.documentRevision, b.documentRevision) ||
      a.textProjection.id !== b.textProjection.id ||
      a.textProjection.version !== b.textProjection.version ||
      a.selector.type !== b.selector.type ||
      a.selector.start !== b.selector.start ||
      a.selector.end !== b.selector.end ||
      a.categoryCode !== b.categoryCode ||
      a.priority !== b.priority ||
      a.title !== b.title ||
      a.explanation !== b.explanation ||
      a.suggestedReplacement !== b.suggestedReplacement ||
      a.confidence !== b.confidence ||
      a.provenance.workflowId !== b.provenance.workflowId ||
      a.provenance.workflowVersion !== b.provenance.workflowVersion ||
      a.provenance.judgePolicyVersion !== b.provenance.judgePolicyVersion ||
      a.provenance.orchestrationMode !== b.provenance.orchestrationMode
    ) {
      return false;
    }
  }
  return true;
}

function sameProcessedInput(
  previous: ProcessedInput | null,
  next: ProcessedInput,
): boolean {
  if (
    previous === null ||
    previous.kind !== next.kind ||
    previous.editor !== next.editor ||
    previous.digestProvider !== next.digestProvider
  ) {
    return false;
  }
  if (previous.kind === 'valid' && next.kind === 'valid') {
    return diagnosticsEqual(previous.diagnostics, next.diagnostics);
  }
  if (previous.kind === 'invalid' && next.kind === 'invalid') {
    return previous.errorCode === next.errorCode;
  }
  return true;
}

function clearEditorDiagnostics(editor: Editor | null): void {
  if (editor === null || editor.isDestroyed) return;
  try {
    editor.commands.clearWritingDiagnostics();
  } catch {
    // A destroyed/replaced host view cannot make stale decorations authoritative.
  }
}

function toDecoration(
  item: CwlVerifiedWritingDiagnostic,
): CwlResolvedWritingDiagnosticDecoration {
  return Object.freeze({
    diagnosticId: item.diagnostic.diagnosticId,
    from: item.from,
    to: item.to,
    priority: item.diagnostic.priority,
  });
}

function projectionErrorToDiagnosticError(error: unknown): WritingDiagnosticError {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'projection'
  ) {
    return new WritingDiagnosticError('projection');
  }
  return new WritingDiagnosticError('selector');
}

/**
 * Bind one host diagnostic prop to one exact editor revision and generation.
 *
 * Every committed render revalidates the hostile input structurally. This is
 * intentional: a caller may mutate an array in place, so reference identity is
 * not accepted as proof that previously validated members are unchanged. A
 * bounded detached comparison suppresses duplicate hash work on ordinary React
 * rerenders and callback replacement.
 */
export function useWritingDiagnosticsController(
  options: UseWritingDiagnosticsControllerOptions,
): WritingDiagnosticsController {
  const { editor, diagnostics, digestProvider, onAction, onError } = options;
  const actionRef = useLatestRef(onAction);
  const errorRef = useLatestRef(onError);
  const generationRef = useRef(0);
  const processedRef = useRef<ProcessedInput | null>(null);
  const [current, setCurrent] = useState<ControllerSnapshot>(() =>
    snapshot('absent', 0, editor),
  );
  const currentRef = useRef(current);
  currentRef.current = current;

  const publish = useCallback((next: ControllerSnapshot): void => {
    currentRef.current = next;
    setCurrent(next);
  }, []);

  useEffect(() => {
    if (editor === null) return undefined;
    const handleTransaction = ({ transaction }: { transaction: { docChanged: boolean } }) => {
      if (!transaction.docChanged) return;
      const active = currentRef.current;
      if (active.editor !== editor) return;
      if (active.status === 'active' || active.status === 'verifying') {
        const nextGeneration = generationRef.current + 1;
        generationRef.current = nextGeneration;
        publish(snapshot('stale', nextGeneration, editor));
      }
    };
    editor.on('transaction', handleTransaction);
    return () => {
      editor.off('transaction', handleTransaction);
      clearEditorDiagnostics(editor);
    };
  }, [editor, publish]);

  useEffect(() => {
    let processed: ProcessedInput;
    let validationError: WritingDiagnosticError | null = null;

    if (diagnostics === undefined) {
      processed = {
        kind: 'absent',
        rawInput: undefined,
        editor,
        digestProvider,
      };
    } else {
      try {
        const validated = validateWritingDiagnostics(diagnostics);
        processed = {
          kind: 'valid',
          rawInput: diagnostics,
          editor,
          digestProvider,
          diagnostics: validated,
        };
      } catch (error) {
        validationError =
          error instanceof WritingDiagnosticError
            ? error
            : new WritingDiagnosticError('contract');
        processed = {
          kind: 'invalid',
          rawInput: diagnostics,
          editor,
          digestProvider,
          errorCode: validationError.code,
        };
      }
    }

    if (sameProcessedInput(processedRef.current, processed)) {
      return;
    }

    const previous = processedRef.current;
    processedRef.current = processed;
    const nextGeneration = generationRef.current + 1;
    generationRef.current = nextGeneration;

    if (previous?.editor !== editor) {
      clearEditorDiagnostics(previous?.editor ?? null);
    }
    clearEditorDiagnostics(editor);

    if (processed.kind === 'absent') {
      publish(snapshot('absent', nextGeneration, editor));
      return;
    }

    if (processed.kind === 'invalid') {
      const error = validationError ?? new WritingDiagnosticError(processed.errorCode);
      publish(snapshot('invalid', nextGeneration, editor));
      notifyError(errorRef.current, error);
      return;
    }

    if (editor === null || editor.isDestroyed) {
      publish(snapshot('stale', nextGeneration, editor));
      return;
    }

    if (processed.diagnostics.length === 0) {
      let installed = false;
      try {
        installed = editor.commands.installWritingDiagnostics(nextGeneration, []);
      } catch {
        installed = false;
      }
      if (!installed) {
        const error = new WritingDiagnosticError('lifecycle');
        publish(snapshot('invalid', nextGeneration, editor));
        notifyError(errorRef.current, error);
        return;
      }
      publish(snapshot('active', nextGeneration, editor));
      return;
    }

    publish(snapshot('verifying', nextGeneration, editor));
    const capturedState = editor.state;
    const capturedDocument = capturedState.doc;
    let envelope;
    try {
      envelope = createDocumentEnvelope(capturedDocument.toJSON());
    } catch {
      const error = new WritingDiagnosticError('revision');
      publish(snapshot('invalid', nextGeneration, editor));
      notifyError(errorRef.current, error);
      return;
    }

    void (async () => {
      let actualRevision: CwlEditorDocumentRevision;
      try {
        actualRevision = await createValidatedDocumentEnvelopeRevision(
          envelope,
          digestProvider,
        );
      } catch {
        if (generationRef.current !== nextGeneration) return;
        const error = new WritingDiagnosticError('revision');
        publish(snapshot('invalid', nextGeneration, editor));
        notifyError(errorRef.current, error);
        return;
      }

      if (generationRef.current !== nextGeneration) return;
      if (editor.isDestroyed) {
        publish(snapshot('stale', nextGeneration, editor));
        return;
      }
      if (!editor.state.doc.eq(capturedDocument)) {
        const staleGeneration = nextGeneration + 1;
        generationRef.current = staleGeneration;
        publish(snapshot('stale', staleGeneration, editor));
        return;
      }

      for (const diagnostic of processed.diagnostics) {
        if (!revisionsEqual(diagnostic.documentRevision, actualRevision)) {
          const error = new WritingDiagnosticError('revision');
          publish(snapshot('invalid', nextGeneration, editor));
          notifyError(errorRef.current, error);
          return;
        }
      }

      const verified: CwlVerifiedWritingDiagnostic[] = [];
      try {
        for (const diagnostic of processed.diagnostics) {
          const range = resolveTextPositionSelector(
            capturedDocument,
            diagnostic.selector,
            diagnostic.textProjection,
          );
          verified.push(
            Object.freeze({
              diagnostic,
              from: range.from,
              to: range.to,
            }),
          );
        }
      } catch (error) {
        const publicError = projectionErrorToDiagnosticError(error);
        publish(snapshot('invalid', nextGeneration, editor));
        notifyError(errorRef.current, publicError);
        return;
      }

      if (generationRef.current !== nextGeneration || editor.isDestroyed) return;
      const frozenVerified = Object.freeze(verified);
      let installed = false;
      try {
        installed = editor.commands.installWritingDiagnostics(
          nextGeneration,
          frozenVerified.map(toDecoration),
        );
      } catch {
        installed = false;
      }
      if (!installed) {
        const error = new WritingDiagnosticError('lifecycle');
        publish(snapshot('invalid', nextGeneration, editor));
        notifyError(errorRef.current, error);
        return;
      }
      publish(snapshot('active', nextGeneration, editor, frozenVerified));
    })();
  });

  const focusDiagnostic = useCallback((diagnosticId: string): boolean => {
    const active = currentRef.current;
    if (
      active.status !== 'active' ||
      active.editor === null ||
      active.editor.isDestroyed ||
      !active.diagnostics.some(
        (candidate) => candidate.diagnostic.diagnosticId === diagnosticId,
      )
    ) {
      return false;
    }
    try {
      return active.editor.commands.focusWritingDiagnostic(
        active.generation,
        diagnosticId,
      );
    } catch {
      return false;
    }
  }, []);

  const consumeDiagnostic = useCallback(
    (
      diagnosticId: string,
      action: Extract<
        CwlWritingDiagnosticAction,
        'ignored' | 'dismissed' | 'requested_explanation'
      >,
    ): CwlWritingDiagnosticActionEvent | null => {
      const active = currentRef.current;
      if (
        active.status !== 'active' ||
        active.editor === null ||
        active.editor.isDestroyed
      ) {
        return null;
      }
      const target = active.diagnostics.find(
        (candidate) => candidate.diagnostic.diagnosticId === diagnosticId,
      );
      if (!target) return null;

      if (action !== 'dismissed') {
        const event = Object.freeze({
          action,
          reasonCode: 'explicit' as const,
          diagnosticId: target.diagnostic.diagnosticId,
          documentRevision: target.diagnostic.documentRevision,
          categoryCode: target.diagnostic.categoryCode,
          generation: active.generation,
        });
        notifyAction(actionRef.current, event);
        return event;
      }

      const remaining = active.diagnostics.filter(
        (candidate) => candidate !== target,
      );
      const nextGeneration = generationRef.current + 1;
      let installed = false;
      try {
        installed = active.editor.commands.installWritingDiagnostics(
          nextGeneration,
          remaining.map(toDecoration),
        );
      } catch {
        installed = false;
      }
      if (!installed) return null;

      generationRef.current = nextGeneration;
      const next = snapshot(
        'active',
        nextGeneration,
        active.editor,
        Object.freeze([...remaining]),
      );
      publish(next);
      const event = Object.freeze({
        action,
        reasonCode: 'explicit' as const,
        diagnosticId: target.diagnostic.diagnosticId,
        documentRevision: target.diagnostic.documentRevision,
        categoryCode: target.diagnostic.categoryCode,
        generation: nextGeneration,
      });
      notifyAction(actionRef.current, event);
      return event;
    },
    [actionRef, publish],
  );

  const ignoreDiagnostic = useCallback(
    (diagnosticId: string) => consumeDiagnostic(diagnosticId, 'ignored'),
    [consumeDiagnostic],
  );
  const dismissDiagnostic = useCallback(
    (diagnosticId: string) => consumeDiagnostic(diagnosticId, 'dismissed'),
    [consumeDiagnostic],
  );
  const requestDiagnosticExplanation = useCallback(
    (diagnosticId: string) =>
      consumeDiagnostic(diagnosticId, 'requested_explanation'),
    [consumeDiagnostic],
  );

  return Object.freeze({
    status: current.status,
    generation: current.generation,
    editor: current.editor,
    diagnostics: current.diagnostics,
    digestProvider,
    focusDiagnostic,
    ignoreDiagnostic,
    dismissDiagnostic,
    requestDiagnosticExplanation,
  });
}
