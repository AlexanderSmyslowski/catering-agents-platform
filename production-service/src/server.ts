import { buildProductionApp } from "./app.js";

const app = buildProductionApp();

app.listen({
  port: 3103,
  host: "0.0.0.0"
}).catch((error) => {
  app.log.error(error);
  process.exit(1);
});

