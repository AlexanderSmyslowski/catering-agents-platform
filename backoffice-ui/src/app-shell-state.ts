import type { DashboardState, ServiceHealthState } from "./api.js";
import { formatDocumentIngestionSummary } from "./production-intake-origin-card-state.js";

export type AppRoute = "home" | "offer" | "production";

export const emptyDashboardState: DashboardState = {
  intakeRequests: [],
  acceptedSpecs: [],
  offerDrafts: [],
  productionPlans: [],
  purchaseLists: [],
  recipes: [],
  auditEvents: []
};

export const emptyServiceHealthState: ServiceHealthState = {
  intake: {
    service: "intake-service",
    status: "unknown",
    timestamp: "",
    counts: {}
  },
  offers: {
    service: "offer-service",
    status: "unknown",
    timestamp: "",
    counts: {}
  },
  production: {
    service: "production-service",
    status: "unknown",
    timestamp: "",
    counts: {}
  },
  exports: {
    service: "print-export",
    status: "unknown",
    timestamp: "",
    counts: {}
  }
};

export function detectRoute(pathname: string): AppRoute {
  if (pathname.startsWith("/angebot")) {
    return "offer";
  }
  if (pathname.startsWith("/produktion")) {
    return "production";
  }
  return "home";
}

export function getPathname(): string {
  if (typeof window === "undefined") {
    return "/";
  }
  return window.location.pathname;
}

export function getBaseUrl(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return window.location.origin;
}

export function translateHealthStatus(value?: string): string {
  const labels: Record<string, string> = {
    ok: "bereit",
    unknown: "unbekannt"
  };
  return value ? labels[value] ?? value : "-";
}

export function formatCounts(counts: Record<string, number>): string {
  const entries = Object.entries(counts);
  if (entries.length === 0) {
    return "Keine Zähler";
  }

  const labels: Record<string, string> = {
    requests: "Anfragen",
    acceptedSpecs: "Spezifikationen",
    offerDrafts: "Angebotsentwürfe",
    productionPlans: "Produktionspläne",
    purchaseLists: "Einkaufslisten",
    recipes: "Rezepte",
    auditEvents: "Änderungen"
  };

  return entries.map(([label, value]) => `${labels[label] ?? label}: ${value}`).join(" · ");
}

export function formatLatestIntakeRequest(requests: Array<Record<string, unknown>>): string {
  if (requests.length === 0) {
    return "letzte Erfassung: keine";
  }

  const latestRequest = requests.reduce((latest, request) => {
    const latestTimestamp = Date.parse(
      String((latest.source as Record<string, unknown> | undefined)?.receivedAt ?? "")
    );
    const requestTimestamp = Date.parse(
      String((request.source as Record<string, unknown> | undefined)?.receivedAt ?? "")
    );
    if (Number.isNaN(latestTimestamp)) {
      return request;
    }
    if (Number.isNaN(requestTimestamp)) {
      return latest;
    }
    return requestTimestamp >= latestTimestamp ? request : latest;
  });

  const requestId = String(latestRequest.requestId ?? latestRequest.id ?? "unbekannt");
  const channel = String((latestRequest.source as Record<string, unknown> | undefined)?.channel ?? "-");
  const rawInputs = Array.isArray(latestRequest.rawInputs) ? latestRequest.rawInputs : [];
  const firstInputWithSource = rawInputs.find((input) => {
    const sourceMetadata = asRecord((input as Record<string, unknown>).sourceMetadata);
    return Boolean(readStringOrNumber(sourceMetadata, ["filename"]));
  }) as Record<string, unknown> | undefined;
  const firstInputWithWarning = rawInputs.find((input) =>
    Boolean(formatDocumentIngestionSummary(input as Record<string, unknown>))
  ) as Record<string, unknown> | undefined;
  const sourceFilename = readStringOrNumber(asRecord(firstInputWithSource?.sourceMetadata), ["filename"]);
  const ingestionSummary = firstInputWithWarning ? formatDocumentIngestionSummary(firstInputWithWarning) : undefined;

  return [
    `letzte Erfassung: ${requestId} via ${channel}`,
    sourceFilename ? `Quelle: ${sourceFilename}` : undefined,
    ingestionSummary ? `Ingestion-Warnung: ${ingestionSummary}` : undefined
  ]
    .filter(Boolean)
    .join(" · ");
}

export function formatAuditEventHandoffLabel(event: Record<string, unknown>): string {
  const actor = asRecord(event.actor);
  const parts = [
    readStringOrNumber(event, ["summary", "action", "auditId"]),
    readStringOrNumber(actor, ["name"]),
    readStringOrNumber(event, ["action"]),
    readStringOrNumber(event, ["at"])
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : "Audit-Eintrag vorhanden";
}

export function formatLatestAuditOverviewLabel(event: Record<string, unknown>): string {
  const actor = asRecord(event.actor);
  const summary = readStringOrNumber(event, ["summary", "action", "auditId"]) ?? "Audit-Eintrag vorhanden";
  const parts = [
    summary,
    readStringOrNumber(actor, ["name"]) ? `Actor: ${readStringOrNumber(actor, ["name"])}` : undefined,
    readStringOrNumber(event, ["action"]) ? `Action: ${readStringOrNumber(event, ["action"])}` : undefined,
    readStringOrNumber(event, ["at"])
  ].filter(Boolean);

  return parts.join(" · ");
}

export function getRouteTitle(route: AppRoute): string {
  if (route === "offer") {
    return "Angebotsagent";
  }
  if (route === "production") {
    return "Produktionsagent";
  }
  return "Catering-Agenten";
}

export function getRouteSubtitle(route: AppRoute): string {
  if (route === "offer") {
    return "Kundenanfrage verstehen, Leistungen strukturieren und daraus belastbare Angebotsentwürfe erzeugen.";
  }
  if (route === "production") {
    return "Ruhige Arbeitsfläche für Rezepte, Produktionspläne und Einkaufslisten.";
  }
  return "Zwei spezialisierte Arbeitsflächen mit gemeinsamem Regelkern und klar getrennten Zuständigkeiten.";
}

export function compareNewestRecordsBy(key: string) {
  return (left: Record<string, unknown>, right: Record<string, unknown>) =>
    trailingNumericRank(right[key]) - trailingNumericRank(left[key]);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function readStringOrNumber(record: Record<string, unknown> | undefined, keys: string[]): string | undefined {
  if (!record) {
    return undefined;
  }

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return undefined;
}

function trailingNumericRank(value: unknown): number {
  const match = String(value ?? "").match(/(\d{6,})$/);
  return match ? Number(match[1]) : 0;
}
