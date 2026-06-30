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
  summary: {
    status: "ready" | "blocked";
    reason:
      | "mini_pilot_ready"
      | "preflight_failed"
      | "mini_pilot_policy_incomplete"
      | "probe_failed"
      | "eval_mismatch";
    nextStep: string;
  };
  preflight: ReturnType<typeof runLlmReadinessSyntheticLivePreflight>;
  probe?: Awaited<ReturnType<typeof runSyntheticLiveProbeCli>>;
}

function buildSyntheticLiveMiniPilotSummary(
  result: Pick<SyntheticLiveMiniPilotCheckCliResult, "ok" | "preflight" | "probe">
): SyntheticLiveMiniPilotCheckCliResult["summary"] {
  if (result.ok) {
    return {
      status: "ready",
      reason: "mini_pilot_ready",
      nextStep: "Mini-Pilot-Rahmen ist grün. Draft-Ergebnis nur manuell prüfen und bewusst übernehmen."
    };
  }

  if (!result.preflight.ok) {
    return {
      status: "blocked",
      reason: "preflight_failed",
      nextStep: "Zuerst den lokalen Preflight korrigieren und den Mini-Pilot-Check erneut ausführen."
    };
  }

  if (!result.preflight.miniPilotReady) {
    return {
      status: "blocked",
      reason: "mini_pilot_policy_incomplete",
      nextStep: "Fehlende PA62-Mini-Pilot-Markierungen setzen und dann den Check erneut ausführen."
    };
  }

  if (result.probe?.evalMatched === false) {
    return {
      status: "blocked",
      reason: "eval_mismatch",
      nextStep: "Provider-Output driftet gegen die Fixture. Draft nicht übernehmen und zuerst die Abweichung prüfen."
    };
  }

  return {
    status: "blocked",
    reason: "probe_failed",
    nextStep: "Probe-Lauffehler prüfen, keine Übernahme vor erneutem grünem Mini-Pilot-Check."
  };
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
    summary: buildSyntheticLiveMiniPilotSummary({
      ok,
      preflight,
      probe
    }),
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
