import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const adapter = path.join(root, "platform-infra/scripts/catering-target-prebuilt-docker-adapter.sh");

function sha256(value: Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function createArchive(bundle: string, name: "runtime" | "web") {
  const output = execFileSync("python3", ["-", bundle, name], {
    encoding: "utf8",
    input: String.raw`
import gzip, hashlib, io, json, pathlib, sys, tarfile
bundle=pathlib.Path(sys.argv[1]); name=sys.argv[2]
config=json.dumps({"kind": name, "fixture": True}, sort_keys=True, separators=(",", ":")).encode()
config_hex=hashlib.sha256(config).hexdigest()
manifest=json.dumps({
  "schemaVersion":2,
  "mediaType":"application/vnd.oci.image.manifest.v1+json",
  "config":{"mediaType":"application/vnd.oci.image.config.v1+json","digest":"sha256:"+config_hex,"size":len(config)},
  "layers":[]
}, sort_keys=True, separators=(",", ":")).encode()
target_hex=hashlib.sha256(manifest).hexdigest()
index=json.dumps({
  "schemaVersion":2,
  "mediaType":"application/vnd.oci.image.index.v1+json",
  "manifests":[{"mediaType":"application/vnd.oci.image.manifest.v1+json","digest":"sha256:"+target_hex,"size":len(manifest)}]
}, sort_keys=True, separators=(",", ":")).encode()
buf=io.BytesIO()
with tarfile.open(fileobj=buf, mode="w") as tf:
  for path,data in [
    ("index.json",index),
    ("blobs/sha256/"+target_hex,manifest),
    ("blobs/sha256/"+config_hex,config),
  ]:
    info=tarfile.TarInfo(path); info.size=len(data); info.mode=0o644
    tf.addfile(info, io.BytesIO(data))
archive=gzip.compress(buf.getvalue())
(bundle/(name+"-image.tar.gz")).write_bytes(archive)
print(json.dumps({"config":"sha256:"+config_hex,"target":"sha256:"+target_hex,"archive":hashlib.sha256(archive).hexdigest()}))
`
  }).trim();
  return JSON.parse(output) as { config: string; target: string; archive: string };
}

function fixture() {
  const bundle = mkdtempSync(path.join(tmpdir(), "catering-target-prebuilt-bundle-"));
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const runtime = createArchive(bundle, "runtime");
  const web = createArchive(bundle, "web");
  writeFileSync(path.join(bundle, "manifest.json"), JSON.stringify({
    schemaVersion: 2,
    sourceCommit: head,
    runtimeConfigImage: runtime.config,
    runtimeTargetImage: runtime.target,
    webConfigImage: web.config,
    webTargetImage: web.target,
    files: {
      "runtime-image.tar.gz": runtime.archive,
      "web-image.tar.gz": web.archive
    }
  }, null, 2) + "\n");
  return { bundle, head, runtime, web };
}

function env(bundle: string) {
  return { ...process.env, CATERING_TARGET_PREBUILT_BUNDLE_DIR: bundle };
}

describe("Catering target prebuilt Docker adapter", () => {
  it("feeds target-addressable manifest IDs to the unchanged runner while preserving exact archive streams", () => {
    const f = fixture();
    const runtimeIid = path.join(f.bundle, "runtime.iid");
    const build = spawnSync(adapter, [
      "build",
      "--iidfile", runtimeIid,
      "--tag", "catering-target-runtime:" + f.head,
      "--file", path.join(root, "platform-infra/docker/Dockerfile.runtime"),
      root
    ], { cwd: root, env: env(f.bundle), encoding: "utf8" });
    expect(build.status, build.stderr).toBe(0);
    expect(readFileSync(runtimeIid, "utf8").trim()).toBe(f.runtime.target);
    expect(readFileSync(runtimeIid, "utf8").trim()).not.toBe(f.runtime.config);

    const save = spawnSync(adapter, ["save", f.runtime.target], {
      cwd: root,
      env: env(f.bundle),
      encoding: null
    });
    expect(save.status, save.stderr?.toString()).toBe(0);
    const decompressed = execFileSync("gzip", ["-dc", path.join(f.bundle, "runtime-image.tar.gz")]);
    expect(save.stdout).toEqual(decompressed);

    const configSave = spawnSync(adapter, ["save", f.runtime.config], {
      cwd: root,
      env: env(f.bundle),
      encoding: "utf8"
    });
    expect(configSave.status).not.toBe(0);
  });

  it("rejects a manifest whose target digest is not the OCI descriptor in the archive", () => {
    const f = fixture();
    const manifestPath = path.join(f.bundle, "manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    manifest.runtimeTargetImage = "sha256:" + "f".repeat(64);
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
    const iid = path.join(f.bundle, "runtime.iid");
    const result = spawnSync(adapter, [
      "build",
      "--iidfile", iid,
      "--tag", "catering-target-runtime:" + f.head,
      "--file", path.join(root, "platform-infra/docker/Dockerfile.runtime"),
      root
    ], { cwd: root, env: env(f.bundle), encoding: "utf8" });
    expect(result.status).not.toBe(0);
  });

  it("rejects a tampered archive before returning a target image id or stream", () => {
    const f = fixture();
    writeFileSync(path.join(f.bundle, "runtime-image.tar.gz"), Buffer.from("tampered"));
    const iid = path.join(f.bundle, "runtime.iid");
    const result = spawnSync(adapter, [
      "build",
      "--iidfile", iid,
      "--tag", "catering-target-runtime:" + f.head,
      "--file", path.join(root, "platform-infra/docker/Dockerfile.runtime"),
      root
    ], { cwd: root, env: env(f.bundle), encoding: "utf8" });
    expect(result.status).not.toBe(0);
  });

  it("rejects unrelated Docker commands and wrong source contexts", () => {
    const f = fixture();
    const unrelated = spawnSync(adapter, ["version"], { cwd: root, env: env(f.bundle), encoding: "utf8" });
    expect(unrelated.status).not.toBe(0);

    const other = mkdtempSync(path.join(tmpdir(), "catering-target-wrong-context-"));
    const iid = path.join(f.bundle, "runtime.iid");
    const wrongContext = spawnSync(adapter, [
      "build",
      "--iidfile", iid,
      "--tag", "catering-target-runtime:" + f.head,
      "--file", path.join(root, "platform-infra/docker/Dockerfile.runtime"),
      other
    ], { cwd: root, env: env(f.bundle), encoding: "utf8" });
    expect(wrongContext.status).not.toBe(0);
  });
});
