import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..");
const helperPath = path.join(repoRoot, "platform-infra/scripts/catering-phase3-pilot.sh");
const fakeDockerPath = path.join(repoRoot, "platform-infra/scripts/phase3-fake-docker.py");

function source(relativePath: string) {
  const filePath = path.join(repoRoot, relativePath);
  expect(existsSync(filePath)).toBe(true);
  return readFileSync(filePath, "utf8");
}

describe("Phase 3 P1 correction reproducers", () => {
  test("RED A: terminal semantic smoke uses the public web identity after intake detach", () => {
    const helper = source("platform-infra/scripts/catering-phase3-pilot.sh");
    expect(helper).toContain('smoke_json catering "http://web:8081/api/intake/health" intake-service');
    expect(helper).not.toContain('smoke_json catering "http://intake:${CATERING_INTAKE_PORT}/health" intake-service');
    expect(helper).toContain("negative_edge_probes_all");
    const fakeDocker = source("platform-infra/scripts/phase3-fake-docker.py");
    expect(fakeDocker).toContain("def reachable");
    expect(fakeDocker).not.toContain('if "! wget" in command: return 0');
  });

  test("RED B: resume and rolling_back require complete, run-bound evidence", () => {
    const helper = source("platform-infra/scripts/catering-phase3-pilot.sh");
    expect(helper).toContain("validate_resume_evidence");
    for (const field of [
      "stage",
      "foreign_invariants_sha256",
      "smoke_readback_sha256",
      "adoption_count",
      "adoption_proof",
      "source_readback_sha256",
    ]) {
      expect(helper).toContain(field);
    }
    expect(helper).toContain("rolling_back");
    expect(helper).toMatch(/rolling_back[\s\S]{0,700}validate_receipt[\s\S]{0,700}(?:restore|fail)/);
    expect(helper).toMatch(/case "\$\{command_name\}:\$\{recovery_class\}" in[\s\S]*resume:candidate:resume/);
    expect(helper).toContain("validate_resume_evidence candidate");
    expect(helper).not.toMatch(/candidate\)\s*\n\s*write_control_marker active\s*$/m);
  });

  test("RED C: all Phase 3 lock acquisition is atomic and proves owner/mode/realpath", () => {
    const helper = source("platform-infra/scripts/catering-phase3-pilot.sh");
    expect(helper).not.toMatch(/sudo test -d [^\n]*lock/);
    expect(helper).not.toMatch(/sudo install -d [^\n]*lock/);
    expect(helper).toContain("mkdir -m 0700");
    expect(helper).toContain("realpath -e");
    expect(helper).toContain("stat -c '%a'");
    for (const relativePath of [
      "platform-infra/scripts/deploy-hetzner.sh",
      "platform-infra/scripts/deploy-web-listener-hetzner.sh",
      "edge-infra/scripts/deploy-hetzner.sh",
      "edge-infra/scripts/cutover-hetzner.sh",
    ]) {
      const caller = source(relativePath);
      expect(caller).not.toMatch(/sudo test -d [^\n]*deploy-lock/);
      expect(caller).not.toMatch(/sudo install -d [^\n]*deploy-lock/);
      expect(caller).toContain("verify_lock_owned");
      expect(caller).toContain("realpath -e");
      expect(caller).toContain("stat -c '%a'");
    }
  });

  test("RED D: baseline captures exact compatibility identity and rollback verifies it before cleanup", () => {
    const helper = source("platform-infra/scripts/catering-phase3-pilot.sh");
    for (const field of [
      "platform_network_baseline_id",
      "platform_network_baseline_members",
      "platform_network_baseline_aliases",
      "zeiterfassung_network_baseline_id",
      "zeiterfassung_network_baseline_members",
      "zeiterfassung_network_baseline_aliases",
      "catering_path_baseline",
    ]) {
      expect(helper).toContain(field);
    }
    expect(helper).toContain("assert_compatibility_baseline");
    expect(helper).toMatch(/assert_compatibility_baseline[\s\S]{0,1200}(?:remove_owned_network|network rm)/);
    expect(helper).toContain("foreign_restore");
    expect(helper).not.toMatch(/docker network rm platform-infra_default|docker network rm zeiterfassung_default/);
  });

  test("RED E: Basic Auth stays on stdin/config and never enters args or container env", () => {
    const files = [
      "platform-infra/scripts/deploy-web-listener-hetzner.sh",
      "platform-infra/scripts/smoke-check.sh",
      "edge-infra/scripts/deploy-hetzner.sh",
      "edge-infra/scripts/diagnose-catering-identity.sh",
    ];
    for (const relativePath of files) {
      const script = source(relativePath);
      expect(script).not.toMatch(/docker compose[^\n]*exec[^\n]*-e[^\n]*(?:AUTH|PASSWORD|BASIC)/i);
      expect(script).not.toMatch(/--user\s+"\$\{[^}]+\}:\$\{[^}]+\}"/);
      expect(script).not.toMatch(/--header\s+"Authorization:\s*Basic\s+\$\{/i);
    }
    const listener = source("platform-infra/scripts/deploy-web-listener-hetzner.sh");
    expect(listener).toMatch(/--config\s+<\(/);
    expect(listener).toMatch(/mktemp(?:\s+|[^\n]*-)/);
  });

  test("security P1 A: the edge workflow claims locks with atomic mkdir and exact owner readback", () => {
    const workflow = source(".github/workflows/deploy-edge-production.yml");
    const lockFunction = workflow.match(/phase3_lock_acquire\(\)[\s\S]*?\n\s*}\n/)?.[0] ?? "";
    expect(lockFunction).toContain("sudo mkdir -m 0700 --");
    expect(lockFunction).not.toMatch(/sudo test -d|sudo install -d/);
    expect(lockFunction).toContain("realpath -e");
    expect(lockFunction).toContain("owner_token=");
    expect(lockFunction).toContain("stat -c '%a'");
    expect(lockFunction).toContain("chmod 0600");
    const releaseStep = workflow.slice(workflow.lastIndexOf("phase3-lock-release"));
    expect(releaseStep).toContain("if: ${{ always() && (steps.deploy_edge.outcome == 'success' || steps.deploy_edge.outputs.rollback_outcome == 'successful') }}");
    expect(releaseStep).not.toContain("if: success()");
    expect(releaseStep).toContain("verify_lock_owned");
    expect(releaseStep).not.toMatch(/sudo test -f[^\n]*owner/);
  });

  test("security P1 B: platform callers retain an authenticated recovery gate across all signals", () => {
    for (const relativePath of [
      "platform-infra/scripts/deploy-hetzner.sh",
      "platform-infra/scripts/deploy-web-listener-hetzner.sh",
    ]) {
      const caller = source(relativePath);
      expect(caller).toMatch(/RECOVERY_REQUIRED|recovery_required/);
      expect(caller).toMatch(/trap[^\n]*ERR/);
      expect(caller).toMatch(/trap[^\n]*TERM/);
      expect(caller).toMatch(/trap[^\n]*INT/);
      expect(caller).toMatch(/trap[^\n]*HUP/);
      expect(caller).toMatch(/PortBindings|port_bindings/);
      expect(caller).toMatch(/restore|rollback/);
    }
  });

  test("security P1 C: edge distinguishes acquired and reentrant locks and never releases during recovery", () => {
    const edge = source("edge-infra/scripts/deploy-hetzner.sh");
    expect(edge).toMatch(/EDGE_LOCK_(?:MODE|ACQUIRED|REENTRANT)/);
    expect(edge).toContain("acquired");
    expect(edge).toContain("reentrant");
    expect(edge).toMatch(/release_edge_lock[\s\S]{0,700}EDGE_RECOVERY_REQUIRED/);
    expect(edge).toMatch(/phase3_release[\s\S]{0,500}RECOVERY_REQUIRED|RECOVERY_REQUIRED[\s\S]{0,500}phase3_release/);
  });

  test("security P1 D: pilot does not invent an external Iranmonitor service identity", () => {
    const helper = source("platform-infra/scripts/catering-phase3-pilot.sh");
    expect(helper).not.toContain("IRANMONITOR_PUBLIC_URL");
    expect(helper).not.toMatch(/smoke_json\s+iranmonitor/);
    expect(helper).toContain("IRANMONITOR_WEB");
    expect(helper).toContain("IRANMONITOR_INGEST");
    expect(helper).toContain("IRANMONITOR_DB");
  });

  test("pilot emits GO only after verified lock release and has signal recovery gates", () => {
    const helper = source("platform-infra/scripts/catering-phase3-pilot.sh");
    const goIndex = helper.lastIndexOf("printf '%s\\n' \"PILOT: GO\"");
    const releaseIndex = helper.lastIndexOf("phase3_lock_release");
    expect(goIndex).toBeGreaterThanOrEqual(0);
    expect(releaseIndex).toBeGreaterThanOrEqual(0);
    expect(releaseIndex).toBeLessThan(goIndex);
    expect(helper).toMatch(/trap[^\n]*ERR/);
    expect(helper).toMatch(/trap[^\n]*TERM/);
    expect(helper).toMatch(/trap[^\n]*INT/);
    expect(helper).toMatch(/trap[^\n]*HUP/);
  });
});
