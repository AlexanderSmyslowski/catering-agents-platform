import { buildPrintExportApp } from "./index.js";

const app = buildPrintExportApp();
const port = Number(process.env.PORT ?? process.env.PRINT_EXPORT_PORT ?? 3104);

app.listen({
  port,
  host: "0.0.0.0"
}).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
