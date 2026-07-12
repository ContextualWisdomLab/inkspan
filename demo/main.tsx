import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
// Bundled, self-contained multilingual fonts (KR / EN+VI / JP / SC / TC).
// Imported from source so the demo build inlines the woff2 files locally and
// renders all five scripts with zero network fetch (air-gapped / 폐쇄망).
import '../src/fonts/fonts.css';
import '../src/styles.css';
import './demo.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
