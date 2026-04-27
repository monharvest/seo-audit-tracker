import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";
import {
  inspectPage,
  runAutomatedRetest,
  sendReportEmailIfConfigured,
  type WorkerEnv,
} from "./functions/api/_shared";

const SERVER_ENV_KEYS = [
  "PAGE_SPEED_API_KEY",
  "RESEND_API_KEY",
  "REPORT_FROM_EMAIL",
  "SEO_COMPETITOR_MONITORING",
] as const;

function readEnvFromProcess(): WorkerEnv {
  return {
    PAGE_SPEED_API_KEY: process.env.PAGE_SPEED_API_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    REPORT_FROM_EMAIL: process.env.REPORT_FROM_EMAIL,
    SEO_COMPETITOR_MONITORING: process.env.SEO_COMPETITOR_MONITORING,
  };
}

function readJsonBody<T>(req: import("http").IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    const cached = (req as { body?: unknown }).body;
    if (cached && typeof cached === "object") {
      resolve(cached as T);
      return;
    }
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        resolve((body ? JSON.parse(body) : {}) as T);
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function vitePluginApiServer(): Plugin {
  return {
    name: "seo-audit-api-server",

    configureServer(server: ViteDevServer) {
      server.middlewares.use("/api/page-inspect", (req, res, next) => {
        if (req.method !== "GET") return next();

        const reqUrl = req.url ?? "";
        const parsed = new URL(reqUrl.startsWith("http") ? reqUrl : `http://localhost${reqUrl}`);
        const target = parsed.searchParams.get("url");

        if (!target) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing url query parameter" }));
          return;
        }

        void (async () => {
          try {
            const payload = await inspectPage(target);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(payload));
          } catch (e) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: String(e) }));
          }
        })();
      });

      server.middlewares.use("/api/report-email", (req, res, next) => {
        if (req.method !== "POST") return next();

        void (async () => {
          try {
            const payload = await readJsonBody<{
              email?: string;
              report?: { meta?: { site?: string } };
            }>(req);
            const email =
              typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
            if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ ok: false, error: "Invalid email" }));
              return;
            }

            const delivery = await sendReportEmailIfConfigured(readEnvFromProcess(), {
              email,
              site: payload.report?.meta?.site,
              report: payload.report,
            });

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: true, sent: delivery.sent, message: delivery.message }));
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: false, error: String(e) }));
          }
        })();
      });

      server.middlewares.use("/api/retest", (req, res, next) => {
        if (req.method !== "POST") return next();

        void (async () => {
          try {
            const payload = await readJsonBody<{ site?: string }>(req);
            const site =
              typeof payload?.site === "string" && payload.site.trim() ? payload.site.trim() : "";
            if (!site) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Missing site" }));
              return;
            }

            const result = await runAutomatedRetest(site, readEnvFromProcess());
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(result));
          } catch (e) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: String(e) }));
          }
        })();
      });
    },
  };
}

const plugins = [react(), tailwindcss(), jsxLocPlugin(), vitePluginManusRuntime(), vitePluginApiServer()];

export default defineConfig(({ mode }) => {
  const envDir = path.resolve(import.meta.dirname);
  const fileEnv = loadEnv(mode, envDir, "");
  for (const key of SERVER_ENV_KEYS) {
    if (fileEnv[key] && !process.env[key]) {
      process.env[key] = fileEnv[key];
    }
  }

  return {
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "client", "src"),
        "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      },
    },
    envDir,
    root: path.resolve(import.meta.dirname, "client"),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
    },
    server: {
      port: 3000,
      strictPort: false,
      host: true,
      allowedHosts: [
        ".manuspre.computer",
        ".manus.computer",
        ".manus-asia.computer",
        ".manuscomputer.ai",
        ".manusvm.computer",
        "localhost",
        "127.0.0.1",
      ],
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
  };
});
