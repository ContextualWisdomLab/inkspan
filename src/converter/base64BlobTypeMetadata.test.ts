import { describe, expect, it } from 'vitest';
import { blobToDataUri } from './base64.js';

describe('blobToDataUri platform MIME metadata authority', () => {
  it('does not evaluate a caller-overridden Blob type accessor', async () => {
    let typeAccessorRead = false;

    class CallerControlledTypeBlob extends Blob {
      override get type(): string {
        typeAccessorRead = true;
        return 'application/x-caller-controlled';
      }
    }

    const blob = new CallerControlledTypeBlob(
      [new Uint8Array([1, 2, 3])],
      { type: 'application/octet-stream' },
    );

    const uri = await blobToDataUri(blob);

    expect(typeAccessorRead).toBe(false);
    expect(uri).toBe('data:application/octet-stream;base64,AQID');
  });
});
