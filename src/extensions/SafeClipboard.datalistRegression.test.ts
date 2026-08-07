import { describe, expect, it } from 'vitest';
import { sanitizeRichClipboardHtml } from './SafeClipboard.js';

describe('SafeClipboard datalist visibility regression', () => {
  it('does not promote hidden datalist suggestion content into visible editor prose', () => {
    const sanitized = sanitizeRichClipboardHtml(
      `<p>visible ordinary content</p>
       <datalist id="approved-values">
         datalist fallback secret
         <option value="approved">approved option secret</option>
       </datalist>`,
      {},
      document,
    );
    const container = document.createElement('div');
    container.innerHTML = sanitized;

    expect(container).toHaveTextContent('visible ordinary content');
    expect(container).not.toHaveTextContent('datalist fallback secret');
    expect(container).not.toHaveTextContent('approved option secret');
    expect(container.querySelectorAll('datalist, option')).toHaveLength(0);
  });
});
