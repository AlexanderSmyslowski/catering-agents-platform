import { EventEmitter } from "node:events";
import { expect, it, vi } from "vitest";
const shared = vi.hoisted(() => ({
  acquired: true,
  instance: undefined as any,
}));
vi.mock("pg", () => ({
  default: {
    Client: class extends EventEmitter {
      constructor() {
        super();
        shared.instance = this;
      }
      async connect() {}
      async query() {
        return { rows: [{ acquired: shared.acquired }] };
      }
      async end() {
        this.emit("end");
      }
    },
  },
}));
import { acquireSupplierMailLease } from "../offer-service/src/supplier-mail-lease.js";
it("excludes another consumer and shuts down on unexpected connection loss", async () => {
  shared.acquired = false;
  await expect(
    acquireSupplierMailLease("postgres://test", () => {}),
  ).rejects.toThrow("already active");
  shared.acquired = true;
  const lost = vi.fn();
  const lease = await acquireSupplierMailLease("postgres://test", lost);
  expect(lease.isLive()).toBe(true);
  shared.instance.emit("end");
  expect(lease.isLive()).toBe(false);
  expect(lost).toHaveBeenCalledOnce();
  await lease.release();
  expect(lost).toHaveBeenCalledOnce();
});
