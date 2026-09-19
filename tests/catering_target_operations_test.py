"""Contracts for the additive target operations configuration."""
import json
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
PLATFORM_SERVICES = {'postgres', 'intake', 'offer', 'production', 'exports', 'web'}


class TargetOperations(unittest.TestCase):
    def test_platform_override_changes_only_restart_policy(self):
        override = json.loads(
            (ROOT / 'platform-infra/docker-compose.catering-target.operations.json').read_text()
        )
        self.assertEqual(set(override), {'services'})
        self.assertEqual(set(override['services']), PLATFORM_SERVICES)
        for service in override['services'].values():
            self.assertEqual(service, {'restart': 'unless-stopped'})

    def test_edge_override_exposes_only_edge_and_requires_policy_inputs(self):
        override = json.loads(
            (ROOT / 'edge-infra/docker-compose.catering-target.operations.json').read_text()
        )
        self.assertEqual(set(override['services']), {'edge'})
        edge = override['services']['edge']
        self.assertEqual(edge['restart'], 'unless-stopped')
        self.assertEqual(edge['networks'], ['catering_ingress', 'catering_public'])
        self.assertEqual(
            {(port['target'], port['published'], port['protocol'], port['mode']) for port in edge['ports']},
            {(80, '80', 'tcp', 'host'), (443, '443', 'tcp', 'host')},
        )
        required = {
            'CADDY_EMAIL',
            'CATERING_PUBLIC_HOST',
            'CATERING_OPERATOR_SOURCE_IPV4',
            'CATERING_BASIC_AUTH_USER',
            'CATERING_BASIC_AUTH_PASSWORD_HASH',
            'CATERING_WRITER_MODE',
        }
        self.assertEqual(set(edge['environment']), required)
        for value in edge['environment'].values():
            self.assertIn(':?required}', value)
            self.assertNotIn(':-', value)
        self.assertEqual(
            override['networks']['catering_public'],
            {'name': 'catering_public', 'driver': 'bridge', 'enable_ipv6': False},
        )

    def test_final_route_is_fail_closed_and_keeps_fixed_upstream(self):
        route = (ROOT / 'edge-infra/Caddyfile.catering-target.operations').read_text()
        self.assertIn('{$CATERING_PUBLIC_HOST}', route)
        self.assertIn('remote_ip {$CATERING_OPERATOR_SOURCE_IPV4}/32', route)
        self.assertIn('basic_auth', route)
        self.assertIn('method GET HEAD', route)
        self.assertIn('/api/intake/health', route)
        self.assertIn('/api/production/v1/production/cases/*', route)
        self.assertIn('{$CATERING_WRITER_MODE}', route)
        self.assertIn('respond @locked_non_read 423', route)
        self.assertIn('respond @locked_unknown_read 404', route)
        self.assertIn('reverse_proxy http://web:8081', route)
        self.assertNotIn('catering-target.invalid', route)
        self.assertNotIn('tls internal', route)
        self.assertNotIn('CATERING_UPSTREAM', route)

    def test_probe_baselines_remain_non_restarting_and_portless(self):
        platform = json.loads(
            (ROOT / 'platform-infra/docker-compose.catering-target.json').read_text()
        )
        edge = json.loads((ROOT / 'edge-infra/docker-compose.catering-target.json').read_text())
        for service in [*platform['services'].values(), *edge['services'].values()]:
            self.assertEqual(service['restart'], 'no')
            self.assertFalse(service.get('ports'))


if __name__ == '__main__':
    unittest.main()
