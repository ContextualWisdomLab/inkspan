'use client';

import { useEffect, useRef, useState } from 'react';
import {
  CwlEditor,
  createDocumentEnvelope,
  restoreDocumentEnvelope,
  serializeDocumentEnvelope,
  type CwlEditorHandle,
} from '@contextualwisdomlab/cwl-editor';
import {
  createDocumentAutosaveSession,
  type DocumentAutosaveSession,
} from '@contextualwisdomlab/cwl-editor/autosave';
import { createAutosaveViewModel } from './autosave-view-model.mjs';
import { createSyntheticDocumentRepository, MAX_DOCUMENT_CODE_UNITS } from './synthetic-document-repository.mjs';

type ReferenceRepository = ReturnType<typeof createSyntheticDocumentRepository>;
type ReferenceDocument = { documentId: string; repository: ReferenceRepository };

export interface AutosaveRecoveryHostProps extends ReferenceDocument {
  readOnly?: boolean;
  /** The embedding reference host retains ownership of newly saved copies. */
  onCopySaved: (copy: ReferenceDocument) => void;
}

const messages: Record<string, string> = {
  loading: 'Opening the saved draft…',
  loadFailed: 'The saved draft could not be opened. Nothing was changed.',
  clean: 'All changes saved in this demo.',
  preparing: 'Preparing changes…',
  saving: 'Saving changes…',
  queued: 'Saving; newer changes are waiting.',
  conflict: 'Another version was saved. Your draft is still here.',
  failed: 'Save not confirmed. Your draft is still here.',
  retrying: 'Checking and saving your draft…',
  recovered: 'Draft recovered and saved in this demo.',
  copied: 'Separate copy saved. The original was not changed.',
  captureFailed: 'Changes could not be prepared. Your draft is still here; shorten it and try again.',
  closed: 'Saving is paused. Your draft is still here.',
};

/** Reference-only, in-memory save recovery; no authentication or durable storage. */
export function AutosaveRecoveryHost({ documentId, repository, readOnly = false, onCopySaved }: AutosaveRecoveryHostProps) {
  const editorRef = useRef<CwlEditorHandle>(null);
  const [initialRead] = useState(() => {
    try { return repository.read(documentId); }
    catch { return null; }
  });
  const confirmedDocumentRef = useRef(initialRead?.document ?? '');
  const editorReadyRef = useRef(false);
  const sessionRef = useRef<DocumentAutosaveSession | null>(null);
  const activeDocumentRef = useRef<ReferenceDocument>({ documentId, repository });
  const viewModelRef = useRef(createAutosaveViewModel());
  const generationRef = useRef(0);
  const capturePendingRef = useRef(false);
  const recoveryInFlightRef = useRef(false);
  const mountedRef = useRef(false);
  const nextOutcomeRef = useRef('saved');
  const finishSaveRef = useRef<(() => void) | null>(null);
  const attemptedDocumentRef = useRef<string | null>(null);
  const copyCountRef = useRef(0);
  const [viewState, setViewState] = useState('loading');
  const [editorReady, setEditorReady] = useState(false);
  const [capturePending, setCapturePending] = useState(false);
  const [captureFailed, setCaptureFailed] = useState(false);
  const [recoveryInFlight, setRecoveryInFlight] = useState(false);
  const [nextOutcome, setNextOutcome] = useState('saved');
  const [saveWaiting, setSaveWaiting] = useState(false);

  function beginSession(validator: string) {
    viewModelRef.current = createAutosaveViewModel();
    const activeDocument = activeDocumentRef.current;
    const nextSession = createDocumentAutosaveSession({
      initialStrongEntityTag: validator,
      async save({ evidence, ifMatchStrongEntityTag }) {
        const document = serializeDocumentEnvelope(evidence.envelope);
        attemptedDocumentRef.current = document;
        const outcome = nextOutcomeRef.current;
        nextOutcomeRef.current = 'saved';
        if (mountedRef.current) setNextOutcome('saved');
        if (outcome === 'deferred') {
          await new Promise<void>((resolve) => {
            finishSaveRef.current = resolve;
            if (mountedRef.current) setSaveWaiting(true);
          });
          finishSaveRef.current = null;
          if (mountedRef.current) setSaveWaiting(false);
        }
        if (outcome === 'conflict') {
          const current = activeDocument.repository.read(activeDocument.documentId);
          activeDocument.repository.save({
            documentId: activeDocument.documentId,
            ifMatch: current.validator,
            document: serializeDocumentEnvelope(createDocumentEnvelope({
              type: 'doc',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Draft saved elsewhere.' }] }],
            })),
          });
        }
        const result = activeDocument.repository.save({
          documentId: activeDocument.documentId,
          document,
          ifMatch: ifMatchStrongEntityTag,
          outcome: outcome === 'deferred' || outcome === 'conflict' ? 'saved' : outcome,
        });
        if (result.status === 'saved' && 'validator' in result) {
          confirmedDocumentRef.current = document;
          return { status: 'saved', nextStrongEntityTag: result.validator };
        }
        return { status: 'conflict' };
      },
      onSnapshotChange(snapshot) {
        if (!mountedRef.current || sessionRef.current !== nextSession) return;
        const { state, blockedReason, activeStrongEntityTag, pendingStrongEntityTag, lastSavedStrongEntityTag } = snapshot;
        setViewState(viewModelRef.current.observe({
          state, blockedReason, activeStrongEntityTag, pendingStrongEntityTag, lastSavedStrongEntityTag,
        }).viewState);
      },
    });
    sessionRef.current = nextSession;
    return nextSession;
  }

  useEffect(() => {
    mountedRef.current = true;
    if (initialRead) beginSession(initialRead.validator);
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      void sessionRef.current?.close();
      finishSaveRef.current?.();
    };
    // The browser entry mounts one fixed document; navigation creates a new host.
  }, []);

  async function queueCurrentDraft() {
    const session = sessionRef.current;
    if (readOnly || !editorReadyRef.current || !session || !editorRef.current) return false;
    const generation = ++generationRef.current;
    capturePendingRef.current = true;
    setCapturePending(true);
    setCaptureFailed(false);
    let submitted = false;
    try {
      const evidence = await editorRef.current.getDocumentEnvelopeRevisionEvidence({ maxUtf8Bytes: MAX_DOCUMENT_CODE_UNITS, maxStringCodeUnits: MAX_DOCUMENT_CODE_UNITS });
      if (!evidence) throw new Error('Editor is not ready.');
      if (!mountedRef.current || generation !== generationRef.current || session !== sessionRef.current) return false;
      const document = serializeDocumentEnvelope(evidence.envelope);
      if (document.length > MAX_DOCUMENT_CODE_UNITS) throw new Error('Draft exceeds reference storage capacity.');
      capturePendingRef.current = false;
      setCapturePending(false);
      if (session.getSnapshot().state === 'idle' && document === confirmedDocumentRef.current) return false;
      const pendingSave = session.enqueue(evidence);
      submitted = true;
      const result = await pendingSave;
      return mountedRef.current && generation === generationRef.current && result.status === 'saved';
    } catch {
      if (mountedRef.current && generation === generationRef.current && session === sessionRef.current) {
        if (submitted) setViewState('failed');
        else setCaptureFailed(true);
      }
      return false;
    } finally {
      if (mountedRef.current && generation === generationRef.current) {
        capturePendingRef.current = false;
        setCapturePending(false);
      }
    }
  }

  async function recoverDraft(asCopy: boolean) {
    const session = sessionRef.current;
    if (readOnly || !session || recoveryInFlightRef.current || capturePendingRef.current || session.getSnapshot().state !== 'blocked') return;
    recoveryInFlightRef.current = true;
    setRecoveryInFlight(true);
    try {
      const document = editorRef.current?.getDocumentEnvelopeJson({ maxUtf8Bytes: MAX_DOCUMENT_CODE_UNITS, maxStringCodeUnits: MAX_DOCUMENT_CODE_UNITS });
      if (!document || document.length > MAX_DOCUMENT_CODE_UNITS) throw new Error('Draft is not ready to save.');
      let activeDocument = activeDocumentRef.current;
      let current = activeDocument.repository.read(activeDocument.documentId);
      if (asCopy) {
        const forkDocumentId = `reference-copy-${++copyCountRef.current}`;
        const fork = activeDocument.repository.fork({
          documentId: activeDocument.documentId, forkDocumentId, ifMatch: current.validator,
        });
        if (fork.status !== 'forked') { setViewState('conflict'); return; }
        activeDocument = { documentId: forkDocumentId, repository: fork.repository };
        current = activeDocument.repository.read(forkDocumentId);
        // ponytail: synchronous reference storage; an asynchronous host must retain
        // this copy and its draft until its own durable save/registration completes.
        const saved = activeDocument.repository.save({ documentId: forkDocumentId, document, ifMatch: current.validator });
        if (saved.status !== 'saved') { setViewState('failed'); return; }
        onCopySaved(activeDocument);
        current = activeDocument.repository.read(forkDocumentId);
      } else if (current.validator !== session.getSnapshot().durableStrongEntityTag && current.document !== attemptedDocumentRef.current) {
        setViewState('conflict');
        return;
      }
      // Pending revisions are still in the editor. Close the blocked coordinator
      // before adopting a freshly read base; never resume stale work into a conflict.
      generationRef.current += 1;
      sessionRef.current = null;
      void session.close();
      activeDocumentRef.current = activeDocument;
      confirmedDocumentRef.current = current.document;
      beginSession(current.validator);
      if (current.document === document) {
        setViewState(asCopy ? 'copied' : 'recovered');
      } else {
        setViewState('retrying');
        if (await queueCurrentDraft()) setViewState('recovered');
      }
    } catch {
      if (mountedRef.current) setViewState('failed');
    } finally {
      recoveryInFlightRef.current = false;
      if (mountedRef.current) setRecoveryInFlight(false);
    }
  }

  const blocked = !captureFailed && (viewState === 'conflict' || viewState === 'failed');
  const displayedState = captureFailed ? 'captureFailed' : capturePending && !blocked ? 'preparing' : viewState;
  return (
    <section className="reference-recovery" aria-labelledby="recovery-heading">
      <h2 id="recovery-heading">Save and recover a draft</h2>
      <p>Practice saving in this tab. This demo uses memory only; closing or reloading it removes every draft and copy.</p>
      <CwlEditor ref={editorRef} mode="markdown" editable={!readOnly && editorReady}
        ariaLabel="Draft" onChange={() => { void queueCurrentDraft(); }}
        onReady={(editor) => {
          if (!mountedRef.current) return;
          try {
            if (!initialRead) throw new Error('Saved draft is unavailable.');
            restoreDocumentEnvelope(editor, initialRead.document, {
              maxUtf8Bytes: MAX_DOCUMENT_CODE_UNITS,
              maxJsonTextCodeUnits: MAX_DOCUMENT_CODE_UNITS,
              maxStringCodeUnits: MAX_DOCUMENT_CODE_UNITS,
            });
            editorReadyRef.current = true;
            setEditorReady(true);
            setViewState('clean');
          } catch { setViewState('loadFailed'); }
        }} />
      <output role="status" aria-live="polite" aria-atomic="true">{messages[displayedState] ?? messages.closed}</output>
      {blocked && !readOnly && (
        <div className="reference-recovery-actions">
          {viewState === 'failed' && <button type="button" disabled={capturePending || recoveryInFlight}
            onClick={() => { void recoverDraft(false); }}>Check saved copy and retry</button>}
          <button type="button" disabled={capturePending || recoveryInFlight}
            onClick={() => { void recoverDraft(true); }}>Save my draft as a separate copy</button>
        </div>
      )}
      <fieldset className="reference-recovery-controls" disabled={readOnly || !editorReady || recoveryInFlight}>
        <legend>Demo controls</legend>
        <label>Next save in this demo
          <select value={nextOutcome} onChange={(event) => {
            nextOutcomeRef.current = event.target.value;
            setNextOutcome(event.target.value);
          }}>
            <option value="saved">Save normally</option>
            <option value="deferred">Wait for confirmation</option>
            <option value="failure">Fail before saving</option>
            <option value="ambiguous_failure">Lose connection before saving</option>
            <option value="ambiguous_commit_failure">Lose confirmation after saving</option>
            <option value="conflict">Another author saves first</option>
          </select>
        </label>
        {saveWaiting && <button type="button" onClick={() => finishSaveRef.current?.()}>Finish pending save</button>}
      </fieldset>
    </section>
  );
}
