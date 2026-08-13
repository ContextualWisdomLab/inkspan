import {
  createRhwpHangulEngine,
  type HangulEngineDocument,
} from './index.js';

class FakeRhwpDocument implements HangulEngineDocument {
  static created = new FakeRhwpDocument(new Uint8Array());
  readonly source: Uint8Array;

  constructor(source: Uint8Array) {
    this.source = source;
  }

  static createEmpty(): FakeRhwpDocument {
    return FakeRhwpDocument.created;
  }

  getSourceFormat(): string { return 'hwpx'; }
  getSectionCount(): number { return 0; }
  getParagraphCount(): number { return 0; }
  getParagraphLength(): number { return 0; }
  exportSelectionHtml(): string { return '';
  }
  deleteText(): string { return '{"ok":true}'; }
  pasteHtml(): string { return '{"ok":true}'; }
  exportHwp(): Uint8Array { return new Uint8Array(); }
  exportHwpx(): Uint8Array { return new Uint8Array(); }
}

describe('RHWP engine adapter', () => {
  it('adapts @rhwp/core without making it a hard runtime dependency', async () => {
    const engine = createRhwpHangulEngine({ HwpDocument: FakeRhwpDocument });
    const bytes = new Uint8Array([1, 2, 3]);

    expect(engine.id).toBe('@rhwp/core');
    const opened = await engine.open(bytes);
    expect(opened).toBeInstanceOf(FakeRhwpDocument);
    expect((opened as FakeRhwpDocument).source).toBe(bytes);
    expect(await engine.create()).toBe(FakeRhwpDocument.created);
  });
});
