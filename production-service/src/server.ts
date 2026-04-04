import { buildProductionApp } from "./app.js";

const databaseUrl = process.env.CATERING_DATABASE_URL ?? process.env.DATABASE_URL;
const dataRoot = process.env.CATERING_DATA_ROOT;
const recipeWebSearchProviderName = process.env.CATERING_RECIPE_WEB_PROVIDER;
const app = buildProductionApp({
  dataRoot,
  databaseUrl,
  recipeWebSearchProviderName
});
const port = Number(process.env.PORT ?? process.env.PRODUCTION_PORT ?? 3103);

app.listen({
  port,
  host: "0.0.0.0"
}).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
