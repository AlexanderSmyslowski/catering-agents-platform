import { describe, expect, it, vi } from "vitest";
import { createSigner, createVerifier } from "fast-jwt";

describe("JWT dependency expiration boundary", () => {
  it("rejects an expired cached token even when the optional iat claim is absent", () => {
    const initialNow = 1_700_000_000_000;
    const expiresAt = initialNow / 1000 + 1;
    const clock = vi.spyOn(Date, "now").mockReturnValue(initialNow);
    try {
      const key = "synthetic-dependency-expiration-regression";
      const token = createSigner({ key, algorithm: "HS256", noTimestamp: true })({
        sub: "synthetic-user",
        exp: expiresAt
      });
      const verify = createVerifier({ key, algorithms: ["HS256"], cache: true, cacheTTL: 60_000 });
      expect(verify(token).sub).toBe("synthetic-user");
      clock.mockReturnValue(expiresAt * 1000 + 1);
      expect(() => verify(token)).toThrow(expect.objectContaining({ code: "FAST_JWT_EXPIRED" }));
    } finally {
      clock.mockRestore();
    }
  });
});
