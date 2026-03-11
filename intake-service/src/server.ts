import { buildIntakeApp } from "./app.js";
import { IntakeStore } from "./store.js";

const databaseUrl = process.env.CATERING_DATABASE_URL ?? process.env.DATABASE_URL;
const dataRoot = process.env.CATERING_DATA_ROOT;
const app = buildIntakeApp(
  new IntakeStore({
    rootDir: dataRoot,
    databaseUrl
  })
);
const port = Number(process.env.PORT ?? process.env.INTAKE_PORT ?? 3101);

app.listen({
  port,
  host: "0.0.0.0"
}).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
