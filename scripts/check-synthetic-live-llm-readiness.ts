import { runLlmReadinessSyntheticLivePreflight } from "@catering/shared-core";
import { pathToFileURL } from "node:url";

export async function main(): Promise<void> {
  const result = runLlmReadinessSyntheticLivePreflight({
    env: process.env
  });

  console.log(JSON.stringify(result, null, 2));

  if (!result.ok) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
