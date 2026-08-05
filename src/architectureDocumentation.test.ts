import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryFile = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

describe('acquisition-ready modular architecture documentation', () => {
  it('defines one authoritative standalone and modular ownership boundary', () => {
    const architecture = repositoryFile('ARCHITECTURE.md');

    expect(architecture).toContain('# Inkspan Architecture');
    expect(architecture).toContain('## Standalone product boundary');
    expect(architecture).toContain('## Modular MSA composition');
    expect(architecture).toContain('## Data ownership matrix');
    expect(architecture).toContain('## Acquisition evidence boundary');
    expect(architecture).toContain('ContextualWisdomLab/.github');
    expect(architecture).toContain('ContextualWisdomLab/naruon');
    expect(architecture).toContain(
      'ContextualWisdomLab/contextual-orchestrator',
    );
    expect(architecture).toContain(
      'Inkspan owns editor and deterministic conversion surfaces.',
    );
    expect(architecture).toContain(
      'Hosts own transport, authorization, tenant isolation, persistence, credentials, migration, retention, and model-use policy.',
    );
  });

  it('renders reviewable deployment and optimistic-concurrency diagrams', () => {
    const architecture = repositoryFile('ARCHITECTURE.md');

    expect(architecture).toContain('```mermaid\nflowchart LR');
    expect(architecture).toContain('```mermaid\nsequenceDiagram');
    expect(architecture).toContain('If-Match');
    expect(architecture).toContain('412 Precondition Failed');
    expect(architecture).toContain('strong ETag');
    expect(architecture).toContain('Y.Doc');
    expect(architecture).toContain('Office renderer');
  });

  it('provides a naruon compose and ui.panel integration contract', () => {
    const integration = repositoryFile('docs/naruon-compose-ui-panel.md');

    expect(integration).toContain('# Naruon compose and ui.panel integration');
    expect(integration).toContain("'use client'");
    expect(integration).toContain('compose');
    expect(integration).toContain('ui.panel');
    expect(integration).toContain('server-selected strong `ETag`');
    expect(integration).toContain('accessible conflict');
    expect(integration).toContain('local evidence');
    expect(integration).toContain('shareable evidence');
    expect(integration).toContain('must not read provider credentials');
    expect(integration).toContain('must not create or destroy the host provider');
  });

  it('keeps the autosave example exact and rejects out-of-order capture completion', () => {
    const integration = repositoryFile('docs/naruon-compose-ui-panel.md');

    expect(integration).toContain('initialStrongEntityTag,');
    expect(integration).toContain("'If-Match': request.ifMatchStrongEntityTag");
    expect(integration).toContain('isStrongHttpEntityTag(nextStrongEntityTag)');
    expect(integration).toContain('nextStrongEntityTag,');
    expect(integration).not.toContain('loadedStrongEntityTag:');
    expect(integration).not.toContain('request.ifMatch,');
    expect(integration).not.toContain('strongEntityTag: nextStrongEntityTag');
    expect(integration).toContain('const editGeneration = useRef(0);');
    expect(integration).toContain('const capturedGeneration = ++editGeneration.current;');
    expect(integration).toContain(
      'capturedGeneration !== editGeneration.current',
    );
    expect(integration).toContain('void captureAndQueueLatestDocument();');
    expect(integration).toContain('void session.close();');
  });

  it('remounts the complete client session when the authorized editing context changes', () => {
    const integration = repositoryFile('docs/naruon-compose-ui-panel.md');
    const doctoring = repositoryFile(
      'docs/doctoring/naruon-modular-architecture.md',
    );
    const changelog = repositoryFile('CHANGELOG.md');

    expect(integration).toContain('readonly editingContextId: string;');
    expect(integration).toContain('function InkspanPanelSession(');
    expect(integration).toContain('<InkspanPanelSession');
    expect(integration).toContain('key={props.editingContextId}');
    expect(integration).toContain('encodeURIComponent(documentId)');
    expect(integration).toContain(
      "import { useEffect, useRef, useState } from 'react';",
    );
    expect(integration).toContain(
      'const [session] = useState<DocumentAutosaveSession>',
    );
    expect(integration).not.toContain('useMemo<DocumentAutosaveSession>');
    expect(integration).toContain(
      'must issue a new opaque `editingContextId` for every authorized document load',
    );
    expect(doctoring).toContain('cross-document state reuse');
    expect(changelog).toContain('opaque editing-context remount');
  });

  it('records authoritative standards and the unreleased product change', () => {
    const doctoring = repositoryFile(
      'docs/doctoring/naruon-modular-architecture.md',
    );
    const changelog = repositoryFile('CHANGELOG.md');

    expect(doctoring).toContain('APA 7 references');
    expect(doctoring).toContain('RFC 9110');
    expect(doctoring).toContain('WCAG 2.2');
    expect(doctoring).toContain('NIST SP 800-204');
    expect(doctoring).toContain('NIST SP 800-204D');
    expect(doctoring).toContain('OWASP ASVS 5.0.0');
    expect(doctoring).toContain('React hydrateRoot');
    expect(doctoring).toContain('Next.js App Router');
    expect(changelog).toContain(
      'authoritative standalone and modular MSA architecture contract',
    );
    expect(changelog).toContain('naruon compose and ui.panel integration');
  });
});
