// React 19 uses this flag to identify act-aware test environments.
// Keeping it central avoids per-smoke-test boilerplate and warning noise.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Existing local integration tests use x-actor-name as an explicit dev/test actor hint.
// Production-near fail-closed tests pass env: {} to services and do not inherit this.
process.env.CATERING_DEV_AUTH ??= "1";
