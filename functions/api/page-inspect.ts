import { inspectPage, type WorkerEnv } from "./_shared";

export const onRequestGet: PagesFunction<WorkerEnv> = async ({ request }) => {
  const parsed = new URL(request.url);
  const target = parsed.searchParams.get("url");

  if (!target) {
    return new Response(JSON.stringify({ error: "Missing url query parameter" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const payload = await inspectPage(target);
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
