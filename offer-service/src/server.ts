import { buildOfferApp } from "./app.js";

const app = buildOfferApp();
const port = Number(process.env.PORT ?? process.env.OFFER_PORT ?? 3102);

app.listen({
  port,
  host: "0.0.0.0"
}).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
