#!/usr/bin/env python3
"""Synthetic Compose and Caddy proof for the target operations delta."""
from __future__ import annotations

import base64
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import tempfile
import time


ROOT = Path(__file__).resolve().parents[2]
CADDY_IMAGE = (
    'caddy@sha256:040e9f7480b80b6d4a7e5013a21159b950a63dcbdb956e38abe2387fb28d9ec0'
)
PLATFORM_IMAGES = {
    'postgres': 'sha256:778d0b486d6daa02b77434d0358ec57a1b21fd8b6d22ac2eef56a33e816928f6',
    'intake': 'sha256:9c36d4e76aa99c12ae10b85d8dc22b705c023423b7606d0155f68935552758f5',
    'offer': 'sha256:5aacae6ef7f96faf1e13f10722548995a4c9aff216c875dd69d0d7f250ad151c',
    'production': 'sha256:5933baa4308ea8f81759834f003da8e3c22c55662b9414be3c6e86cd8acf6898',
    'exports': 'sha256:1028446050cc7d31625981700edf6d2695b607ac40bb006eeb3506ca3935cf10',
    'web': 'sha256:4700fb3c4e05bebdc4a78d42acb032f6957d58d121d54297d628ad541fe7e801',
}
EDGE_IMAGE = 'sha256:5f5c8640aae01df9654968d946d8f1a56c497f1dd5c5cda4cf95ab7c14d58648'


def run(
    *args: str,
    env: dict[str, str] | None = None,
    check: bool = True,
    input_text: str | None = None,
) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        args,
        cwd=ROOT,
        env=env,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        input=input_text,
        check=False,
    )
    if check and result.returncode:
        raise RuntimeError(f"command failed ({result.returncode}): {' '.join(args[:3])}\n{result.stdout}")
    return result


def compose_config(base: str, override: str, env: dict[str, str]) -> dict:
    result = run('docker', 'compose', '-f', base, '-f', override, 'config', '--format', 'json', env=env)
    return json.loads(result.stdout)


def assert_compose_contract(env: dict[str, str]) -> None:
    platform = compose_config(
        'platform-infra/docker-compose.catering-target.json',
        'platform-infra/docker-compose.catering-target.operations.json',
        env,
    )
    edge = compose_config(
        'edge-infra/docker-compose.catering-target.json',
        'edge-infra/docker-compose.catering-target.operations.json',
        env,
    )

    if set(platform['services']) != set(PLATFORM_IMAGES):
        raise AssertionError('final platform render changed the service set')
    for name, expected_image in PLATFORM_IMAGES.items():
        service = platform['services'][name]
        if service['image'] != expected_image or service['restart'] != 'unless-stopped':
            raise AssertionError(f'final platform identity/restart mismatch: {name}')
        if service.get('ports'):
            raise AssertionError(f'final platform service gained host ports: {name}')
    if platform['services']['postgres']['environment']['POSTGRES_DB'] != 'catering_agents':
        raise AssertionError('final database binding is not catering_agents')
    if 'catering_operator_probe_20260919' in json.dumps(platform, sort_keys=True):
        raise AssertionError('operator test database leaked into final render')
    if set(platform['services']['web']['networks']) != {'catering_ingress', 'catering_private'}:
        raise AssertionError('final web network boundary changed')
    for name in {'postgres', 'intake', 'offer', 'production', 'exports'}:
        if set(platform['services'][name]['networks']) != {'catering_private'}:
            raise AssertionError(f'private service network boundary changed: {name}')
    for name in {'catering_ingress', 'catering_private'}:
        network = platform['networks'][name]
        if not network['internal'] or network['enable_ipv6']:
            raise AssertionError(f'private network boundary changed: {name}')

    if set(edge['services']) != {'edge'}:
        raise AssertionError('final edge render changed the service set')
    edge_service = edge['services']['edge']
    if edge_service['image'] != EDGE_IMAGE or edge_service['restart'] != 'unless-stopped':
        raise AssertionError('final edge identity/restart mismatch')
    if set(edge_service['networks']) != {'catering_ingress', 'catering_public'}:
        raise AssertionError('final edge network boundary mismatch')
    ports = {
        (entry['target'], str(entry['published']), entry['protocol'], entry.get('mode', 'ingress'))
        for entry in edge_service['ports']
    }
    if ports != {(80, '80', 'tcp', 'host'), (443, '443', 'tcp', 'host')}:
        raise AssertionError(f'final edge ports are not exactly 80/443: {sorted(ports)}')
    if edge['networks']['catering_public'].get('internal') is True:
        raise AssertionError('public edge bridge rendered as internal')
    if edge['networks']['catering_public']['enable_ipv6']:
        raise AssertionError('public edge bridge unexpectedly enables IPv6')
    caddy_mounts = [
        mount for mount in edge_service['volumes']
        if mount['target'] == '/etc/caddy/Caddyfile'
    ]
    if len(caddy_mounts) != 1:
        raise AssertionError('final edge has an ambiguous Caddyfile mount')
    caddy_mount = caddy_mounts[0]
    if (
        caddy_mount.get('type') != 'bind'
        or caddy_mount.get('source') != '/opt/catering-edge/Caddyfile'
        or caddy_mount.get('read_only') is not True
    ):
        raise AssertionError('final edge lost the protected Caddyfile mount')

    for variable in {
        'CADDY_EMAIL',
        'CATERING_PUBLIC_HOST',
        'CATERING_OPERATOR_SOURCE_IPV4',
        'CATERING_BASIC_AUTH_USER',
        'CATERING_BASIC_AUTH_PASSWORD_HASH',
        'CATERING_WRITER_MODE',
    }:
        missing = env.copy()
        missing.pop(variable)
        result = run(
            'docker', 'compose',
            '-f', 'edge-infra/docker-compose.catering-target.json',
            '-f', 'edge-infra/docker-compose.catering-target.operations.json',
            'config', '--format', 'json',
            env=missing,
            check=False,
        )
        if result.returncode == 0:
            raise AssertionError(f'edge Compose accepted missing required input: {variable}')


def caddy_env(
    password_hash: str,
    writer_mode: str,
    source: str,
    public_host: str = 'catering-operations.example.invalid',
) -> dict[str, str]:
    env = os.environ.copy()
    env.update(
        {
            'CADDY_EMAIL': 'operations-test@example.invalid',
            'CATERING_PUBLIC_HOST': public_host,
            'CATERING_OPERATOR_SOURCE_IPV4': source,
            'CATERING_BASIC_AUTH_USER': 'operator-fixture',
            'CATERING_BASIC_AUTH_PASSWORD_HASH': password_hash,
            'CATERING_WRITER_MODE': writer_mode,
            'POSTGRES_PASSWORD': 'synthetic-only',
            'CATERING_DEFAULT_BUSINESS_ID': 'synthetic-business',
            'CATERING_TRUSTED_ACTOR_SECRET': 'synthetic-only',
        }
    )
    return env


def caddy_validate(env: dict[str, str], expected_success: bool) -> None:
    command = [
        'docker', 'run', '--rm', '--entrypoint', 'caddy',
        '--volume', f'{ROOT / "edge-infra/Caddyfile.catering-target.operations"}:/etc/caddy/Caddyfile:ro',
    ]
    for name in (
        'CADDY_EMAIL', 'CATERING_PUBLIC_HOST', 'CATERING_OPERATOR_SOURCE_IPV4',
        'CATERING_BASIC_AUTH_USER', 'CATERING_BASIC_AUTH_PASSWORD_HASH', 'CATERING_WRITER_MODE',
    ):
        if name in env:
            command.extend(['--env', name])
    command.extend([CADDY_IMAGE, 'validate', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile'])
    result = run(*command, env=env, check=False)
    if (result.returncode == 0) != expected_success:
        raise AssertionError(f'unexpected Caddy validation result: {result.returncode}\n{result.stdout}')


def http_request(
    client: str,
    method: str,
    authorization: str | None = None,
    path: str = '/api/intake/health',
) -> tuple[int, str]:
    headers = ['Host: catering-operations.example.invalid', 'Connection: close']
    if authorization:
        headers.append(f'Authorization: Basic {authorization}')
    request = '\r\n'.join([f'{method} {path} HTTP/1.1', *headers, '', ''])
    result = run(
        'docker', 'exec', '--interactive', client, 'nc', '-w', '4', 'edge', '80',
        check=False,
        input_text=request,
    )
    match = re.search(r'^HTTP/1\.[01] (\d{3})', result.stdout, re.MULTILINE)
    if not match:
        raise AssertionError(f'client did not receive an HTTP response for {method}: {result.stdout}')
    return int(match.group(1)), result.stdout


def wait_for_http(client: str, authorization: str) -> None:
    last_error = 'no request attempted'
    for _ in range(40):
        try:
            status, _ = http_request(client, 'GET', authorization)
            if status == 200:
                return
            last_error = f'HTTP {status}'
        except AssertionError as error:
            last_error = str(error)
        time.sleep(0.25)
    raise AssertionError(f'edge/backend did not become ready: {last_error}')


def run_edge(
    name: str,
    ingress: str,
    public: str,
    env: dict[str, str],
    caddyfile: Path,
) -> None:
    command = [
        'docker', 'run', '--detach', '--name', name, '--network', ingress,
        '--volume', f'{caddyfile}:/etc/caddy/Caddyfile:ro',
    ]
    for variable in (
        'CADDY_EMAIL', 'CATERING_PUBLIC_HOST', 'CATERING_OPERATOR_SOURCE_IPV4',
        'CATERING_BASIC_AUTH_USER', 'CATERING_BASIC_AUTH_PASSWORD_HASH', 'CATERING_WRITER_MODE',
    ):
        command.extend(['--env', variable])
    command.append(CADDY_IMAGE)
    run(*command, env=env)
    run('docker', 'network', 'connect', '--alias', 'edge', public, name)


def assert_caddy_runtime() -> None:
    suffix = secrets.token_hex(5)
    ingress = f'catering-ops-ingress-{suffix}'
    public = f'catering-ops-public-{suffix}'
    backend = f'catering-ops-web-{suffix}'
    allowed = f'catering-ops-allowed-{suffix}'
    denied = f'catering-ops-denied-{suffix}'
    edge = f'catering-ops-edge-{suffix}'
    containers = [edge, denied, allowed, backend]
    networks = [public, ingress]
    try:
        run('docker', 'network', 'create', ingress)
        run('docker', 'network', 'create', public)
        with tempfile.TemporaryDirectory(prefix='catering-ops-') as temp_dir:
            backend_config = Path(temp_dir) / 'Caddyfile'
            backend_config.write_text('{\n\tauto_https off\n}\n:8081 {\n\trespond "upstream-reached" 200\n}\n')
            final_route = (ROOT / 'edge-infra/Caddyfile.catering-target.operations').read_text()
            site_marker = '{$CATERING_PUBLIC_HOST} {'
            if final_route.count(site_marker) != 1:
                raise AssertionError('final Caddy route has an ambiguous site address')
            runtime_route = Path(temp_dir) / 'Caddyfile.edge-http-fixture'
            runtime_route.write_text(final_route.replace(site_marker, f'http://{site_marker}', 1))
            run(
                'docker', 'run', '--detach', '--name', backend, '--network', ingress,
                '--network-alias', 'web', '--volume', f'{backend_config}:/etc/caddy/Caddyfile:ro',
                CADDY_IMAGE,
            )
            run(
                'docker', 'run', '--detach', '--name', allowed, '--network', public,
                '--entrypoint', 'sleep', CADDY_IMAGE, '300',
            )
            run(
                'docker', 'run', '--detach', '--name', denied, '--network', public,
                '--entrypoint', 'sleep', CADDY_IMAGE, '300',
            )
            allowed_ip = json.loads(run('docker', 'inspect', allowed).stdout)[0]['NetworkSettings']['Networks'][public]['IPAddress']
            password_hash = run(
                'docker', 'run', '--rm', '--entrypoint', 'caddy', CADDY_IMAGE,
                'hash-password', '--plaintext', 'synthetic-password',
            ).stdout.strip()
            authorization = base64.b64encode(b'operator-fixture:synthetic-password').decode()

            locked_env = caddy_env(password_hash, 'locked', allowed_ip)
            run_edge(edge, ingress, public, locked_env, runtime_route)
            wait_for_http(allowed, authorization)
            status, _ = http_request(denied, 'GET', authorization)
            if status != 403:
                raise AssertionError(f'outside source was not denied: {status}')
            for supplied_auth in (None, base64.b64encode(b'operator-fixture:wrong').decode()):
                status, _ = http_request(allowed, 'GET', supplied_auth)
                if status != 401:
                    raise AssertionError(f'unauthenticated request was not challenged: {status}')
            for method in ('GET', 'HEAD'):
                status, _ = http_request(allowed, method, authorization)
                if status != 200:
                    raise AssertionError(f'allowed read did not reach upstream: {method} {status}')
            status, _ = http_request(allowed, 'GET', authorization, '/unapproved-read')
            if status != 404:
                raise AssertionError(f'unlisted read was not rejected before upstream: {status}')
            for method in ('POST', 'PUT', 'PATCH', 'DELETE'):
                status, _ = http_request(allowed, method, authorization)
                if status != 423:
                    raise AssertionError(f'locked write was not rejected before upstream: {method} {status}')

            run('docker', 'container', 'rm', '--force', '--volumes', edge)
            enabled_env = caddy_env(password_hash, 'enabled', allowed_ip)
            run_edge(edge, ingress, public, enabled_env, runtime_route)
            wait_for_http(allowed, authorization)
            status, _ = http_request(allowed, 'POST', authorization)
            if status != 200:
                raise AssertionError(f'explicit writer enable did not reach upstream: {status}')

            run('docker', 'container', 'rm', '--force', '--volumes', edge)
            run_edge(edge, ingress, public, locked_env, runtime_route)
            wait_for_http(allowed, authorization)
            status, _ = http_request(allowed, 'POST', authorization)
            if status != 423:
                raise AssertionError(f'writer rollback did not restore the lock: {status}')

            run('docker', 'container', 'rm', '--force', '--volumes', edge)
            invalid_env = caddy_env(password_hash, 'missing-*.caddy', allowed_ip)
            run_edge(edge, ingress, public, invalid_env, runtime_route)
            wait_for_http(allowed, authorization)
            status, _ = http_request(allowed, 'POST', authorization)
            if status != 423:
                raise AssertionError(f'invalid writer mode did not remain locked: {status}')
    finally:
        for container in containers:
            run('docker', 'container', 'rm', '--force', '--volumes', container, check=False)
        for network in networks:
            run('docker', 'network', 'rm', network, check=False)


def main() -> None:
    run('docker', 'pull', CADDY_IMAGE)
    version = run('docker', 'run', '--rm', '--entrypoint', 'caddy', CADDY_IMAGE, 'version').stdout.strip()
    if not version.startswith('v2.11.4'):
        raise AssertionError(f'unexpected Caddy test version: {version}')
    password_hash = run(
        'docker', 'run', '--rm', '--entrypoint', 'caddy', CADDY_IMAGE,
        'hash-password', '--plaintext', 'synthetic-password',
    ).stdout.strip()
    locked_env = caddy_env(password_hash, 'locked', '192.0.2.25')
    assert_compose_contract(locked_env)
    caddy_validate(locked_env, expected_success=True)
    missing_host = locked_env.copy()
    missing_host.pop('CATERING_PUBLIC_HOST')
    caddy_validate(missing_host, expected_success=False)
    caddy_validate(caddy_env(password_hash, 'missing-*.caddy', '192.0.2.25'), expected_success=True)
    caddy_validate(caddy_env(password_hash, 'locked', '0.0.0.0/0'), expected_success=False)
    assert_caddy_runtime()
    print('target operations compose and Caddy proof: PASS')


if __name__ == '__main__':
    main()
