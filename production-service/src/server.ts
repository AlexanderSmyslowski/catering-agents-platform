import { buildProductionApp } from "./app.js";

const app = buildProductionApp();
const port = Number(process.env.PORT ?? process.env.PRODUCTION_PORT ?? 3103);

app.listen({
  port,
  host: "0.0.0.0"
}).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
