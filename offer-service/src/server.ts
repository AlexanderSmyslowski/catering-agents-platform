import { buildOfferApp } from "./app.js";
import { SupplierSourceStore } from "./supplier-source-store.js";
import { acquireSupplierMailLease } from "./supplier-mail-lease.js";
import {
  createSupplierMailRuntime,
  readSupplierMailSettings,
} from "./supplier-mail-runtime.js";

const databaseUrl =
  process.env.CATERING_DATABASE_URL ?? process.env.DATABASE_URL;
const dataRoot = process.env.CATERING_DATA_ROOT;
const configPath = process.env.CATERING_SUPPLIER_MAIL_CONFIG;
if (configPath && !databaseUrl)
  throw new Error(
    "Supplier mailbox requires PostgreSQL for its consumer lease",
  );
let shutdownOnLeaseLoss: () => void = () => {};
const lease = configPath
  ? await acquireSupplierMailLease(databaseUrl!, () => shutdownOnLeaseLoss())
  : undefined;
const sourceStore = configPath
  ? new SupplierSourceStore({
      rootDir: dataRoot,
      databaseUrl,
      pgPool: lease!.queryable,
    })
  : undefined;
const runtime =
  configPath && sourceStore
    ? createSupplierMailRuntime(
        await readSupplierMailSettings(configPath),
        sourceStore,
        () => lease?.isLive() === true,
      )
    : undefined;
if (lease && !lease.isLive())
  throw new Error("Supplier mailbox lease lost during startup");
const app = buildOfferApp({
  rootDir: dataRoot,
  databaseUrl,
  supplierSourceStore: sourceStore,
  supplierSourceAdapter: runtime?.adapter,
});
if (runtime)
  app.addHook("onClose", async () => {
    await runtime.stop();
    await lease?.release();
  });
shutdownOnLeaseLoss = () => {
  void app.close().then(
    () => process.exit(1),
    () => process.exit(1),
  );
};
const port = Number(process.env.PORT ?? process.env.OFFER_PORT ?? 3102);
const host = process.env.HOST ?? process.env.OFFER_HOST ?? "127.0.0.1";

app
  .listen({ port, host })
  .then(() => runtime?.start())
  .catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.once(signal, () => {
    void app.close().then(
      () => process.exit(0),
      () => process.exit(1),
    );
  });
