import { MINIMAL_MVP_ROLE_CAPABILITIES } from "@catering/shared-core";

/** Explicit authenticated UI fixture for pre-session product tests. */
export function adminSessionResponse(): Response {
  return Response.json({
    authenticated: true,
    user: {
      userId: "test-admin",
      displayName: "Test-Administrator"
    },
    access: {
      capabilities: [...MINIMAL_MVP_ROLE_CAPABILITIES.admin]
    }
  });
}
