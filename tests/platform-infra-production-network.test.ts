import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const base = readFileSync(new URL('../platform-infra/docker-compose.yml', import.meta.url), 'utf8');
const production = (() => {
  try {
    return readFileSync(new URL('../platform-infra/docker-compose.production.yml', import.meta.url), 'utf8');
  } catch {
    return '';
  }
})();

describe('platform production proxy network contract', () => {
  it('keeps the base compose self-contained', () => {
    expect(base).not.toContain('zeiterfassung_default:');
    expect(base).not.toContain('- zeiterfassung_default');
  });

  it('attaches only the production web service to the external zeiterfassung network', () => {
    expect(production).toContain('services:');
    expect(production).toMatch(/web:\s*[\s\S]*networks:\s*[\s\S]*- default\s*[\s\S]*- zeiterfassung_default/);
    expect(production).toContain('zeiterfassung_default:');
    expect(production).toContain('external: true');
    expect(production).toContain('name: zeiterfassung_default');

    const serviceBlocks = production.split(/^  (?=[a-zA-Z0-9_-]+:)/m);
    const crossNetworkBlocks = serviceBlocks.filter((block) => block.includes('- zeiterfassung_default'));
    expect(crossNetworkBlocks).toHaveLength(1);
    expect(crossNetworkBlocks[0]).toMatch(/^web:/);
  });
});
