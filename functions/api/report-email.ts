import { sendReportEmailIfConfigured, type WorkerEnv } from "./_shared";

interface ReportEmailPayload {
  email?: string;
  report?: {
    meta?: {
      site?: string;
    };
  };
}

export const onRequestPost: PagesFunction<WorkerEnv> = async ({ request, env }) => {
  try {
    const payload = (await request.json()) as ReportEmailPayload;
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid email" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const delivery = await sendReportEmailIfConfigured(env, {
      email,
      site: payload.report?.meta?.site,
      report: payload.report,
    });

    return new Response(JSON.stringify({ ok: true, sent: delivery.sent, message: delivery.message }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
};
