import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const config = readFileSync("platform-infra/supplier-scanner/clamd.conf", "utf8");
const service = readFileSync("platform-infra/supplier-scanner/catering-supplier-clamd.service", "utf8");
const socket = readFileSync("platform-infra/supplier-scanner/catering-supplier-proxy.socket", "utf8");
const overlay = readFileSync("platform-infra/docker-compose.supplier-mail.yml", "utf8");
const standard = readFileSync("platform-infra/docker-compose.yml", "utf8");

describe("optional supplier scanner profile", () => {
  it("matches the reader's protected socket and leaves the standard stack alone", () => {
    expect(config).toMatch(/^LocalSocket \/run\/catering-supplier-clamd\/private\.sock$/m);
    expect(config).toMatch(/^LocalSocketMode 600$/m);
    expect(config).toMatch(/^FixStaleSocket no$/m);
    expect(config).toMatch(/^DatabaseDirectory \/var\/lib\/clamav$/m);
    expect(config).not.toMatch(/^TCP(?:Socket|Addr)\b/m);
    expect(socket).toContain("ListenStream=/run/catering-supplier-scanner/clamd.sock");
    expect(socket).toContain("SocketUser=root");
    expect(socket).toContain("SocketMode=0600");
    expect(socket).toContain("DirectoryMode=0700");
    expect(service).toContain("User=clamav");
    expect(service).toContain("PrivateTmp=yes");
    expect(config).toContain("TemporaryDirectory /tmp");
    expect(service).toContain("ReadOnlyPaths=/var/lib/clamav");
    expect(service).toContain("RestrictAddressFamilies=AF_UNIX");
    expect(overlay).toContain("target: /run/catering-scan");
    expect(standard).not.toContain("catering-supplier-scanner");
  });
  it("fails closed on scanner limits and encrypted files", () => {
    for (const setting of ["AlertExceedsMax yes", "AlertEncrypted yes", "ScanArchive yes"]) {
      expect(config).toContain(setting);
    }
    expect(service).toContain("InaccessiblePaths=-/etc/catering-supplier-mail ");
    expect(service).toContain("NoNewPrivileges=yes");
    expect(service).toContain("CapabilityBoundingSet=");
    expect(service).toContain("ProtectSystem=strict");
    expect(service).toContain("LimitCORE=0");
  });
});
