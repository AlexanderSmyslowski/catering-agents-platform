#!/usr/bin/env python3
import json
import os
from pathlib import Path
import sys

APPLICATION = ["intake", "offer", "production", "exports", "web"]

def base_state():
    return {
        "targetId": "catering-prod-1",
        "deployPath": "/opt/catering-agents-platform",
        "runtimeExists": True,
        "backupReady": True,
        "lockState": "free",
        "networks": ["catering_private", "catering_ingress", "catering_public"],
        "serviceNetworks": {
            "postgres": ["catering_private"],
            "intake": ["catering_private"],
            "offer": ["catering_private"],
            "production": ["catering_private"],
            "exports": ["catering_private"],
            "web": ["catering_ingress", "catering_private"],
            "edge": ["catering_ingress", "catering_public"],
        },
        "publishedPorts": {
            "postgres": [],
            "intake": [],
            "offer": [],
            "production": [],
            "exports": [],
            "web": [],
            "edge": ["80/tcp", "443/tcp"],
        },
        "services": ["postgres", *APPLICATION, "edge"],
    }

def apply_scenario(state, scenario):
    if scenario == "healthy":
        return
    if scenario == "forbidden-network":
        state["serviceNetworks"]["web"].append("zeiterfassung_default")
        return
    if scenario == "extra-foreign-network":
        state["serviceNetworks"]["web"].append("foreign_shared")
        return
    if scenario == "missing-runtime":
        state["runtimeExists"] = False
        return
    if scenario == "bad-target-path":
        state["deployPath"] = "/opt/not-catering"
        return
    if scenario == "backup-not-ready":
        state["backupReady"] = False
        return
    if scenario == "lock-held":
        state["lockState"] = "held"
        return
    if scenario == "topology-drift":
        state["serviceNetworks"]["production"] = ["catering_ingress"]
        return
    if scenario in {
        "candidate-image-missing",
        "activate-fails",
        "smoke-fails",
        "postflight-port-drift",
        "postflight-network-drift",
        "rollback-fails",
        "migration-required",
    }:
        return
    raise SystemExit(f"unknown harness scenario: {scenario}")

def main():
    if len(sys.argv) != 4 or sys.argv[1] != "--prepare":
        raise SystemExit("usage: catering-target-update-harness.py --prepare SCENARIO ROOT")
    scenario = sys.argv[2]
    root = Path(sys.argv[3])
    root.mkdir(parents=True, exist_ok=True)
    state = base_state()
    apply_scenario(state, scenario)
    (root / "state.json").write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")
    (root / "mutations.log").touch()
    (root / "commands.log").touch()

if __name__ == "__main__":
    main()
