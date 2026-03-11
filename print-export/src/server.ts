import { buildPrintExportApp } from "./index.js";

const databaseUrl = process.env.CATERING_DATABASE_URL ?? process.env.DATABASE_URL;
const dataRoot = process.env.CATERING_DATA_ROOT;
const app = buildPrintExportApp({
  rootDir: dataRoot,
  databaseUrl
});
const port = Number(process.env.PORT ?? process.env.PRINT_EXPORT_PORT ?? 3104);

app.listen({
  port,
  host: "0.0.0.0"
}).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
