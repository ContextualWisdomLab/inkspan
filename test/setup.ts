import '@testing-library/jest-dom/vitest';

// jsdom does not implement canvas; the downscale path falls back gracefully,
// but stubbing getContext keeps any accidental calls from throwing.
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext =
    HTMLCanvasElement.prototype.getContext ||
    (() => null as unknown as CanvasRenderingContext2D);
}
