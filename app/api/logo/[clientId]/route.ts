import { db } from "@/lib/db";

/**
 * Public logo endpoint (used in emails and the rating page).
 * Long cache headers + ETag so Vercel's CDN serves repeat requests.
 * Links include ?v=<updatedAt> so a new logo gets a new URL.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/logo/[clientId]">) {
  const { clientId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(clientId)) return new Response("Not found", { status: 404 });

  const logo = await db.clientLogo.findUnique({ where: { clientId }, select: { data: true, contentType: true, updatedAt: true, sizeBytes: true } });
  if (!logo) return new Response("Not found", { status: 404, headers: { "Cache-Control": "public, max-age=300" } });

  const etag = `"${logo.updatedAt.getTime().toString(36)}-${logo.sizeBytes}"`;
  const versioned = new URL(request.url).searchParams.has("v");
  const cacheControl = versioned ? "public, max-age=31536000, immutable" : "public, max-age=3600, s-maxage=86400";

  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag, "Cache-Control": cacheControl } });
  }
  return new Response(logo.data, {
    headers: {
      "Content-Type": logo.contentType,
      "Content-Length": String(logo.data.length),
      "Cache-Control": cacheControl,
      ETag: etag,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
