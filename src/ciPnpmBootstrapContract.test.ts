import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const workflow = readFileSync(
  resolve(process.cwd(), '.github/workflows/ci.yml'),
  'utf8',
);
const SAFE_PNPM_ACTION_PIN =
  'pnpm/action-setup@0977fd99725f1db4007ccb2928dbb4e90d06cc86 # v6.0.10';
const VULNERABLE_PNPM_ACTION_PIN =
  'pnpm/action-setup@0e279bb959325dab635dd2c09392533439d90093 # v6.0.8';

describe('CI pnpm bootstrap contract', () => {
  it('uses the signed non-vulnerable action in every JavaScript job', () => {
    expect(workflow.match(new RegExp(SAFE_PNPM_ACTION_PIN, 'g'))).toHaveLength(2);
    expect(workflow).not.toContain(VULNERABLE_PNPM_ACTION_PIN);
  });
});
