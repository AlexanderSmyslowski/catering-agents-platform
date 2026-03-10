import { buildOfferApp } from "./app.js";

const app = buildOfferApp();

app.listen({
  port: 3102,
  host: "0.0.0.0"
}).catch((error) => {
  app.log.error(error);
  process.exit(1);
});

