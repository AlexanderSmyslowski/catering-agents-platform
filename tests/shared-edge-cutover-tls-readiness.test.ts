import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const smoke = readFileSync(
  new URL('../edge-infra/scripts/smoke-all.sh', import.meta.url),
  'utf8',
);

describe('shared edge cutover TLS readiness', () => {
  it('retries transient public TLS startup failures without weakening final smoke assertions', () => {
    expect(smoke).toContain('PUBLIC_SMOKE_ATTEMPTS');
    expect(smoke).toContain('for attempt in $(seq 1 "${PUBLIC_SMOKE_ATTEMPTS}")');
    expect(smoke).toContain('sleep 2');
    expect(smoke).toContain('response did not identify a healthy Zeiterfassung endpoint');
    expect(smoke).toContain('All managed public-host smoke checks passed.');
  });
});
