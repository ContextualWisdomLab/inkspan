import { describe, expect, it } from 'vitest';
import { sanitizeRichClipboardHtml } from './SafeClipboard.js';

describe('SafeClipboard popover security regression', () => {
  it('drops popover subtrees whose runtime showing state is absent from clipboard HTML', () => {
    const sanitized = sanitizeRichClipboardHtml(
      `<p>visible ordinary content</p>
       <div popover>default popover secret</div>
       <aside popover="auto">auto popover secret</aside>
       <section popover="manual">manual popover secret</section>
       <article popover="hint">hint popover secret</article>`,
      {},
      document,
    );
    const container = document.createElement('div');
    container.innerHTML = sanitized;

    expect(container).toHaveTextContent('visible ordinary content');
    expect(container).not.toHaveTextContent('default popover secret');
    expect(container).not.toHaveTextContent('auto popover secret');
    expect(container).not.toHaveTextContent('manual popover secret');
    expect(container).not.toHaveTextContent('hint popover secret');
  });
});
