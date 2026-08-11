# Stage A Provider Data Gate

- Add a server-owned approval gate before every external BYO LLM call.
- Keep fixture execution local and preserve existing synthetic contracts.
- Require exact business, purpose, data class, provider, model, capability, region and cost approval matches.
- Resolve approval records from an absolute file path outside the repository.
- Keep approval records and raw provider payloads out of audits.
- Guard product routes and the offer batch before their delegates run.
- Do not invoke network or Codex CLI transports during verification.
