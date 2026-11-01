"""Scope regressions run before selection, including against real Git history."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
import re
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("ci_scope", ROOT / "scripts/ci-test-scope.py")
scope = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(scope)
OPERATOR = "platform-infra/scripts/catering_target_nue_image_update.py"


class ScopeTests(unittest.TestCase):
    def test_product_scope_keeps_application_security_and_data_tests(self):
        changes = [("M", "backoffice-ui/src/App.tsx"),
                   ("M", "shared-core/src/rules/scaling.ts"),
                   ("M", "production-service/src/routes/recipe-routes.ts"),
                   ("A", "tests/recipe-photo-review.test.tsx"),
                   ("M", "scripts/browser-rehearsal/open-offer-history-item.js"),
                   ("M", "memory.md")]
        self.assertTrue(scope.product_only(changes))
        command = scope.regression_command("product")
        self.assertEqual(command[:4], ["npx", "--no-install", "vitest", "run"])
        self.assertEqual(command[4::2], ["--exclude"] * len(scope.MIGRATION_TEST_FILES))
        self.assertEqual(set(command[5::2]), set(scope.MIGRATION_TEST_FILES))
        self.assertNotIn("--passWithNoTests", command)

    def test_product_scope_requires_a_product_change(self):
        self.assertFalse(scope.product_only([]))
        self.assertFalse(scope.product_only([("M", "memory.md")]))

    def test_infrastructure_config_helpers_and_unknown_changes_require_full(self):
        for path in [OPERATOR, ".github/workflows/ci.yml", "scripts/ci-test-scope.py",
                     "tests/ci_test_scope_test.py", "package.json", "package-lock.json",
                     "vitest.config.ts", "tests/setup-react-act.ts", "AGENTS.md", "TESTING.md",
                     "docs/operations/CATERING_BACKUP_RESTORE.md",
                     "tests/phase3-latest-p1-review-helpers.ts",
                     "tests/catering-backup-collector-fixture.ts", "unknown.ts",
                     "scripts/check-browser-rehearsal.sh", "tests/fixtures/unknown.ts"]:
            with self.subTest(path=path):
                self.assertFalse(scope.product_only([("M", "backoffice-ui/src/App.tsx"), ("M", path)]))
        for path in scope.MIGRATION_TEST_FILES:
            self.assertTrue((ROOT / path).is_file())
            self.assertFalse(scope.product_only([("M", "backoffice-ui/src/App.tsx"), ("M", path)]))

    def test_only_modified_or_added_product_files_can_select_product(self):
        for status in ["D", "R100", "T", "U", "?"]:
            self.assertFalse(scope.product_only([(status, "backoffice-ui/src/App.tsx")]))
        for path in ["backoffice-ui/package.json", "backoffice-ui/src/../package.json",
                     "scripts/browser-rehearsal/nested/unknown.js", "tests/nested/unknown.test.ts"]:
            self.assertFalse(scope.product_only([("M", path)]))

    def test_full_command_is_unchanged_and_unknown_scope_cannot_run_tests(self):
        self.assertEqual(scope.regression_command("full"), ["npm", "test"])
        for value in ["", "operator", "unknown", "product --passWithNoTests"]:
            with self.assertRaises(ValueError):
                scope.regression_command(value)

    def test_omitted_contracts_keep_the_reviewed_infrastructure_dependency_boundary(self):
        helpers = {"tests/phase3-latest-p1-review-helpers.ts", "tests/catering-backup-collector-fixture.ts"}
        for name in [*scope.MIGRATION_TEST_FILES, *helpers]:
            source = (ROOT / name).read_text()
            with self.subTest(file=name):
                self.assertNotIn("@catering/", source)
                self.assertNotRegex(source, r"(?:backoffice-ui|shared-core|intake-service|offer-service|production-service|print-export)/src")
                for module in re.findall(r'''\bfrom\s+["'](\.[^"']+)["']''', source):
                    resolved = (ROOT / name).parent / module.replace(".js", ".ts")
                    self.assertIn(resolved.resolve().relative_to(ROOT).as_posix(), helpers)

    def test_every_allowed_operator_file_has_a_scoped_path(self):
        for path in scope.OPERATOR_FILES:
            with self.subTest(path=path):
                self.assertTrue((ROOT / path).is_file())
                self.assertTrue(scope.operator_only([("M", path)]))

    def test_companion_documents_require_an_operator_change(self):
        for path in scope.COMPANION_DOCS:
            self.assertFalse(scope.operator_only([("M", path)]))
            self.assertTrue(scope.operator_only([("M", OPERATOR), ("M", path)]))

    def test_product_policy_dependencies_and_unknown_files_require_full(self):
        for path in ["backoffice-ui/src/App.tsx", "shared-core/src/auth.ts", "package.json",
                     "package-lock.json", "vitest.config.ts", "tests/setup-react-act.ts",
                     ".github/workflows/ci.yml", "scripts/ci-test-scope.py", "tests/ci_test_scope_test.py",
                     "AGENTS.md", "TESTING.md", "platform-infra/Dockerfile", "unknown.py",
                     "platform-infra/scripts/catering-target-production-update.sh",
                     "platform-infra/scripts/catering-target-authenticated-smoke.mjs"]:
            with self.subTest(path=path):
                self.assertFalse(scope.operator_only([("M", OPERATOR), ("M", path)]))

    def test_empty_added_deleted_renamed_and_type_changed_are_full(self):
        self.assertFalse(scope.operator_only([]))
        for status in ["A", "D", "R100", "T", "U"]:
            self.assertFalse(scope.operator_only([(status, OPERATOR)]))

    def test_malformed_or_incomplete_diff_is_not_accepted(self):
        for raw in [b"M\0path", b"M\0", b"M\0\xff\0"]:
            with patch.object(scope, "git", return_value=raw), self.assertRaises(ValueError):
                scope.changes_between("base", "head")

    def test_missing_event_defaults_to_full_and_publishes_summary(self):
        with tempfile.TemporaryDirectory() as tmp:
            out, summary = Path(tmp) / "output", Path(tmp) / "summary"
            with patch.dict(os.environ, {"GITHUB_EVENT_PATH": tmp + "/absent",
                                         "GITHUB_OUTPUT": str(out), "GITHUB_STEP_SUMMARY": str(summary)}, clear=True):
                scope.main()
            self.assertEqual(out.read_text(), "scope=full\n")
            self.assertIn("Test scope: full", summary.read_text())


class GitBindingTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.previous = Path.cwd()
        os.chdir(self.root)
        self.addCleanup(os.chdir, self.previous)
        self.run_git("init", "-q", "-b", "main")
        self.run_git("config", "user.email", "test@example.invalid")
        self.run_git("config", "user.name", "CI scope fixture")
        self.write(OPERATOR, "original")
        self.write("app.ts", "app")
        self.base = self.save("base")
        self.write(OPERATOR, "operator fix")
        self.head = self.save("operator change")

    def run_git(self, *args):
        return subprocess.check_output(["git", *args], stderr=subprocess.DEVNULL).decode().strip()

    def write(self, name, value):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(value)

    def save(self, message):
        self.run_git("add", ".")
        self.run_git("commit", "-qm", message)
        return self.run_git("rev-parse", "HEAD")

    def push_event(self):
        return {"before": self.base, "after": self.head, "forced": False,
                "deleted": False, "ref": "refs/heads/main"}

    def classify_push(self, event=None, sha=None, ref="refs/heads/main"):
        return scope.select_scope("push", event or self.push_event(), sha or self.head, ref)[0]

    def test_normal_push_is_operator_but_mixed_product_change_is_full(self):
        self.assertEqual(self.classify_push(), "operator")
        self.write("app.ts", "product change")
        self.head = self.save("mixed")
        self.assertEqual(self.classify_push(), "full")

    def test_actual_pr_merge_is_checked_and_stale_parent_binding_is_full(self):
        self.run_git("switch", "-qc", "pr", self.head)
        self.run_git("switch", "-qc", "merge-base", self.base)
        self.run_git("merge", "--no-ff", "-qm", "test merge", "pr")
        merged = self.run_git("rev-parse", "HEAD")
        event = {"pull_request": {"base": {"ref": "main", "sha": self.base},
                                  "head": {"sha": self.head}}}
        self.assertEqual(scope.select_scope("pull_request", event, merged, "refs/pull/1/merge")[0], "operator")
        event["pull_request"]["head"]["sha"] = self.base
        self.assertEqual(scope.select_scope("pull_request", event, merged, "refs/pull/1/merge")[0], "full")

    def test_unknown_commits_force_push_tags_and_checkout_drift_are_full(self):
        for key, value in [("before", "0" * 40), ("before", "f" * 40),
                           ("before", "--help"), ("after", self.base),
                           ("forced", True), ("deleted", True), ("ref", "refs/heads/other")]:
            event = self.push_event()
            event[key] = value
            with self.subTest(key=key, value=value):
                self.assertEqual(self.classify_push(event), "full")
        self.assertEqual(self.classify_push(sha=self.base), "full")
        self.assertEqual(self.classify_push(ref="refs/tags/checkpoint-test"), "full")
        self.assertEqual(scope.select_scope("schedule", {}, self.head, "refs/heads/main")[0], "full")

    def test_deletion_or_move_into_allowed_name_cannot_select_operator(self):
        self.run_git("mv", "app.ts", "memory.md")
        self.head = self.save("rename")
        self.assertEqual(self.classify_push(), "full")

    def test_product_scope_uses_the_complete_real_main_diff(self):
        self.run_git("switch", "--detach", self.base)
        self.write("backoffice-ui/src/new-panel.tsx", "export const panel = 1;")
        self.head = self.save("product")
        self.assertEqual(self.classify_push(), "product")
        self.write("platform-infra/unknown.sh", "exit 0")
        self.head = self.save("mixed infrastructure")
        self.assertEqual(self.classify_push(), "full")

    def test_product_pr_merge_keeps_exact_parent_and_deletion_guards(self):
        self.run_git("switch", "--detach", self.base)
        self.write("backoffice-ui/src/panel.tsx", "export const panel = 1;")
        self.head = self.save("product")
        self.run_git("switch", "-qc", "product-pr", self.head)
        self.run_git("switch", "-qc", "product-merge", self.base)
        self.run_git("merge", "--no-ff", "-qm", "product merge", "product-pr")
        merged = self.run_git("rev-parse", "HEAD")
        event = {"pull_request": {"base": {"ref": "main", "sha": self.base},
                                  "head": {"sha": self.head}}}
        self.assertEqual(scope.select_scope("pull_request", event, merged, "refs/pull/1/merge")[0], "product")
        event["pull_request"]["head"]["sha"] = self.base
        self.assertEqual(scope.select_scope("pull_request", event, merged, "refs/pull/1/merge")[0], "full")

        self.run_git("switch", "--detach", self.head)
        self.base = self.head
        self.run_git("mv", "backoffice-ui/src/panel.tsx", "backoffice-ui/src/renamed.tsx")
        self.head = self.save("rename product source")
        self.assertEqual(self.classify_push(), "full")

    def test_added_product_symlink_keeps_the_full_suite(self):
        self.run_git("switch", "--detach", self.base)
        link = self.root / "backoffice-ui/src/link.ts"
        link.parent.mkdir(parents=True)
        link.symlink_to("../../app.ts")
        self.head = self.save("product-shaped symlink")
        self.assertEqual(self.classify_push(), "full")

    def test_added_product_gitlink_keeps_the_full_suite(self):
        self.run_git("switch", "--detach", self.base)
        self.run_git("update-index", "--add", "--cacheinfo", f"160000,{self.base},backoffice-ui/src/submodule.ts")
        self.run_git("commit", "-qm", "product-shaped gitlink")
        self.head = self.run_git("rev-parse", "HEAD")
        self.assertEqual(self.classify_push(), "full")


class WorkflowTests(unittest.TestCase):
    def test_required_jobs_and_scoped_acceptance_remain_unconditional(self):
        text = (ROOT / ".github/workflows/ci.yml").read_text()
        build = text.split("  build-and-test:\n", 1)[1].split("  catering-target-operator-macos:", 1)[0]
        self.assertIn("fetch-depth: 0", build)
        self.assertLess(build.index("python3 -B tests/ci_test_scope_test.py"), build.index("id: test_scope"))
        self.assertIn("if: steps.test_scope.outputs.scope != 'operator'\n        run: python3 -B scripts/ci-test-scope.py --run-tests \"${{ steps.test_scope.outputs.scope || 'full' }}\"", build)
        self.assertIn("if: steps.test_scope.outputs.scope == 'operator'\n        run: npx --no-install vitest run tests/catering-target-*.test.ts", build)
        gates = build.split("- name: Catering target operator acceptance gates", 1)[1]
        self.assertNotIn("if:", gates)
        for test in ["catering_target_operator_test.py", "catering_target02_test.py", "catering_target_v4_test.py",
                     "catering_target_nue_image_update_test.py", "catering_infrastructure_oci_test.py"]:
            self.assertIn(test, gates)
        for job in ["catering-target-operator-macos", "browser-rehearsal", "compose-render-parity"]:
            job_header = text.split(f"  {job}:\n", 1)[1].split("    steps:", 1)[0]
            self.assertNotIn("if:", job_header)


if __name__ == "__main__":
    unittest.main()
