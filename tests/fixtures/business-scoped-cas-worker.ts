import { existsSync, writeFileSync } from "node:fs";
import {
  createBusinessScopedPersistentCollection
} from "../../shared-core/src/persistence.js";

interface WorkerRecord {
  id: string;
  value: string;
  version: number;
}

const [rootDir, writer, pauseClaimPath, pauseReadyPath, releasePath, checkedPath] = process.argv.slice(2);
if (!rootDir || !writer || !pauseClaimPath || !pauseReadyPath || !releasePath || !checkedPath) {
  throw new Error("CAS worker requires root, writer, barrier, release, and checked paths.");
}

const sleeper = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT));
const collection = createBusinessScopedPersistentCollection<WorkerRecord>({
  collectionName: "multiprocess-records",
  getId: (record) => record.id,
  rootDir,
  fileFaultInjector: (phase) => {
    if (phase !== "before_record_replace") return;
    writeFileSync(checkedPath, writer);
    try {
      writeFileSync(pauseClaimPath, writer, { flag: "wx" });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") return;
      throw error;
    }
    writeFileSync(pauseReadyPath, writer);
    while (!existsSync(releasePath)) {
      Atomics.wait(sleeper, 0, 0, 10);
    }
  }
});

const result = await collection.compareAndSet(
  { businessId: "alpha" },
  "same",
  1,
  { id: "same", value: writer, version: 2 }
);
process.stdout.write(`${JSON.stringify({ writer, result })}\n`);
