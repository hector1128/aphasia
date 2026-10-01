import { defineConfig, loadEnv } from "vite";
import { reportMiddleware } from "./server/report-api";
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env } as Record<
    string,
    string
  >;
  return {
    plugins: [
      {
        name: "local-report-email",
        configureServer(server) {
          server.middlewares.use(reportMiddleware(env));
        },
        configurePreviewServer(server) {
          server.middlewares.use(reportMiddleware(env));
        },
      },
    ],
  };
});
