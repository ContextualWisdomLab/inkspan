import { afterEach, describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/react';
import { buildExtensions } from './kit.js';
import {
  SafeLinkHrefError,
  isSafeLinkHref,
  safeLinkPluginKey,
  validateSafeLinkHref,
} from './SafeLink.js';

const openEditors: Editor[] = [];

function makeEditor(content = '<p>alpha</p><p>omega</p>'): Editor {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = new Editor({
    element,
    extensions: buildExtensions(),
    content,
  });
  openEditors.push(editor);
  return editor;
}

afterEach(() => {
  for (const editor of openEditors.splice(0)) {
    if (!editor.isDestroyed) editor.destroy();
  }
  document.body.replaceChildren();
});

describe('validateSafeLinkHref', () => {
  it.each([
    'https://example.com/path?q=1#section',
    'HTTP://localhost:3000/health',
    'mailto:person@example.com?subject=Hello',
    'TEL:+82-10-1234-5678',
    '/docs/getting-started',
    './next-page',
    '../previous-page',
    'docs/reference',
    '?view=compact',
    '#editor-surface',
  ])('accepts safe link target %s', (href) => {
    expect(validateSafeLinkHref(href)).toBe(href);
    expect(isSafeLinkHref(href)).toBe(true);
  });

  it('rejects link targets above a caller-selected UTF-8 byte ceiling', () => {
    const boundedValidate = validateSafeLinkHref as unknown as (
      href: unknown,
      options?: { maxHrefBytes?: number },
    ) => string;

    expect(() =>
      boundedValidate('https://example.com/path', { maxHrefBytes: 8 }),
    ).toThrow(SafeLinkHrefError);
  });

  it.each([
    null,
    42,
    '',
    '//attacker.example/path',
    '\\attacker.example\\path',
    ' https://example.com',
    'https://example.com ',
    'https://exam ple.com',
    'java\nscript:alert(1)',
    'javascript:alert(1)',
    'data:text/html;base64,PHNjcmlwdD4=',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'blob:https://example.com/identifier',
    'custom-protocol://example.com',
    'mailto:',
    'tel:',
    'https:example.com',
    'https://',
    'https://user:secret@example.com/path',
    'http://user@example.com/path',
  ])('rejects unsafe link target %s', (href) => {
    expect(() => validateSafeLinkHref(href)).toThrow(SafeLinkHrefError);
    expect(isSafeLinkHref(href)).toBe(false);
  });

  it('redacts rejected target details in typed errors', () => {
    const nonString = new SafeLinkHrefError(42);
    const empty = new SafeLinkHrefError('');
    const protocolRelative = new SafeLinkHrefError('//secret.example/token');
    const fragment = new SafeLinkHrefError('#private-section');
    const scheme = new SafeLinkHrefError('JAVASCRIPT:secret()');
    const relative = new SafeLinkHrefError('private/path?token=secret');

    expect(nonString.name).toBe('SafeLinkHrefError');
    expect(nonString.hrefPreview).toBe('<number>');
    expect(empty.hrefPreview).toBe('<empty>');
    expect(protocolRelative.hrefPreview).toBe('//<redacted>');
    expect(fragment.hrefPreview).toBe('#<redacted>');
    expect(scheme.hrefPreview).toBe('javascript:<redacted>');
    expect(relative.hrefPreview).toBe('<relative>');
    expect(relative.message).not.toContain('private/path');
  });
});

describe('SafeLink extension', () => {
  it('is present in the shared kit with the direct-transaction plugin', () => {
    const editor = makeEditor();
    expect(editor.extensionManager.extensions.some((item) => item.name === 'link')).toBe(true);
    expect(safeLinkPluginKey.get(editor.state)).toBeDefined();
  });

  it('drops unsafe initial HTML links while preserving safe relative links', () => {
    const editor = makeEditor(
      '<p><a href="javascript:alert(1)">bad</a> <a href="/safe/path">good</a></p>',
    );
    const html = editor.getHTML();
    expect(html).not.toContain('javascript:');
    expect(html).toContain('<p>bad ');
    expect(html).toContain('href="/safe/path"');
  });

  it('allows safe command links and rejects unsafe command links', () => {
    const editor = makeEditor('<p>select me</p>');
    editor.chain().focus().selectAll().run();
    expect(editor.commands.setLink({ href: 'https://example.com' })).toBe(true);
    expect(editor.getHTML()).toContain('href="https://example.com"');

    editor.commands.unsetLink();
    editor.chain().focus().selectAll().run();
    expect(editor.commands.setLink({ href: 'javascript:alert(1)' })).toBe(false);
    expect(editor.getHTML()).not.toContain('javascript:');
  });

  it('allows safe direct transactions and rejects unsafe direct transactions', () => {
    const editor = makeEditor();
    const linkType = editor.schema.marks.link;
    const boldType = editor.schema.marks.bold;
    expect(linkType).toBeDefined();
    expect(boldType).toBeDefined();

    editor.view.dispatch(editor.state.tr.setMeta('coverage', true));

    const safeMark = linkType!.create({ href: '/safe' });
    editor.view.dispatch(editor.state.tr.addMark(1, 6, safeMark));
    expect(editor.getHTML()).toContain('href="/safe"');

    const boldMark = boldType!.create();
    editor.view.dispatch(editor.state.tr.addMark(8, 13, boldMark));
    expect(editor.getHTML()).toContain('<strong>omega</strong>');

    const before = editor.getHTML();
    const unsafeMark = linkType!.create({ href: 'javascript:alert(1)' });
    editor.view.dispatch(editor.state.tr.addMark(1, 6, unsafeMark));
    expect(editor.getHTML()).toBe(before);
    expect(editor.getHTML()).not.toContain('javascript:');
  });
});
