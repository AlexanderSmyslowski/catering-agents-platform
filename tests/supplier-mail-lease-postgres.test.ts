import { expect, it } from "vitest";
import pg from "pg";
import { acquireSupplierMailLease } from "../offer-service/src/supplier-mail-lease.js";
import { SupplierSourceStore } from "../offer-service/src/supplier-source-store.js";
const url = process.env.CATERING_TEST_SUPPLIER_DATABASE_URL;
it.skipIf(!url)(
  "holds the consumer lock and fences source writes when its real PostgreSQL session ends",
  async () => {
    const observer = new pg.Client({ connectionString: url });
    await observer.connect();
    let lost = false;
    const lease = await acquireSupplierMailLease(url!, () => {
      lost = true;
    });
    try {
      const store = new SupplierSourceStore({
        databaseUrl: url,
        pgPool: lease.queryable,
      });
      const record = await store.create(
        { businessId: "supplier-lease-test" },
        {
          name: "Example",
          mailboxId: "m",
          sender: "a@example.org",
          columns: {},
          articleMappings: [],
          autoApply: false,
          mailboxBinding: "binding",
        },
      );
      expect(
        (await store.get({ businessId: "supplier-lease-test" }, record.id))?.id,
      ).toBe(record.id);
      await expect(acquireSupplierMailLease(url!, () => {})).rejects.toThrow(
        "already active",
      );
      const pid = (
        await lease.queryable.query("SELECT pg_backend_pid() AS pid")
      ).rows[0]!.pid;
      await observer.query("SELECT pg_terminate_backend($1)", [pid]);
      for (let i = 0; i < 50 && !lost; i++)
        await new Promise((resolve) => setTimeout(resolve, 10));
      expect(lost).toBe(true);
      await expect(
        store.pause({ businessId: "supplier-lease-test" }, record.id),
      ).rejects.toThrow();
      const next = await acquireSupplierMailLease(url!, () => {});
      await next.release();
    } finally {
      await lease.release().catch(() => {});
      await observer.end();
    }
  },
);
