'use client';

import { ReferenceHostHydrationGate } from './hydration-gate.js';
import {
  NativeFormHost,
  type NativeFormHostProps,
} from './native-form-host.js';

export interface ReferenceHostAppProps extends NativeFormHostProps {
  /** Host-localized label rendered in the deterministic server shell. */
  loadingLabel: string;
}

/**
 * Minimal buyer-facing application composition for the reference host.
 *
 * The server render is deliberately limited to deterministic host chrome and a
 * hydration placeholder. The real Inkspan native-form integration is created
 * only after client hydration, while authorization and durable persistence stay
 * behind the host-supplied onAuthorizedSubmit callback.
 */
export function ReferenceHostApp({
  loadingLabel,
  onAuthorizedSubmit,
  readOnly = false,
}: ReferenceHostAppProps) {
  return (
    <main aria-labelledby="reference-host-heading">
      <h1 id="reference-host-heading">Inkspan reference host</h1>
      <ReferenceHostHydrationGate
        loadingLabel={loadingLabel}
        renderEditor={() => (
          <NativeFormHost
            onAuthorizedSubmit={onAuthorizedSubmit}
            readOnly={readOnly}
          />
        )}
      />
    </main>
  );
}
