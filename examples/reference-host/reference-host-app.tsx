import {
  ReferenceHostClient,
  type ReferenceHostClientProps,
} from './reference-host-client.js';

export interface ReferenceHostAppProps extends ReferenceHostClientProps {}

/**
 * Minimal buyer-facing application composition for the reference host.
 *
 * This module is deliberately server-safe: it owns only deterministic host
 * chrome and delegates browser-only hydration/editor behavior to the narrow
 * ReferenceHostClient boundary. Authorization and durable persistence remain
 * behind the host-supplied onAuthorizedSubmit callback.
 */
export function ReferenceHostApp({
  loadingLabel,
  onAuthorizedSubmit,
  controlMode = 'uncontrolled',
  readOnly = false,
}: ReferenceHostAppProps) {
  return (
    <main aria-labelledby="reference-host-heading">
      <h1 id="reference-host-heading">Inkspan reference host</h1>
      <ReferenceHostClient
        loadingLabel={loadingLabel}
        onAuthorizedSubmit={onAuthorizedSubmit}
        controlMode={controlMode}
        readOnly={readOnly}
      />
    </main>
  );
}
