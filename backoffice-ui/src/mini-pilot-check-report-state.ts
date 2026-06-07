export interface MiniPilotCheckReportState {
  statusLabel: string;
  reasonLabel: string;
  nextStepLabel: string;
  commandLabel: string;
  errorLabels: string[];
}

type MiniPilotCheckLike = {
  errors?: unknown;
  summary?: {
    status?: unknown;
    reason?: unknown;
    nextStep?: unknown;
  };
  preflight?: {
    preferredMiniPilotCommand?: unknown;
  };
};

function formatReasonLabel(reason: string): string {
  const labels: Record<string, string> = {
    mini_pilot_ready: "Mini-Pilot-Rahmen ist gruen.",
    preflight_failed: "Lokaler Preflight ist noch nicht gruen.",
    mini_pilot_policy_incomplete: "Mini-Pilot-Rahmen ist noch nicht vollstaendig markiert.",
    probe_failed: "Der lokale Probe-Lauf ist fehlgeschlagen.",
    eval_mismatch: "Der Provider-Output driftet gegen die Erwartung."
  };

  return labels[reason] ?? reason;
}

function normalizeErrors(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0) : [];
}

function isSummaryShape(value: MiniPilotCheckLike["summary"]): value is {
  status: "ready" | "blocked";
  reason: string;
  nextStep: string;
} {
  return Boolean(
    value &&
      (value.status === "ready" || value.status === "blocked") &&
      typeof value.reason === "string" &&
      value.reason.trim().length > 0 &&
      typeof value.nextStep === "string" &&
      value.nextStep.trim().length > 0
  );
}

export function buildMiniPilotCheckReportState(rawResult: string): MiniPilotCheckReportState {
  const trimmed = rawResult.trim();

  if (!trimmed) {
    return {
      statusLabel: "noch kein Ergebnis",
      reasonLabel: "JSON-Ausgabe aus dem lokalen Mini-Pilot-Check fehlt noch.",
      nextStepLabel: "Check lokal ausfuehren, JSON einfuellen und dann erst mit dem Draft weiterarbeiten.",
      commandLabel: "npm run llm:synthetic-live:check:mini-pilot",
      errorLabels: []
    };
  }

  let parsed: MiniPilotCheckLike;

  try {
    parsed = JSON.parse(trimmed) as MiniPilotCheckLike;
  } catch {
    return {
      statusLabel: "ungueltiges Ergebnis",
      reasonLabel: "Die Eingabe ist kein lesbares Mini-Pilot-JSON.",
      nextStepLabel: "Nur die JSON-Ausgabe von npm run llm:synthetic-live:check:mini-pilot einfuegen.",
      commandLabel: "npm run llm:synthetic-live:check:mini-pilot",
      errorLabels: []
    };
  }

  if (!isSummaryShape(parsed.summary)) {
    return {
      statusLabel: "unvollstaendiges Ergebnis",
      reasonLabel: "Die JSON-Ausgabe enthaelt keinen vollstaendigen ready/blocked-Status.",
      nextStepLabel: "Mini-Pilot-Check erneut ausfuehren und die vollstaendige JSON-Ausgabe einfuegen.",
      commandLabel:
        typeof parsed.preflight?.preferredMiniPilotCommand === "string"
          ? parsed.preflight.preferredMiniPilotCommand
          : "npm run llm:synthetic-live:check:mini-pilot",
      errorLabels: normalizeErrors(parsed.errors)
    };
  }

  return {
    statusLabel: parsed.summary.status,
    reasonLabel: formatReasonLabel(parsed.summary.reason),
    nextStepLabel: parsed.summary.nextStep,
    commandLabel:
      typeof parsed.preflight?.preferredMiniPilotCommand === "string"
        ? parsed.preflight.preferredMiniPilotCommand
        : "npm run llm:synthetic-live:check:mini-pilot",
    errorLabels: normalizeErrors(parsed.errors)
  };
}
