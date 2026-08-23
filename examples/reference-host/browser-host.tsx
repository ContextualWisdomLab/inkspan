import './presentation-full.css';
import { hydrateRoot } from 'react-dom/client';

import { ReferenceHostApp } from './reference-host-app.js';

declare global {
  interface Window {
    referenceHostSubmissions: string[];
    referenceHostResolveSubmission?: () => void;
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
const deferSubmission = searchParams.get('deferSubmission') === '1';
let resolveDeferredSubmission: (() => void) | undefined;

window.referenceHostResolveSubmission = () => {
  resolveDeferredSubmission?.();
};

hydrateRoot(
  root,
  <ReferenceHostApp
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