import { runLlmReadinessSyntheticLiveProbe } from "@catering/shared-core";

function parseArgs(argv: readonly string[]): { fixtureId?: string; providerRunId?: string } {
  const parsed: { fixtureId?: string; providerRunId?: string } = {};

  for (const arg of argv) {
    if (arg.startsWith("--fixture-id=")) {
      parsed.fixtureId = arg.slice("--fixture-id=".length);
      continue;
    }

    if (arg.startsWith("--provider-run-id=")) {
      parsed.providerRunId = arg.slice("--provider-run-id=".length);
    }
  }

  return parsed;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const result = await runLlmReadinessSyntheticLiveProbe({
    fixtureId: args.fixtureId,
    providerRunId: args.providerRunId,
    env: process.env
  });

  const output = {
    ok: result.ok,
    errors: result.errors,
    fixtureId: result.fixtureId,
    providerRunId: result.providerRunId,
    response: result.response,
    auditRecord: result.auditRecord,
    runResult: result.runResult
  };

  console.log(JSON.stringify(output, null, 2));

  if (!result.ok) {
    process.exitCode = 1;
  }
}

await main();
