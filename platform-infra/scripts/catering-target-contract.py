#!/usr/bin/env python3
"""Validate versioned target contract values before shell or remote use."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any


class ContractError(Exception):
    """A fixed, non-sensitive contract validation failure."""


REPOSITORY_SOURCE_PATHS = {
    "platformBase": "platform-infra/docker-compose.catering-target.json",
    "platformOperations": "platform-infra/docker-compose.catering-target.operations.json",
    "edgeBase": "edge-infra/docker-compose.catering-target.json",
    "edgeOperations": "edge-infra/docker-compose.catering-target.operations.json",
    "edgeCaddy": "edge-infra/Caddyfile.catering-target.operations",
    "targetSite": "platform-infra/target-sites/catering-target.caddy",
}
INSTALLED_RUNTIME = {
    "platform": {
        "composeProject": "platform-infra",
        "workingDirectory": "/opt/catering-agents-platform/platform-infra",
        "baseCompose": "/opt/catering-agents-platform/platform-infra/compose.json",
        "operationsCompose": "/opt/catering-agents-platform/platform-infra/operations.json",
        "targetSite": "/opt/catering-agents-platform/platform-infra/sites/catering-target.caddy",
    },
    "edge": {
        "composeProject": "catering-edge",
        "workingDirectory": "/opt/catering-edge",
        "baseCompose": "/opt/catering-edge/compose.json",
        "operationsCompose": "/opt/catering-edge/operations.json",
        "caddyfile": "/opt/catering-edge/Caddyfile",
    },
}
CONTAINER_IDENTITIES = {
    "platform": [
        {"name": "platform-infra-postgres-1", "service": "postgres"},
        {"name": "platform-infra-intake-1", "service": "intake"},
        {"name": "platform-infra-offer-1", "service": "offer"},
        {"name": "platform-infra-production-1", "service": "production"},
        {"name": "platform-infra-exports-1", "service": "exports"},
        {"name": "platform-infra-web-1", "service": "web"},
    ],
    "edge": [{"name": "catering-edge-edge-1", "service": "edge"}],
}
RUNTIME_FILE_BINDINGS = {
    "platform": [
        ("base_compose", "/opt/catering-agents-platform/platform-infra/compose.json", REPOSITORY_SOURCE_PATHS["platformBase"]),
        ("operations_compose", "/opt/catering-agents-platform/platform-infra/operations.json", REPOSITORY_SOURCE_PATHS["platformOperations"]),
        ("target_site", "/opt/catering-agents-platform/platform-infra/sites/catering-target.caddy", REPOSITORY_SOURCE_PATHS["targetSite"]),
    ],
    "edge": [
        ("base_compose", "/opt/catering-edge/compose.json", REPOSITORY_SOURCE_PATHS["edgeBase"]),
        ("operations_compose", "/opt/catering-edge/operations.json", REPOSITORY_SOURCE_PATHS["edgeOperations"]),
        ("caddyfile", "/opt/catering-edge/Caddyfile", REPOSITORY_SOURCE_PATHS["edgeCaddy"]),
    ],
}
SAFE_EVIDENCE = re.compile(r"^[A-Za-z0-9_]+$")


def _require(condition: bool) -> None:
    if not condition:
        raise ContractError("target contract or inventory has invalid control values")


def validate_control_data(contract: Any, inventory: Any, target_id: str = "catering-prod-1") -> None:
    """Accept only the versioned values consumed as paths, names, or commands."""
    _require(target_id in {"catering-prod-1", "catering-prod-02"})
    _require(isinstance(contract, dict))
    _require(set(contract) == {
        "schemaVersion", "targetId", "deployPath", "edgePath", "releaseRoot",
        "repositorySourcePaths", "installedRuntime", "applicationServices", "databaseService",
        "requiredNetworks", "forbiddenNetworks", "protectedRemotePaths", "migrationPolicy",
    })
    _require(contract.get("schemaVersion") == 2)
    _require(contract.get("targetId") == target_id)
    _require(contract.get("deployPath") == "/opt/catering-agents-platform")
    _require(contract.get("edgePath") == "/opt/catering-edge")
    _require(contract.get("releaseRoot") == "/opt/catering-releases")
    _require(contract.get("repositorySourcePaths") == REPOSITORY_SOURCE_PATHS)
    _require(contract.get("installedRuntime") == INSTALLED_RUNTIME)
    _require(contract.get("applicationServices") == ["intake", "offer", "production", "exports", "web"])
    _require(contract.get("databaseService") == "postgres")
    _require(contract.get("requiredNetworks") == ["catering_private", "catering_ingress", "catering_public"])
    _require(contract.get("forbiddenNetworks") == ["zeiterfassung_default"])
    _require(contract.get("protectedRemotePaths") == [
        "/etc/catering-target/runtime.env",
        "/opt/catering-agents-platform/platform-infra/compose.json",
        "/opt/catering-agents-platform/platform-infra/operations.json",
        "/opt/catering-agents-platform/platform-infra/.env",
        "/opt/catering-agents-platform/platform-infra/sites",
        "/opt/catering-agents-platform/data",
        "/opt/catering-edge/compose.json",
        "/opt/catering-edge/operations.json",
        "/opt/catering-edge/Caddyfile",
    ])
    _require(contract.get("migrationPolicy") == {"mode": "explicit-only", "supportedCommand": None})

    # prod-02 has an intended contract, never a copy of the prod-1 observation.
    # Installed state is checked live by the unchanged production preflight.
    if target_id == "catering-prod-02":
        _require(inventory is None)
        return
    _require(isinstance(inventory, dict))
    _require(set(inventory) == {
        "schemaVersion", "targetId", "observedAt", "observation", "platform", "edge",
        "legacyExpectedRemotePaths", "contractAlignment",
    })
    _require(inventory.get("schemaVersion") == 1 and inventory.get("targetId") == "catering-prod-1")
    _require(isinstance(inventory.get("observedAt"), str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", inventory["observedAt"]) is not None)

    for scope in ("platform", "edge"):
        section = inventory.get(scope)
        runtime = INSTALLED_RUNTIME[scope]
        _require(isinstance(section, dict))
        _require(section.get("composeProject") == runtime["composeProject"])
        _require(section.get("workingDirectory") == runtime["workingDirectory"])
        if scope == "edge":
            _require(set(section) == {"composeProject", "workingDirectory", "container", "runtimeFiles"})
            _require(section.get("container") == CONTAINER_IDENTITIES["edge"][0])
        else:
            _require(set(section) == {"composeProject", "workingDirectory", "containers", "runtimeFiles"})
            _require(section.get("containers") == CONTAINER_IDENTITIES["platform"])
        items = section.get("runtimeFiles")
        _require(isinstance(items, list) and len(items) == len(RUNTIME_FILE_BINDINGS[scope]))
        _require(all(isinstance(item, dict) and isinstance(item.get("role"), str) for item in items))
        by_role = {item.get("role"): item for item in items if isinstance(item, dict)}
        _require(set(by_role) == {role for role, _, _ in RUNTIME_FILE_BINDINGS[scope]})
        for role, remote_path, source_path in RUNTIME_FILE_BINDINGS[scope]:
            item = by_role[role]
            _require(item.get("path") == remote_path and item.get("sourcePath") == source_path)
            _require(item.get("status") == "regular_file")
            _require(item.get("owner") == "root" and item.get("group") == "root" and item.get("mode") == "0644")
            _require(item.get("sourceMatch") is True)
            evidence = item.get("evidence")
            _require(isinstance(evidence, str) and SAFE_EVIDENCE.fullmatch(evidence) is not None)


def main() -> int:
    if len(sys.argv) not in {3, 4}:
        print("target contract or inventory has invalid control values", file=sys.stderr)
        return 1
    try:
        contract = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
        inventory = None if sys.argv[2] == "__unobserved__" else json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))
        validate_control_data(contract, inventory, sys.argv[3] if len(sys.argv) == 4 else "catering-prod-1")
    except (OSError, UnicodeError, json.JSONDecodeError, ContractError, TypeError, AttributeError, IndexError, KeyError, ValueError):
        print("target contract or inventory has invalid control values", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
