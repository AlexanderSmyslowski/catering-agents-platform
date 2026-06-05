import { runLlmReadinessSyntheticLiveProbe } from "@catering/shared-core";
import { pathToFileURL } from "node:url";

export interface SyntheticLiveProbeCliArgs {
  fixtureId?: string;
  providerRunId?: string;
  failOnEvalMismatch: boolean;
}

export function parseSyntheticLiveProbeCliArgs(argv: readonly string[]): SyntheticLiveProbeCliArgs {
  const parsed: SyntheticLiveProbeCliArgs = {
    failOnEvalMismatch: false
  };

  for (const arg of argv) {
    if (arg.startsWith("--fixture-id=")) {
      parsed.fixtureId = arg.slice("--fixture-id=".length);
      continue;
    }

    if (arg.startsWith("--provider-run-id=")) {
      parsed.providerRunId = arg.slice("--provider-run-id=".length);
      continue;
    }

    if (arg === "--fail-on-eval-mismatch") {
      parsed.failOnEvalMismatch = true;
    }
  }

  return parsed;
}

export function shouldFailSyntheticLiveProbeProcess(
  result: {
    ok: boolean;
    evalMatched?: boolean;
  },
  args: Pick<SyntheticLiveProbeCliArgs, "failOnEvalMismatch">
): boolean {
  if (!result.ok) {
    return true;
  }

  return args.failOnEvalMismatch && result.evalMatched === false;
}

export async function main(): Promise<void> {
  const args = parseSyntheticLiveProbeCliArgs(process.argv.slice(2));
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
    evaluation: result.evaluation,
    evalMatched: result.evalMatched,
    response: result.response,
    auditRecord: result.auditRecord,
    runResult: result.runResult
  };

  console.log(JSON.stringify(output, null, 2));

  if (shouldFailSyntheticLiveProbeProcess(result, args)) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
