import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryFile = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

const fencedCodeBlock = (markdown: string, language: string): string => {
  const opening = `\`\`\`${language}\n`;
  const start = markdown.indexOf(opening);
  expect(start).toBeGreaterThanOrEqual(0);
  const bodyStart = start + opening.length;
  const end = markdown.indexOf('\n```', bodyStart);
  expect(end).toBeGreaterThan(bodyStart);
  return markdown.slice(bodyStart, end);
};

const markerPosition = (
  text: string,
  marker: string,
  startAt = 0,
): number => {
  const position = text.indexOf(marker, startAt);
  expect(position).toBeGreaterThanOrEqual(startAt);
  return position;
};

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

  it('validates fenced autosave structure, generation ordering, and conflict recovery', () => {
    const integration = repositoryFile('docs/naruon-compose-ui-panel.md');
    const example = fencedCodeBlock(integration, 'tsx');

    expect(example).toContain('initialStrongEntityTag,');
    expect(example).toContain("'If-Match': request.ifMatchStrongEntityTag");
    expect(example).toContain('signal: AbortSignal.timeout(10_000),');
    expect(example).toContain('isStrongHttpEntityTag(nextStrongEntityTag)');
    expect(example).toContain('nextStrongEntityTag,');
    expect(example).not.toContain('loadedStrongEntityTag:');
    expect(example).not.toContain('request.ifMatch,');
    expect(example).not.toContain('strongEntityTag: nextStrongEntityTag');
    expect(example).toContain('const editGeneration = useRef(0);');
    expect(example).toContain('const conflictRecoveryPending = useRef(false);');
    expect(example).toContain(
      'readonly requestConflictRecovery: (\n    resumeWithStrongEntityTag: (recoveredStrongEntityTag: string) => boolean,\n  ) => void;',
    );
    expect(example).toContain('function requestDurableConflictRecovery(): void {');
    expect(example).toContain('if (conflictRecoveryPending.current) return;');
    expect(example).toContain('conflictRecoveryPending.current = true;');
    expect(example).toContain(
      'requestConflictRecovery((recoveredStrongEntityTag) => {',
    );
    expect(example).toContain(
      'const resumed = session.resume(recoveredStrongEntityTag);',
    );

    const capture = markerPosition(
      example,
      'const capturedGeneration = ++editGeneration.current;',
    );
    const digest = markerPosition(
      example,
      'await editorRef.current?.getDocumentEnvelopeRevisionEvidence();',
      capture,
    );
    const firstGenerationGuard = markerPosition(
      example,
      'capturedGeneration !== editGeneration.current',
      digest,
    );
    const enqueue = markerPosition(
      example,
      'const outcome = await session.enqueue(evidence);',
      firstGenerationGuard,
    );
    const conflictBranch = markerPosition(
      example,
      "if (outcome.status === 'conflict') {",
      enqueue,
    );
    markerPosition(
      example,
      'requestDurableConflictRecovery();',
      conflictBranch,
    );
    markerPosition(
      example,
      'capturedGeneration !== editGeneration.current',
      conflictBranch,
    );

    expect(example).toContain('void captureAndQueueLatestDocument();');
    expect(example).toContain('void session.close();');
  });

  it('uses instance-unique labels and remounts the complete authorized client session', () => {
    const integration = repositoryFile('docs/naruon-compose-ui-panel.md');
    const example = fencedCodeBlock(integration, 'tsx');
    const doctoring = repositoryFile(
      'docs/doctoring/naruon-modular-architecture.md',
    );
    const changelog = repositoryFile('CHANGELOG.md');

    expect(example).toContain('readonly editingContextId: string;');
    expect(example).toContain('function InkspanPanelSession(');
    expect(example).toContain('<InkspanPanelSession');
    expect(example).toContain('key={props.editingContextId}');
    expect(example).toContain('encodeURIComponent(documentId)');
    expect(example).toContain(
      "import { useEffect, useId, useRef, useState } from 'react';",
    );
    expect(example).toContain('const titleId = useId();');
    expect(example).toContain('<section aria-labelledby={titleId}>');
    expect(example).toContain('<h2 id={titleId}>Document editor</h2>');
    expect(example).not.toContain('id="document-editor-title"');
    expect(example).toContain(
      'const [session] = useState<DocumentAutosaveSession>',
    );
    expect(example).not.toContain('useMemo<DocumentAutosaveSession>');
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
