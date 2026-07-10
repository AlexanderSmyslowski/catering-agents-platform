import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { LlmReadinessStructuredCandidateValue } from "./llm-readiness.js";
import type {
  LlmReadinessProviderAdapter,
  LlmReadinessProviderAdapterRequest,
  LlmReadinessProviderAdapterResponse
} from "./llm-readiness-provider-adapter.js";
import type {
  LlmReadinessSyntheticLiveTransport,
  LlmReadinessSyntheticLiveTransportRequest,
  LlmReadinessSyntheticLiveTransportResponse
} from "./llm-readiness-synthetic-live-slice.js";
import { SyntheticLiveLlmReadinessSlice } from "./llm-readiness-synthetic-live-slice.js";

export interface CodexCliExecRequest {
  command: string;
  args: string[];
  stdin: string;
  timeoutMs: number;
}

export interface CodexCliExecResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut?: boolean;
  errorCode?: string;
}

export type CodexCliExec = (request: CodexCliExecRequest) => Promise<CodexCliExecResult>;

export interface CodexCliSyntheticLiveTransportOptions {
  cliBin?: string;
  model?: string;
  timeoutMs?: number;
  execImpl?: CodexCliExec;
}

export interface CodexCliLlmReadinessProviderAdapterOptions extends CodexCliSyntheticLiveTransportOptions {
  providerRunIdPrefix?: string;
}

interface CodexCliJsonPayload {
  text?: unknown;
  reason?: unknown;
  reasonCode?: unknown;
  components?: unknown;
  menuItems?: unknown;
  signals?: unknown;
  alternatives?: unknown;
}

const defaultCodexCliTimeoutMs = 120_000;
const maxCapturedOutputChars = 200_000;

function appendLimited(current: string, chunk: Buffer): string {
  if (current.length >= maxCapturedOutputChars) {
    return current;
  }

  return (current + chunk.toString("utf8")).slice(0, maxCapturedOutputChars);
}

export const defaultCodexCliExec: CodexCliExec = ({
  command,
  args,
  stdin,
  timeoutMs
}) => new Promise((resolve) => {
  const child = spawn(command, args, {
    shell: false,
    stdio: ["pipe", "pipe", "pipe"]
  });
  let stdout = "";
  let stderr = "";
  let settled = false;
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    child.kill("SIGTERM");
  }, timeoutMs);

  child.stdout.on("data", (chunk: Buffer) => {
    stdout = appendLimited(stdout, chunk);
  });
  child.stderr.on("data", (chunk: Buffer) => {
    stderr = appendLimited(stderr, chunk);
  });
  child.on("error", (error: NodeJS.ErrnoException) => {
    if (settled) {
      return;
    }
    settled = true;
    clearTimeout(timer);
    resolve({
      exitCode: null,
      stdout,
      stderr,
      errorCode: error.code
    });
  });
  child.on("close", (exitCode) => {
    if (settled) {
      return;
    }
    settled = true;
    clearTimeout(timer);
    resolve({
      exitCode,
      stdout,
      stderr,
      timedOut
    });
  });

  child.stdin.end(stdin);
});

function buildCodexPrompt(request: LlmReadinessSyntheticLiveTransportRequest): string {
  const responseShape = request.outputKind === "production_draft_extraction"
    ? "{\"eventType\":\"...\",\"serviceForm\":\"...\",\"eventDate\":\"YYYY-MM-DD\",\"attendeeCount\":45,\"customerName\":null,\"venueName\":null,\"components\":[{\"label\":\"...\",\"course\":null,\"category\":null,\"categoryEvidence\":null,\"note\":null}],\"openQuestions\":[{\"field\":\"...\",\"message\":\"...\",\"suggestedQuestion\":null}]}"
    : request.outputKind === "intake_shadow_extraction"
      ? "{\"eventType\":\"...\",\"serviceForm\":\"...\",\"eventDate\":\"YYYY-MM-DD\",\"attendeeCount\":45,\"menuItems\":[\"...\"]}"
      : request.outputKind === "offer_package_classification_draft"
        ? "{\"packageId\":\"business_lunch_basic\",\"confidence\":0.86,\"rationale\":\"...\",\"signals\":[\"...\"],\"alternatives\":[{\"packageId\":\"brunch_buffet\",\"confidence\":0.18}]}"
        : "{\"text\":\"...\",\"reason\":\"...\",\"reasonCode\":\"...\"}";

  return [
    request.systemPrompt,
    "",
    "Lokaler Codex-CLI-BYO-Transport: reine Inferenz. Nutze keine Tools, keine Shell, keine Dateien und kein Netzwerk.",
    "Antworte ausschliesslich mit einem JSON-Objekt in diesem Format:",
    responseShape,
    "",
    request.userPrompt
  ].join("\n");
}

function buildCodexExecArgs(model: string | undefined, workDir: string): string[] {
  const args = [
    "exec",
    "--sandbox",
    "read-only",
    "--ephemeral",
    "--ignore-rules",
    "--skip-git-repo-check",
    "--cd",
    workDir,
    "--color",
    "never"
  ];

  if (typeof model === "string" && model.trim().length > 0) {
    args.push("--model", model.trim());
  }

  args.push("-");
  return args;
}

function extractLastJsonObject(output: string): unknown | undefined {
  let depth = 0;
  let startIndex = -1;
  let inString = false;
  let escaped = false;
  let lastParsed: unknown;

  for (let index = 0; index < output.length; index += 1) {
    const char = output[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{") {
      if (depth === 0) {
        startIndex = index;
      }
      depth += 1;
      continue;
    }

    if (char !== "}" || depth === 0) {
      continue;
    }

    depth -= 1;
    if (depth !== 0 || startIndex < 0) {
      continue;
    }

    const candidate = output.slice(startIndex, index + 1);
    try {
      lastParsed = JSON.parse(candidate);
    } catch {
      // Keep scanning: Codex may print prose or event JSON before the final payload.
    }
    startIndex = -1;
  }

  return lastParsed;
}

function parseCodexCliPayload(output: string, outputKind: LlmReadinessSyntheticLiveTransportRequest["outputKind"]): {
  ok: boolean;
  errors: string[];
  text?: string;
  structuredCandidate?: Record<string, LlmReadinessStructuredCandidateValue>;
} {
  const parsed = extractLastJsonObject(output);
  const payload = parsed as CodexCliJsonPayload;

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {
      ok: false,
      errors: ["codex CLI output did not contain a valid JSON object"]
    };
  }

  if (outputKind === "production_draft_extraction") {
    if (!Array.isArray(payload.components)) {
      return {
        ok: false,
        errors: ["codex CLI JSON output must contain components as an array"]
      };
    }

    return {
      ok: true,
      errors: [],
      text: JSON.stringify(parsed)
    };
  }

  if (outputKind === "intake_shadow_extraction") {
    if (!Array.isArray(payload.menuItems)) {
      return {
        ok: false,
        errors: ["codex CLI JSON output must contain menuItems as an array"]
      };
    }

    return {
      ok: true,
      errors: [],
      text: JSON.stringify(parsed)
    };
  }

  if (outputKind === "offer_package_classification_draft") {
    if (!Array.isArray(payload.signals) || !Array.isArray(payload.alternatives)) {
      return {
        ok: false,
        errors: ["codex CLI JSON output must contain signals and alternatives as arrays"]
      };
    }

    return {
      ok: true,
      errors: [],
      text: JSON.stringify(parsed)
    };
  }

  if (
    typeof payload.text !== "string" ||
    typeof payload.reason !== "string" ||
    typeof payload.reasonCode !== "string"
  ) {
    return {
      ok: false,
      errors: ["codex CLI JSON output must contain text, reason and reasonCode as strings"]
    };
  }

  return {
    ok: true,
    errors: [],
    text: payload.text,
    structuredCandidate: {
      reason: payload.reason,
      reasonCode: payload.reasonCode
    }
  };
}

function looksLikeAuthFailure(output: string): boolean {
  return /not logged in|login required|authentication|auth|unauthorized|subscription/i.test(output);
}

export class CodexCliSyntheticLiveTransport implements LlmReadinessSyntheticLiveTransport {
  private readonly cliBin: string;
  private readonly timeoutMs: number;
  private readonly execImpl: CodexCliExec;

  constructor(private readonly options: CodexCliSyntheticLiveTransportOptions = {}) {
    this.cliBin = options.cliBin?.trim() || "codex";
    this.timeoutMs = options.timeoutMs ?? defaultCodexCliTimeoutMs;
    this.execImpl = options.execImpl ?? defaultCodexCliExec;
  }

  async run(
    request: LlmReadinessSyntheticLiveTransportRequest
  ): Promise<LlmReadinessSyntheticLiveTransportResponse> {
    if (
      request.outputKind !== "clarification_question_draft" &&
      request.outputKind !== "production_draft_extraction" &&
      request.outputKind !== "intake_shadow_extraction" &&
      request.outputKind !== "offer_package_classification_draft"
    ) {
      return {
        ok: false,
        errors: ["Codex CLI transport only supports clarification_question_draft, production_draft_extraction, intake_shadow_extraction and offer_package_classification_draft"],
        providerId: "codex-cli"
      };
    }

    const workDir = mkdtempSync(path.join(tmpdir(), "catering-codex-cli-"));
    try {
      const result = await this.execImpl({
        command: this.cliBin,
        args: buildCodexExecArgs(this.options.model, workDir),
        stdin: buildCodexPrompt(request),
        timeoutMs: this.timeoutMs
      });

      if (result.errorCode === "ENOENT") {
        return {
          ok: false,
          errors: [`codex CLI binary not found: ${this.cliBin}`],
          providerId: "codex-cli"
        };
      }

      if (result.timedOut) {
        return {
          ok: false,
          errors: [`codex CLI timed out after ${this.timeoutMs}ms`],
          providerId: "codex-cli",
          providerRequestId: request.providerRunId
        };
      }

      if (result.exitCode !== 0) {
        const combinedOutput = `${result.stdout}\n${result.stderr}`;
        return {
          ok: false,
          errors: [
            looksLikeAuthFailure(combinedOutput)
              ? "codex CLI is not logged in or subscription authentication is unavailable"
              : `codex CLI exited with code ${result.exitCode ?? "unknown"}`
          ],
          providerId: "codex-cli",
          providerRequestId: request.providerRunId
        };
      }

      const payload = parseCodexCliPayload(result.stdout, request.outputKind);
      if (!payload.ok) {
        return {
          ok: false,
          errors: payload.errors,
          providerId: "codex-cli",
          providerRequestId: request.providerRunId
        };
      }

      return {
        ok: true,
        errors: [],
        providerId: "codex-cli",
        providerRequestId: request.providerRunId,
        text: payload.text,
        structuredCandidate: payload.structuredCandidate
      };
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  }
}

export class CodexCliLlmReadinessProviderAdapter implements LlmReadinessProviderAdapter {
  readonly adapterId = "llm-readiness-synthetic-live-slice" as const;
  readonly adapterMode = "synthetic_live" as const;
  private readonly slice: SyntheticLiveLlmReadinessSlice;
  private readonly providerRunIdPrefix: string;

  constructor(options: CodexCliLlmReadinessProviderAdapterOptions = {}) {
    this.providerRunIdPrefix = options.providerRunIdPrefix ?? "byo-llm-codex-cli";
    this.slice = new SyntheticLiveLlmReadinessSlice({
      enabled: true,
      transport: new CodexCliSyntheticLiveTransport(options)
    });
  }

  async run(request: LlmReadinessProviderAdapterRequest): Promise<LlmReadinessProviderAdapterResponse> {
    return this.slice.run({
      providerRunId: `${this.providerRunIdPrefix}-${request.input.inputId}`,
      input: request.input,
      promptSchemaId: request.promptSchemaId,
      promptContext: request.promptContext
    });
  }
}
