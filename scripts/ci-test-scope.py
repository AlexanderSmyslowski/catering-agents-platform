"""Select a smaller regression set only for known, fully covered operator files."""
import json
import os
from pathlib import Path
import re
import subprocess


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
        if operator_only(changes_between(base, head)):
            return "operator", "only explicitly covered operator files and companion documentation changed"
        return "full", "change includes files outside the narrow operator scope"
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


if __name__ == "__main__":
    main()
