import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(
  new URL('../.github/workflows/ci.yml', import.meta.url),
  'utf8',
);

function browserRunnerBootstrap(): string {
  const start = workflow.indexOf('      - name: Install GNU screen');
  const end = workflow.indexOf('      - name: Setup Node', start);

  if (start < 0 || end < 0) {
    throw new Error('Browser runner bootstrap step not found');
  }

  return workflow.slice(start, end);
}

describe('browser rehearsal runner bootstrap contract', () => {
  it('bypasses the hosted Azure mirror indirection before installing GNU screen', () => {
    const bootstrap = browserRunnerBootstrap();
    const rewrite = bootstrap.indexOf(
      "'s|mirror+file:/etc/apt/apt-mirrors.txt|https://archive.ubuntu.com/ubuntu|g'",
    );
    const update = bootstrap.indexOf('update');

    expect(bootstrap).toContain('/etc/apt/sources.list.d/ubuntu.sources');
    expect(rewrite).toBeGreaterThanOrEqual(0);
    expect(update).toBeGreaterThan(rewrite);
  });

  it('bounds apt networking and retries transient failures', () => {
    const bootstrap = browserRunnerBootstrap();

    expect(bootstrap).toContain('timeout 180s apt-get');
    expect(bootstrap).toContain('Acquire::Retries=3');
    expect(bootstrap).toContain('Acquire::http::Timeout=30');
    expect(bootstrap).toContain('Acquire::https::Timeout=30');
    expect(bootstrap).toContain('install --no-install-recommends -y screen');
  });
});
