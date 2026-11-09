import pg from "pg";

/** The connection is held for the lifetime of the poller and released after drain. */
export async function acquireSupplierMailLease(
  databaseUrl: string,
  onLoss: () => void,
) {
  const client = new pg.Client({ connectionString: databaseUrl });
  let live = false,
    closing = false;
  const lost = () => {
    if (!closing && live) {
      live = false;
      onLoss();
    }
  };
  client.on("error", lost);
  client.on("end", lost);
  try {
    await client.connect();
    const result = await client.query<{ acquired: boolean }>(
      "SELECT pg_try_advisory_lock($1,$2) AS acquired",
      [1128354899, 1347571017],
    );
    if (!result.rows[0]?.acquired)
      throw new Error("Supplier mailbox consumer already active");
    live = true;
    return {
      isLive: () => live,
      queryable: {
        async query(sql: string, params?: unknown[]) {
          if (!live) throw new Error("Supplier mailbox lease lost");
          return client.query(sql, params);
        },
      },
      async release() {
        closing = true;
        live = false;
        await client.end();
      },
    };
  } catch (error) {
    closing = true;
    await client.end().catch(() => {});
    throw error;
  }
}
