import type {
  AcceptedEventSpec,
  BusinessContext,
  EventRequest
} from "@catering/shared-core";

export type IntakeSpecInsertResult = "created" | "same_content";
export type IntakeSpecReplaceResult = "updated" | "same_content";

export interface IntakeRecordsPort {
  getRequest(
    context: BusinessContext,
    requestId: string
  ): Promise<EventRequest | undefined>;
  getSpec(
    context: BusinessContext,
    specId: string
  ): Promise<AcceptedEventSpec | undefined>;
  insertSpec(
    context: BusinessContext,
    spec: AcceptedEventSpec
  ): Promise<IntakeSpecInsertResult>;
  replaceSpec(
    context: BusinessContext,
    expected: AcceptedEventSpec,
    replacement: AcceptedEventSpec
  ): Promise<IntakeSpecReplaceResult>;
}
