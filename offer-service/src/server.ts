import { buildOfferApp } from "./app.js";

const databaseUrl = process.env.CATERING_DATABASE_URL ?? process.env.DATABASE_URL;
const dataRoot = process.env.CATERING_DATA_ROOT;
const app = buildOfferApp({
  rootDir: dataRoot,
  databaseUrl
});
const port = Number(process.env.PORT ?? process.env.OFFER_PORT ?? 3102);
const host = process.env.HOST ?? process.env.OFFER_HOST ?? "127.0.0.1";

app.listen({
  port,
  host
}).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
