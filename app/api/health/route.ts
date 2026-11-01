import { db } from "@/lib/db";

// Always evaluated at request time: an uptime monitor must not get a cached answer.
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };

/**
 * Health check for uptime monitors. Returns no details, so it is safe to leave public.
 *
 * By default it only checks that the app is up and does NOT touch the database.
 * Neon suspends an idle database after 5 minutes; a query every few minutes keeps
 * it awake around the clock and uses up the free plan's monthly compute hours,
 * after which Neon stops the database until the next month.
 *
 * `?db=1` also runs `SELECT 1` (503 if the database is unreachable). Use it for
 * manual checks only, never from a frequent monitor.
 */
async function check(req: Request) {
  if (new URL(req.url).searchParams.get("db") !== "1") {
    return Response.json({ status: "ok" }, { headers });
  }
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" }, { headers });
  } catch (err) {
    console.error("[health] database check failed", err);
    return Response.json({ status: "error" }, { status: 503, headers });
  }
}

export const GET = check;
export const HEAD = check;
