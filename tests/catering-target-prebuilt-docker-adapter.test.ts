import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const adapter = path.join(root, "platform-infra/scripts/catering-target-prebuilt-docker-adapter.sh");

function fixture() {
  const bundle = mkdtempSync(path.join(tmpdir(), "catering-target-prebuilt-bundle-"));
  const runtimeTar = Buffer.from("runtime-image-tar-fixture");
  const webTar = Buffer.from("web-image-tar-fixture");
  const runtimeArchive = gzipSync(runtimeTar);
  const webArchive = gzipSync(webTar);
  writeFileSync(path.join(bundle, "runtime-image.tar.gz"), runtimeArchive);
  writeFileSync(path.join(bundle, "web-image.tar.gz"), webArchive);
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const runtimeImage = "sha256:" + "1".repeat(64);
  const webImage = "sha256:" + "2".repeat(64);
  writeFileSync(path.join(bundle, "manifest.json"), JSON.stringify({
    schemaVersion: 1,
    sourceCommit: head,
    runtimeImage,
    webImage,
    files: {
      "runtime-image.tar.gz": createHash("sha256").update(runtimeArchive).digest("hex"),
      "web-image.tar.gz": createHash("sha256").update(webArchive).digest("hex")
    }
  }, null, 2) + "\n");
  return { bundle, head, runtimeImage, webImage, runtimeTar, webTar };
}

function env(bundle: string) {
  return { ...process.env, CATERING_TARGET_PREBUILT_BUNDLE_DIR: bundle };
}

describe("Catering target prebuilt Docker adapter", () => {
  it("emulates only the exact build iid and save operations expected by the unchanged release runner", () => {
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
    expect(readFileSync(runtimeIid, "utf8").trim()).toBe(f.runtimeImage);

    const save = spawnSync(adapter, ["save", f.runtimeImage], {
      cwd: root,
      env: env(f.bundle),
      encoding: null
    });
    expect(save.status, save.stderr?.toString()).toBe(0);
    expect(save.stdout).toEqual(f.runtimeTar);
  });

  it("rejects a tampered archive before returning an image id or stream", () => {
    const f = fixture();
    writeFileSync(path.join(f.bundle, "runtime-image.tar.gz"), gzipSync(Buffer.from("tampered")));
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
