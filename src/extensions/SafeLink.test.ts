import { afterEach, describe, expect, it, vi } from 'vitest';
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
  vi.restoreAllMocks();
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

  it('rejects obvious oversize before UTF-8 allocation and URL parsing', () => {
    const encodeSpy = vi.spyOn(TextEncoder.prototype, 'encode');
    const href = 'https://example.com/path';

    let error: unknown;
    try {
      validateSafeLinkHref(href, { maxHrefBytes: 8 });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(SafeLinkHrefError);
    expect(error).toMatchObject({
      code: 'input_too_large',
      hrefPreview: '<oversized>',
    });
    expect(String(error)).not.toContain('example.com');
    expect(encodeSpy).not.toHaveBeenCalled();
    expect(isSafeLinkHref(href, { maxHrefBytes: 8 })).toBe(false);
  });

  it('enforces the default bound before allocating an oversized UTF-8 copy', () => {
    const encodeSpy = vi.spyOn(TextEncoder.prototype, 'encode');
    const href = `https://example.com/${'a'.repeat(65_536)}`;

    expect(() => validateSafeLinkHref(href)).toThrow(SafeLinkHrefError);
    expect(encodeSpy).not.toHaveBeenCalled();
  });

  it('enforces exact UTF-8 byte counts when code-unit length alone can fit', () => {
    expect(() =>
      validateSafeLinkHref('/é', { maxHrefBytes: 2 }),
    ).toThrow(SafeLinkHrefError);
    expect(validateSafeLinkHref('/é', { maxHrefBytes: 3 })).toBe('/é');
  });

  it('accepts an omitted configured limit through an explicit options object', () => {
    expect(validateSafeLinkHref('/safe', {})).toBe('/safe');
  });

  it.each([
    null,
    8,
    [],
    { maxHrefBytes: '8' },
    { maxHrefBytes: 1.5 },
    { maxHrefBytes: 0 },
    { maxHrefBytes: 1_048_577 },
  ])('fails closed for invalid resource configuration %#', (options) => {
    let error: unknown;
    try {
      validateSafeLinkHref('/private/path?token=secret', options as never);
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(SafeLinkHrefError);
    expect(error).toMatchObject({
      code: 'invalid_configuration',
      hrefPreview: '<configuration>',
    });
    expect(String(error)).not.toContain('private/path');
  });

  it('rejects accessor-backed resource configuration without evaluating the accessor', () => {
    const getter = vi.fn(() => 8);
    const options = Object.defineProperty({}, 'maxHrefBytes', {
      enumerable: true,
      get: getter,
    });

    let error: unknown;
    try {
      validateSafeLinkHref('/private/path?token=secret', options as never);
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(SafeLinkHrefError);
    expect(error).toMatchObject({
      code: 'invalid_configuration',
      hrefPreview: '<configuration>',
    });
    expect(String(error)).not.toContain('private/path');
    expect(getter).not.toHaveBeenCalled();
  });

  it('rejects unknown string and symbol configuration keys before reading values', () => {
    const getter = vi.fn(() => 8);
    const unknownStringKey = Object.defineProperty({}, 'unexpected', {
      enumerable: true,
      get: getter,
    });
    const unknownSymbolKey = { [Symbol('maxHrefBytes')]: 8 };

    for (const options of [unknownStringKey, unknownSymbolKey]) {
      let error: unknown;
      try {
        validateSafeLinkHref('/private/path?token=secret', options as never);
      } catch (caught) {
        error = caught;
      }

      expect(error).toBeInstanceOf(SafeLinkHrefError);
      expect(error).toMatchObject({
        code: 'invalid_configuration',
        hrefPreview: '<configuration>',
      });
      expect(String(error)).not.toContain('private/path');
    }
    expect(getter).not.toHaveBeenCalled();
  });

  it('converts reflection failures into payload-redacted configuration errors', () => {
    const options = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error('proxy-owned secret');
        },
      },
    );

    let error: unknown;
    try {
      validateSafeLinkHref('/private/path?token=secret', options as never);
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(SafeLinkHrefError);
    expect(error).toMatchObject({
      code: 'invalid_configuration',
      hrefPreview: '<configuration>',
    });
    expect(String(error)).not.toContain('proxy-owned secret');
    expect(String(error)).not.toContain('private/path');
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
    'https://:secret@example.com/path',
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
    const oversized = new SafeLinkHrefError(
      'https://secret.example/token',
      'input_too_large',
    );
    const invalidConfiguration = new SafeLinkHrefError(
      'https://secret.example/token',
      'invalid_configuration',
    );

    expect(nonString.name).toBe('SafeLinkHrefError');
    expect(nonString.code).toBe('invalid_href');
    expect(nonString.hrefPreview).toBe('<number>');
    expect(empty.hrefPreview).toBe('<empty>');
    expect(protocolRelative.hrefPreview).toBe('//<redacted>');
    expect(fragment.hrefPreview).toBe('#<redacted>');
    expect(scheme.hrefPreview).toBe('javascript:<redacted>');
    expect(relative.hrefPreview).toBe('<relative>');
    expect(relative.message).not.toContain('private/path');
    expect(oversized.hrefPreview).toBe('<oversized>');
    expect(oversized.message).not.toContain('secret.example');
    expect(invalidConfiguration.hrefPreview).toBe('<configuration>');
    expect(invalidConfiguration.message).not.toContain('secret.example');
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
