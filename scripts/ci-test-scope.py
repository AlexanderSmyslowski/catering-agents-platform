"""Select regression work from an exact event diff; uncertainty keeps the full run."""
import json
import os
from pathlib import Path
import re
import subprocess
import sys


# Every executable here is covered by the unconditional Python acceptance gates
# plus the catering-target Vitest contracts. Shell/JS runners are deliberately
# excluded: their process, authentication and integration effects are broader.
OPERATOR_FILES = frozenset({
    "platform-infra/scripts/catering-target-operator.py",
    "platform-infra/scripts/catering-target-contract.py",
    "platform-infra/scripts/catering-target-bootstrap.py",
    "platform-infra/scripts/catering-target-stage-binding.py",
    "platform-infra/scripts/catering-target-release-state.py",
    "platform-infra/scripts/catering_target_oci.py",
    "platform-infra/scripts/catering_target_nue_image_update.py",
    "tests/catering_target_operator_test.py",
    "tests/catering_target02_test.py",
    "tests/catering_target_v4_test.py",
    "tests/catering_target_nue_image_update_test.py",
    "tests/catering_infrastructure_oci_test.py",
})
COMPANION_DOCS = frozenset({
    "memory.md",
    "docs/agent-memory/HANDOFF_PROMPT.md",
    "docs/operations/CATERING_TARGET_UPDATE.md",
    "docs/operations/CATERING_TARGET02_BOOTSTRAP.md",
})

# These slow suites exercise historical deployment/backup scripts with synthetic
# services, not application code. All other Vitest tests stay in the product run,
# including authorization, persistence, quantities, exports and data isolation.
MIGRATION_TEST_FILES = (
    "tests/phase3-latest-p1-review-absent-and-compatibility.test.ts",
    "tests/phase3-latest-p1-review-rollback-and-recovery.test.ts",
    "tests/phase3-latest-p1-review-preexisting-and-legacy.test.ts",
    "tests/catering-phase3-pilot-contract.test.ts",
    "tests/catering-backup-restore-contract.test.ts",
    "tests/post-cutover-evidence-workflow-contract.test.ts",
)
PRODUCT_SOURCE = re.compile(
    r"(?:backoffice-ui|shared-core|intake-service|offer-service|production-service|print-export)"
    r"/src/(?:[A-Za-z0-9_-]+/)*[A-Za-z0-9_-]+\.(?:ts|tsx|css)"
)
PRODUCT_TEST = re.compile(r"tests/[A-Za-z0-9_-]+\.test\.tsx?")
PRODUCT_REHEARSAL = re.compile(r"scripts/browser-rehearsal/[A-Za-z0-9_-]+\.js")
PRODUCT_COMPANION_DOCS = frozenset({
    "memory.md",
    "docs/agent-memory/HANDOFF_PROMPT.md",
    "docs/product/PRODUKTZIEL_CATERING_AGENTS_PLATFORM.md",
    "docs/product/OPUS_UX_UI_REVIEW_20261031.md",
})
# The supplier UI edits local draft estimates and calls the existing pricing API.
# Server, shared API, access control and persistence changes use a broader profile.
SUPPLIER_UI_FILES = frozenset({
    "backoffice-ui/src/ingredient-cost-helper.tsx",
    "backoffice-ui/src/offer-pricing-editor.tsx",
    "backoffice-ui/src/price-source-columns.tsx",
    "backoffice-ui/src/price-source-review.tsx",
    "backoffice-ui/src/price-source-settings.tsx",
    "backoffice-ui/src/saved-ingredient-prices.tsx",
    "tests/offer-pricing-editor.test.tsx",
    "tests/supplier-price-helper.test.tsx",
    "tests/supplier-invoice-helper.test.tsx",
    "tests/configured-supplier-prices.test.tsx",
})
SUPPLIER_UI_TESTS = (
    "tests/supplier-", "tests/configured-supplier-prices.test.tsx",
    "tests/offer-pricing-", "tests/mutating-route-auth-matrix.test.ts",
)
SHA = re.compile(r"[0-9a-f]{40}")


def git(*args):
    return subprocess.check_output(["git", *args], stderr=subprocess.DEVNULL)


def commit(value):
    if not isinstance(value, str) or not SHA.fullmatch(value) or value == "0" * 40:
        raise ValueError("missing or invalid commit")
    if git("rev-parse", "--verify", value + "^{commit}").decode().strip() != value:
        raise ValueError("commit mismatch")
    return value


def comparison(event_name, event, checkout_sha, ref):
    checkout = commit(checkout_sha)
    if git("rev-parse", "HEAD").decode().strip() != checkout:
        raise ValueError("checkout is not the event commit")
    if event_name == "pull_request":
        pr = event["pull_request"]
        if pr["base"]["ref"] != "main":
            raise ValueError("unexpected PR base")
        base, head = commit(pr["base"]["sha"]), commit(pr["head"]["sha"])
        parents = git("show", "-s", "--format=%P", checkout).decode().split()
        if parents != [base, head]:
            raise ValueError("PR merge parents do not match the event")
        # Compare what is actually tested, including GitHub's merge result.
        return base, checkout
    if event_name == "push" and ref == "refs/heads/main" and event["ref"] == ref:
        before, after = commit(event["before"]), commit(event["after"])
        if after != checkout or event.get("forced") is not False or event.get("deleted") is not False:
            raise ValueError("not a normal main push")
        git("merge-base", "--is-ancestor", before, after)
        return before, after
    raise ValueError("event requires full regression")


def operator_only(changes):
    if not changes or not any(path in OPERATOR_FILES for _, path in changes):
        return False
    # Deletions, type changes and renames require the full suite. --no-renames
    # below exposes a move as deletion + addition, including moves into this list.
    return all(status == "M" and path in OPERATOR_FILES | COMPANION_DOCS
               for status, path in changes)


def product_file(path):
    return path not in MIGRATION_TEST_FILES and bool(
        PRODUCT_SOURCE.fullmatch(path) or PRODUCT_TEST.fullmatch(path) or PRODUCT_REHEARSAL.fullmatch(path)
    )


def product_only(changes):
    if not changes or not any(product_file(path) for _, path in changes):
        return False
    return all(status in {"M", "A"} and (product_file(path) or path in PRODUCT_COMPANION_DOCS)
               for status, path in changes)


def regression_command(scope):
    if scope == "full":
        return ["npm", "test"]
    if scope == "supplier-ui":
        return ["npx", "--no-install", "vitest", "run", *SUPPLIER_UI_TESTS]
    if scope == "product":
        return ["npx", "--no-install", "vitest", "run", *(
            argument for filename in MIGRATION_TEST_FILES for argument in ("--exclude", filename)
        )]
    raise ValueError("unknown regression scope")


def regular_product_changes(base, head, changes, *, plain_sources=False):
    # A new symlink/gitlink is reported as A, not T. Inspect the Git modes rather
    # than trusting a product-looking filename or following its checkout target.
    raw = git("diff", "--raw", "--no-abbrev", "-z", "--no-renames", base, head, "--")
    fields = raw.decode("utf-8", errors="strict").split("\0")
    if fields.pop() != "" or len(fields) % 2:
        raise ValueError("incomplete raw diff")
    modes = []
    for header, path in zip(fields[::2], fields[1::2]):
        parts = header.split()
        if len(parts) != 5 or not parts[0].startswith(":"):
            raise ValueError("invalid raw diff")
        before, after, status = parts[0][1:], parts[1], parts[4]
        if after not in {"100644", "100755"} or before not in (
            {"000000"} if status == "A" else {"100644", "100755"}
        ):
            return False
        if plain_sources and (before, after, status) != ("100644", "100644", "M"):
            return False
        modes.append((status, path))
    return modes == changes


def changes_between(base, head):
    raw = git("diff", "--name-status", "-z", "--no-renames", base, head, "--")
    if not raw:
        return []
    fields = raw.decode("utf-8", errors="strict").split("\0")
    if fields.pop() != "" or len(fields) % 2:
        raise ValueError("incomplete diff")
    return list(zip(fields[::2], fields[1::2]))


def select_scope(event_name, event, checkout_sha, ref):
    try:
        base, head = comparison(event_name, event, checkout_sha, ref)
        changes = changes_between(base, head)
        if operator_only(changes):
            return "operator", "only explicitly covered operator files and companion documentation changed"
        if (changes and all(status == "M" and path in SUPPLIER_UI_FILES for status, path in changes)
                and regular_product_changes(base, head, changes, plain_sources=True)):
            return "supplier-ui", "only existing supplier pricing controls or their tests changed"
        if product_only(changes) and regular_product_changes(base, head, changes):
            return "product", "only application sources, product tests, DOM rehearsals and named companion documentation changed"
        return "full", "change includes infrastructure, CI, dependencies or paths outside the reviewed scopes"
    except (KeyError, TypeError, ValueError, OSError, subprocess.SubprocessError):
        return "full", "complete event/checkout/diff binding unavailable or event requires full regression"


def main():
    try:
        event = json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text())
    except (KeyError, OSError, ValueError):
        event = {}
    scope, reason = select_scope(os.environ.get("GITHUB_EVENT_NAME"), event,
                                 os.environ.get("GITHUB_SHA"), os.environ.get("GITHUB_REF"))
    print(f"CI test scope: {scope} ({reason})")
    with open(os.environ["GITHUB_OUTPUT"], "a") as output:
        output.write(f"scope={scope}\n")
    with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as summary:
        summary.write(f"### Test scope: {scope}\n\n{reason}.\n\n")
        summary.write("Build, Linux/macOS operator gates, browser rehearsal and Compose parity remain required.\n")
        if scope == "supplier-ui":
            summary.write("Runs supplier import, price editing, revision, print and authorization tests.\n")
        if scope == "product":
            summary.write("All application Vitest regressions run; only these unchanged historical infrastructure suites are omitted:\n")
            summary.writelines(f"- `{filename}`\n" for filename in MIGRATION_TEST_FILES)


if __name__ == "__main__":
    if len(sys.argv) == 1:
        main()
    elif len(sys.argv) == 3 and sys.argv[1] == "--run-tests":
        raise SystemExit(subprocess.call(regression_command(sys.argv[2])))
    else:
        raise SystemExit("Usage: ci-test-scope.py [--run-tests full|product|supplier-ui]")
