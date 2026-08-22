import { markdownToPlainText } from '@contextualwisdomlab/cwl-editor/markdown';

function requireNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || !/\S/u.test(value)) {
    throw new TypeError(`${fieldName} must be a non-empty string.`);
  }
  return value;
}

/**
 * Create a bounded reference-only DOCX request from editor Markdown.
 *
 * The host deliberately projects Markdown to plain text through Inkspan's
 * React-free public package surface before constructing the strict Office
 * request. This example does not claim Markdown-to-OOXML round-trip fidelity,
 * perform Office rendering, authorize export, choose a filesystem path, or
 * persist/distribute the resulting artifact; those remain host responsibilities.
 *
 * @param {{ title: string, markdown: string }} input host-owned export input
 * @returns {{ format: 'docx', title: string, blocks: readonly [{ type: 'paragraph', text: string }] }}
 */
export function createReferenceDocxRequest({ title, markdown }) {
  const acceptedTitle = requireNonEmptyString(title, 'title');
  if (typeof markdown !== 'string') {
    throw new TypeError('markdown must be a string.');
  }

  const text = markdownToPlainText(markdown);
  const paragraph = Object.freeze({ type: 'paragraph', text });

  return Object.freeze({
    format: 'docx',
    title: acceptedTitle,
    blocks: Object.freeze([paragraph]),
  });
}
