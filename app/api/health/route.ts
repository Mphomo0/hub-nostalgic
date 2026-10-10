import { db } from "@/lib/db";

// Always evaluated at request time: an uptime monitor must not get a cached answer.
export const dynamic = "force-dynamic";

/**
 * Health check for uptime monitors. 200 when the app is up and can reach the
 * database, 503 otherwise. Returns no details, so it is safe to leave public.
 */
async function check() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[health] database check failed", err);
    return Response.json({ status: "error" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export const GET = check;
export const HEAD = check;
