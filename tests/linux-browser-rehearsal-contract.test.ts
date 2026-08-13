import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const shellPath = resolve(root, "scripts/browser-rehearsal-shell.sh");
const workflow = readFileSync(resolve(root, ".github/workflows/ci.yml"), "utf8");
const rehearsal = readFileSync(resolve(root, "scripts/check-browser-rehearsal.sh"), "utf8");
const browserShell = readFileSync(resolve(root, "scripts/browser-rehearsal-shell.sh"), "utf8");
const homeMarkers = readFileSync(resolve(root, "scripts/browser-rehearsal/home-markers.js"), "utf8");

const runMarkerContract = (mode: "eventual" | "permanent") =>
  spawnSync(
    "bash",
    [
      "-c",
      `
source "$1"
set -euo pipefail
exec 3>&2
state_file="$(mktemp /tmp/catering-marker-contract.XXXXXX)"
cleanup_state() {
  if [[ -x /usr/bin/trash ]]; then
    /usr/bin/trash "$state_file" >/dev/null 2>&1 || true
  fi
}
trap cleanup_state EXIT
printf '0' > "$state_file"
sleep() { :; }
run_browser() {
  local calls
  calls="$(<"$state_file")"
  calls=$((calls + 1))
  printf '%s' "$calls" > "$state_file"
  printf 'attempt=%s\\n' "$calls" >&3
  if [[ "$2" == "eventual" && "$calls" -lt 3 ]]; then
    printf 'marker pending on attempt %s\\n' "$calls"
    return 1
  fi
  if [[ "$2" == "permanent" ]]; then
    printf 'marker missing on attempt %s\\n' "$calls"
    return 1
  fi
  return 0
}
check_current_page_markers "Marker-Vertrag" "$2"
`,
      "browser-contract",
      shellPath,
      mode,
    ],
    { cwd: root, encoding: "utf8" },
  );

describe("Linux browser rehearsal governance", () => {
  it("requires a real Ubuntu browser job with a hard, fail-closed rehearsal", () => {
    expect(workflow).toContain("browser-rehearsal:");
    const browserJob = workflow.slice(workflow.indexOf("\n  browser-rehearsal:"));
    const jobEnv = browserJob.match(/\n    env:\n(?<body>(?:      .*\n)+?)\n    steps:/u)?.groups?.body ?? "";
    const npmSteps = browserJob
      .split(/\n      - name: /u)
      .slice(1)
      .filter((step) => /run:.*\bnpm\b|^\s+npx\b/mu.test(step));

    expect(jobEnv).not.toMatch(/\$\{\{\s*runner\./u);
    expect(npmSteps).toHaveLength(3);
    for (const step of npmSteps) {
      expect(step).toContain(
        "env:\n          npm_config_cache: ${{ runner.temp }}/catering-npm-cache",
      );
    }
    expect(workflow).toContain("runs-on: ubuntu-latest");
    expect(workflow).toContain("playwright-cli install-browser chrome-for-testing");
    expect(workflow).toContain("CATERING_BROWSER_CLI");
    expect(workflow).toContain("npm_config_cache: ${{ runner.temp }}/catering-npm-cache");
    expect(workflow).toContain("npm ci");
    expect(workflow).toContain("chmod +x scripts/ci-browser-cli.sh");
    expect(workflow).toContain("timeout 300 npm run browser:rehearsal:full-fresh");
    expect(workflow).toContain("browser:rehearsal:full-fresh");
    expect(workflow).not.toMatch(/continue-on-error:\s*true/u);
    expect(rehearsal).toContain("set -euo pipefail");
  });

  it("requires both target viewports in the executable harness", () => {
    expect(browserShell).toContain("run_browser resize");
    expect(browserShell).toContain("check_viewport");
    expect(browserShell).toContain("1440 900");
    expect(browserShell).toContain("390 844");
    expect(browserShell).toContain("run_browser --json console error");
    expect(browserShell).toContain("run_browser --json requests --filter '/api/'");
    expect(browserShell).toContain("require_empty_console_report");
    expect(browserShell).toContain("require_nonempty_request_report");
    expect(browserShell).toContain("JSON.parse");
    expect(browserShell).toContain("report.requests.length === 0");
    expect(rehearsal).toContain("check_current_page_markers_at_viewports");
    expect(browserShell).toContain("CATERING_BROWSER_CLI");
  });

  it("executes the home marker contract against the rendered portal actions", () => {
    expect(homeMarkers).not.toContain("Interner Arbeitsstand");
    expect(homeMarkers).not.toContain("Arbeitsweg: Start");
    expect(homeMarkers).not.toContain("keine automatische Allergen");
    expect(homeMarkers).not.toContain("Bestands- und Demo-Kontext");
    expect(homeMarkers).not.toContain("/produktion");
    expect(rehearsal).toContain('click_rehearsal_link "Angebot -> Produktion" "/produktion"');

    const actionLinks = [
      {
        offsetParent: {},
        textContent: "Neuen Auftrag beginnen",
        getAttribute: (name: string) => (name === "href" ? "/angebot" : null)
      },
      {
        offsetParent: {},
        textContent: "Frühere Aufträge",
        getAttribute: (name: string) => (name === "href" ? "/angebot#history" : null)
      }
    ];
    const portalDocument = {
      body: { innerText: "Catering-Agenten\nNeuen Auftrag beginnen\nFrühere Aufträge" },
      querySelectorAll: (selector: string) =>
        selector === "nav[aria-label='Startauswahl'] a" ? actionLinks : []
    };
    const buildMarkerCheck = (document: typeof portalDocument) =>
      new Function(
        "document",
        "location",
        `return (${homeMarkers});`
      )(document, { pathname: "/" }) as () => { route: string; markers: string };

    expect(buildMarkerCheck(portalDocument)()).toEqual({ route: "/", markers: "home-ok" });

    const missingHistoryActionDocument = {
      ...portalDocument,
      querySelectorAll: (selector: string) =>
        selector === "nav[aria-label='Startauswahl'] a" ? actionLinks.slice(0, 1) : []
    };
    expect(() => buildMarkerCheck(missingHistoryActionDocument)()).toThrow(
      "Startaktion fehlt: Frühere Aufträge -> /angebot#history"
    );
  });

  it("rejects a missing browser CLI before opening a stack or session", () => {
    const result = spawnSync("bash", [resolve(root, "scripts/check-browser-rehearsal.sh")], {
      cwd: root,
      env: { ...process.env, CATERING_BROWSER_CLI: "/definitely/missing/catering-browser-cli" },
      encoding: "utf8",
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("CATERING_BROWSER_CLI ist gesetzt, aber nicht ausfuehrbar");
  });

  it("rejects malformed and empty diagnostic JSON", () => {
    const run = (functionName: string, report: string) =>
      spawnSync(
        "bash",
        ["-c", `source "$1"; ${functionName} "$2"`, "browser-contract", shellPath, report],
        { cwd: root, encoding: "utf8" },
      );

    expect(run("require_empty_console_report", '{"messages":[]}').status).toBe(0);
    expect(run("require_empty_console_report", "not-json").status).not.toBe(0);
    expect(run("require_nonempty_request_report", '{"requests":[{"url":"/api/health"}]}').status).toBe(0);
    expect(run("require_nonempty_request_report", '{"requests":[]}').status).not.toBe(0);
  });

  it("retries a marker that appears during asynchronous initialisation", () => {
    const result = runMarkerContract("eventual");

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Browser-Marker sichtbar");
    expect(result.stderr).toContain("attempt=3");
  });

  it("fails bounded marker retries with the last concrete CLI error", () => {
    const result = runMarkerContract("permanent");

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("attempt=30");
    expect(result.stderr).toContain("marker missing on attempt 30");
  });
});
