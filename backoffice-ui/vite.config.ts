import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@ui": path.resolve(__dirname, "src")
      }
    },
    server: {
      port: 3200,
      proxy: {
        "/api/intake": {
          target: env.VITE_INTAKE_PROXY_TARGET ?? "http://localhost:3101",
          changeOrigin: true,
          rewrite: (input) => input.replace(/^\/api\/intake/, "")
        },
        "/api/offers": {
          target: env.VITE_OFFERS_PROXY_TARGET ?? "http://localhost:3102",
          changeOrigin: true,
          rewrite: (input) => input.replace(/^\/api\/offers/, "")
        },
        "/api/production": {
          target: env.VITE_PRODUCTION_PROXY_TARGET ?? "http://localhost:3103",
          changeOrigin: true,
          rewrite: (input) => input.replace(/^\/api\/production/, "")
        }
      }
    }
  };
});

