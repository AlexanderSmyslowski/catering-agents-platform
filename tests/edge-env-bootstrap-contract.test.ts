import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(import.meta.dirname, '..');
const workflowPath = path.join(repoRoot, '.github/workflows/deploy-edge-production.yml');
const stagedContent = 'EDGE_BOOTSTRAP_MODE=rehearsal\nEDGE_BOOTSTRAP_SOURCE=contract-test\n';
const operatorContent = 'PROTECTED_OPERATOR_VALUE=unchanged\n';

function workflowHeredoc(source: string, label: string) {
  const markerIndex = source.indexOf(`<<'${label}'`);
  if (markerIndex < 0) return '';
  const bodyStart = source.indexOf('\n', markerIndex) + 1;
  const bodyEnd = source.indexOf(`\n          ${label}`, bodyStart);
  if (bodyEnd < 0) return '';
  const body = source.slice(bodyStart, bodyEnd);
  const indentation = (body.split('\n').find((line) => line.trim()) ?? '').match(/^\s*/)?.[0].length ?? 0;
  return body.split('\n').map((line) => line.slice(Math.min(indentation, line.length))).join('\n');
}

const localSudoScript = [
  '#!/usr/bin/env bash',
  'set -euo pipefail',
  'if [[ "${1:-}" == ln ]]; then',
  '  shift; [[ "${1:-}" == -T ]] && shift; [[ "${1:-}" == -- ]] && shift',
  '  exec node - "$@" <<\'NODE\'',
  'const fs = require("node:fs");',
  'const [source, destination] = process.argv.slice(2);',
  'fs.linkSync(source, destination);',
  'NODE',
  'fi',
  'exec "$@"',
  '',
].join('\n');
const localStatScript = [
  '#!/bin/sh',
  'if [ "$1" = -c ] || [ "$1" = -f ]; then',
  '  format="$2"; target="$3"',
  '  exec node - "$format" "$target" <<\'NODE\'',
  'const fs = require("node:fs");',
  'const [format, target] = process.argv.slice(2);',
  'const s = fs.lstatSync(target);',
  'const mode = (s.mode & 0o7777).toString(8);',
  'const values = { "%a": mode, "%Lp": mode, "%u": String(s.uid), "%g": String(s.gid), "%i": String(s.ino), "%h": String(s.nlink), "%l": String(s.nlink) };',
  'const formats = new Set(["%a", "%a %u %g", "%a %u %g %i %h", "%i", "%Lp", "%Lp %u %g", "%Lp %u %g %i %l"]);',
  'if (!formats.has(format)) process.exit(2);',
  'process.stdout.write(format.split(" ").map((field) => values[field]).join(" ") + "\\n");',
  'NODE',
  'fi',
  'exec /usr/bin/stat "$@"',
  '',
].join('\n');

function conflictSudoScript() {
  return [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    'if [[ "${1:-}" == ln || "${1:-}" == mv ]]; then',
    '  destination="${@: -1}"',
    '  if [[ "${destination}" == "${CATERING_CONFLICT_TARGET:?}" && ! -e "${destination}" && ! -L "${destination}" ]]; then',
    '    case "${CATERING_CONFLICT_KIND:?}" in',
    '      regular) printf "%s" "${CATERING_OPERATOR_CONTENT:?}" > "${destination}"; chmod 0600 "${destination}" ;;',
    '      symlink) ln -s "${CATERING_OPERATOR_FILE:?}" "${destination}" ;;',
    '      symlink-dir) ln -s "${CATERING_OPERATOR_FILE:?}" "${destination}" ;;',
    '      fifo) mkfifo "${destination}" ;;',
    '      none) ;;',
    '      *) exit 97 ;;',
    '    esac',
    '  fi',
    'fi',
    'if [[ "${1:-}" == ln ]]; then',
    '  shift; [[ "${1:-}" == -T ]] && shift; [[ "${1:-}" == -- ]] && shift',
    '  exec node - "$@" <<\'NODE\'',
    'const fs = require("node:fs");',
    'const [source, destination] = process.argv.slice(2);',
    'fs.linkSync(source, destination);',
    'NODE',
    'fi',
    'exec "$@"',
    '',
  ].join('\n');
}

function runRemoteBootstrap(kind: 'none' | 'regular' | 'symlink' | 'symlink-dir' | 'fifo') {
  const root = mkdtempSync(path.join(tmpdir(), 'catering-edge-env-bootstrap-'));
  const edgeRoot = path.join(root, 'shared-edge');
  const stagedPath = path.join(root, 'staged.env');
  const operatorPath = path.join(root, 'operator.env');
  const bin = path.join(root, 'bin');
  const target = path.join(edgeRoot, '.env');
  mkdirSync(edgeRoot, { mode: 0o755 });
  mkdirSync(bin, { recursive: true });
  writeFileSync(stagedPath, stagedContent, { mode: 0o600 });
  if (kind === 'symlink-dir') mkdirSync(operatorPath, { mode: 0o700 });
  else writeFileSync(operatorPath, operatorContent, { mode: 0o600 });
  writeFileSync(
    path.join(edgeRoot, '.env.bootstrap-state'),
    'schema=1\nowner_token=phase3-normal-contract-test\nstate=not_started\nstage=bootstrap\n',
    { mode: 0o600 },
  );
  writeFileSync(path.join(bin, 'sudo'), kind === 'none' ? localSudoScript : conflictSudoScript(), { mode: 0o700 });
  writeFileSync(path.join(bin, 'stat'), localStatScript, { mode: 0o700 });
  chmodSync(path.join(bin, 'sudo'), 0o700);
  chmodSync(path.join(bin, 'stat'), 0o700);
  const body = workflowHeredoc(readFileSync(workflowPath, 'utf8'), 'REMOTE_SCRIPT').replaceAll('/opt/shared-edge', edgeRoot);
  const result = spawnSync('/bin/bash', ['-s', '--', stagedPath, 'phase3-normal-contract-test'], {
    cwd: repoRoot,
    encoding: 'utf8',
    input: body,
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH ?? '/usr/bin:/bin'}`,
      CATERING_CONFLICT_KIND: kind,
      CATERING_CONFLICT_TARGET: target,
      CATERING_OPERATOR_CONTENT: operatorContent,
      CATERING_OPERATOR_FILE: operatorPath,
    },
  });
  return { edgeRoot, operatorPath, stagedPath, target, result };
}

function pendingFiles(edgeRoot: string) {
  return readdirSync(edgeRoot).filter((entry) => entry.startsWith('.env.pending.'));
}

describe('edge env bootstrap safety contract', () => {
  it('executes the actual remote heredoc and uses atomic same-filesystem create-if-absent publication', () => {
    const body = workflowHeredoc(readFileSync(workflowPath, 'utf8'), 'REMOTE_SCRIPT');
    expect(body).toContain('sudo ln -T -- "$pending" "${edge_path}/.env"');
    expect(body).not.toContain('sudo ln -- "$pending" "${edge_path}/.env"');
    expect(body).not.toContain('sudo mv -f "$pending" "${edge_path}/.env"');
    const run = runRemoteBootstrap('none');
    expect(run.result.status).toBe(0);
    expect(readFileSync(run.target, 'utf8')).toBe(stagedContent);
    const liveStat = lstatSync(run.target);
    expect(liveStat.isFile()).toBe(true);
    expect(liveStat.mode & 0o777).toBe(0o600);
    expect(liveStat.uid).toBe(process.getuid?.() ?? liveStat.uid);
    expect(liveStat.gid).toBe(process.getgid?.() ?? liveStat.gid);
    expect(existsSync(run.stagedPath)).toBe(false);
    expect(pendingFiles(run.edgeRoot)).toEqual([]);
    expect(`${run.result.stdout}${run.result.stderr}`).not.toContain(operatorContent);
  });

  it.each(['regular', 'symlink', 'symlink-dir', 'fifo'] as const)(
    'fails closed and preserves a %s target created after the precheck',
    (kind) => {
      const run = runRemoteBootstrap(kind);
      expect(run.result.status).not.toBe(0);
      expect(existsSync(run.stagedPath)).toBe(false);
      expect(pendingFiles(run.edgeRoot)).toEqual([]);
      expect(`${run.result.stdout}${run.result.stderr}`).not.toContain(operatorContent);
      const liveStat = lstatSync(run.target);
      if (kind === 'regular') {
        expect(liveStat.isFile()).toBe(true);
        expect(readFileSync(run.target, 'utf8')).toBe(operatorContent);
      } else if (kind === 'symlink' || kind === 'symlink-dir') {
        expect(liveStat.isSymbolicLink()).toBe(true);
        expect(readlinkSync(run.target)).toBe(run.operatorPath);
        if (kind === 'symlink-dir') expect(readdirSync(run.operatorPath)).toEqual([]);
      } else {
        expect(liveStat.isFIFO()).toBe(true);
      }
    },
  );
});
