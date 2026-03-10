import { buildIntakeApp } from "./app.js";

const app = buildIntakeApp();

app.listen({
  port: 3101,
  host: "0.0.0.0"
}).catch((error) => {
  app.log.error(error);
  process.exit(1);
});

