import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const trustedHeaders = (actorName: string) => env.CATERING_TRUSTED_ACTOR_SECRET
    ? { "x-catering-trusted-secret": env.CATERING_TRUSTED_ACTOR_SECRET, "x-catering-actor-name": actorName, "x-catering-business-id": env.CATERING_DEFAULT_BUSINESS_ID ?? "local" }
    : {};
  const proxyTarget = (target: string, prefix: RegExp, actorName: string) => ({
    target,
    changeOrigin: true,
    rewrite: (input: string) => input.replace(prefix, ""),
    headers: trustedHeaders(actorName)
  });

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@ui": path.resolve(__dirname, "src")
      }
    },
    server: {
      host: "0.0.0.0",
      port: 3200,
      proxy: {
        "/api/intake/v1/intake/seed-demo": proxyTarget(env.VITE_INTAKE_PROXY_TARGET ?? "http://localhost:3101", /^\/api\/intake/, "Betriebs-/Audit-Operator"),
        "/api/intake": {
          ...proxyTarget(env.VITE_INTAKE_PROXY_TARGET ?? "http://localhost:3101", /^\/api\/intake/, "Intake-Mitarbeiter")
        },
        "/api/offers/v1/offers/seed-demo": proxyTarget(env.VITE_OFFERS_PROXY_TARGET ?? "http://localhost:3102", /^\/api\/offers/, "Betriebs-/Audit-Operator"),
        "/api/offers": {
          ...proxyTarget(env.VITE_OFFERS_PROXY_TARGET ?? "http://localhost:3102", /^\/api\/offers/, "Angebots-Mitarbeiter")
        },
        "/api/production/v1/production/seed-demo": proxyTarget(env.VITE_PRODUCTION_PROXY_TARGET ?? "http://localhost:3103", /^\/api\/production/, "Betriebs-/Audit-Operator"),
        "/api/production/v1/production/audit": proxyTarget(env.VITE_PRODUCTION_PROXY_TARGET ?? "http://localhost:3103", /^\/api\/production/, "Betriebs-/Audit-Operator"),
        "/api/production": {
          ...proxyTarget(env.VITE_PRODUCTION_PROXY_TARGET ?? "http://localhost:3103", /^\/api\/production/, "Produktions-Mitarbeiter")
        },
        "/api/exports/v1/exports/offers": proxyTarget(env.VITE_EXPORTS_PROXY_TARGET ?? "http://localhost:3104", /^\/api\/exports/, "Angebots-Mitarbeiter"),
        "/api/exports": {
          ...proxyTarget(env.VITE_EXPORTS_PROXY_TARGET ?? "http://localhost:3104", /^\/api\/exports/, "Produktions-Mitarbeiter")
        }
      }
    }
  };
});
