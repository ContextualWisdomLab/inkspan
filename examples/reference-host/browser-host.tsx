import '@contextualwisdomlab/cwl-editor/styles.css';
import { hydrateRoot } from 'react-dom/client';

import { ReferenceHostApp } from './reference-host-app.js';

declare global {
  interface Window {
    referenceHostSubmissions: string[];
  }
}

const submissions: string[] = [];
window.referenceHostSubmissions = submissions;

const root = document.getElementById('reference-host-root');
if (!root) {
  throw new Error('Reference host root is missing.');
}

const readOnly =
  new URLSearchParams(window.location.search).get('readOnly') === '1';

hydrateRoot(
  root,
  <ReferenceHostApp
    loadingLabel="Loading buyer editor"
    onAuthorizedSubmit={async (messageBody) => {
      submissions.push(messageBody);
    }}
    readOnly={readOnly}
  />,
);
