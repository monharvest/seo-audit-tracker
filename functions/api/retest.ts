import { runAutomatedRetest, type WorkerEnv } from "./_shared";

export const onRequestPost: PagesFunction<WorkerEnv> = async ({ request, env }) => {
  try {
    const payload = (await request.json()) as { site?: string };
    const site = typeof payload?.site === "string" && payload.site.trim() ? payload.site.trim() : "example.com";
    const result = await runAutomatedRetest(site, env);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
};
