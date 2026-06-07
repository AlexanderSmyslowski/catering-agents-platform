import { runLlmReadinessSyntheticLivePreflight } from "@catering/shared-core";
import {
  parseSyntheticLiveProbeCliArgs,
  runSyntheticLiveProbeCli,
  shouldFailSyntheticLiveProbeProcess,
  type SyntheticLiveProbeCliOptions
} from "./run-synthetic-live-llm-readiness.js";
import { pathToFileURL } from "node:url";

export interface SyntheticLiveMiniPilotCheckCliResult {
  ok: boolean;
  errors: string[];
  preflight: ReturnType<typeof runLlmReadinessSyntheticLivePreflight>;
  probe?: Awaited<ReturnType<typeof runSyntheticLiveProbeCli>>;
}

export async function runSyntheticLiveMiniPilotCheckCli(
  argv: readonly string[],
  options: SyntheticLiveProbeCliOptions = {}
): Promise<SyntheticLiveMiniPilotCheckCliResult> {
  const args = parseSyntheticLiveProbeCliArgs(argv);
  const env = options.env ?? process.env;
  const preflight = runLlmReadinessSyntheticLivePreflight({ env });

  const probe = await runSyntheticLiveProbeCli(
    {
      ...args,
      failOnEvalMismatch: true,
      requireMiniPilotReady: true
    },
    {
      ...options,
      env
    }
  );

  const ok = preflight.ok && preflight.miniPilotReady && probe.ok && probe.evalMatched !== false;
  const errors = ok
    ? []
    : [...new Set([...(probe.errors ?? []), ...(preflight.ok ? [] : preflight.errors)])];

  return {
    ok,
    errors,
    preflight,
    probe
  };
}

export async function main(): Promise<void> {
  const result = await runSyntheticLiveMiniPilotCheckCli(process.argv.slice(2), {
    env: process.env
  });

  console.log(JSON.stringify(result, null, 2));

  if (
    !result.ok ||
    shouldFailSyntheticLiveProbeProcess(
      {
        ok: result.probe?.ok ?? false,
        evalMatched: result.probe?.evalMatched
      },
      { failOnEvalMismatch: true }
    )
  ) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
