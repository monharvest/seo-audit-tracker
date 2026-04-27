import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import {
  inspectPage,
  runAutomatedRetest,
  sendReportEmailIfConfigured,
  type WorkerEnv,
} from "../functions/api/_shared";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);
  const env: WorkerEnv = {
    PAGE_SPEED_API_KEY: process.env.PAGE_SPEED_API_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    REPORT_FROM_EMAIL: process.env.REPORT_FROM_EMAIL,
    SEO_COMPETITOR_MONITORING: process.env.SEO_COMPETITOR_MONITORING,
  };

  app.use(express.json({ limit: "2mb" }));

  app.post("/api/retest", async (req, res) => {
    try {
      const site =
        typeof req.body?.site === "string" && req.body.site.trim()
          ? req.body.site.trim()
          : "example.com";
      const result = await runAutomatedRetest(site, env);
      res.json(result);
    } catch (e) {
      res.status(400).json({ error: String(e) });
    }
  });

  app.get("/api/page-inspect", async (req, res) => {
    const target = typeof req.query.url === "string" ? req.query.url : "";

    if (!target) {
      res.status(400).json({ error: "Missing url query parameter" });
      return;
    }

    try {
      const payload = await inspectPage(target);
      res.json(payload);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.post("/api/report-email", async (req, res) => {
    try {
      const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        res.status(400).json({ ok: false, error: "Invalid email" });
        return;
      }

      const delivery = await sendReportEmailIfConfigured(env, {
        email,
        site: req.body?.report?.meta?.site,
        report: req.body?.report,
      });

      res.json({ ok: true, sent: delivery.sent, message: delivery.message });
    } catch (e) {
      res.status(400).json({ ok: false, error: String(e) });
    }
  });

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
