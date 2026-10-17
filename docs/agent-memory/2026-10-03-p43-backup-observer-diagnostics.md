# P4.3 – Backup observer gate diagnostics

Base: `b86f268a08cacb7fba61b7d7b653b94ebc08ad6d`. Scope: preserve existing
diagnostics from the single read-only observer invocation; no production contact.

The remote runner previously captured observer stdout in `observer_json`, then
discarded it on a nonzero status. Failed remote stdout was also discarded by the
local command substitution. The Python operator inherits runner stderr, so a
sanitized `TARGET_BACKUP_OBSERVER_DIAGNOSTIC` JSON line on stderr survives both
boundaries and appears immediately before its corresponding failure gate.

The line always contains `gate` and `observer_exit` (the existing observer
pipeline status). It projects only existing, type-checked fields:
`backup_health`, `reason`, `data_epoch`, `observer_run`, `delivery_accepted`,
`recipient_confirmed`, and `remote_repository_checked`. Reasons use an explicit
allowlist of current observer codes; unknown codes become `REDACTED`. Health and
run values use fixed enums, flags are JSON booleans, epoch is a nonnegative signed
64-bit integer or null. Invalid field types and all other fields are omitted.
Malformed, non-object or oversized output (over 4096 characters) produces the
fixed `diagnostic_status=UNAVAILABLE`; raw output and parser exceptions are not
included in that diagnostic. A diagnostic-process failure has the same fixed
fallback. Healthy success emits no new diagnostic.

Fail-closed behavior remains: nonzero observer status fails
`backup_observer_command`; zero status without completed/healthy output fails
`backup_observer_health`. Diagnostics never authorize success, rerun the observer,
sleep, relax freshness, or alter locking, activation, recovery or retry policy.
Record generations are internal and absent from the existing observer result;
they are not newly collected. Freshness/restore/policy distinctions are conveyed
by their existing reason codes, rather than inferred new status fields.

Regression tests execute the rendered gate inside the outer command substitution
with the external observer boundary simulated: healthy, generation, age,
restore-dispatch/receipt validator, policy errors, status/health disagreement,
malformed output, secret fields and unknown codes. Each invocation asserts one
observer process call. RED on base: six missing-diagnostic failures; GREEN and
independent review/PR-CI evidence are recorded separately in the private P4.3
evidence package.

The original production failure remains causally unresolved. This diagnostic
change does not establish a race or authorize retry, integration or deployment.
