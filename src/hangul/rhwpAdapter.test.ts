import type { HangulEngineDocument } from './index.js';
import { createHangulModuleEngine } from './engineAdapter.js';

class FakeHangulDocument implements HangulEngineDocument {
  static created = new FakeHangulDocument(new Uint8Array());
  readonly source: Uint8Array;

  constructor(source: Uint8Array) {
    this.source = source;
  }

  static createEmpty(): FakeHangulDocument {
    return FakeHangulDocument.created;
  }

  getSourceFormat(): string { return 'hwpx'; }
  getSectionCount(): number { return 0; }
  getParagraphCount(): number { return 0; }
  getParagraphLength(): number { return 0; }
  exportSelectionHtml(): string { return ''; }
  deleteText(): string { return '{"ok":true}'; }
  pasteHtml(): string { return '{"ok":true}'; }
  exportHwp(): Uint8Array { return new Uint8Array(); }
  exportHwpx(): Uint8Array { return new Uint8Array(); }
}

describe('Hangul parser module adapter', () => {
  it('adapts a host-initialized module without a hard runtime dependency', async () => {
    const engine = createHangulModuleEngine({ HwpDocument: FakeHangulDocument });
    const bytes = new Uint8Array([1, 2, 3]);

    expect(engine.id).toBe('hangul-module');
    const opened = await engine.open(bytes);
    expect(opened).toBeInstanceOf(FakeHangulDocument);
    expect((opened as FakeHangulDocument).source).toBe(bytes);
    expect(await engine.create()).toBe(FakeHangulDocument.created);
  });
});
