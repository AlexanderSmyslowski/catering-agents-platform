// React 19 uses this flag to identify act-aware test environments.
// Keeping it central avoids per-smoke-test boilerplate and warning noise.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
