import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const shellPath = resolve(root, "scripts/browser-rehearsal-shell.sh");
const workflow = readFileSync(resolve(root, ".github/workflows/ci.yml"), "utf8");
const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
  scripts?: Record<string, string>;
};
const rehearsal = readFileSync(resolve(root, "scripts/check-browser-rehearsal.sh"), "utf8");
const browserShell = readFileSync(resolve(root, "scripts/browser-rehearsal-shell.sh"), "utf8");
const homeMarkers = readFileSync(resolve(root, "scripts/browser-rehearsal/home-markers.js"), "utf8");
const homeToOffer = readFileSync(resolve(root, "scripts/browser-rehearsal/home-to-offer.js"), "utf8");
const offerEmptyMarkers = readFileSync(resolve(root, "scripts/browser-rehearsal/offer-empty-markers.js"), "utf8");
const productionEmptyMarkers = readFileSync(
  resolve(root, "scripts/browser-rehearsal/production-empty-markers.js"),
  "utf8",
);
const productionHandoffMarkers = readFileSync(
  resolve(root, "scripts/browser-rehearsal/production-handoff-markers.js"),
  "utf8",
);
const createOfferCase = readFileSync(
  resolve(root, "scripts/browser-rehearsal/create-offer-case.js"),
  "utf8",
);
const openOfferHistoryItem = readFileSync(
  resolve(root, "scripts/browser-rehearsal/open-offer-history-item.js"),
  "utf8",
);
const fullFreshRehearsal = readFileSync(
  resolve(root, "scripts/check-browser-rehearsal-full-fresh.sh"),
  "utf8",
);

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

const runNavigationContract = (mode: "click-failure" | "path-failure") =>
  spawnSync(
    "bash",
    [
      "-c",
      `
source "$1"
set -euo pipefail
exec 3>&2
state_file="$(mktemp /tmp/catering-navigation-contract.XXXXXX)"
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
  if [[ "$2" == "click-failure" ]]; then
    printf 'Startaktion /angebot nicht klickbar\\n'
    return 1
  fi
  if [[ "$2" == "click-success" ]]; then
    return 0
  fi
  calls="$(<"$state_file")"
  calls=$((calls + 1))
  printf '%s' "$calls" > "$state_file"
  printf 'attempt=%s\\n' "$calls" >&3
  printf 'Navigation wartet auf /angebot; aktuell /\\n'
  return 1
}
click_script="click-success"
if [[ "$2" == "click-failure" ]]; then
  click_script="click-failure"
fi
click_rehearsal_link "Navigation-Vertrag" "/angebot" "$click_script"
`,
      "browser-contract",
      shellPath,
      mode,
    ],
    { cwd: root, encoding: "utf8" },
  );

const runFreshScopeContract = () =>
  spawnSync(
    "bash",
    [
      "-c",
      `
source "$1"
set +e
candidate_root="$(mktemp -d /tmp/catering-agents-rehearsal-manual-XXXXXX)"
data_root_file="$(mktemp /tmp/catering-fresh-scope-contract.XXXXXX)"
cleanup_scope() {
  if [[ -x /usr/bin/trash ]]; then
    /usr/bin/trash "$candidate_root" "$data_root_file" >/dev/null 2>&1 || true
  fi
}
trap cleanup_scope EXIT
printf '%s\\n' "$candidate_root" > "$data_root_file"
require_fresh_mutation_scope 0 0 0 1 0 "$data_root_file"
`,
      "browser-contract",
      shellPath,
    ],
    { cwd: root, encoding: "utf8" },
  );

const runFreshQuarantineFixture = (mode: "offer-case-failure" | "foreign-root" | "foreign-marker" | "symlink-root" | "owned-child-failure") => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "catering-fresh-quarantine-fixture-"));
  const tempRoot = mkdtempSync(join(tmpdir(), "catering-fresh-quarantine-tmp-"));
  const scriptsRoot = join(fixtureRoot, "scripts");
  const runtimeRoot = join(fixtureRoot, ".runtime", "local-stack");
  mkdirSync(scriptsRoot, { recursive: true });
  mkdirSync(runtimeRoot, { recursive: true });
  writeFileSync(join(scriptsRoot, "check-browser-rehearsal-full-fresh.sh"), fullFreshRehearsal);
  const startScript = mode === "offer-case-failure"
    ? [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        "ROOT_DIR=\"$(cd \"$(dirname \"${BASH_SOURCE[0]}\")/..\" && pwd)\"",
        "parent=\"${CATERING_FRESH_DATA_PARENT:?}\"",
        "root=\"$(mktemp -d \"${parent%/}/catering-agents-rehearsal-XXXXXX\")\"",
        "printf '%s\\n' \"$root\" > \"$ROOT_DIR/.runtime/local-stack/data-root.txt\"",
        "printf 'partial-state\\n' > \"$root/partial-state\"",
        "mkdir -p \"$parent/neighbour\"",
        "printf 'must-remain\\n' > \"$parent/neighbour/keep.txt\"",
      ].join("\n")
    : mode === "owned-child-failure"
      ? [
          "#!/usr/bin/env bash",
          "set -euo pipefail",
          "ROOT_DIR=\"$(cd \"$(dirname \"${BASH_SOURCE[0]}\")/..\" && pwd)\"",
          "parent=\"${CATERING_FRESH_DATA_PARENT:?}\"",
          "root=\"$(mktemp -d \"${parent%/}/catering-agents-rehearsal-XXXXXX\")\"",
          "printf '%s\\n' \"$root\" > \"$ROOT_DIR/.runtime/local-stack/data-root.txt\"",
          "sleep 60 &",
          "printf '%s\\n' \"$!\" > \"$root/child-pid\"",
          "printf 'partial-state\\n' > \"$root/partial-state\"",
          "exit 37",
        ].join("\n")
      : mode === "foreign-root"
      ? [
          "#!/usr/bin/env bash",
          "set -euo pipefail",
          "ROOT_DIR=\"$(cd \"$(dirname \"${BASH_SOURCE[0]}\")/..\" && pwd)\"",
          "external_root=\"$(mktemp -d \"${TMPDIR%/}/catering-foreign-root-XXXXXX\")\"",
          "printf '%s\\n' \"$external_root\" > \"$ROOT_DIR/.runtime/local-stack/data-root.txt\"",
          "printf 'foreign-state\\n' > \"$external_root/foreign-state\"",
        ].join("\n")
      : mode === "foreign-marker"
        ? [
            "#!/usr/bin/env bash",
            "set -euo pipefail",
            "ROOT_DIR=\"$(cd \"$(dirname \"${BASH_SOURCE[0]}\")/..\" && pwd)\"",
            "parent=\"${CATERING_FRESH_DATA_PARENT:?}\"",
            "root=\"$(mktemp -d \"${parent%/}/catering-agents-rehearsal-XXXXXX\")\"",
            "printf '%s\\n' \"$root\" > \"$ROOT_DIR/.runtime/local-stack/data-root.txt\"",
            "printf 'foreign-token\\n' > \"$root/.catering-rehearsal-owner-foreign\"",
          ].join("\n")
        : [
            "#!/usr/bin/env bash",
            "set -euo pipefail",
            "ROOT_DIR=\"$(cd \"$(dirname \"${BASH_SOURCE[0]}\")/..\" && pwd)\"",
            "parent=\"${CATERING_FRESH_DATA_PARENT:?}\"",
            "real_root=\"$(mktemp -d \"${TMPDIR%/}/catering-real-root-XXXXXX\")\"",
            "link_root=\"${parent}/catering-agents-rehearsal-ABC123\"",
            "ln -s \"$real_root\" \"$link_root\"",
            "printf '%s\\n' \"$link_root\" > \"$ROOT_DIR/.runtime/local-stack/data-root.txt\"",
          ].join("\n");
  writeFileSync(join(scriptsRoot, "start-fresh-local-stack.sh"), `${startScript}\n`);
  writeFileSync(join(scriptsRoot, "stop-local-stack.sh"), "#!/usr/bin/env bash\nexit 0\n");
  writeFileSync(
    join(scriptsRoot, "check-browser-rehearsal.sh"),
    "#!/usr/bin/env bash\nprintf 'simulierter OfferCase-Schreibfehler\\n' >&2\nexit 42\n",
  );
  for (const scriptName of [
    "check-browser-rehearsal-full-fresh.sh",
    "start-fresh-local-stack.sh",
    "stop-local-stack.sh",
    "check-browser-rehearsal.sh",
  ]) {
    chmodSync(join(scriptsRoot, scriptName), 0o755);
  }
  const env: NodeJS.ProcessEnv = { ...process.env, TMPDIR: tempRoot };
  delete env.CATERING_FRESH_DATA_PARENT;
  const result = spawnSync("bash", [join(scriptsRoot, "check-browser-rehearsal-full-fresh.sh")], {
    cwd: fixtureRoot,
    env,
    encoding: "utf8",
  });
  return { fixtureRoot, tempRoot, result };
};

const cleanupFreshQuarantineFixture = (fixtureRoot: string, tempRoot: string) => {
  rmSync(fixtureRoot, { recursive: true, force: true });
  rmSync(tempRoot, { recursive: true, force: true });
};

const runFreshRootPropagationContract = () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "catering-fresh-propagation-fixture-"));
  const tempRoot = realpathSync(mkdtempSync(join(tmpdir(), "catering-fresh-propagation-tmp-")));
  const scriptsRoot = join(fixtureRoot, "scripts");
  const runtimeRoot = join(fixtureRoot, ".runtime", "local-stack");
  mkdirSync(scriptsRoot, { recursive: true });
  mkdirSync(runtimeRoot, { recursive: true });
  writeFileSync(join(scriptsRoot, "check-browser-rehearsal-full-fresh.sh"), fullFreshRehearsal);
  writeFileSync(join(scriptsRoot, "browser-rehearsal-shell.sh"), browserShell);
  writeFileSync(
    join(scriptsRoot, "start-fresh-local-stack.sh"),
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      "ROOT_DIR=\"$(cd \"$(dirname \"${BASH_SOURCE[0]}\")/..\" && pwd)\"",
      "parent=\"${CATERING_FRESH_DATA_PARENT:?}\"",
      "root=\"$(mktemp -d \"${parent%/}/catering-agents-rehearsal-XXXXXX\")\"",
      "printf '%s\\n' \"$root\" > \"$ROOT_DIR/.runtime/local-stack/data-root.txt\"",
    ].join("\n") + "\n",
  );
  writeFileSync(join(scriptsRoot, "stop-local-stack.sh"), "#!/usr/bin/env bash\nexit 0\n");
  writeFileSync(
    join(scriptsRoot, "check-browser-rehearsal.sh"),
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      "ROOT_DIR=\"$(cd \"$(dirname \"${BASH_SOURCE[0]}\")/..\" && pwd)\"",
      "source \"$ROOT_DIR/scripts/browser-rehearsal-shell.sh\"",
      "require_fresh_mutation_scope 0 0 0 1 0 \"$ROOT_DIR/.runtime/local-stack/data-root.txt\"",
      "printf 'child-scope-ok\\n'",
    ].join("\n") + "\n",
  );
  for (const scriptName of [
    "check-browser-rehearsal-full-fresh.sh",
    "start-fresh-local-stack.sh",
    "stop-local-stack.sh",
    "check-browser-rehearsal.sh",
  ]) {
    chmodSync(join(scriptsRoot, scriptName), 0o755);
  }
  const result = spawnSync("bash", [join(scriptsRoot, "check-browser-rehearsal-full-fresh.sh")], {
    cwd: fixtureRoot,
    env: { ...process.env, TMPDIR: tempRoot },
    encoding: "utf8",
  });
  return { fixtureRoot, tempRoot, result };
};

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
    expect(workflow).toContain("sudo apt-get install --no-install-recommends -y screen");
    expect(workflow).toContain("screen --version");
    expect(workflow).toContain("browser:rehearsal:full-fresh");
    expect(workflow).not.toMatch(/continue-on-error:\s*true/u);
    expect(rehearsal).toContain("set -euo pipefail");
    expect(rehearsal).toContain("CATERING_BROWSER_REHEARSAL_CREATE_OFFER_CASE");
    expect(rehearsal).toContain('load_rehearsal_script "create-offer-case.js"');
    expect(rehearsal).toContain('load_rehearsal_script "production-handoff-markers.js"');
    expect(rehearsal).toContain('[[ "${CREATE_OFFER_CASE}" == "1" ]]');
    expect(rehearsal).toContain('run_browser reload >/dev/null');
  });

  it("requires standalone mutating rehearsal commands to opt into OfferCase creation", () => {
    for (const scriptName of [
      "browser:rehearsal",
      "browser:rehearsal:answer-submit",
      "browser:rehearsal:archive-intake",
      "browser:rehearsal:failed-upload",
    ]) {
      expect(packageJson.scripts?.[scriptName]).toContain("CATERING_BROWSER_REHEARSAL_CREATE_OFFER_CASE=1");
    }
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

  it("rejects a non-canonical path that only contains the Fresh marker", () => {
    const result = runFreshScopeContract();

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Synthetischer Angebotsfall darf nur unter einer Fresh-Datenwurzel angelegt werden.");
  });

  it("quarantines the complete active Fresh-Root after an outer OfferCase failure", () => {
    const { fixtureRoot, tempRoot, result } = runFreshQuarantineFixture("offer-case-failure");
    try {
      expect(result.status).toBe(42);
      expect(result.stderr).toContain("simulierter OfferCase-Schreibfehler");
      expect(result.stderr).toContain("Ursprungsfehler");
      const quarantineMatch = result.stderr.match(/Fresh-Root quarantiniert: ([^\n]+)/u);
      expect(quarantineMatch?.[1]).toBeTruthy();
      const quarantineRoot = quarantineMatch?.[1] ?? "";
      const activeRoot = readFileSync(
        join(fixtureRoot, ".runtime", "local-stack", "data-root.txt"),
        "utf8",
      ).trim();
      expect(existsSync(activeRoot)).toBe(false);
      expect(existsSync(quarantineRoot)).toBe(true);
      expect(readFileSync(join(quarantineRoot, "partial-state"), "utf8")).toBe("partial-state\n");
      expect(readFileSync(join(resolve(quarantineRoot, "..", "neighbour"), "keep.txt"), "utf8")).toBe("must-remain\n");
    } finally {
      cleanupFreshQuarantineFixture(fixtureRoot, tempRoot);
    }
  });

  it("rejects a Fresh-Root that is not owned by the current run", () => {
    const { fixtureRoot, tempRoot, result } = runFreshQuarantineFixture("foreign-root");
    try {
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("Fresh-Datenwurzel");
      expect(result.stderr).not.toContain("Fresh-Root quarantiniert:");
    } finally {
      cleanupFreshQuarantineFixture(fixtureRoot, tempRoot);
    }
  });

  it("rejects symlinked Fresh-Roots and foreign owner markers", () => {
    for (const mode of ["symlink-root", "foreign-marker"] as const) {
      const { fixtureRoot, tempRoot, result } = runFreshQuarantineFixture(mode);
      try {
        expect(result.status).not.toBe(0);
        expect(result.stderr).toMatch(/Fresh-Datenwurzel|Eigentümermarker/u);
        expect(result.stderr).not.toContain("Fresh-Root quarantiniert:");
      } finally {
        cleanupFreshQuarantineFixture(fixtureRoot, tempRoot);
      }
    }
  });

  it("rejects a symlink escape even when the target has a valid-looking Fresh name and marker", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "catering-fresh-symlink-contract-"));
    const realRoot = mkdtempSync(join(tmpdir(), "catering-fresh-symlink-target-"));
    const parentRoot = join(fixtureRoot, "catering-agents-rehearsal-parent-ABC123");
    mkdirSync(parentRoot, { recursive: true });
    const linkRoot = join(parentRoot, "catering-agents-rehearsal-ABC123");
    const marker = join(linkRoot, ".catering-rehearsal-owner-token");
    const dataRootFile = join(fixtureRoot, "data-root.txt");
    try {
      writeFileSync(join(realRoot, ".catering-rehearsal-owner-token"), "token\n");
      writeFileSync(dataRootFile, `${linkRoot}\n`);
      spawnSync("ln", ["-s", realRoot, linkRoot], { cwd: fixtureRoot, encoding: "utf8" });
      const result = spawnSync(
        "bash",
        ["-c", `source "$1"; CATERING_FRESH_OWNER_MARKER="$2" CATERING_FRESH_RUN_TOKEN=token require_fresh_mutation_scope 0 0 0 1 0 "$3"`, "browser-contract", shellPath, marker, dataRootFile],
        { cwd: root, encoding: "utf8" },
      );
      expect(result.status).not.toBe(0);
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
      rmSync(realRoot, { recursive: true, force: true });
    }
  });

  it("forwards the owned Fresh-Root marker to the child rehearsal process", () => {
    const { fixtureRoot, tempRoot, result } = runFreshRootPropagationContract();
    try {
      expect(result.status, `${result.stdout}${result.stderr}`).toBe(0);
      expect(result.stdout).toContain("child-scope-ok");
    } finally {
      cleanupFreshQuarantineFixture(fixtureRoot, tempRoot);
    }
  });

  it("preserves the start failure status and terminates descendants in the owned process group", () => {
    const { fixtureRoot, tempRoot, result } = runFreshQuarantineFixture("owned-child-failure");
    let childPid: number | undefined;
    try {
      const activeRoot = readFileSync(join(fixtureRoot, ".runtime", "local-stack", "data-root.txt"), "utf8").trim();
      const quarantineMatch = result.stderr.match(/Fresh-Root quarantiniert: ([^\n]+)/u);
      const persistedRoot = quarantineMatch?.[1] ?? activeRoot;
      childPid = Number.parseInt(readFileSync(join(persistedRoot, "child-pid"), "utf8").trim(), 10);
      expect(result.status).toBe(37);
      expect(Number.isInteger(childPid)).toBe(true);
      expect(() => process.kill(childPid!, 0)).toThrow();
    } finally {
      if (childPid) {
        try { process.kill(childPid, "SIGKILL"); } catch { /* bereits beendet */ }
      }
      cleanupFreshQuarantineFixture(fixtureRoot, tempRoot);
    }
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

  it("clicks the actual portal offer action and rejects the legacy label", () => {
    expect(homeToOffer).not.toContain("Angebotsagent öffnen");
    expect(homeToOffer).toContain("Neuen Auftrag beginnen");

    let clicks = 0;
    const actualLink = {
      offsetParent: {},
      textContent: "Neuen Auftrag beginnen",
      getAttribute: (name: string) => (name === "href" ? "/angebot" : null),
      click: () => {
        clicks += 1;
      }
    };
    const buildNavigation = (links: typeof actualLink[]) => {
      const document = { querySelectorAll: () => links };
      return new Function("document", `return (${homeToOffer});`)(document) as () => {
        clicked: string;
      };
    };

    expect(buildNavigation([actualLink])()).toEqual({ clicked: "Neuen Auftrag beginnen" });
    expect(clicks).toBe(1);

    const legacyLink = {
      ...actualLink,
      textContent: "Angebotsagent öffnen"
    };
    expect(() => buildNavigation([legacyLink])()).toThrow(
      "Start-Link zum Angebotsagent fehlt: Neuen Auftrag beginnen -> /angebot"
    );
  });

  it("does not treat a selected OfferCase as approved without server confirmation", async () => {
    let clicks = 0;
    let selected = false;
    const selectedCaseButton = {
      textContent: "Browser-Rehearsal - Besprechung - 06.11.2026 - 35 Personen",
      getAttribute: (name: string) => name === "aria-pressed" ? String(selected) : null,
      click: () => {
        clicks += 1;
        selected = true;
      },
    };
    const historyDetails = {
      open: false,
      querySelector: (selector: string) =>
        selector === "summary"
          ? { textContent: "Frühere Angebotsaufträge öffnen · 1 Auftrag" }
          : null,
      querySelectorAll: (selector: string) =>
        selector === "button[data-action='open-case']" ? [selectedCaseButton] : [],
    };
    const handoffDetails = {
      open: false,
      querySelector: (selector: string) =>
        selector === "summary"
          ? { textContent: "Für die Produktion übernommene Veranstaltungen" }
          : null,
      querySelectorAll: () => [],
    };
    const approvalButton = {
      textContent: "Variante freigeben: Standard",
      click: () => undefined,
    };
    const handoffLink = {
      offsetParent: {},
      textContent: "Zur Produktion",
    };
    const document = {
      body: {
        innerText: "Aktueller Entwurf: Besprechung für 35 Teilnehmer als Kaffeepause. Angebotsvariante wurde freigegeben.",
      },
      querySelectorAll: (selector: string) => {
        if (selector === "details") return [historyDetails, handoffDetails];
        if (selector === "button") return [approvalButton];
        if (selector === "a[href='/produktion']") return [handoffLink];
        return [];
      },
      querySelector: (selector: string) =>
        selector === "[aria-label='Kompakte Ergebniszusammenfassung']" ? {} : null,
    };
    const fetch = async (path: string) => ({
      ok: true,
      status: 200,
      json: async () => path.includes("/cases/")
        ? {
            case: {
              caseId: "offer-case-browser-rehearsal",
              product: "offer",
              displayName: "Browser-Rehearsal - Besprechung - 06.11.2026 - 35 Personen"
            },
            events: [{ revisionRef: { artifactType: "OfferDraft", artifactId: "draft-browser-rehearsal" } }]
          }
        : {
            draftId: "draft-browser-rehearsal",
            eventSummary: "Besprechung für 35 Teilnehmer als Kaffeepause.",
            proposedEventSpec: { specId: "spec-browser-rehearsal-offer-case" }
          }
    });
    const sessionStorage = { getItem: () => "offer-case-browser-rehearsal" };
    const openCase = new Function(
      "document",
      "fetch",
      "sessionStorage",
      "location",
      `return (${openOfferHistoryItem});`,
    )(document, fetch, sessionStorage, { pathname: "/angebot" }) as () => Promise<{ selected: string; caseId: string; draftId: string }>;

    await expect(openCase()).rejects.toThrow("Freigabezustand");
    expect(clicks).toBe(1);
  });

  it("rejects a generic production link when the server-side approval state is absent", async () => {
    const selectedCaseButton = {
      textContent: "Browser-Rehearsal - Besprechung - 06.11.2026 - 35 Personen",
      getAttribute: (name: string) => name === "aria-pressed" ? "true" : null,
      click: () => undefined,
    };
    const historyDetails = {
      open: false,
      querySelector: (selector: string) => selector === "summary"
        ? { textContent: "Frühere Angebotsaufträge öffnen · 1 Auftrag" }
        : null,
      querySelectorAll: (selector: string) => selector === "button[data-action='open-case']"
        ? [selectedCaseButton]
        : [],
    };
    const handoffDetails = {
      open: false,
      querySelector: (selector: string) => selector === "summary"
        ? { textContent: "Für die Produktion übernommene Veranstaltungen" }
        : null,
      querySelectorAll: () => [],
    };
    const approvalButton = { textContent: "Variante freigeben: Standard", click: () => undefined };
    const document = {
      body: { innerText: "Aktueller Entwurf: Besprechung für 35 Teilnehmer als Kaffeepause. Angebotsvariante wurde freigegeben." },
      querySelectorAll: (selector: string) => {
        if (selector === "details") return [historyDetails, handoffDetails];
        if (selector === "button") return [approvalButton];
        if (selector === "a[href='/produktion']") return [{ offsetParent: {}, textContent: "Zur Produktion" }];
        return [];
      },
      querySelector: (selector: string) => selector === "[aria-label='Kompakte Ergebniszusammenfassung']" ? {} : null,
    };
    const fetch = async (path: string) => ({
      ok: true,
      status: 200,
      json: async () => path.includes("/cases/")
        ? {
            case: { caseId: "offer-case-browser-rehearsal", product: "offer", displayName: "Browser-Rehearsal - Besprechung - 06.11.2026 - 35 Personen" },
            events: [{ revisionRef: { artifactType: "OfferDraft", artifactId: "draft-browser-rehearsal" } }],
          }
        : { draftId: "draft-browser-rehearsal", eventSummary: "Besprechung für 35 Teilnehmer als Kaffeepause.", proposedEventSpec: { specId: "spec-browser-rehearsal-offer-case" } },
    });
    const openCase = new Function(
      "document", "fetch", "sessionStorage", "location", `return (${openOfferHistoryItem});`,
    )(document, fetch, { getItem: () => "offer-case-browser-rehearsal" }, { pathname: "/angebot" }) as () => Promise<unknown>;

    await expect(openCase()).rejects.toThrow("Freigabezustand");
  });

  it("drives the approved offer to the explicit handoff boundary", async () => {
    let approved = false;
    let handoffCreated = false;
    let productionCaseCreated = false;
    let caseSelected = false;
    const calls: string[] = [];
    const selectedCaseButton = {
      textContent: "Browser-Rehearsal - Besprechung - 06.11.2026 - 35 Personen",
      getAttribute: (name: string) => name === "aria-pressed" ? String(caseSelected) : null,
      click: () => { caseSelected = true; },
    };
    const approvalButton = {
      textContent: "Variante freigeben: Standard",
      click: () => { void fetch("/api/offers/v1/offers/drafts/draft-browser-rehearsal/decision", { method: "POST" }); },
    };
    const handoffButton = {
      textContent: "An Produktion übergeben",
      getAttribute: () => null,
      click: () => {
        void fetch("/api/offers/v1/offers/approved/approved-offer-browser-rehearsal/handoffs", { method: "POST" });
        void fetch("/api/production/v1/production/cases/from-handoff/handoff-browser-rehearsal", { method: "POST" });
        void fetch("/api/production/v1/production/drafts/from-handoff/handoff-browser-rehearsal", { method: "POST" });
      },
    };
    const historyDetails = {
      open: false,
      querySelector: (selector: string) => selector === "summary" ? { textContent: "Frühere Angebotsaufträge öffnen · 1 Auftrag" } : null,
      querySelectorAll: (selector: string) => selector === "button[data-action='open-case']" ? [selectedCaseButton] : [],
    };
    const handoffDetails = {
      open: false,
      querySelector: (selector: string) => selector === "summary" ? { textContent: "Für die Produktion übernommene Veranstaltungen" } : null,
      querySelectorAll: () => [],
    };
    const document = {
      body: {
        get innerText() {
          return [
            "Aktueller Entwurf: Besprechung für 35 Teilnehmer als Kaffeepause.",
            approved ? "Angebotsvariante wurde freigegeben." : "",
            handoffCreated ? "Freigegebenes Angebot wurde an die Produktion übergeben." : "",
          ].join(" ");
        },
      },
      querySelectorAll: (selector: string) => {
        if (selector === "details") return [historyDetails, handoffDetails];
        if (selector === "button") return approved && !handoffCreated ? [handoffButton] : [approvalButton];
        if (selector === "a[href='/produktion']") return handoffCreated ? [{ offsetParent: {}, textContent: "Zur Produktion" }] : [];
        return [];
      },
      querySelector: (selector: string) => selector === "[aria-label='Kompakte Ergebniszusammenfassung']" ? {} : null,
    };
    const session = new Map([["catering.browser-rehearsal.offer-case-id", "offer-case-browser-rehearsal"]]);
    const sessionStorage = { getItem: (key: string) => session.get(key) ?? null, setItem: (key: string, value: string) => session.set(key, value) };
    const fetch = async (path: string, _init?: unknown) => {
      calls.push(path);
      if (path.endsWith("/decision")) approved = true;
      if (path.includes("/handoffs") && path.includes("approved")) handoffCreated = true;
      if (path.includes("/production/cases/from-handoff")) productionCaseCreated = true;
      return {
        ok: true,
        status: 201,
        json: async () => {
          if (path.includes("/offers/cases/")) {
            return {
              case: {
                caseId: "offer-case-browser-rehearsal", product: "offer", displayName: "Browser-Rehearsal - Besprechung - 06.11.2026 - 35 Personen",
                ...(approved ? { approvedOfferId: "approved-offer-browser-rehearsal" } : {}),
                ...(handoffCreated ? { productionHandoffId: "handoff-browser-rehearsal" } : {}),
              },
              events: [
                { revisionRef: { artifactType: "OfferDraft", artifactId: "draft-browser-rehearsal" } },
                ...(approved ? [{ kind: "approval", artifactId: "approved-offer-browser-rehearsal" }] : []),
                ...(handoffCreated ? [{ kind: "result", artifactId: "handoff-browser-rehearsal" }] : []),
              ],
            };
          }
          if (path.includes("/offers/drafts/")) return { draftId: "draft-browser-rehearsal", eventSummary: "Besprechung für 35 Teilnehmer als Kaffeepause.", proposedEventSpec: { specId: "spec-browser-rehearsal-offer-case" } };
          if (path.includes("/offers/approved/") && path.includes("/handoffs") || path.includes("/offers/handoffs/")) return { handoff: { handoffId: "handoff-browser-rehearsal", approvedOfferId: "approved-offer-browser-rehearsal", source: { draftId: "draft-browser-rehearsal" }, eventSpecSnapshot: { specId: "spec-browser-rehearsal-offer-case" } } };
          if (path.includes("/production/cases?") || path.includes("/production/cases/")) return { items: [{ caseId: "production-case-browser-rehearsal", product: "production", displayName: "Besprechung · 35 Teilnehmer · 2026-11-06", productionHandoffId: "handoff-browser-rehearsal", sourceSpecId: "spec-browser-rehearsal-offer-case" }], case: { caseId: "production-case-browser-rehearsal", product: "production", displayName: "Besprechung · 35 Teilnehmer · 2026-11-06", productionHandoffId: "handoff-browser-rehearsal", sourceSpecId: "spec-browser-rehearsal-offer-case" } };
          return { draftId: "production-draft-browser-rehearsal" };
        },
      };
    };
    const openCase = new Function(
      "document", "fetch", "sessionStorage", "location", `return (${openOfferHistoryItem});`,
    )(document, fetch, sessionStorage, { pathname: "/angebot" }) as () => Promise<{
      caseId: string;
      draftId: string;
      approvedOfferId: string;
    }>;

    await expect(openCase()).resolves.toMatchObject({
      caseId: "offer-case-browser-rehearsal",
      draftId: "draft-browser-rehearsal",
      approvedOfferId: "approved-offer-browser-rehearsal",
    });
    expect(productionCaseCreated).toBe(false);
    expect(calls.some((path) => path.includes("/offers/approved/approved-offer-browser-rehearsal/handoffs"))).toBe(false);
  });

  it("uses an explicit handoff action as the route transition to production", async () => {
    const handoffScript = readFileSync(
      resolve(root, "scripts/browser-rehearsal/handoff-offer-case.js"),
      "utf8",
    );
    expect(rehearsal).toContain('load_rehearsal_script "handoff-offer-case.js"');
    const createFlow = rehearsal.slice(
      rehearsal.indexOf('if [[ "${CREATE_OFFER_CASE}" == "1" ]]'),
      rehearsal.indexOf("\nfi", rehearsal.indexOf('if [[ "${CREATE_OFFER_CASE}" == "1" ]]')),
    );
    expect(createFlow).toContain('click_rehearsal_link "Angebot -> Produktion Handoff" "/produktion" "${handoff_offer_case}"');
    expect(createFlow).not.toContain('"${offer_to_production}"');
    let route = "/angebot";
    let clicks = 0;
    const handoffButton = {
      textContent: "An Produktion übergeben",
      disabled: false,
      getAttribute: (name: string) => name === "aria-disabled" ? "false" : null,
      click: () => {
        clicks += 1;
        route = "/produktion";
      },
    };
    const document = {
      querySelectorAll: (selector: string) => selector === "button" ? [handoffButton] : [],
    };
    const location = { get pathname() { return route; } };
    const session = new Map([
      ["catering.browser-rehearsal.offer-case-id", "offer-case-browser-rehearsal"],
      ["catering.browser-rehearsal.offer-approved-offer-id", "approved-offer-browser-rehearsal"],
    ]);
    const startHandoff = new Function(
      "document",
      "location",
      "sessionStorage",
      `return (${handoffScript});`,
    )(document, location, { getItem: (key: string) => session.get(key) ?? null }) as () => Promise<unknown>;

    await expect(startHandoff()).resolves.toMatchObject({ route: "/angebot", clicked: true });
    expect(clicks).toBe(1);
    expect(route).toBe("/produktion");
  });

  it("confirms the server handoff after the browser has reached production", async () => {
    const confirmScript = readFileSync(
      resolve(root, "scripts/browser-rehearsal/confirm-production-handoff.js"),
      "utf8",
    );
    const session = new Map([
      ["catering.browser-rehearsal.offer-case-id", "offer-case-browser-rehearsal"],
      ["catering.browser-rehearsal.offer-draft-id", "draft-browser-rehearsal"],
      ["catering.browser-rehearsal.offer-approved-offer-id", "approved-offer-browser-rehearsal"],
      ["catering.browser-rehearsal.offer-spec-id", "spec-browser-rehearsal-offer-case"],
    ]);
    const calls: string[] = [];
    const fetch = async (path: string) => {
      calls.push(path);
      const payload = path.includes("/offers/cases/")
        ? {
            case: {
              caseId: "offer-case-browser-rehearsal",
              product: "offer",
              displayName: "Browser-Rehearsal - Besprechung - 06.11.2026 - 35 Personen",
              productionHandoffId: "handoff-browser-rehearsal",
            },
            events: [{ kind: "result", artifactId: "handoff-browser-rehearsal" }],
          }
        : path.includes("/offers/handoffs/")
          ? {
              handoff: {
                handoffId: "handoff-browser-rehearsal",
                approvedOfferId: "approved-offer-browser-rehearsal",
                source: { draftId: "draft-browser-rehearsal" },
                eventSpecSnapshot: { specId: "spec-browser-rehearsal-offer-case" },
              },
            }
          : path.includes("/production/cases?")
            ? {
                items: [{
                  caseId: "production-case-browser-rehearsal",
                  product: "production",
                  displayName: "Besprechung · 35 Teilnehmer · 2026-11-06",
                  productionHandoffId: "handoff-browser-rehearsal",
                  sourceSpecId: "spec-browser-rehearsal-offer-case",
                }],
              }
            : {
                case: {
                  caseId: "production-case-browser-rehearsal",
                  productionHandoffId: "handoff-browser-rehearsal",
                  sourceSpecId: "spec-browser-rehearsal-offer-case",
                },
              };
      return { ok: true, status: 200, text: async () => JSON.stringify(payload) };
    };
    const confirmHandoff = new Function(
      "fetch",
      "sessionStorage",
      "location",
      `return (${confirmScript});`,
    )(
      fetch,
      {
        getItem: (key: string) => session.get(key) ?? null,
        setItem: (key: string, value: string) => { session.set(key, value); },
      },
      { pathname: "/produktion" },
    ) as () => Promise<unknown>;

    await expect(confirmHandoff()).resolves.toMatchObject({
      route: "/produktion",
      caseId: "production-case-browser-rehearsal",
      handoffId: "handoff-browser-rehearsal",
      sourceSpecId: "spec-browser-rehearsal-offer-case",
    });
    expect(calls).toEqual([
      "/api/offers/v1/offers/cases/offer-case-browser-rehearsal",
      "/api/offers/v1/offers/handoffs/handoff-browser-rehearsal",
      "/api/production/v1/production/cases?search=Browser-Rehearsal%20-%20Besprechung%20-%2006.11.2026%20-%2035%20Personen",
      "/api/production/v1/production/cases/production-case-browser-rehearsal",
    ]);
    expect(session.get("catering.browser-rehearsal.production-case-id")).toBe("production-case-browser-rehearsal");
  });

  it("waits for the rendered handoff action to become enabled after approval refresh", async () => {
    let approved = false;
    let handoffCreated = false;
    let route = "/angebot";
    const handoffButton = {
      textContent: "An Produktion übergeben",
      disabled: true,
      getAttribute: (name: string) => name === "aria-disabled" ? null : null,
      click: () => {
        if (handoffButton.disabled) return;
        handoffCreated = true;
        route = "/produktion";
      },
    };
    const selectedCaseButton = {
      textContent: "Browser-Rehearsal - Besprechung - 06.11.2026 - 35 Personen",
      getAttribute: (name: string) => name === "aria-pressed" ? "true" : null,
      click: () => undefined,
    };
    const historyDetails = {
      open: false,
      querySelector: (selector: string) => selector === "summary"
        ? { textContent: "Frühere Angebotsaufträge öffnen · 1 Auftrag" }
        : null,
      querySelectorAll: (selector: string) => selector === "button[data-action='open-case']"
        ? [selectedCaseButton]
        : [],
    };
    const handoffDetails = {
      open: false,
      querySelector: (selector: string) => selector === "summary"
        ? { textContent: "Für die Produktion übernommene Veranstaltungen" }
        : null,
      querySelectorAll: () => [],
    };
    const approvalButton = {
      textContent: "Variante freigeben: Standard",
      click: () => {
        approved = true;
        setTimeout(() => { handoffButton.disabled = false; }, 20);
      },
    };
    const document = {
      body: {
        get innerText() {
          return [
            "Aktueller Entwurf: Besprechung für 35 Teilnehmer als Kaffeepause.",
            approved ? "Angebotsvariante wurde freigegeben." : "",
            handoffCreated ? "Freigegebenes Angebot wurde an die Produktion übergeben." : "",
          ].join(" ");
        },
      },
      querySelectorAll: (selector: string) => {
        if (selector === "details") return [historyDetails, handoffDetails];
        if (selector === "button") return approved && !handoffCreated ? [handoffButton] : [approvalButton];
        if (selector === "a[href='/produktion']") return handoffCreated ? [{ offsetParent: {}, textContent: "Zur Produktion" }] : [];
        return [];
      },
      querySelector: (selector: string) => selector === "[aria-label='Kompakte Ergebniszusammenfassung']" ? {} : null,
    };
    const session = new Map([["catering.browser-rehearsal.offer-case-id", "offer-case-browser-rehearsal"]]);
    const sessionStorage = {
      getItem: (key: string) => session.get(key) ?? null,
      setItem: (key: string, value: string) => { session.set(key, value); },
    };
    const fetch = async (path: string) => ({
      ok: true,
      status: 200,
      json: async () => {
        if (path.includes("/offers/cases/")) {
          return {
            case: {
              caseId: "offer-case-browser-rehearsal",
              product: "offer",
              displayName: "Browser-Rehearsal - Besprechung - 06.11.2026 - 35 Personen",
              ...(approved ? { approvedOfferId: "approved-offer-browser-rehearsal" } : {}),
              ...(handoffCreated ? { productionHandoffId: "handoff-browser-rehearsal" } : {}),
            },
            events: [
              { revisionRef: { artifactType: "OfferDraft", artifactId: "draft-browser-rehearsal" } },
              ...(approved ? [{ kind: "approval", artifactId: "approved-offer-browser-rehearsal" }] : []),
              ...(handoffCreated ? [{ kind: "result", artifactId: "handoff-browser-rehearsal" }] : []),
            ],
          };
        }
        if (path.includes("/offers/drafts/")) {
          return {
            draftId: "draft-browser-rehearsal",
            eventSummary: "Besprechung für 35 Teilnehmer als Kaffeepause.",
            proposedEventSpec: { specId: "spec-browser-rehearsal-offer-case" },
          };
        }
        if (path.includes("/offers/approved/") && path.includes("/handoffs")) {
          handoffCreated = true;
          return {
            handoff: {
              handoffId: "handoff-browser-rehearsal",
              approvedOfferId: "approved-offer-browser-rehearsal",
              source: { draftId: "draft-browser-rehearsal" },
              eventSpecSnapshot: { specId: "spec-browser-rehearsal-offer-case" },
            },
          };
        }
        if (path.includes("/offers/handoffs/")) {
          return {
            handoff: {
              handoffId: "handoff-browser-rehearsal",
              approvedOfferId: "approved-offer-browser-rehearsal",
              source: { draftId: "draft-browser-rehearsal" },
              eventSpecSnapshot: { specId: "spec-browser-rehearsal-offer-case" },
            },
          };
        }
        if (path.includes("/production/cases?")) {
          return { items: [{ caseId: "production-case-browser-rehearsal", product: "production", displayName: "Besprechung · 35 Teilnehmer · 2026-11-06" }] };
        }
        if (path.includes("/production/cases/")) {
          return { case: { caseId: "production-case-browser-rehearsal", productionHandoffId: "handoff-browser-rehearsal", sourceSpecId: "spec-browser-rehearsal-offer-case" } };
        }
        return { draftId: "production-draft-browser-rehearsal" };
      },
    });
    const openCase = new Function(
      "document", "fetch", "sessionStorage", "location", `return (${openOfferHistoryItem});`,
    )(document, fetch, sessionStorage, { pathname: "/angebot" }) as () => Promise<unknown>;

    const handoffScript = readFileSync(
      resolve(root, "scripts/browser-rehearsal/handoff-offer-case.js"),
      "utf8",
    );
    await expect(openCase()).resolves.toMatchObject({ approvedOfferId: "approved-offer-browser-rehearsal" });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(handoffButton.disabled).toBe(false);
    const startHandoff = new Function(
      "document",
      "location",
      "sessionStorage",
      `return (${handoffScript});`,
    )(document, { get pathname() { return route; } }, sessionStorage) as () => Promise<unknown>;
    await expect(startHandoff()).resolves.toMatchObject({ target: "/produktion", clicked: true });
    expect(handoffCreated).toBe(true);
  });

  it("fails closed when the rendered case action does not confirm selection", async () => {
    const selectedCaseButton = {
      textContent: "Browser-Rehearsal - Besprechung - 06.11.2026 - 35 Personen",
      getAttribute: (name: string) => name === "aria-pressed" ? "false" : null,
      click: () => undefined,
    };
    const historyDetails = {
      open: false,
      querySelector: (selector: string) =>
        selector === "summary"
          ? { textContent: "Frühere Angebotsaufträge öffnen · 1 Auftrag" }
          : null,
      querySelectorAll: (selector: string) =>
        selector === "button[data-action='open-case']" ? [selectedCaseButton] : [],
    };
    const handoffDetails = {
      open: false,
      querySelector: (selector: string) =>
        selector === "summary"
          ? { textContent: "Für die Produktion übernommene Veranstaltungen" }
          : null,
      querySelectorAll: () => [],
    };
    const approvalButton = {
      textContent: "Variante freigeben: Standard",
      click: () => undefined,
    };
    const handoffLink = { offsetParent: {}, textContent: "Zur Produktion" };
    const document = {
      body: {
        innerText: "Aktueller Entwurf: Besprechung für 35 Teilnehmer als Kaffeepause. Angebotsvariante wurde freigegeben.",
      },
      querySelectorAll: (selector: string) => {
        if (selector === "details") return [historyDetails, handoffDetails];
        if (selector === "button") return [approvalButton];
        if (selector === "a[href='/produktion']") return [handoffLink];
        return [];
      },
      querySelector: (selector: string) =>
        selector === "[aria-label='Kompakte Ergebniszusammenfassung']" ? {} : null,
    };
    const fetch = async (path: string) => ({
      ok: true,
      status: 200,
      json: async () => path.includes("/cases/")
        ? {
            case: {
              caseId: "offer-case-browser-rehearsal",
              product: "offer",
              displayName: "Browser-Rehearsal - Besprechung - 06.11.2026 - 35 Personen"
            },
            events: [{ revisionRef: { artifactType: "OfferDraft", artifactId: "draft-browser-rehearsal" } }]
          }
        : {
            draftId: "draft-browser-rehearsal",
            eventSummary: "Besprechung für 35 Teilnehmer als Kaffeepause.",
            proposedEventSpec: { specId: "spec-browser-rehearsal-offer-case" }
          }
    });
    const openCase = new Function(
      "document",
      "fetch",
      "sessionStorage",
      "location",
      `return (${openOfferHistoryItem});`,
    )(document, fetch, { getItem: () => "offer-case-browser-rehearsal" }, { pathname: "/angebot" }) as () => Promise<unknown>;

    await expect(openCase()).rejects.toThrow("Fallauswahl wurde nach");
  });

  it("rejects a client-only approval without a projected server approval", async () => {
    let approvalClicks = 0;
    let serverApprovalState: "pending" | "approved" = "pending";
    let caseSelected = false;
    const approvalRequests: string[] = [];
    const selectedCaseButton = {
      textContent: "Browser-Rehearsal - Besprechung - 06.11.2026 - 35 Personen",
      getAttribute: (name: string) => name === "aria-pressed" ? String(caseSelected) : null,
      click: () => {
        caseSelected = true;
      },
    };
    const approvalButton = {
      textContent: "Variante freigeben: Standard",
      click: () => {
        approvalClicks += 1;
        void fetch("/api/offers/v1/offers/drafts/draft-browser-rehearsal/decision", {
          method: "POST",
          body: JSON.stringify({ decision: "approved" })
        });
      },
    };
    const handoffLink = {
      offsetParent: {},
      textContent: "Zur Produktion",
    };
    const historyDetails = {
      open: false,
      querySelector: (selector: string) =>
        selector === "summary"
          ? { textContent: "Frühere Angebotsaufträge öffnen · 1 Auftrag" }
          : null,
      querySelectorAll: (selector: string) =>
        selector === "button[data-action='open-case']" ? [selectedCaseButton] : [],
    };
    const handoffDetails = {
      open: false,
      querySelector: (selector: string) =>
        selector === "summary"
          ? { textContent: "Für die Produktion übernommene Veranstaltungen" }
          : null,
      querySelectorAll: () => [],
    };
    const document = {
      body: {
        get innerText() {
          return serverApprovalState === "approved"
            ? "Aktueller Entwurf: Besprechung für 35 Teilnehmer als Kaffeepause. Angebotsvariante wurde freigegeben."
            : "Aktueller Entwurf: Besprechung für 35 Teilnehmer als Kaffeepause.";
        },
      },
      querySelectorAll: (selector: string) => {
        if (selector === "details") return [historyDetails, handoffDetails];
        if (selector === "button") return [approvalButton];
        if (selector === "a[href='/produktion']") return serverApprovalState === "approved" ? [handoffLink] : [];
        return [];
      },
      querySelector: (selector: string) =>
        selector === "[aria-label='Kompakte Ergebniszusammenfassung']" ? {} : null,
    };
    const fetch = async (path: string, _init?: unknown) => {
      if (path.endsWith("/decision")) {
        approvalRequests.push(path);
        serverApprovalState = "approved";
      }
      return {
        ok: true,
        status: 201,
        json: async () => path.includes("/cases/")
          ? {
              case: {
                caseId: "offer-case-browser-rehearsal",
                product: "offer",
                displayName: "Browser-Rehearsal - Besprechung - 06.11.2026 - 35 Personen"
              },
              events: [{ revisionRef: { artifactType: "OfferDraft", artifactId: "draft-browser-rehearsal" } }]
            }
          : {
              draftId: "draft-browser-rehearsal",
              eventSummary: "Besprechung für 35 Teilnehmer als Kaffeepause.",
              proposedEventSpec: { specId: "spec-browser-rehearsal-offer-case" }
            }
      };
    };
    const sessionStorage = { getItem: () => "offer-case-browser-rehearsal" };
    const openCase = new Function(
      "document",
      "fetch",
      "sessionStorage",
      "location",
      `return (${openOfferHistoryItem});`,
    )(document, fetch, sessionStorage, { pathname: "/angebot" }) as () => Promise<unknown>;

    await expect(openCase()).rejects.toThrow("Freigabezustand");
    expect(approvalClicks).toBe(1);
    expect(approvalRequests).toEqual([
      "/api/offers/v1/offers/drafts/draft-browser-rehearsal/decision"
    ]);
  });

  it("creates the rehearsal case and draft through the existing scoped offer endpoints", async () => {
    const calls: Array<{ path: string; init: { body?: string; headers?: Record<string, string> } }> = [];
    const fakeFetch = async (path: string, init: { body?: string; headers?: Record<string, string> }) => {
      calls.push({ path, init });
      if (path.endsWith("/intake/normalize")) {
        return {
          ok: true,
          status: 201,
          text: async () => JSON.stringify({ acceptedEventSpec: { specId: "spec-browser-rehearsal-offer-case" } }),
        };
      }
      if (path.endsWith("/offers/cases")) {
        return {
          ok: true,
          status: 201,
          text: async () => JSON.stringify({ case: { caseId: "offer-case-browser-rehearsal" } }),
        };
      }
      return {
        ok: true,
        status: 201,
        text: async () => JSON.stringify({
          draftId: "draft-browser-rehearsal",
          eventSummary: "Besprechung für 35 Teilnehmer als Kaffeepause."
        }),
      };
    };
    const createCase = new Function(
      "fetch",
      `return (${createOfferCase});`,
    )(fakeFetch) as () => Promise<{ caseId: string; draftId: string; eventSummary: string }>;

    await expect(createCase()).resolves.toEqual({
      caseId: "offer-case-browser-rehearsal",
      draftId: "draft-browser-rehearsal",
      eventSummary: "Besprechung für 35 Teilnehmer als Kaffeepause."
    });
    expect(calls.map((call) => call.path)).toEqual([
      "/api/intake/v1/intake/normalize",
      "/api/offers/v1/offers/cases",
      "/api/offers/v1/offers/from-text"
    ]);
    expect(JSON.parse(calls[0]?.init.body ?? "{}" as string)).toMatchObject({
      requestId: "browser-rehearsal-offer-case",
      text: "Besprechung am 2026-11-06 fuer 35 Teilnehmer mit Kaffeepause, Croissants und Wasserservice."
    });
    expect(calls[0]?.init.headers?.["x-actor-name"]).toBe("Intake-Mitarbeiter");
    expect(JSON.parse(calls[1]?.init.body ?? "{}" as string)).toMatchObject({
      customerName: "Browser-Rehearsal",
      eventTypeLabel: "Besprechung",
      attendeeCount: 35
    });
    expect(JSON.parse(calls[2]?.init.body ?? "{}" as string)).toMatchObject({
      caseId: "offer-case-browser-rehearsal",
      requestId: "browser-rehearsal-offer-case"
    });
    expect(calls.slice(1).every((call) => call.init.headers?.["x-actor-name"] === "Angebots-Mitarbeiter")).toBe(true);
  });

  it("rejects a legacy offer draft list without an explicit case action", async () => {
    const legacyButton = {
      textContent: "Besprechung · 35 Teilnehmer · Kaffeepause",
      click: () => undefined,
    };
    const legacyDetails = {
      open: false,
      querySelector: (selector: string) =>
        selector === "summary" ? { textContent: "Frühere Angebotsaufträge öffnen" } : null,
      querySelectorAll: (selector: string) => selector === "button" ? [legacyButton] : [],
    };
    const legacyDocument = {
      body: { innerText: "" },
      querySelectorAll: (selector: string) => selector === "details" ? [legacyDetails] : [],
      querySelector: () => null,
    };
    const fetch = async (path: string) => ({
      ok: true,
      status: 200,
      json: async () => path.includes("/cases/")
        ? {
            case: {
              caseId: "offer-case-browser-rehearsal",
              product: "offer",
              displayName: "Browser-Rehearsal - Besprechung - 06.11.2026 - 35 Personen"
            },
            events: [{ revisionRef: { artifactType: "OfferDraft", artifactId: "draft-browser-rehearsal" } }]
          }
        : {
            draftId: "draft-browser-rehearsal",
            eventSummary: "Besprechung für 35 Teilnehmer als Kaffeepause.",
            proposedEventSpec: { specId: "spec-browser-rehearsal-offer-case" }
          }
    });
    const sessionStorage = { getItem: () => "offer-case-browser-rehearsal" };
    const openLegacy = new Function(
      "document",
      "fetch",
      "sessionStorage",
      "location",
      `return (${openOfferHistoryItem});`,
    )(legacyDocument, fetch, sessionStorage, { pathname: "/angebot" }) as () => Promise<unknown>;

    await expect(openLegacy()).rejects.toThrow("Angebots-Historie fehlt");
  });

  it("surfaces a failed click with its concrete browser error", () => {
    const result = runNavigationContract("click-failure");

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Startaktion /angebot nicht klickbar");
  });

  it("fails bounded navigation waits with the last concrete path error", () => {
    const result = runNavigationContract("path-failure");

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("attempt=30");
    expect(result.stderr).not.toContain("attempt=31");
    expect(result.stderr).toContain("Navigation wartet auf /angebot; aktuell /");
  });

  it("binds the empty offer marker to a fresh zero-count state", () => {
    const requiredText = [
      "Angebotsagent",
      "Kundenanfrage einfügen und Entwurf prüfen",
      "Die App erstellt einen prüfbaren Angebotsentwurf.",
      "Frühere Angebotsaufträge öffnen",
      "0 Aufträge"
    ].join("\n");
    const buildMarkerCheck = (innerText: string) => {
      const document = {
        body: { innerText },
        querySelectorAll: () => []
      };
      return new Function(
        "document",
        "location",
        `return (${offerEmptyMarkers});`
      )(document, { pathname: "/angebot" }) as () => { route: string; markers: string };
    };

    expect(buildMarkerCheck(requiredText)()).toEqual({ route: "/angebot", markers: "offer-empty-ok" });
    for (const nonEmptyCount of ["2 Aufträge", "10 Aufträge"]) {
      expect(() => buildMarkerCheck(requiredText.replace("0 Aufträge", nonEmptyCount))()).toThrow(
        "0 Aufträge"
      );
    }
    expect(() => buildMarkerCheck(requiredText.replace("Frühere Angebotsaufträge öffnen", ""))()).toThrow(
      "Frühere Angebotsaufträge öffnen"
    );
  });

  it("accepts the actual fresh production empty state with zero orders", () => {
    const buildMarkerCheck = (orderCount: string) => {
      const freshProductionText = [
      "Produktionsagent",
      "Angebot hochladen oder Produktionsauftrag beschreiben",
      "Ablauf: Quelle → KI-Entwurf → Prüfung → Plan",
      "Frühere Produktionsaufträge öffnen",
        orderCount,
      ].join("\n");
      const document = {
        body: { innerText: freshProductionText },
        querySelectorAll: () => [],
      };
      return new Function(
        "document",
        "location",
        `return (${productionEmptyMarkers});`,
      )(document, { pathname: "/produktion" }) as () => { route: string; markers: string };
    };

    expect(buildMarkerCheck("0 Aufträge")()).toEqual({ route: "/produktion", markers: "production-empty-ok" });
    for (const nonEmptyCount of ["5 Aufträge", "10 Aufträge"]) {
      expect(() => buildMarkerCheck(nonEmptyCount)()).toThrow("0 Aufträge");
    }
    expect(() => buildMarkerCheck("0 Aufträge\n5 Aufträge")()).toThrow("widersprüchlicher Auftragszähler");
  });

  it("binds the fresh production handoff marker to the generated case instead of seeded plan data", () => {
    expect(productionHandoffMarkers).toContain("Besprechung · 35 Teilnehmer · 2026-11-06");
    expect(productionHandoffMarkers).toContain("Produktionsentwurf");
    expect(productionHandoffMarkers).toContain("veralteter Demo-Produktionsfall");
    expect(productionHandoffMarkers).not.toContain("Produktionsplan-Exportlink fehlt");
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
