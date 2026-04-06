import { buildIngestionApp } from "./app.js";
import { IngestionStore } from "./store.js";

const databaseUrl = process.env.CATERING_DATABASE_URL ?? process.env.DATABASE_URL;
const dataRoot = process.env.CATERING_DATA_ROOT;
const app = buildIngestionApp({
  store: new IngestionStore({
    rootDir: dataRoot,
    databaseUrl
  }),
  dataRoot,
  databaseUrl
});
const port = Number(process.env.PORT ?? process.env.INGESTION_PORT ?? 3105);

app.listen({
  port,
  host: "0.0.0.0"
}).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
