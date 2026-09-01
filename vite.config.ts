import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const configuredBase = env.VITE_BASE_PATH?.trim();

  return {
    base: mode === "pages" ? (configuredBase || "/pre-programmed/") : "/",
    plugins: [react()],
    server: {
      proxy: {
        "/api": "http://127.0.0.1:8787",
      },
    },
  };
});
