#!/usr/bin/env python3
"""Deterministic Docker command adapter for the Phase-3 contract harness.

The production pilot remains the only transaction/state machine. This adapter
persists only Docker observations and injects command-boundary faults; it never
writes pilot markers, manifests, journals, receipts, or transition state.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import signal
import sys
from pathlib import Path
from urllib.parse import urlparse
from typing import Any


ROOT = Path(os.environ["CATERING_PHASE3_FAKE_HOST_ROOT"])
STATE_PATH = ROOT / "fake-docker-state.json"
LOG_PATH = ROOT / "fake-docker.log"
MARKER_PATH = ROOT / "phase3.activation"
JOURNAL_PATH = ROOT / "phase3.network-adoption.journal"


def stable_id(kind: str, name: str) -> str:
    # Docker inspect exposes the canonical 64-hex ID. The default `network ls`
    # view is shortened in do_network, just as the real CLI does.
    return hashlib.sha256(f"{kind}:{name}".encode()).hexdigest()


def log(argv: list[str]) -> None:
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with LOG_PATH.open("a", encoding="utf-8") as handle:
        handle.write("docker " + " ".join(argv) + "\n")


def save(state: dict[str, Any]) -> None:
    STATE_PATH.write_text(json.dumps(state, sort_keys=True, separators=(",", ":")), encoding="utf-8")


def load() -> dict[str, Any]:
    return json.loads(STATE_PATH.read_text(encoding="utf-8"))


def container(
    name: str,
    image: str,
    project: str,
    service: str,
    networks: dict[str, list[str]],
    ports: dict[str, list[dict[str, str]]] | None = None,
    started_at: str = "2026-08-22T10:00:00Z",
    environment: dict[str, str] | None = None,
) -> dict[str, Any]:
    return {
        "id": stable_id("container", name),
        "image": image,
        "labels": {"com.docker.compose.project": project, "com.docker.compose.service": service},
        "config": {"env": environment or {}},
        "mounts": [],
        "networks": {key: {"aliases": aliases} for key, aliases in networks.items()},
        "ports": ports or {},
        "restart_count": 0,
        "started_at": started_at,
        "status": "running",
    }


def network(name: str, labels: dict[str, str]) -> dict[str, Any]:
    return {
        "driver": "bridge",
        "enable_ipv6": False,
        "id": stable_id("network", name),
        "internal": False,
        "ipam_config": [],
        "ipam_driver": "default",
        "labels": labels,
        "options": {},
        "scope": "local",
        "containers": {},
    }


def baseline_state() -> dict[str, Any]:
    foreign_labels = {
        "com.catering.kind": "compatibility",
        "com.catering.owner": "foreign",
        "com.catering.phase": "baseline",
        "com.catering.transaction": "absent",
    }
    production_env_value = os.environ.get("CATERING_PHASE3_FAKE_PRODUCTION_ENV", "0")
    production_environment = (
        {}
        if production_env_value == "__absent__"
        else {"CATERING_ENABLE_WEB_RECIPE_SEARCH": production_env_value}
    )
    production_project = os.environ.get("CATERING_PHASE3_FAKE_PRODUCTION_PROJECT", "platform-infra")
    production_service = os.environ.get("CATERING_PHASE3_FAKE_PRODUCTION_SERVICE", "production")
    containers = {
        "zeiterfassung-app-1": container("zeiterfassung-app-1", "zeiterfassung-app:0.4.141-75d58ec8e817", "zeiterfassung", "app", {"zeiterfassung_default": ["app", "zeiterfassung-app-1"]}),
        "commcats-eventos-app": container("commcats-eventos-app", "commcats-eventos-app", "commcats-eventos", "app", {"commcats-eventos_default": ["app", "commcats-eventos-app"], "platform-infra_default": ["app", "commcats-eventos-app"]}, started_at="2026-08-22T10:00:01Z"),
        "commcats-eventos-postgres": container("commcats-eventos-postgres", "commcats-eventos-postgres:17.10-hardened", "commcats-eventos", "postgres", {"commcats-eventos_default": ["postgres", "commcats-eventos-postgres"]}, started_at="2026-08-22T10:00:02Z"),
        "deploy-web-1": container("deploy-web-1", "deploy-web", "deploy", "web", {"deploy_default": ["web", "deploy-web-1"]}, {"3000/tcp": [{"HostIp": "0.0.0.0", "HostPort": "3000"}]}, started_at="2026-08-22T10:00:03Z"),
        "deploy-ingest-1": container("deploy-ingest-1", "deploy-ingest", "deploy", "ingest", {"deploy_default": ["ingest", "deploy-ingest-1"]}, started_at="2026-08-22T10:00:04Z"),
        "deploy-db-1": container("deploy-db-1", "postgres:16-alpine", "deploy", "db", {"deploy_default": ["db", "deploy-db-1"]}, {"5432/tcp": [{"HostIp": "127.0.0.1", "HostPort": "5432"}]}, started_at="2026-08-22T10:00:05Z"),
        "platform-infra-web-1": container("platform-infra-web-1", "catering-web", "platform-infra", "web", {"platform-infra_default": ["web"], "zeiterfassung_default": ["web"]}, started_at="2026-08-22T10:00:06Z"),
        "platform-infra-postgres-1": container("platform-infra-postgres-1", "catering-pg", "platform-infra", "postgres", {"platform-infra_default": ["postgres"]}, started_at="2026-08-22T10:00:07Z"),
        "platform-infra-intake-1": container("platform-infra-intake-1", "catering-intake", "platform-infra", "intake", {"platform-infra_default": ["intake"]}, started_at="2026-08-22T10:00:08Z"),
        "platform-infra-offer-1": container("platform-infra-offer-1", "catering-offer", "platform-infra", "offer", {"platform-infra_default": ["offer"]}, started_at="2026-08-22T10:00:09Z"),
        "platform-infra-production-1": container("platform-infra-production-1", "catering-production", production_project, production_service, {"platform-infra_default": ["production"]}, started_at="2026-08-22T10:00:10Z", environment=production_environment),
        "platform-infra-exports-1": container("platform-infra-exports-1", "catering-exports", "platform-infra", "exports", {"platform-infra_default": ["exports"]}, started_at="2026-08-22T10:00:11Z"),
        "shared-edge-edge-1": container("shared-edge-edge-1", "caddy:2-alpine", "shared-edge", "edge", {"platform-infra_default": ["edge", "shared-edge-edge-1"], "zeiterfassung_default": ["edge", "shared-edge-edge-1"]}, {"443/tcp": [{"HostIp": "0.0.0.0", "HostPort": "443"}], "80/tcp": [{"HostIp": "0.0.0.0", "HostPort": "80"}]}, started_at="2026-08-22T10:00:12Z"),
    }
    networks = {name: network(name, foreign_labels) for name in ["commcats-eventos_default", "deploy_default", "platform-infra_default", "zeiterfassung_default"]}
    state: dict[str, Any] = {"compose_failed": False, "containers": containers, "fault": "", "fault_triggered": False, "networks": networks}
    for container_name, item in containers.items():
        for network_name, details in item["networks"].items():
            networks[network_name]["containers"][item["id"]] = {"Name": f"/{container_name}", "Aliases": details["aliases"]}
    return state


def marker_state() -> str:
    try:
        for line in MARKER_PATH.read_text(encoding="utf-8").splitlines():
            if line.startswith("state="):
                return line.split("=", 1)[1]
    except FileNotFoundError:
        pass
    return "absent"


def journal_field(key: str) -> str:
    try:
        for line in JOURNAL_PATH.read_text(encoding="utf-8").splitlines():
            if line.startswith(f"{key}="):
                return line.split("=", 1)[1]
    except FileNotFoundError:
        pass
    return ""


def inject_fault(state: dict[str, Any], operation: str, name: str = "") -> None:
    fault = state.get("fault", "")
    if not fault or state.get("fault_triggered"):
        return
    current = marker_state()
    expected_ingress = {"platform-infra-web-1", "shared-edge-edge-1"}
    expected_private = {"platform-infra-web-1", "platform-infra-postgres-1", "platform-infra-intake-1", "platform-infra-offer-1", "platform-infra-production-1", "platform-infra-exports-1"}
    ingress = state.get("networks", {}).get("catering_ingress", {}).get("containers", {}).values()
    private = state.get("networks", {}).get("catering_private", {}).get("containers", {}).values()
    ingress_members = {str(value.get("Name", "")).lstrip("/") for value in ingress}
    private_members = {str(value.get("Name", "")).lstrip("/") for value in private}
    trigger = False
    if fault == "crash-after-candidate":
        trigger = current == "candidate" and operation == "inspect" and ingress_members == expected_ingress and private_members == expected_private
    elif fault == "crash-after-active":
        trigger = current == "active" and operation == "inspect"
    elif fault == "crash-after-rollback":
        trigger = current == "rolling_back" and operation == "inspect"
    elif fault == "crash-after-receipt":
        trigger = current == "rolling_back" and operation == "inspect" and (ROOT / "phase3.rollback-completion.receipt").is_file()
    elif fault == "crash-after-ingress":
        trigger = operation == "inspect" and name == "catering_ingress" and re.fullmatch(r"[0-9a-f]{64}", journal_field("catering_ingress_id")) is not None and journal_field("adoption_order") == "catering_ingress"
    elif fault == "crash-after-private":
        trigger = operation == "inspect" and name == "catering_private" and re.fullmatch(r"[0-9a-f]{64}", journal_field("catering_private_id")) is not None and journal_field("adoption_order") == "catering_ingress,catering_private"
    if trigger:
        state["fault_triggered"] = True
        save(state)
        os.kill(os.getppid(), signal.SIGKILL)


def resolve_network(state: dict[str, Any], value: str) -> tuple[str, dict[str, Any]]:
    networks = state["networks"]
    if value in networks:
        return value, networks[value]
    for name, item in networks.items():
        if item["id"] == value:
            return name, item
    raise KeyError(value)


def resolve_container(state: dict[str, Any], value: str) -> tuple[str, dict[str, Any]]:
    containers = state["containers"]
    if value in containers:
        return value, containers[value]
    for name, item in containers.items():
        if item["id"] == value:
            return name, item
    raise KeyError(value)


def json_text(value: Any) -> str:
    return json.dumps(value, separators=(",", ":"))


def render_network(state: dict[str, Any], value: str, fmt: str) -> str:
    name, item = resolve_network(state, value)
    if state.get("fault") == "network-provenance-fail" and name.startswith("catering_") and ".Driver" in fmt:
        return "overlay"
    if fmt == "{{.Id}}":
        return item["id"]
    if fmt == "{{.Driver}}":
        return item["driver"]
    if fmt == "{{.Scope}}":
        return item["scope"]
    if fmt == "{{.Internal}}":
        return str(item["internal"]).lower()
    if fmt == "{{.IPAM.Driver}}":
        return item["ipam_driver"]
    if fmt == "{{json .IPAM.Config}}":
        return json_text(item["ipam_config"])
    if fmt == "{{json .Options}}":
        return json_text(item["options"])
    if fmt == "{{.EnableIPv6}}":
        return str(item["enable_ipv6"]).lower()
    if fmt == "{{json .Labels}}":
        return json_text(item["labels"])
    if fmt == "{{json .Containers}}":
        return json_text(item["containers"])
    if fmt == "{{len .Containers}}":
        return str(len(item["containers"]))
    match = re.fullmatch(r'\{\{index \.Labels "([^"]+)"\}\}', fmt)
    if match:
        return item["labels"].get(match.group(1), "<no value>")
    raise ValueError(f"unsupported network format: {fmt}")


def render_container(state: dict[str, Any], value: str, fmt: str) -> str:
    _, item = resolve_container(state, value)
    # The real Docker CLI accepts a pipe-delimited Go template. Keep the fake
    # adapter faithful for the helper's atomic snapshot readbacks instead of
    # teaching the pilot a fake-only format.
    if "|" in fmt:
        return "|".join(render_container(state, value, part) for part in fmt.split("|"))
    if fmt == "{{.Id}}":
        return item["id"]
    if fmt == "{{.RestartCount}}":
        return str(item["restart_count"])
    if fmt == "{{.State.StartedAt}}":
        return item["started_at"]
    if fmt == "{{.State.Status}}":
        return item["status"]
    if fmt == "{{.Image}}":
        return item["image"]
    if fmt == "{{json .NetworkSettings.Networks}}":
        return json_text(item["networks"])
    if fmt == "{{json .HostConfig.PortBindings}}":
        return json_text(item["ports"])
    if fmt == "{{json .Mounts}}":
        return json_text(item["mounts"])
    if fmt == "{{json .Config.Env}}":
        return json_text(item.get("config", {}).get("env", {}))
    if fmt == "{{range .Config.Secrets}}{{.Name}};{{end}}":
        return ""
    label_match = re.fullmatch(r'\{\{index \.Config\.Labels "([^"]+)"\}\}', fmt)
    if label_match:
        return item["labels"].get(label_match.group(1), "<no value>")
    alias_match = re.search(r'eq "\$network_name" "([^"]+)"', fmt)
    if alias_match:
        network_name = alias_match.group(1)
        return ",".join(item["networks"].get(network_name, {}).get("aliases", []))
    raise ValueError(f"unsupported container format: {fmt}")


def reachable(state: dict[str, Any], caller: str, host: str) -> bool:
    caller_networks = set(resolve_container(state, caller)[1]["networks"])
    for target_name, target_item in state["containers"].items():
        aliases = {target_name}
        aliases.update(alias for details in target_item["networks"].values() for alias in details.get("aliases", []))
        if host in aliases and caller_networks.intersection(target_item["networks"]):
            return True
    return False


def do_network(state: dict[str, Any], args: list[str]) -> int:
    if not args:
        return 1
    action = args[0]
    if action == "ls":
        match = re.search(r"name=\^([^$]+)\$", " ".join(args))
        if match and match.group(1) in state["networks"]:
            value = state["networks"][match.group(1)]["id"]
            print(value if "--no-trunc" in args else value[:12])
        return 0
    if action == "inspect":
        value = args[-1]
        fmt = args[args.index("--format") + 1] if "--format" in args else ""
        inject_fault(state, "inspect", value)
        if not fmt:
            try:
                resolve_network(state, value)
            except KeyError:
                return 1
            return 0
        try:
            print(render_network(state, value, fmt))
        except (KeyError, ValueError):
            return 1
        return 0
    if action == "create":
        name = args[-1]
        # Docker refuses a same-name network and leaves the existing object
        # untouched; the harness must expose that conflict.
        if name in state["networks"]:
            return 1
        labels: dict[str, str] = {}
        for index, value in enumerate(args):
            if value == "--label" and index + 1 < len(args) and "=" in args[index + 1]:
                key, label_value = args[index + 1].split("=", 1)
                labels[key] = label_value
        state["networks"][name] = network(name, labels)
        save(state)
        return 0
    if action in {"connect", "disconnect"}:
        aliases: list[str] = []
        values: list[str] = []
        index = 1
        while index < len(args):
            if args[index] == "--alias" and index + 1 < len(args):
                aliases.append(args[index + 1])
                index += 2
            else:
                values.append(args[index])
                index += 1
        if len(values) < 2:
            return 1
        network_name, net = resolve_network(state, values[-2])
        container_name, item = resolve_container(state, values[-1])
        if action == "connect":
            aliases = aliases or [container_name]
            item["networks"][network_name] = {"aliases": aliases}
            net["containers"][item["id"]] = {"Name": f"/{container_name}", "Aliases": aliases}
        else:
            item["networks"].pop(network_name, None)
            net["containers"].pop(item["id"], None)
        save(state)
        return 0
    if action == "rm":
        name = args[-1]
        _, item = resolve_network(state, name)
        if item["containers"]:
            return 1
        state["networks"].pop(name, None)
        save(state)
        return 0
    return 1


def do_exec(state: dict[str, Any], args: list[str]) -> int:
    interactive = bool(args and args[0] == "-i")
    if interactive:
        args = args[1:]
    if len(args) < 2:
        return 1
    caller = args[0]
    command = " ".join(args[1:])
    stdin_payload = sys.stdin.read() if interactive else ""
    if "CATERING_ENABLE_WEB_RECIPE_SEARCH" in command:
        try:
            _, item = resolve_container(state, caller)
        except (KeyError, ValueError):
            return 1
        value = item.get("config", {}).get("env", {}).get("CATERING_ENABLE_WEB_RECIPE_SEARCH")
        print(value if value is not None else "__absent__")
        return 0
    if re.search(r"\bcommand\s+-v\s+nc\b", command):
        return 1 if state.get("fault") == "nc-missing" else 0
    urls = re.findall(r"https?://[^\s'\"]+", command)
    target = stdin_payload.strip().splitlines()[0] if stdin_payload.strip() else (urls[-1] if urls else "")
    parsed = urlparse(target)
    host = parsed.hostname or ""
    negative = bool(re.search(r"(?:^|[;&|\s])!\s*(?:wget|nc|netcat)", command))
    # This scenario models one failed mutating probe; persist consumption so
    # the fresh post-restore smoke exercises the normal service response.
    if state.get("fault") == "semantic-smoke-fail" and host == "web" and not state.get("fault_triggered"):
        state["fault_triggered"] = True
        save(state)
        return 1
    if state.get("fault") == "semantic-smoke-incomplete" and host == "commcats-eventos-app" and not state.get("fault_triggered"):
        state["fault_triggered"] = True
        save(state)
        print("{}")
        return 0
    if state.get("fault") == "foreign-smoke-fail" and host in {"zeiterfassung-app-1", "commcats-eventos-app"} and not negative:
        return 1
    tcp_tail = re.search(r"\b(?:nc|netcat)\b(?P<rest>.*)$", command)
    tcp_tokens = tcp_tail.group("rest").strip().split() if tcp_tail else []
    if len(tcp_tokens) >= 2 and re.fullmatch(r"[A-Za-z0-9._-]+", tcp_tokens[-2]) and re.fullmatch(r"[0-9]{1,5}", tcp_tokens[-1]):
        tcp_host = tcp_tokens[-2]
        is_reachable = reachable(state, caller, tcp_host)
        return 0 if (is_reachable and not negative) or (negative and not is_reachable) else 1
    if host == "egress.invalid":
        try:
            caller_networks = set(resolve_container(state, caller)[1]["networks"])
        except (KeyError, ValueError):
            return 1
        # The provider proof is valid only from the active internal Catering
        # service after its legacy compatibility path has been detached.
        if "catering_private" not in caller_networks or "platform-infra_default" in caller_networks:
            return 1
        if state.get("fault") == "egress-fail":
            return 1
        print("status=ok http=200")
        return 0
    is_reachable = reachable(state, caller, host) if host else False
    if negative:
        return 0 if not is_reachable else 1
    if host == "postgres" and ":5432" in target:
        return 1
    if not is_reachable and host not in {"iranmonitor.invalid"}:
        return 1
    if state.get("fault") == "crash-after-rollback" and marker_state() == "candidate" and "web:8081" in command:
        # Force the real helper into its compensating rollback; the next
        # inspect while rolling_back is the durable crash boundary.
        return 1
    if state.get("fault") == "crash-after-receipt" and marker_state() == "candidate" and "web:8081" in command:
        # Fail the semantic gate normally so the real helper enters its
        # compensating rollback; inject the crash only after its receipt exists.
        return 1
    if host == "web":
        print('{"service":"intake-service","status":"ok"}')
    elif host == "zeiterfassung-app-1":
        print('{"status":"ok"}')
    elif host == "commcats-eventos-app":
        print('{"status":"ok"}')
    else:
        print('{"status":"ok"}')
    return 0


def do_compose(state: dict[str, Any], args: list[str]) -> int:
    if args[:1] == ["version"] and "--short" in args:
        print("2.24.4")
        return 0
    if state.get("fault") == "compose-render-fail" and "config" in args:
        return 1
    return 0


def do_inspect(state: dict[str, Any], args: list[str]) -> int:
    if not args:
        return 1
    value = args[-1]
    fmt = args[args.index("--format") + 1] if "--format" in args else ""
    inject_fault(state, "inspect", value)
    try:
        _, item = resolve_container(state, value)
        if not fmt:
            return 0
        print(render_container(state, value, fmt))
        return 0
    except (KeyError, ValueError):
        return 1


def main(argv: list[str]) -> int:
    log(argv)
    if argv == ["--init"]:
        save(baseline_state())
        return 0
    state = load()
    if argv[:1] == ["--set-fault"]:
        state["fault"] = argv[1] if len(argv) > 1 else ""
        state["fault_triggered"] = False
        save(state)
        return 0
    if argv[:1] == ["network"]:
        return do_network(state, argv[1:])
    if argv[:1] == ["inspect"]:
        return do_inspect(state, argv[1:])
    if argv[:1] == ["exec"]:
        return do_exec(state, argv[1:])
    if argv[:1] == ["compose"]:
        return do_compose(state, argv[1:])
    return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
