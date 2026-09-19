"""Declarative target admission; no Docker or production access."""
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
IMAGES = {
    'web': '4700fb3c4e05bebdc4a78d42acb032f6957d58d121d54297d628ad541fe7e801',
    'intake': '9c36d4e76aa99c12ae10b85d8dc22b705c023423b7606d0155f68935552758f5',
    'offer': '5aacae6ef7f96faf1e13f10722548995a4c9aff216c875dd69d0d7f250ad151c',
    'production': '5933baa4308ea8f81759834f003da8e3c22c55662b9414be3c6e86cd8acf6898',
    'exports': '1028446050cc7d31625981700edf6d2695b607ac40bb006eeb3506ca3935cf10',
    'postgres': '778d0b486d6daa02b77434d0358ec57a1b21fd8b6d22ac2eef56a33e816928f6',
    'edge': '5f5c8640aae01df9654968d946d8f1a56c497f1dd5c5cda4cf95ab7c14d58648',
}


class TargetIsolation(unittest.TestCase):
    def test_isolated_target_pins_runtime_and_denies_external_paths(self):
        platform = json.loads((ROOT / 'platform-infra/docker-compose.catering-target.json').read_text())
        edge = json.loads((ROOT / 'edge-infra/docker-compose.catering-target.json').read_text())
        self.assertEqual(platform['name'], 'platform-infra')
        self.assertEqual(edge['name'], 'catering-edge')
        self.assertEqual(set(platform['services']), set(IMAGES) - {'edge'})
        self.assertEqual(set(edge['services']), {'edge'})
        for name, service in {**platform['services'], **edge['services']}.items():
            self.assertEqual(service['image'], 'sha256:' + IMAGES[name])
            self.assertEqual(service['pull_policy'], 'never')
            self.assertNotIn('build', service)
            self.assertFalse(service.get('ports'))
            self.assertFalse(service.get('privileged'))
            self.assertNotIn('network_mode', service)
            self.assertEqual(service['restart'], 'no')
            self.assertIn('no-new-privileges:true', service['security_opt'])
            expected = ['catering_ingress', 'catering_private'] if name == 'web' else (
                ['catering_ingress'] if name == 'edge' else ['catering_private'])
            self.assertEqual(service['networks'], expected)
            for mount in service.get('volumes', []):
                self.assertNotIn('docker.sock', mount)
                self.assertNotIn('shared-edge', mount)
                self.assertNotIn('zeiterfassung', mount)
        self.assertEqual(set(platform['networks']), {'catering_private', 'catering_ingress'})
        for network in platform['networks'].values():
            self.assertTrue(network['internal'])
            self.assertFalse(network['enable_ipv6'])
            self.assertEqual(network['driver_opts']['com.docker.network.bridge.gateway_mode_ipv4'], 'isolated')
        self.assertEqual(edge['networks'], {'catering_ingress': {'external': True, 'name': 'catering_ingress'}})

    def test_sites_are_real_scoped_private_tls_routes(self):
        web = (ROOT / 'platform-infra/target-sites/catering-target.caddy').read_text()
        edge = (ROOT / 'edge-infra/Caddyfile.catering-target').read_text()
        self.assertIn('https://catering-web.invalid:8443', web)
        self.assertIn('import catering_app_routes', web)
        self.assertIn('https://catering-target.invalid:8443', edge)
        for text in (web, edge):
            self.assertIn('tls internal', text)
            self.assertNotIn('zeiterfassung', text)
            self.assertNotIn('eventos', text)
            self.assertNotIn('admin off', text)


if __name__ == '__main__':
    unittest.main()
