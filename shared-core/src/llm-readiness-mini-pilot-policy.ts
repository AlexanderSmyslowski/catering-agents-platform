export interface LlmReadinessMiniPilotPolicyResult {
  miniPilotReady: boolean;
  miniPilotEnabled: boolean;
  namedOperatorScopeConfirmed: boolean;
  approvedDataScopeConfirmed: boolean;
  draftOnlyConfirmed: boolean;
  humanApprovalConfirmed: boolean;
  writeEffectsAllowed: false;
  preferredMiniPilotCommand: "npm run llm:synthetic-live:check";
  pilotScope: "internal_named_users_draft_only";
  warnings: string[];
}

function isEnabled(value?: string): boolean {
  return value === "1" || value === "true";
}

export function readLlmReadinessMiniPilotPolicy(
  env: Record<string, string | undefined>
): LlmReadinessMiniPilotPolicyResult {
  const miniPilotEnabled = isEnabled(env.CATERING_SYNTHETIC_LLM_MINI_PILOT);
  const namedOperatorScopeConfirmed =
    env.CATERING_SYNTHETIC_LLM_OPERATOR_SCOPE === "named_internal_operators";
  const approvedDataScopeConfirmed =
    env.CATERING_SYNTHETIC_LLM_DATA_SCOPE === "synthetic_demo_or_approved_internal";
  const draftOnlyConfirmed = env.CATERING_SYNTHETIC_LLM_OUTPUT_SCOPE === "draft_only";
  const humanApprovalConfirmed = env.CATERING_SYNTHETIC_LLM_HUMAN_APPROVAL === "required";
  const warnings: string[] = [];

  if (!miniPilotEnabled) {
    warnings.push("CATERING_SYNTHETIC_LLM_MINI_PILOT should be set for the approved mini-pilot corridor");
  }

  if (!namedOperatorScopeConfirmed) {
    warnings.push("CATERING_SYNTHETIC_LLM_OPERATOR_SCOPE should stay named_internal_operators");
  }

  if (!approvedDataScopeConfirmed) {
    warnings.push("CATERING_SYNTHETIC_LLM_DATA_SCOPE should stay synthetic_demo_or_approved_internal");
  }

  if (!draftOnlyConfirmed) {
    warnings.push("CATERING_SYNTHETIC_LLM_OUTPUT_SCOPE should stay draft_only");
  }

  if (!humanApprovalConfirmed) {
    warnings.push("CATERING_SYNTHETIC_LLM_HUMAN_APPROVAL should stay required");
  }

  return {
    miniPilotReady:
      miniPilotEnabled &&
      namedOperatorScopeConfirmed &&
      approvedDataScopeConfirmed &&
      draftOnlyConfirmed &&
      humanApprovalConfirmed,
    miniPilotEnabled,
    namedOperatorScopeConfirmed,
    approvedDataScopeConfirmed,
    draftOnlyConfirmed,
    humanApprovalConfirmed,
    writeEffectsAllowed: false,
    preferredMiniPilotCommand: "npm run llm:synthetic-live:check",
    pilotScope: "internal_named_users_draft_only",
    warnings
  };
}
