import '@testing-library/jest-dom/vitest';
import { realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';

// macOS exposes its system temp directory through /var -> /private/var. Give
// child-process path guards the canonical platform path so they can still
// reject symlinks created inside the test boundary.
process.env.TMPDIR = realpathSync(tmpdir());

// jsdom does not implement canvas; the downscale path falls back gracefully,
// but stubbing getContext keeps any accidental calls from throwing.
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext =
    HTMLCanvasElement.prototype.getContext ||
    (() => null as unknown as CanvasRenderingContext2D);
}

// ProseMirror scrollToSelection / coordsAtPos call getClientRects on DOM
// ranges. jsdom's implementation is incomplete and throws under table
// mutations (insert/delete). Provide a zero-rect stub so commercial toolbar
// table ops exercise the real command path without crashing the suite.
const emptyRect = (): DOMRect =>
  ({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    toJSON: () => ({}),
  }) as DOMRect;

const emptyRectList = (): DOMRectList =>
  ({
    length: 0,
    item: () => null,
    [Symbol.iterator]: function* () {},
  }) as DOMRectList;

if (typeof Range !== 'undefined') {
  Range.prototype.getClientRects = emptyRectList;
  Range.prototype.getBoundingClientRect = emptyRect;
}
if (typeof Element !== 'undefined') {
  Element.prototype.getClientRects = emptyRectList;
  // Keep real getBoundingClientRect if present; only fill when missing.
  if (typeof Element.prototype.getBoundingClientRect !== 'function') {
    Element.prototype.getBoundingClientRect = emptyRect;
  }
}
