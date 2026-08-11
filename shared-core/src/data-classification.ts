export const byoLlmDataClasses = [
  "synthetic_demo",
  "anonymized",
  "pseudonymized",
  "private_business",
  "personal_confidential"
] as const;

export type ByoLlmDataClass = typeof byoLlmDataClasses[number];
