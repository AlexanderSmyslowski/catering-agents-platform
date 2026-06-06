import {
  runLlmReadinessSyntheticLivePreflight,
  runLlmReadinessSyntheticLiveProbe,
  type LlmReadinessSyntheticLivePreflightResult,
  type LlmReadinessSyntheticLiveTransport
} from "@catering/shared-core";
import { pathToFileURL } from "node:url";

export interface SyntheticLiveProbeCliArgs {
  fixtureId?: string;
  providerRunId?: string;
  failOnEvalMismatch: boolean;
  requireMiniPilotReady: boolean;
}

export interface SyntheticLiveProbeCliResult {
  ok: boolean;
  errors: string[];
  fixtureId?: string;
  providerRunId?: string;
  evaluation?: Awaited<ReturnType<typeof runLlmReadinessSyntheticLiveProbe>>["evaluation"];
  evalMatched?: boolean;
  preflight?: LlmReadinessSyntheticLivePreflightResult;
  response?: Awaited<ReturnType<typeof runLlmReadinessSyntheticLiveProbe>>["response"];
  auditRecord?: Awaited<ReturnType<typeof runLlmReadinessSyntheticLiveProbe>>["auditRecord"];
  runResult?: Awaited<ReturnType<typeof runLlmReadinessSyntheticLiveProbe>>["runResult"];
}

export interface SyntheticLiveProbeCliOptions {
  env?: Record<string, string | undefined>;
  transport?: LlmReadinessSyntheticLiveTransport;
}

export function parseSyntheticLiveProbeCliArgs(argv: readonly string[]): SyntheticLiveProbeCliArgs {
  const parsed: SyntheticLiveProbeCliArgs = {
    failOnEvalMismatch: false,
    requireMiniPilotReady: false
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
      continue;
    }

    if (arg === "--require-mini-pilot-ready") {
      parsed.requireMiniPilotReady = true;
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

function buildMiniPilotGuardErrors(
  preflight: LlmReadinessSyntheticLivePreflightResult
): string[] {
  const errors = [...preflight.errors];

  if (!preflight.miniPilotReady) {
    errors.push("mini-pilot policy is not fully marked as ready");
  }

  for (const warning of preflight.miniPilotWarnings) {
    errors.push(`miniPilot.${warning}`);
  }

  return [...new Set(errors)];
}

export async function runSyntheticLiveProbeCli(
  args: SyntheticLiveProbeCliArgs,
  options: SyntheticLiveProbeCliOptions = {}
): Promise<SyntheticLiveProbeCliResult> {
  const preflight = args.requireMiniPilotReady
    ? runLlmReadinessSyntheticLivePreflight({
        env: options.env
      })
    : undefined;

  if (preflight && (!preflight.ok || !preflight.miniPilotReady)) {
    return {
      ok: false,
      errors: buildMiniPilotGuardErrors(preflight),
      preflight
    };
  }

  const result = await runLlmReadinessSyntheticLiveProbe({
    fixtureId: args.fixtureId,
    providerRunId: args.providerRunId,
    env: options.env,
    transport: options.transport
  });

  return {
    ok: result.ok,
    errors: result.errors,
    fixtureId: result.fixtureId,
    providerRunId: result.providerRunId,
    evaluation: result.evaluation,
    evalMatched: result.evalMatched,
    preflight,
    response: result.response,
    auditRecord: result.auditRecord,
    runResult: result.runResult
  };
}

export async function main(): Promise<void> {
  const args = parseSyntheticLiveProbeCliArgs(process.argv.slice(2));
  const output = await runSyntheticLiveProbeCli(args, {
    env: process.env
  });

  console.log(JSON.stringify(output, null, 2));

  if (shouldFailSyntheticLiveProbeProcess(output, args)) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
