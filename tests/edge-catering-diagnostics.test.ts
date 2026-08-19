import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const deploy = readFileSync(
  new URL('../edge-infra/scripts/deploy-hetzner.sh', import.meta.url),
  'utf8',
);
const diagnosticPath = fileURLToPath(
  new URL('../edge-infra/scripts/diagnose-catering-identity.sh', import.meta.url),
);
const sandboxes: string[] = [];

afterEach(() => {
  for (const sandbox of sandboxes.splice(0)) {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

function readDiagnostic(): string {
  expect(existsSync(diagnosticPath)).toBe(true);
  return readFileSync(diagnosticPath, 'utf8');
}

describe('edge Catering identity diagnostics', () => {
  it('collects candidate, direct upstream and Docker-alias evidence only after exact identity validation fails', () => {
    const diagnostic = readDiagnostic();
    const probeStart = deploy.indexOf('probe_catering_json() {');
    const probeEnd = deploy.indexOf('\n}\nprobe_ok_json "Rehearsal Zeiterfassung"', probeStart);
    const probe = deploy.slice(probeStart, probeEnd);

    expect(probeStart).toBeGreaterThanOrEqual(0);
    expect(probeEnd).toBeGreaterThan(probeStart);
    expect(probe).toContain('payload.get("status") != "ok"');
    expect(probe).toContain('payload.get("service") != "intake-service"');
    expect(probe).toContain("--write-out $'%{http_code}\\t%{content_type}'");
    expect(probe).toContain('scripts/diagnose-catering-identity.sh');

    const exactIdentityCheck = probe.indexOf('payload.get("service") != "intake-service"');
    const diagnosticCall = probe.indexOf('scripts/diagnose-catering-identity.sh');
    const failedReturn = probe.indexOf('return 1', diagnosticCall);
    expect(diagnosticCall).toBeGreaterThan(exactIdentityCheck);
    expect(failedReturn).toBeGreaterThan(diagnosticCall);

    expect(diagnostic).toContain(
      'BODY_PREVIEW_LIMIT="${CATERING_DIAGNOSTIC_BODY_PREVIEW_LIMIT:-800}"',
    );
    expect(diagnostic).toContain('http://web:8081/api/intake/health');
    expect(diagnostic).not.toContain('http://web:80/api/intake/health');
    expect(diagnostic).toContain('http://intake:3101/health');
    expect(diagnostic).toContain('network inspect "${NETWORK_NAME}"');
    expect(diagnostic).toContain('com.docker.compose.project=shared-edge');
    expect(diagnostic).toContain('com.docker.compose.service=edge');
    expect(diagnostic).toContain('Catering diagnostic effective edge upstream:');
    expect(diagnostic).toContain('CATERING_UPSTREAM');
    expect(diagnostic).toContain('for alias in ("web", "intake"):');
    expect(diagnostic).toContain('Catering diagnostic alias {alias} owners:');
    expect(diagnostic).not.toContain('.Config.Env');
    expect(diagnostic).not.toContain('printenv');
    expect(diagnostic).not.toMatch(/\bset\s+-x\b/);
    expect(diagnostic).not.toMatch(
      /(?:echo|printf)[^\n]*(?:CATERING_SMOKE_BASIC_AUTH_USER|CATERING_SMOKE_BASIC_AUTH_PASSWORD|CATERING_DIAGNOSTIC_AUTH_B64)/,
    );
  });

  it('redacts credentials before applying the bounded candidate body preview', () => {
    readDiagnostic();
    const sandbox = mkdtempSync(join(tmpdir(), 'edge-catering-diagnostic-'));
    sandboxes.push(sandbox);
    const bodyPath = join(sandbox, 'candidate-body.txt');
    const user = 'probe-user';
    const password = 'super-secret-password';
    writeFileSync(
      bodyPath,
      `prefix user=${user} ${'x'.repeat(763)} password=${password} TAIL-SHOULD-NOT-APPEAR`,
    );

    const result = spawnSync(
      'bash',
      [
        diagnosticPath,
        'catering.the-one.catering',
        '200',
        'text/html; charset=utf-8',
        bodyPath,
      ],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          DOCKER_BIN: '/bin/false',
          CATERING_SMOKE_BASIC_AUTH_USER: user,
          CATERING_SMOKE_BASIC_AUTH_PASSWORD: password,
          CATERING_DIAGNOSTIC_BODY_PREVIEW_LIMIT: '800',
        },
      },
    );
    const output = `${result.stdout}${result.stderr}`;

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(output).toContain(
      'Catering diagnostic candidate: status=200 content-type=text/html; charset=utf-8',
    );
    expect(output).toContain(
      'Catering diagnostic candidate body-preview (max 800 bytes):',
    );
    expect(output).toContain('[REDACTED]');
    expect(output).not.toContain(user);
    expect(output).not.toContain(password);
    expect(output).not.toContain(password.slice(0, 4));
    expect(output).not.toContain('TAIL-SHOULD-NOT-APPEAR');
  });
});
