import './presentation-full.css';
import './autosave-recovery.css';
import { hydrateRoot } from 'react-dom/client';
import { createDocumentEnvelope, serializeDocumentEnvelope } from '@contextualwisdomlab/cwl-editor';

import { ReferenceHostApp } from './reference-host-app.js';
import { ReferenceHostHydrationGate } from './hydration-gate.js';
import { AutosaveRecoveryHost } from './autosave-recovery-host.js';
import { createSyntheticDocumentRepository } from './synthetic-document-repository.mjs';

declare global {
  interface Window {
    referenceHostSubmissions: string[];
    referenceHostResolveSubmission?: () => void;
    referenceHostSavedDocuments: () => { original: string; originalValidator: string; copies: string[] };
  }
}

const submissions: string[] = [];
window.referenceHostSubmissions = submissions;

const root = document.getElementById('reference-host-root');
if (!root) {
  throw new Error('Reference host root is missing.');
}

const searchParams = new URLSearchParams(window.location.search);
const readOnly = searchParams.get('readOnly') === '1';
const recoveryJourney = searchParams.get('journey') === 'recovery';
const documentId = 'reference-draft';
const savedDraft = searchParams.get('savedDraft');
const repository = createSyntheticDocumentRepository({
  documentId,
  initialDocument: savedDraft === 'invalid' ? 'Invalid stored draft' : serializeDocumentEnvelope(createDocumentEnvelope({
    type: 'doc', content: savedDraft === '1' ? [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Saved heading' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Previously saved draft', marks: [{ type: 'bold' }] }] },
    ] : [{ type: 'paragraph', content: [{ type: 'text', text: 'Draft' }] }],
  })),
});
const savedCopies: Array<{ documentId: string; repository: typeof repository }> = [];
window.referenceHostSavedDocuments = () => {
  const original = repository.read(documentId);
  return { original: original.document, originalValidator: original.validator,
    copies: savedCopies.map((copy) => copy.repository.read(copy.documentId).document) };
};
const deferSubmission = searchParams.get('deferSubmission') === '1';
const controlMode =
  searchParams.get('controlMode') === 'controlled'
    ? 'controlled'
    : 'uncontrolled';
let resolveDeferredSubmission: (() => void) | undefined;

window.referenceHostResolveSubmission = () => {
  resolveDeferredSubmission?.();
};

hydrateRoot(
  root,
  recoveryJourney ? (
    <main aria-labelledby="reference-host-heading">
      <h1 id="reference-host-heading">Inkspan reference host</h1>
      <ReferenceHostHydrationGate loadingLabel="Loading buyer editor" renderEditor={() => (
        <AutosaveRecoveryHost documentId={documentId} repository={repository} readOnly={readOnly}
          onCopySaved={(copy) => { savedCopies.push(copy); }} />
      )} />
    </main>
  ) : <ReferenceHostApp
    controlMode={controlMode}
    loadingLabel="Loading buyer editor"
    onAuthorizedSubmit={async (messageBody) => {
      submissions.push(messageBody);
      if (deferSubmission) {
        await new Promise<void>((resolve) => {
          resolveDeferredSubmission = resolve;
        });
        resolveDeferredSubmission = undefined;
      }
    }}
    readOnly={readOnly}
  />,
);
