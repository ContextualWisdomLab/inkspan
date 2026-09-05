'use client';

import { useEffect, useRef, useState } from 'react';
import { CwlEditor, createDocumentEnvelope, serializeDocumentEnvelope, type CwlEditorHandle } from '@contextualwisdomlab/cwl-editor';
import { createDelayedProposal, applyDelayedProposal } from './delayed-proposal.mjs';
import { MAX_DOCUMENT_CODE_UNITS } from './synthetic-document-repository.mjs';

const suggestionText = 'An example suggestion for this draft.';
const limits = { maxUtf8Bytes: MAX_DOCUMENT_CODE_UNITS, maxJsonTextCodeUnits: MAX_DOCUMENT_CODE_UNITS, maxStringCodeUnits: MAX_DOCUMENT_CODE_UNITS };
const messages: Record<string, string> = {
  idle: 'Edit your draft or prepare an example suggestion.',
  preparing: 'Preparing a local suggestion…',
  ready: 'Suggestion ready. Review it before applying.',
  applying: 'Checking your draft before applying…',
  applied: 'Suggestion applied. Nothing has been saved.',
  conflict: 'Your draft changed. Prepare a new suggestion.',
  failed: 'The suggestion could not be used. Your draft is still here.',
};

/** Local, provider-free proposal review; no model call or durable save. */
export function DelayedProposalHost({ readOnly = false }: { readOnly?: boolean }) {
  const editorRef = useRef<CwlEditorHandle>(null);
  const mountedRef = useRef(false);
  const busyRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('idle');
  const [proposal, setProposal] = useState<Awaited<ReturnType<typeof createDelayedProposal>> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  async function prepareSuggestion() {
    const editor = editorRef.current;
    if (readOnly || !ready || !editor || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setProposal(null);
    setStatus('preparing');
    try {
      const evidence = await editor.getDocumentEnvelopeRevisionEvidence(limits);
      if (!evidence) throw new Error('Editor is unavailable.');
      const candidate = await createDelayedProposal({
        expectedRevision: evidence.revision.strongEntityTag,
        replacement: serializeDocumentEnvelope(createDocumentEnvelope({
          type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: suggestionText }] }],
        })),
      });
      if (mountedRef.current) { setProposal(candidate); setStatus('ready'); }
    } catch {
      if (mountedRef.current) setStatus('failed');
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  }

  async function applySuggestion() {
    const editor = editorRef.current;
    if (readOnly || !ready || !editor || !proposal || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    let moved = false;
    try {
      if (!window.confirm('Replace the draft with this suggestion? Your current text will be replaced.')) return;
      setStatus('applying');
      const current = await editor.getDocumentEnvelopeRevision(limits);
      if (!current || !mountedRef.current) return;
      const result = await applyDelayedProposal({
        proposal, currentRevision: current.strongEntityTag,
        async apply(replacement: string) {
          const restored = await editor.restoreDocumentEnvelopeIfMatch(proposal.expectedRevision, replacement, limits);
          if (restored?.status !== 'restored') {
            moved = true;
            throw new Error('Draft changed.');
          }
        },
      });
      if (mountedRef.current) {
        setStatus(result.status === 'applied' ? 'applied' : 'conflict');
        setProposal(null);
        editor.focus();
      }
    } catch {
      if (mountedRef.current) setStatus(moved ? 'conflict' : 'failed');
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  }

  return <section className="reference-recovery" aria-labelledby="proposal-heading">
    <h2 id="proposal-heading">Review a suggested change</h2>
    <p>This demo prepares a fixed suggestion locally. Nothing is sent to a model or saved; closing or reloading the tab removes the draft.</p>
    <CwlEditor ref={editorRef} mode="markdown" defaultValue="Draft" ariaLabel="Draft"
      editable={!readOnly} onReady={() => setReady(true)} />
    <output role="status" aria-live="polite" aria-atomic="true">{messages[status]}</output>
    {proposal && <blockquote>{suggestionText}</blockquote>}
    <fieldset className="reference-recovery-controls" disabled={readOnly || !ready || busy}>
      <legend>Local suggestion</legend>
      <button type="button" onClick={() => { void prepareSuggestion(); }}>Prepare example suggestion</button>
      {proposal && <>
        <button type="button" onClick={() => { void applySuggestion(); }}>Apply suggestion</button>
        <button type="button" onClick={() => { setProposal(null); setStatus('idle'); editorRef.current?.focus(); }}>Discard suggestion</button>
      </>}
    </fieldset>
  </section>;
}
