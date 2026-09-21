"""Read-only regression of the real startup guard; no product services are started."""
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time
import unittest

SOURCE = Path(__file__).resolve().parents[1] / "scripts" / "start-local-stack.sh"


class ProcessSnapshotTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="catering-process-snapshot-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        source = SOURCE.read_text(encoding="utf-8")
        match = re.search(r"^production_writer_is_quiescent\(\) \{\n.*?^\}\n", source, re.M | re.S)
        self.assertIsNotNone(match, "The actual startup guard must be exercised")
        shim = self.root / "bin"
        shim.mkdir()
        ps = shim / "ps"
        ps.write_text("#!" + sys.executable + "\n" + """
import os, subprocess, sys, time
mode = os.environ['SNAPSHOT_PS_MODE']
if mode == 'error': sys.exit(2)
if mode == 'empty': sys.exit(0)
# Force the old pipeline's matcher to be present when real ps samples it.
# No fabricated process table: stdout is exactly the platform's ps output.
time.sleep(0.1)
result = subprocess.run(['/bin/ps', *sys.argv[1:]], capture_output=True)
sys.stdout.buffer.write(result.stdout)
sys.stderr.buffer.write(result.stderr)
sys.exit(result.returncode)
""", encoding="utf-8")
        ps.chmod(0o755)
        self.runner = self.root / "guard.sh"
        self.runner.write_text("""#!/bin/bash
set -euo pipefail
ROOT_DIR="$SNAPSHOT_ROOT"
STACK_NAMESPACE=snapshot-test
screen_session_exists() { [[ "$1" == "${SNAPSHOT_SCREEN:-none}" ]]; }
local_port_is_bound() { [[ "${SNAPSHOT_BOUND:-0}" == "1" ]]; }
uname() { printf '%s\\n' Linux; }
""" + match.group(0) + "\nif production_writer_is_quiescent; then exit 0; else exit 1; fi\n", encoding="utf-8")
        self.env = {**os.environ, "PATH": str(shim) + os.pathsep + os.environ.get("PATH", ""),
                    "SNAPSHOT_ROOT": str(self.root), "SNAPSHOT_PS_MODE": "real",
                    "SNAPSHOT_SCREEN": "none", "SNAPSHOT_BOUND": "0"}

    def run_guard(self, **env):
        result = subprocess.run(["/bin/bash", str(self.runner)], env={**self.env, **env},
                                capture_output=True, text=True, timeout=5)
        return result.returncode, result.stderr

    def start_dummy(self, production=True):
        # Only this owned sleeping child is ever stopped; it has no open sockets or product data.
        name = "production-service/src/server.ts" if production else "unrelated-worker.ts"
        child = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(20)",
                                  str(self.root / "node_modules" / "tsx" / "cli.mjs"), name],
                                 stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        def stop():
            if child.poll() is None:
                child.terminate()
            child.wait(timeout=5)
        self.addCleanup(stop)
        time.sleep(0.03)
        self.assertIsNone(child.poll())

    def test_empty_control(self):
        self.assertEqual(self.run_guard(SNAPSHOT_PS_MODE="empty"), (0, ""))

    def test_matcher_does_not_detect_itself(self):
        self.assertEqual(self.run_guard(), (0, ""))

    def test_real_matching_process_still_blocks(self):
        self.start_dummy()
        status, message = self.run_guard()
        self.assertEqual(status, 1)
        self.assertIn("Production-Prozess", message)

    def test_unrelated_process_does_not_block(self):
        self.start_dummy(production=False)
        self.assertEqual(self.run_guard(), (0, ""))

    def test_failed_process_inspection_is_closed(self):
        self.assertEqual(self.run_guard(SNAPSHOT_PS_MODE="error")[0], 1)

    def test_legacy_screen_still_blocks(self):
        status, message = self.run_guard(SNAPSHOT_SCREEN="catering-production")
        self.assertEqual(status, 1)
        self.assertIn("screen-Sitzung", message)

    def test_owned_screen_still_blocks(self):
        status, message = self.run_guard(SNAPSHOT_SCREEN="snapshot-test-production")
        self.assertEqual(status, 1)
        self.assertIn("screen-Sitzung", message)

    def test_bound_port_still_blocks(self):
        status, message = self.run_guard(SNAPSHOT_PS_MODE="empty", SNAPSHOT_BOUND="1")
        self.assertEqual(status, 1)
        self.assertIn("Port 3103", message)


if __name__ == "__main__":
    unittest.main(verbosity=2)
