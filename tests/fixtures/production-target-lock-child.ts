import { ProductionStore } from "../../production-service/src/repositories/production-store.js";
import { productionDecisionRepositoryFor } from "../../production-service/src/repositories/production-decision-repository.js";

const [rootDir, artifactId] = process.argv.slice(2);
if (!rootDir || !artifactId || !process.send) throw new Error("Lock-Child benötigt Root, Artefakt-ID und IPC.");

const store = new ProductionStore({ rootDir });
const repository = productionDecisionRepositoryFor(store);
await repository.withTargetCriticalSection(
  { businessId: "local" },
  { kind: "production_draft", artifactId, revision: 1 },
  async () => {
    process.send?.("entered");
    await new Promise<void>((resolve) => process.once("message", (message) => {
      if (message === "release") resolve();
    }));
  }
);
process.send("done");
