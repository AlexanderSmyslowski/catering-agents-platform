import {
  validateAcceptedEventSpec,
  validateEventRequest,
  type AcceptedEventSpec,
  type BusinessContext
} from "@catering/shared-core";
import type {
  IntakeRecordsPort,
  IntakeSpecInsertResult,
  IntakeSpecReplaceResult
} from "../ports/intake-records-port.js";

export interface HttpIntakeRecordsPortOptions {
  intakeServiceUrl: string;
  trustedServiceSecret?: string;
  fetch?: typeof globalThis.fetch;
}

function upstreamMessage(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return undefined;
  const message = (payload as { message?: unknown }).message;
  return typeof message === "string" && message.trim() ? message : undefined;
}

export class HttpIntakeRecordsPort implements IntakeRecordsPort {
  private readonly fetcher: typeof globalThis.fetch;

  constructor(private readonly options: HttpIntakeRecordsPortOptions) {
    this.fetcher = options.fetch ?? globalThis.fetch;
  }

  async getRequest(context: BusinessContext, requestId: string) {
    const response = await this.request(
      context,
      `/v1/intake/internal/requests/${encodeURIComponent(requestId)}`
    );
    if (response.status === 404) return undefined;
    const payload = await this.expectJson(response, "EventRequest konnte nicht geladen werden.");
    const eventRequest = (payload as { eventRequest?: unknown }).eventRequest;
    if (!eventRequest || typeof eventRequest !== "object") {
      throw new Error("EventRequest-Antwort enthält keinen gültigen Datensatz.");
    }
    const validated = validateEventRequest(eventRequest as Parameters<typeof validateEventRequest>[0]);
    if (validated.requestId !== requestId) {
      throw new Error("EventRequest passt nicht zur angeforderten Identität.");
    }
    return validated;
  }

  async getSpec(context: BusinessContext, specId: string) {
    const response = await this.request(
      context,
      `/v1/intake/internal/specs/${encodeURIComponent(specId)}`
    );
    if (response.status === 404) return undefined;
    const payload = await this.expectJson(response, "AcceptedEventSpec konnte nicht geladen werden.");
    const acceptedEventSpec = (payload as { acceptedEventSpec?: unknown }).acceptedEventSpec;
    if (!acceptedEventSpec || typeof acceptedEventSpec !== "object") {
      throw new Error("AcceptedEventSpec-Antwort enthält keinen gültigen Datensatz.");
    }
    const validated = validateAcceptedEventSpec(
      acceptedEventSpec as Parameters<typeof validateAcceptedEventSpec>[0]
    );
    if (validated.specId !== specId) {
      throw new Error("AcceptedEventSpec passt nicht zur angeforderten Identität.");
    }
    return validated;
  }

  async insertSpec(
    context: BusinessContext,
    specInput: AcceptedEventSpec
  ): Promise<IntakeSpecInsertResult> {
    const spec = validateAcceptedEventSpec(specInput);
    const response = await this.request(
      context,
      `/v1/intake/internal/specs/${encodeURIComponent(spec.specId)}`,
      {
        method: "PUT",
        body: JSON.stringify({ acceptedEventSpec: spec })
      }
    );
    const payload = await this.expectJson(response, "AcceptedEventSpec konnte nicht eingefügt werden.");
    const result = (payload as { result?: unknown }).result;
    if (result !== "created" && result !== "same_content") {
      throw new Error("AcceptedEventSpec-Einfügung enthält kein gültiges Ergebnis.");
    }
    return result;
  }

  async replaceSpec(
    context: BusinessContext,
    expectedInput: AcceptedEventSpec,
    replacementInput: AcceptedEventSpec
  ): Promise<IntakeSpecReplaceResult> {
    const expected = validateAcceptedEventSpec(expectedInput);
    const replacement = validateAcceptedEventSpec(replacementInput);
    if (expected.specId !== replacement.specId) {
      throw new Error("AcceptedEventSpec-Ersetzung muss dieselbe specId behalten.");
    }
    const response = await this.request(
      context,
      `/v1/intake/internal/specs/${encodeURIComponent(expected.specId)}/replacement`,
      {
        method: "PUT",
        body: JSON.stringify({ expected, replacement })
      }
    );
    const payload = await this.expectJson(response, "AcceptedEventSpec konnte nicht ersetzt werden.");
    const result = (payload as { result?: unknown }).result;
    if (result !== "updated" && result !== "same_content") {
      throw new Error("AcceptedEventSpec-Ersetzung enthält kein gültiges Ergebnis.");
    }
    return result;
  }

  private async request(
    context: BusinessContext,
    path: string,
    init: RequestInit = {}
  ): Promise<Response> {
    try {
      return await this.fetcher(
        `${this.options.intakeServiceUrl.replace(/\/$/, "")}${path}`,
        {
          ...init,
          redirect: "error",
          headers: {
            accept: "application/json",
            ...(init.body ? { "content-type": "application/json" } : {}),
            "x-catering-actor-name": "Production-Service",
            "x-catering-business-id": context.businessId,
            ...(this.options.trustedServiceSecret
              ? { "x-catering-trusted-secret": this.options.trustedServiceSecret }
              : {})
          }
        }
      );
    } catch (error) {
      throw new Error("Intake-Datensatz konnte nicht geladen oder geschrieben werden.", {
        cause: error
      });
    }
  }

  private async expectJson(response: Response, fallbackMessage: string): Promise<unknown> {
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      if (!response.ok) throw new Error(fallbackMessage);
      throw new Error("Intake-Service lieferte kein gültiges JSON.");
    }
    if (!response.ok) {
      throw new Error(upstreamMessage(payload) ?? fallbackMessage);
    }
    return payload;
  }
}
