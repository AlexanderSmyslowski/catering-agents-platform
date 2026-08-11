import {
  areJsonValuesEqual,
  validateAcceptedEventSpec,
  validateEventRequest,
  type AcceptedEventSpec,
  type BusinessContext,
  type EventRequest
} from "@catering/shared-core";
import type {
  IntakeRecordsPort,
  IntakeSpecInsertResult,
  IntakeSpecReplaceResult
} from "../../production-service/src/ports/intake-records-port.js";

function recordKey(context: BusinessContext, id: string): string {
  return `${context.businessId}\u0000${id}`;
}

export class InMemoryIntakeRecordsPort implements IntakeRecordsPort {
  private readonly requests = new Map<string, EventRequest>();
  private readonly specs = new Map<string, AcceptedEventSpec>();

  async getRequest(context: BusinessContext, requestId: string): Promise<EventRequest | undefined> {
    return structuredClone(this.requests.get(recordKey(context, requestId)));
  }

  async getSpec(context: BusinessContext, specId: string): Promise<AcceptedEventSpec | undefined> {
    return structuredClone(this.specs.get(recordKey(context, specId)));
  }

  async listSpecs(context: BusinessContext): Promise<AcceptedEventSpec[]> {
    const prefix = `${context.businessId}\u0000`;
    return [...this.specs.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([, spec]) => structuredClone(spec));
  }

  async insertSpec(context: BusinessContext, spec: AcceptedEventSpec): Promise<IntakeSpecInsertResult> {
    const validated = validateAcceptedEventSpec(spec);
    const key = recordKey(context, validated.specId);
    const existing = this.specs.get(key);
    if (existing) {
      if (areJsonValuesEqual(existing, validated)) return "same_content";
      throw new Error("AcceptedEventSpec existiert bereits mit anderem Inhalt.");
    }
    this.specs.set(key, structuredClone(validated));
    return "created";
  }

  async replaceSpec(
    context: BusinessContext,
    expected: AcceptedEventSpec,
    replacement: AcceptedEventSpec
  ): Promise<IntakeSpecReplaceResult> {
    const validatedExpected = validateAcceptedEventSpec(expected);
    const validatedReplacement = validateAcceptedEventSpec(replacement);
    if (validatedExpected.specId !== validatedReplacement.specId) {
      throw new Error("AcceptedEventSpec-Ersatz muss dieselbe specId verwenden.");
    }
    const key = recordKey(context, validatedExpected.specId);
    const existing = this.specs.get(key);
    if (!existing || !areJsonValuesEqual(existing, validatedExpected)) {
      throw new Error("AcceptedEventSpec wurde zwischenzeitlich geändert.");
    }
    if (areJsonValuesEqual(existing, validatedReplacement)) return "same_content";
    this.specs.set(key, structuredClone(validatedReplacement));
    return "updated";
  }

  seedRequest(context: BusinessContext, request: EventRequest): void {
    const validated = validateEventRequest(request);
    this.requests.set(recordKey(context, validated.requestId), structuredClone(validated));
  }
}

const portsByApp = new WeakMap<object, IntakeRecordsPort>();

export function bindTestIntakeRecordsPort(app: object, port: IntakeRecordsPort): void {
  portsByApp.set(app, port);
}

export function testIntakeRecordsPortFor(app: object): IntakeRecordsPort {
  const port = portsByApp.get(app);
  if (!port) throw new Error("Test-App wurde ohne IntakeRecordsPort registriert.");
  return port;
}
