import { readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const runner = () => [
  readFileSync(path.join(root, "platform-infra/scripts/update-catering-target.sh"), "utf8"),
  readFileSync(path.join(root, "platform-infra/scripts/catering-target-production-update.sh"), "utf8")
].join("\n");
const smoke = () => readFileSync(path.join(root, "platform-infra/scripts/catering-target-authenticated-smoke.mjs"), "utf8");
const operatorSmoke = () => readFileSync(path.join(root, "platform-infra/scripts/catering-target-operator-smoke.mjs"), "utf8");

describe("Catering target production command boundary", () => {

  it("executes remote bundle verification against v4 archive bytes and rejects rehashed R/M/C drift", () => {
    const production = readFileSync(path.join(root, "platform-infra/scripts/catering-target-production-update.sh"), "utf8");
    const block = production.match(/<<'REMOTE_BUNDLE_VERIFY'[^\n]*\n([\s\S]*?)\nREMOTE_BUNDLE_VERIFY/)?.[1];
    expect(block).toBeTruthy();
    const program = String.raw`
import hashlib, json, sys, tempfile
from pathlib import Path
sys.path.insert(0, str(Path.cwd() / 'tests'))
from catering_target_operator_test import build_fixture_bundle, operator, PRODUCT_SHA, OPERATIONS_SHA
sys.modules['catering_target_oci'] = operator._oci()
script = json.loads(sys.argv[1]).replace('__OCI_HELPER_PYTHON__', '').replace('root = Path(release_dir)', 'root = Path(fixture_root)')
for mutation in (None, 'indexDigest', 'platformManifestDigest', 'configDigest'):
    with tempfile.TemporaryDirectory() as tmp:
        out, sha, _, _, _ = build_fixture_bundle(Path(tmp))
        manifest = json.loads((out / 'manifest.json').read_text())
        runtime = manifest['images']['runtime']['platformManifestDigest']
        web = manifest['images']['web']['platformManifestDigest']
        if mutation:
            manifest['images']['runtime'][mutation] = 'sha256:' + 'f'*64
            (out / 'manifest.json').write_text(json.dumps(manifest))
            sha = hashlib.sha256((out / 'manifest.json').read_bytes()).hexdigest()
        sys.argv = ['-', '/opt/catering-releases/' + PRODUCT_SHA, sha, PRODUCT_SHA, OPERATIONS_SHA, runtime, web]
        try:
            exec(compile(script, '<remote-bundle>', 'exec'), {'fixture_root': str(out), '__name__': '__main__'})
        except (SystemExit, ValueError):
            if mutation is None: raise
        else:
            if mutation: raise AssertionError('remote runner accepted altered ' + mutation)
`;
    const result = spawnSync("python3", ["-B", "-c", program, JSON.stringify(block)], { cwd: root, encoding: "utf8" });
    expect(result.status, result.stderr).toBe(0);
  });

  it("executes trusted rendered preflight and verify container guards in isolated Python", () => {
    const production = readFileSync(path.join(root, "platform-infra/scripts/catering-target-production-update.sh"), "utf8");
    const renderer = production.match(/render_trusted_template\(\) \{[\s\S]*?\n\}/)?.[0];
    expect(renderer).toBeTruthy();
    const preflight = production.match(/running_identity_source\+='\n([\s\S]*?)\n'/)?.[1];
    expect(preflight).toBeTruthy();
    const blocks = ["__OCI_HELPER_PYTHON__\n" + preflight,
      ...[...production.matchAll(/<<'PY_RUNNING_IDENTITY'\n([\s\S]*?)\nPY_RUNNING_IDENTITY/g)].map((block) => block[1])];
    expect(blocks).toHaveLength(2);
    const directory = mkdtempSync(path.join(tmpdir(), "catering-v4-observed-"));
    const manifest = path.join(directory, "manifest.json");
    writeFileSync(manifest, JSON.stringify({ schemaVersion: 4 }));
    const m = "sha256:" + "a".repeat(64);
    const c = "sha256:" + "b".repeat(64);
    for (const block of blocks) {
      const rendered = spawnSync("/bin/bash", ["-c", renderer + "\nrender_trusted_template __OCI_HELPER_PYTHON__"], {
        input: block, encoding: "utf8", env: { ...process.env, OPERATIONS_ROOT: root },
      });
      expect(rendered.status, rendered.stderr).toBe(0);
      for (const [observation, success] of [
        [{ Image: m, State: { Running: true } }, true],
        [{ Image: m, State: { Running: true }, ImageManifestDescriptor: { digest: m } }, true],
        [{ Image: c, State: { Running: true } }, false],
        [{ Image: m, State: { Running: true }, ImageManifestDescriptor: { digest: c } }, false],
        [{ Image: m, State: { Running: false } }, false],
      ] as const) {
        const checked = spawnSync("python3", ["-B", "-I", "-", JSON.stringify(observation), m, manifest], {
          input: rendered.stdout, encoding: "utf8",
        });
        expect(checked.status === 0, checked.stderr).toBe(success);
      }
    }
  });

  it("preloads the trusted OCI module before executing the streamed stage tool", () => {
    const production = readFileSync(path.join(root, "platform-infra/scripts/catering-target-production-update.sh"), "utf8");
    const renderer = production.match(/render_trusted_template\(\) \{[\s\S]*?\n\}/)?.[0];
    const tool = path.join(root, "platform-infra/scripts/catering-target-stage-binding.py");
    const rendered = spawnSync("/bin/bash", ["-c", renderer + '\nrender_trusted_template __STAGE_BINDING_PYTHON__ "$1"', "renderer", tool], {
      input: "__STAGE_BINDING_PYTHON__\n", encoding: "utf8", env: { ...process.env, OPERATIONS_ROOT: root },
    });
    expect(rendered.status, rendered.stderr).toBe(0);
    const checked = spawnSync("python3", ["-B", "-I", "-", "--help"], { input: rendered.stdout, encoding: "utf8" });
    expect(checked.status, checked.stderr).toBe(0);
    expect(checked.stdout).toContain("inspect-existing");
  });

  it("executes post-load inspection and exported manifest/config relation checks", () => {
    const production = readFileSync(path.join(root, "platform-infra/scripts/catering-target-production-update.sh"), "utf8");
    const block = production.match(/<<'PY_LOADED_IDENTITY'\n([\s\S]*?)\nPY_LOADED_IDENTITY/)?.[1];
    expect(block).toBeTruthy();
    const program = String.raw`
import json, os, sys, tempfile
from pathlib import Path
sys.path.insert(0, str(Path.cwd() / 'tests'))
from catering_target_operator_test import build_fixture_bundle, operator
sys.modules['catering_target_oci'] = operator._oci()
script = json.loads(sys.argv[1]).replace('__OCI_HELPER_PYTHON__', '')
with tempfile.TemporaryDirectory() as tmp:
    out, _, _, _, _ = build_fixture_bundle(Path(tmp))
    original = json.loads((out / 'manifest.json').read_text())
    fixtures = {v['platformManifestDigest']: str(out / v['archive']) for v in original['images'].values()}
    fake = Path(tmp) / 'docker'
    fake.write_text('#!' + sys.executable + '\n' + 'import gzip,json,os,sys\nfrom pathlib import Path\n' +
        'fixtures=' + repr(fixtures) + '\n' +
        'reference=sys.argv[-1]\nassert reference in fixtures\n' +
        'if sys.argv[1:3] == ["image","inspect"]:\n print(json.dumps({"Id": reference if os.environ["OBSERVATION"] != "wrong-id" else "sha256:"+"f"*64, "Os":"linux", "Architecture":"amd64"}))\n' +
        'elif sys.argv[1] == "save":\n sys.stdout.buffer.write(gzip.decompress(Path(fixtures[reference]).read_bytes()))\n' +
        'else: raise SystemExit(1)\n')
    fake.chmod(0o755)
    os.environ['PATH'] = tmp + os.pathsep + os.environ['PATH']
    for mutation in ('valid', 'wrong-id', 'wrong-config'):
        os.environ['OBSERVATION'] = mutation
        manifest = json.loads(json.dumps(original))
        if mutation == 'wrong-config': manifest['images']['runtime']['configDigest'] = 'sha256:' + 'f'*64
        (out / 'manifest.json').write_text(json.dumps(manifest))
        sys.argv = ['-', str(out / 'manifest.json')]
        try:
            exec(compile(script, '<remote-loaded>', 'exec'), {'__name__': '__main__'})
        except (SystemExit, ValueError):
            if mutation == 'valid': raise
        else:
            if mutation != 'valid': raise AssertionError('accepted loaded ' + mutation)
`;
    const result = spawnSync("python3", ["-B", "-c", program, JSON.stringify(block)], { cwd: root, encoding: "utf8" });
    expect(result.status, result.stderr).toBe(0);
  });

  it("keeps every remote Bash heredoc syntactically valid", () => {
    const production = readFileSync(
      path.join(root, "platform-infra/scripts/catering-target-production-update.sh"),
      "utf8"
    );
    const blocks = [...production.matchAll(/<<'(REMOTE_[A-Z0-9_]+)'[^\n]*\n([\s\S]*?)\n\1/g)];
    const pythonNames = new Set([
      "REMOTE_BUNDLE_VERIFY",
      "REMOTE_INSTALL_RECEIPT_VERIFY"
    ]);
    const bashBlocks = blocks.filter((match) => !pythonNames.has(match[1] ?? ""));
    expect(bashBlocks.map((match) => match[1])).toEqual([
      "REMOTE_SCHEMA_SOURCE",
      "REMOTE_DDL_MANIFEST",
      "REMOTE_PREFLIGHT",
      "REMOTE_STAGE_INSPECT",
      "REMOTE_STAGE_RECEIPT",
      "REMOTE_STAGE_VERIFY",
      "REMOTE_LOCK",
      "REMOTE_UNLOCK",
      "REMOTE_RELEASE",
      "REMOTE_LOAD",
      "REMOTE_ROLLBACK_RELEASE",
      "REMOTE_ACTIVATE",
      "REMOTE_VERIFY"
    ]);
    for (const match of bashBlocks) {
      const check = spawnSync("/bin/bash", ["-n"], {
        input: match[2] ?? "",
        encoding: "utf8"
      });
      expect(check.status, `${match[1]}: ${check.stderr}`).toBe(0);
    }
    const pythonBlocks = blocks.filter((match) => pythonNames.has(match[1] ?? ""));
    expect(pythonBlocks.map((match) => match[1])).toEqual([
      "REMOTE_BUNDLE_VERIFY",
      "REMOTE_INSTALL_RECEIPT_VERIFY"
    ]);
    for (const match of pythonBlocks) {
      const check = spawnSync("python3", ["-c", "import ast,sys; ast.parse(sys.stdin.read())"], {
        input: match[2] ?? "",
        encoding: "utf8"
      });
      expect(check.status, `${match[1]}: ${check.stderr}`).toBe(0);
    }
  });

  it("keeps the remote bundle verification heredoc valid Python", () => {
    const production = readFileSync(
      path.join(root, "platform-infra/scripts/catering-target-production-update.sh"),
      "utf8"
    );
    const match = production.match(/<<'REMOTE_BUNDLE_VERIFY'[^\n]*\n([\s\S]*?)\nREMOTE_BUNDLE_VERIFY/);
    expect(match?.[1], "REMOTE_BUNDLE_VERIFY block missing").toBeTruthy();
    const check = spawnSync("python3", ["-c", "import ast,sys; ast.parse(sys.stdin.read())"], {
      input: match?.[1] ?? "",
      encoding: "utf8"
    });
    expect(check.status, check.stderr).toBe(0);
  });

  it("streams the versioned operator release verifier to the read-only remote preflight", () => {
    const production = readFileSync(
      path.join(root, "platform-infra/scripts/catering-target-production-update.sh"),
      "utf8"
    );
    expect(production).toContain("catering-target-release-state.py");
    expect(production).toContain("preflight_fail operator_release_binding");
    expect(production).toContain('[[ "$#" -eq 30 ]] || preflight_fail remote_argument_count');
    expect(production).toContain('runtime_state=release:%s');
  });

  it("uses the bound lowercase release root under the strict remote Bash shell", () => {
    const production = readFileSync(
      path.join(root, "platform-infra/scripts/catering-target-production-update.sh"),
      "utf8"
    );
    const match = production.match(/<<'REMOTE_PREFLIGHT'[^\n]*\n([\s\S]*?)\nREMOTE_PREFLIGHT/);
    expect(match?.[1], "REMOTE_PREFLIGHT block missing").toBeTruthy();
    const remotePreflight = match?.[1] ?? "";
    const releaseRoot = remotePreflight.match(/^\s*release_root="\/opt\/catering-releases"$/m)?.[0];
    const releasePath = remotePreflight.match(/^\s*release_dir="\$release_root\/\$active_release_sha"$/m)?.[0];
    expect(releaseRoot).toBeTruthy();
    expect(releasePath).toBeTruthy();
    const check = spawnSync("/bin/bash", ["-euo", "pipefail", "-c", [
      releaseRoot,
      `active_release_sha="${"a".repeat(40)}"`,
      releasePath,
      '[[ "$release_dir" == "$release_root/$active_release_sha" ]]'
    ].join("\n")], { encoding: "utf8" });
    expect(check.status, check.stderr).toBe(0);
  });

  it("disables psql startup files in the read-only remote preflight", () => {
    const production = readFileSync(
      path.join(root, "platform-infra/scripts/catering-target-production-update.sh"),
      "utf8"
    );
    const match = production.match(/<<'REMOTE_PREFLIGHT'[^\n]*\n([\s\S]*?)\nREMOTE_PREFLIGHT/);
    expect(match?.[1], "REMOTE_PREFLIGHT block missing").toBeTruthy();
    const remotePreflight = match?.[1] ?? "";
    expect(remotePreflight).toMatch(/\bpsql\b[^\n]*--no-psqlrc\b/);
  });

  it("reads installed migration and DDL source from all immutable runtime containers", () => {
    const production = readFileSync(
      path.join(root, "platform-infra/scripts/catering-target-production-update.sh"),
      "utf8"
    );
    expect(production).toContain("TARGET_RUNTIME_SCHEMA_HASHES");
    expect(production).toContain("TARGET_RUNTIME_DDL_HASHES");
    expect(production).toContain("/app/shared-core/src/persistence.ts");
    expect(production).toContain("for service in intake offer production exports; do");
    expect(production).toContain('sudo -n docker exec "$container"');
    expect(production).not.toMatch(/DEPLOY_PATH\}\/shared-core\/src\/persistence\.ts/);
    expect(production).toContain('fail "TARGET_PREFLIGHT_FAIL gate=runtime_schema_source"');
    expect(production).toContain('fail "TARGET_PREFLIGHT_FAIL gate=runtime_ddl_manifest"');
  });

  it("preserves the empty unlocked-preflight owner across SSH argument serialization", () => {
    const production = readFileSync(
      path.join(root, "platform-infra/scripts/catering-target-production-update.sh"),
      "utf8"
    );
    expect(production).toContain('expected_lock_owner_arg="__CATERING_NO_LOCK_OWNER__"');
    expect(production).toContain('"${expected_lock_owner_arg}"');
    const match = production.match(/<<'REMOTE_PREFLIGHT'[^\n]*\n([\s\S]*?)\nREMOTE_PREFLIGHT/);
    expect(match?.[1], "REMOTE_PREFLIGHT block missing").toBeTruthy();
    const remotePreflight = match?.[1] ?? "";
    expect(remotePreflight).toContain('[[ "$#" -eq 30 ]] || preflight_fail remote_argument_count');
    expect(remotePreflight).toContain('expected_owner_arg="$7"');
    expect(remotePreflight).toContain('expected_owner=""');
  });

  it("runs the local runtime DDL scanner with Python warnings treated as errors", () => {
    const production = readFileSync(
      path.join(root, "platform-infra/scripts/catering-target-production-update.sh"),
      "utf8"
    );
    const match = production.match(/runtime_ddl_manifest_hash\(\) \{[\s\S]*?python3 - "\$root" <<'PY'\n([\s\S]*?)\nPY\n\}/);
    expect(match?.[1], "local runtime DDL Python block missing").toBeTruthy();
    const check = spawnSync("python3", ["-W", "error", "-", root], {
      input: match?.[1] ?? "",
      encoding: "utf8"
    });
    expect(check.status, check.stderr).toBe(0);
    expect(check.stdout.trim()).toMatch(/^[0-9a-f]{64}$/);
  });

  it("checks the root-only runtime env through non-interactive sudo without reading its contents", () => {
    const production = readFileSync(
      path.join(root, "platform-infra/scripts/catering-target-production-update.sh"),
      "utf8"
    );
    const match = production.match(/<<'REMOTE_PREFLIGHT'[^\n]*\n([\s\S]*?)\nREMOTE_PREFLIGHT/);
    expect(match?.[1], "REMOTE_PREFLIGHT block missing").toBeTruthy();
    const remotePreflight = match?.[1] ?? "";
    expect(remotePreflight).toContain('sudo -n test -f "$runtime_env" || preflight_fail runtime_env_file');
    expect(remotePreflight).toContain('sudo -n test ! -L "$runtime_env" || preflight_fail runtime_env_symlink');
    expect(remotePreflight).toContain('sudo -n stat -c \'%u:%g:%a\' "$runtime_env"');
    expect(remotePreflight).not.toContain('sudo -n cat "$runtime_env"');
  });

  it("distinguishes target file absence, symlink, hash read failure, and actual hash drift", () => {
    const production = readFileSync(
      path.join(root, "platform-infra/scripts/catering-target-production-update.sh"),
      "utf8"
    );
    const match = production.match(/<<'REMOTE_PREFLIGHT'[^\n]*\n([\s\S]*?)\nREMOTE_PREFLIGHT/);
    expect(match?.[1], "REMOTE_PREFLIGHT block missing").toBeTruthy();
    const remotePreflight = match?.[1] ?? "";
    expect(remotePreflight).toContain('preflight_fail "${gate}_file"');
    expect(remotePreflight).toContain('preflight_fail "${gate}_symlink"');
    expect(remotePreflight).toContain('preflight_fail "${gate}_mode"');
    expect(remotePreflight).toContain('preflight_fail "${gate}_hash_read"');
    expect(remotePreflight).toContain('preflight_fail "${gate}_hash"');
    expect(remotePreflight).toContain('check_regular_hash "$platform_base" "$platform_base_hash" platform_base');
    expect(remotePreflight).toContain('check_regular_hash "$platform_ops" "$platform_ops_hash" platform_ops');
    expect(remotePreflight).toContain('check_regular_hash "$edge_base" "$edge_base_hash" edge_base');
    expect(remotePreflight).toContain('check_regular_hash "$edge_ops" "$edge_ops_hash" edge_ops');
    expect(remotePreflight).toContain('check_regular_hash "$edge_caddy" "$edge_caddy_hash" edge_caddy');
    expect(remotePreflight).toContain('check_regular_hash "$target_site" "$target_site_hash" target_site');
    expect(remotePreflight).not.toContain('check_regular_hash "$platform_base" "$platform_base_hash" ||');
  });

  it("binds preflight runtime files and Compose labels from contract v2 instead of reconstructing repo names", () => {
    const production = readFileSync(
      path.join(root, "platform-infra/scripts/catering-target-production-update.sh"),
      "utf8"
    );
    const contractValidator = readFileSync(
      path.join(root, "platform-infra/scripts/catering-target-contract.py"),
      "utf8"
    );
    const match = production.match(/<<'REMOTE_PREFLIGHT'[^\n]*\n([\s\S]*?)\nREMOTE_PREFLIGHT/);
    expect(match?.[1], "REMOTE_PREFLIGHT block missing").toBeTruthy();
    const remotePreflight = match?.[1] ?? "";
    expect(production).toContain("repositorySourcePaths.platformBase");
    expect(production).toContain("installedRuntime.platform.baseCompose");
    expect(production).toContain("installedRuntime.edge.baseCompose");
    expect(production).toContain("catering-target-contract.py");
    expect(production).toContain('fail "target contract or inventory has invalid control values"');
    expect(contractValidator).toContain('item.get("path") == remote_path and item.get("sourcePath") == source_path');
    expect(remotePreflight).toContain('platform_base="${10}"');
    expect(remotePreflight).toContain('edge_base="${14}"');
    expect(remotePreflight).toContain('target_site="${17}"');
    expect(remotePreflight).toContain("com.docker.compose.project.config_files");
    expect(remotePreflight).toContain('check_compose_labels "platform-infra-${service}-1"');
    expect(remotePreflight).toContain('check_compose_labels "catering-edge-edge-1"');
    expect(remotePreflight).not.toContain('$deploy_path/platform-infra/docker-compose.catering-target.json');
    expect(remotePreflight).not.toContain('$deploy_path/edge-infra/docker-compose.catering-target.json');
  });

  it("names critical read-only preflight failure gates without exposing values", () => {
    const production = readFileSync(
      path.join(root, "platform-infra/scripts/catering-target-production-update.sh"),
      "utf8"
    );
    const match = production.match(/<<'REMOTE_PREFLIGHT'[^\n]*\n([\s\S]*?)\nREMOTE_PREFLIGHT/);
    expect(match?.[1], "REMOTE_PREFLIGHT block missing").toBeTruthy();
    const remotePreflight = match?.[1] ?? "";
    for (const gate of [
      "remote_argument_count",
      "target_hostname",
      "deploy_path",
      "runtime_env_symlink",
      "runtime_env_mode",
      "target_update_lock_absent",
      "backup_observer_health",
      "platform_compose_render",
      "docker_network_set",
      "writer_mode",
      "schema_version",
      "postgres_network",
      "web_network",
      "edge_ports",
      "postgres_volume",
      "edge_image"
    ]) {
      expect(remotePreflight).toContain("preflight_fail " + gate);
    }
    expect(remotePreflight).toContain("TARGET_PREFLIGHT_FAIL gate=%s");
  });

  it("keeps local and remote runtime DDL detection semantics identical", () => {
    const production = readFileSync(
      path.join(root, "platform-infra/scripts/catering-target-production-update.sh"),
      "utf8"
    );
    const ddlRegex = 'ddl = re.compile(r"\\b(?:CREATE|ALTER|DROP)\\s+TABLE\\b|\\bCREATE\\s+(?:UNIQUE\\s+)?INDEX\\b", re.I)';
    expect(production.split(ddlRegex).length - 1).toBe(2);
  });

  it("implements strict read-only production preflight", () => {
    const text = runner();
    expect(text).toContain("--preflight");
    expect(text).toContain("StrictHostKeyChecking=yes");
    expect(text).toContain("UserKnownHostsFile=");
    expect(text).toContain("/usr/local/libexec/catering-backup-observer.py");
    expect(text).toContain("--check");
    expect(text).toContain("catering-prod-1");
    expect(text).not.toContain("normal target preflight is not enabled");
  });

  it("implements an explicitly confirmed production update mode", () => {
    const text = runner();
    expect(text).toContain("--update");
    expect(text).toContain("CATERING_TARGET_CONFIRMATION");
    expect(text).toContain("UPDATE_CATERING_TARGET");
    expect(text).toContain("docker build");
    expect(text).toContain("docker load");
    const contract = JSON.parse(readFileSync(path.join(root, "platform-infra/catering-target-update-contract.json"), "utf8"));
    expect(contract.repositorySourcePaths.platformBase).toBe("platform-infra/docker-compose.catering-target.json");
    expect(contract.repositorySourcePaths.platformOperations).toBe("platform-infra/docker-compose.catering-target.operations.json");
  });

  it("never references the historical shared deployment chain", () => {
    const text = runner();
    expect(text).not.toContain("zeiterfassung_default");
    expect(text).not.toContain("shared-edge");
    expect(text).not.toContain("deploy-hetzner.sh");
    expect(text).not.toContain("docker-compose.production.yml");
    expect(text).not.toContain("docker-compose.edge-cutover.yml");
  });

  it("performs an authenticated application-session read smoke without embedding credentials", () => {
    const runnerText = runner();
    const smokeText = smoke();
    expect(runnerText).toContain("catering-target-authenticated-smoke.mjs");
    expect(smokeText).toContain("/api/intake/v1/auth/login");
    expect(smokeText).toContain("/api/intake/v1/auth/session");
    expect(smokeText).toContain("/api/production/v1/production/cases");
    expect(smokeText).toContain("process.stdin");
    expect(smokeText).not.toContain("synthetic-password");
  });

  it("uses the operations-bound read-only plans smoke in the versioned operator path", () => {
    const production = readFileSync(
      path.join(root, "platform-infra/scripts/catering-target-production-update.sh"),
      "utf8"
    );
    const smokeText = operatorSmoke();
    const start = production.indexOf("authenticated_read_smoke() {");
    const end = production.indexOf("\n}\n", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(production.slice(start, end)).toContain("catering-target-operator-smoke.mjs");
    expect(production.slice(start, end)).toContain("CATERING_TARGET_OPERATIONS_COMMIT");
    expect(production.slice(start, end)).toMatch(/printf '%s' "\$\{payload\}" \| ssh_target sudo -n docker exec -i platform-infra-intake-1 node --input-type=module -e "\$\{smoke_source\}"/);
    expect(production.slice(start, end)).not.toContain("base64");
    expect(smokeText).toContain("/api/intake/v1/auth/login");
    expect(smokeText).toContain("/api/intake/v1/auth/session");
    expect(smokeText).toContain("/api/production/v1/production/plans");
    expect(smokeText).not.toContain("/api/production/v1/production/cases");
    expect(smokeText).toContain("process.stdin");
  });

  it("protects the server-owned configuration in production sync", () => {
    const text = runner();
    for (const excluded of ["platform-infra/.env", "platform-infra/sites", "data"]) {
      expect(text).toContain("--exclude=" + excluded);
    }
    expect(text).toContain("/etc/catering-target/runtime.env");
    expect(text).toContain("ServerAliveInterval=15");
    expect(text).toContain("ServerAliveCountMax=4");
  });

  it("checks operator bindings at phase entry and rechecks staged artifacts before apply", () => {
    const production = readFileSync(
      path.join(root, "platform-infra/scripts/catering-target-production-update.sh"),
      "utf8"
    );
    const inputValidation = production.slice(
      production.indexOf("validate_production_inputs() {"),
      production.indexOf("\n}\n", production.indexOf("validate_production_inputs() {"))
    );
    const apply = production.slice(
      production.indexOf("run_production_apply() {"),
      production.indexOf("\n}\n", production.indexOf("run_production_apply() {"))
    );
    expect(production).toContain('REPO_ROOT="${CATERING_TARGET_SOURCE_ROOT:-${OPERATIONS_ROOT}}"');
    expect(production).toContain('"${OPERATIONS_ROOT}/platform-infra/scripts/catering-target-operator.py" _gate');
    expect(inputValidation).toContain("operator_guard");
    expect(inputValidation).toContain("checked out operations commit does not match its binding");
    expect(apply).toContain("validate_production_inputs");
    expect(apply).toContain("verify_remote_bundle");
    expect(apply).toContain("verify_remote_stage_receipt");
    expect(apply).toContain("capture_previous_and_load_candidates");
    expect(apply).toContain('activate_remote_override "${release_dir}/candidate-images.json"');
    expect(production).toContain("verify_remote_bundle || return 1");
    expect(production).toContain("operations_commit={operations_commit}");
    expect(production).toContain("manifest_sha256={manifest_sha}");
  });

  it("keeps remote preflight GitHub-free while carrying operator bindings to release-state verification", () => {
    const production = readFileSync(
      path.join(root, "platform-infra/scripts/catering-target-production-update.sh"),
      "utf8"
    );
    const start = production.indexOf("remote_preflight() {");
    const end = production.indexOf("\n}\n", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const remotePreflight = production.slice(start, end);
    expect(remotePreflight).toContain('operations_commit_arg="${CATERING_TARGET_OPERATIONS_COMMIT}"');
    expect(remotePreflight).toContain('manifest_sha_arg="${CATERING_TARGET_MANIFEST_SHA256:-__CATERING_LEGACY__}"');
    expect(remotePreflight).toContain('"${operations_commit_arg}" "${manifest_sha_arg}"');
    expect(remotePreflight).not.toContain("operator_guard");
    expect(remotePreflight).not.toContain("gh ");
  });

  it("validates a previously installed release independently before rollback activation", () => {
    const production = readFileSync(
      path.join(root, "platform-infra/scripts/catering-target-production-update.sh"),
      "utf8"
    );
    const start = production.indexOf("activate_remote_override() {");
    const end = production.indexOf("\n}\n", start);
    const activation = production.slice(start, end);
    const rollbackBranch = activation.match(/elif \[\[ "\$\{PREVIOUS_RELEASE_SHA\}[\s\S]*?\n    else/);
    expect(rollbackBranch?.[0]).toContain('verify_remote_previous_release "${PREVIOUS_RELEASE_SHA}"');
    expect(rollbackBranch?.[0]).not.toContain("operator_guard");
    expect(rollbackBranch?.[0]).not.toContain("verify_remote_bundle");
    expect(production).toContain('<<\'REMOTE_ROLLBACK_RELEASE\' | ssh_target sudo -n /usr/bin/python3 -I -');
  });

  it("disables sender ownership preservation for both root-received rsync phases", () => {
    const production = readFileSync(
      path.join(root, "platform-infra/scripts/catering-target-production-update.sh"),
      "utf8"
    );
    const sourceSync = production.match(/^\s*rsync -az ([^\n]*source_sync_root[^\n]*)$/m)?.[1] ?? "";
    const bundleSync = production.match(/^\s*rsync -az ([^\n]*bundle_files[^\n]*)$/m)?.[1] ?? "";
    for (const args of [sourceSync, bundleSync]) {
      expect(args).toContain("--no-owner");
      expect(args).toContain("--no-group");
      expect(args).toContain('--rsync-path="sudo -n rsync"');
    }
  });
});
