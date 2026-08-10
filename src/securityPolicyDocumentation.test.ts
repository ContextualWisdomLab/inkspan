import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryFile = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

describe('security disclosure and vulnerability-handling documentation', () => {
  it('publishes a repository-native private reporting boundary', () => {
    const policy = repositoryFile('SECURITY.md');

    expect(policy).toContain('# Security Policy');
    expect(policy).toContain('## Supported releases');
    expect(policy).toContain('## Reporting a vulnerability');
    expect(policy).toContain('Report a vulnerability');
    expect(policy).toContain('GitHub Security Advisory');
    expect(policy).toContain(
      'Do not include vulnerability details, proof-of-concept payloads, secrets, or customer data in a public issue.',
    );
    expect(policy).toContain(
      'asks for a private security contact without disclosing the vulnerability',
    );
  });

  it('keeps supported release rows bound to published artifacts rather than unreleased manifests', () => {
    const policy = repositoryFile('SECURITY.md');

    expect(policy).toMatch(
      /^\| `@contextualwisdomlab\/cwl-editor` \| latest released `\d+\.\d+\.x` \|/mu,
    );
    expect(policy).toMatch(
      /^\| `inkspan-office` \| latest released `\d+\.\d+\.x` \|/mu,
    );
    expect(policy).toContain(
      'Package manifests and release-candidate changelog headings may move ahead of these public support lines during reviewed release preparation.',
    );
    expect(policy).toContain(
      'Only successful public registry publication and its post-publication verification advance a `latest released` support line.',
    );
    expect(policy).toContain(
      'Unreleased branches and pull requests are development evidence, not supported releases.',
    );
  });

  it('defines support, ownership, evidence, and coordinated-disclosure limits', () => {
    const policy = repositoryFile('SECURITY.md');

    expect(policy).toContain('Unreleased branches and pull requests');
    expect(policy).toContain('host-owned transport');
    expect(policy).toContain('tenant isolation');
    expect(policy).toContain('exact affected version');
    expect(policy).toContain('minimal reproduction');
    expect(policy).toContain('root-cause regression test');
    expect(policy).toContain('exact-head CI');
    expect(policy).toContain('coordinated disclosure');
    expect(policy).toContain('does not promise a response-time SLA');
  });

  it('records current authoritative sources and the non-conformance claim boundary', () => {
    const doctoring = repositoryFile(
      'docs/doctoring/security-disclosure-lifecycle.md',
    );
    const changelog = repositoryFile('CHANGELOG.md');

    expect(doctoring).toContain(
      '# Doctoring record: security disclosure and vulnerability handling',
    );
    expect(doctoring).toContain('ISO/IEC 29147:2018');
    expect(doctoring).toContain('ISO/IEC 30111:2019');
    expect(doctoring).toContain('NIST SP 800-218');
    expect(doctoring).toContain('SSDF Version 1.1');
    expect(doctoring).toContain('Version 1.2 remains a draft');
    expect(doctoring).toContain('GitHub private vulnerability reporting');
    expect(doctoring).toContain('APA 7 references');
    expect(doctoring).toContain(
      'Booth, H., Ogata, M., Kent, K., Souppaya, M., & Dodson, D. (2025).',
    );
    expect(doctoring).toContain('https://doi.org/10.6028/NIST.SP.800-218r1.ipd');
    expect(doctoring).toContain(
      'does not claim ISO certification or complete SSDF conformance',
    );
    expect(changelog).toContain(
      'repository-native security disclosure and vulnerability-handling policy',
    );
  });
});
