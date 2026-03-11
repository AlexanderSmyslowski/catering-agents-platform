import { buildIntakeApp } from "./app.js";

const app = buildIntakeApp();
const port = Number(process.env.PORT ?? process.env.INTAKE_PORT ?? 3101);

app.listen({
  port,
  host: "0.0.0.0"
}).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
