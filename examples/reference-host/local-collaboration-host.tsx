'use client';

import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Doc, applyUpdate, encodeStateAsUpdate } from 'yjs';
import { CollaborativeCwlEditor } from '@contextualwisdomlab/cwl-editor/collaboration';
import { createHostCollaborationLifecycle } from './collaboration-provider-lifecycle.mjs';
import { createHostAuthorizedProviderFactory } from './host-authorized-collaboration.mjs';

type LocalSession = { lifecycle: ReturnType<typeof createHostCollaborationLifecycle>; peer: Doc };
const messages = {
  idle: 'Start a local session to try two views of the same draft.',
  connected: 'Local views connected. Nothing is saved or sent to a server.',
  denied: 'The local connection is not allowed. Enable the demo permission and try again.',
  failed: 'The connection could not be confirmed. Reconnect to try again; your local draft is still here.',
  closed: 'Local session closed. Its drafts have been removed from memory.',
};

/** Two local Yjs documents; no server, awareness, credential or durable store. */
export function LocalCollaborationHost({ readOnly = false, onEvent }: {
  readOnly?: boolean;
  onEvent: (event: string) => void;
}) {
  const sessionRef = useRef<LocalSession | null>(null);
  const busyRef = useRef(false);
  const allowRef = useRef(true);
  const failRef = useRef(false);
  const startRef = useRef<HTMLButtonElement>(null);
  const [session, setSession] = useState<LocalSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [allowed, setAllowed] = useState(true);
  const [failNext, setFailNext] = useState(false);
  const [status, setStatus] = useState<keyof typeof messages>('idle');

  function disposeSession() {
    const current = sessionRef.current;
    if (!current) return;
    try { current.lifecycle.dispose(); }
    finally { current.peer.destroy(); }
    sessionRef.current = null;
  }

  useEffect(() => () => { disposeSession(); }, []);
  useEffect(() => {
    if (!busy && status === 'closed') startRef.current?.focus();
  }, [busy, status]);

  function createSession(): LocalSession {
    const peer = new Doc();
    peer.on('destroy', () => onEvent('document:destroy:peer'));
    try {
      const lifecycle = createHostCollaborationLifecycle({
        roomId: 'local-demo-room', actorId: 'local-demo-author',
        documentFactory() {
          const document = new Doc();
          document.on('destroy', () => onEvent('document:destroy:local'));
          return document;
        },
        providerFactory: createHostAuthorizedProviderFactory({
          authorize({ generation }: { generation: number }) {
            onEvent(`authorize:${generation}`);
            return allowRef.current;
          },
          createProvider({ document, generation }: { document: Doc; generation: number }) {
            onEvent(`provider:create:${generation}`);
            // ponytail: in-memory pair only; an authorized network provider must
            // replace this transport and own presence, retries and persistence.
            const forward = (update: Uint8Array, origin: unknown) => {
              if (origin !== peer) { applyUpdate(peer, update, document); onEvent(`provider:forward:${generation}`); }
            };
            const reverse = (update: Uint8Array, origin: unknown) => {
              if (origin !== document) applyUpdate(document, update, peer);
            };
            const detach = () => { document.off('update', forward); peer.off('update', reverse); };
            return {
              connect() {
                onEvent(`provider:connect:${generation}`);
                document.on('update', forward); peer.on('update', reverse);
                if (failRef.current) {
                  failRef.current = false; setFailNext(false);
                  throw new Error('private local connection fixture cause');
                }
                applyUpdate(peer, encodeStateAsUpdate(document), document);
                applyUpdate(document, encodeStateAsUpdate(peer), peer);
              },
              disconnect() { detach(); onEvent(`provider:disconnect:${generation}`); },
              destroy() { detach(); onEvent(`provider:destroy:${generation}`); },
            };
          },
        }),
      });
      return { lifecycle, peer };
    } catch (error) { peer.destroy(); throw error; }
  }

  function perform(action: 'start' | 'reconnect' | 'close') {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true);
    try {
      if (action === 'close') {
        if (!sessionRef.current || !window.confirm('Close this local session? Both unsaved local drafts will be lost.')) return;
        // Detach both editor bindings before destroying their host-owned docs.
        flushSync(() => setSession(null));
        disposeSession(); setStatus('closed');
      } else if (action === 'start') {
        if (sessionRef.current) return;
        const current = createSession();
        sessionRef.current = current; setSession(current);
        current.lifecycle.connect(); setStatus('connected');
      } else {
        if (!sessionRef.current) return;
        sessionRef.current.lifecycle.reconnect(); setStatus('connected');
      }
    } catch { setStatus(allowRef.current ? 'failed' : 'denied'); }
    finally {
      // Keep the synchronous admission latch through the initiating event turn.
      queueMicrotask(() => { busyRef.current = false; setBusy(false); });
    }
  }

  return <section className="reference-recovery" aria-labelledby="collaboration-heading">
    <h2 id="collaboration-heading">Try a local collaboration session</h2>
    <p>Both views run in this tab. Nothing is sent to another person or saved; closing the session or reloading removes the drafts.</p>
    <output role="status" aria-live="polite" aria-atomic="true">{messages[status]}</output>
    <fieldset className="reference-recovery-controls" disabled={busy}>
      <legend>Local connection demo</legend>
      <label><input type="checkbox" checked={allowed} onChange={(event) => { allowRef.current = event.target.checked; setAllowed(event.target.checked); }} /> Allow the next local connection</label>
      <label><input type="checkbox" checked={failNext} onChange={(event) => { failRef.current = event.target.checked; setFailNext(event.target.checked); }} /> Fail the next connection</label>
      <button ref={startRef} type="button" disabled={session !== null} onClick={() => perform('start')}>Start local session</button>
      <button type="button" disabled={session === null} onClick={() => perform('reconnect')}>Reconnect</button>
      <button type="button" disabled={session === null} onClick={() => perform('close')}>Close local session</button>
    </fieldset>
    {session && <>
      <h3>Your draft</h3>
      <CollaborativeCwlEditor document={session.lifecycle.document} ariaLabel="Your draft" editable={!readOnly}
        connectionStatus={status === 'connected' ? 'connected' : 'disconnected'} />
      <h3>Other local view</h3>
      <CollaborativeCwlEditor document={session.peer} ariaLabel="Other local view" editable={false} hideToolbar
        connectionStatus={status === 'connected' ? 'connected' : 'disconnected'} />
    </>}
  </section>;
}
