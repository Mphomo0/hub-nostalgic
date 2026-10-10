import { NextResponse } from "next/server";
import { rateLimitByIp } from "@/lib/rate-limit";
import { stripPlaceholder } from "@/lib/tokens";
import { recordGoogleClick } from "@/modules/reviews/lib/rating";

/** Records the Google click, then redirects to the client's Google review link. */
export async function GET(_request: Request, ctx: RouteContext<"/r/[token]/go">) {
  const { token: raw } = await ctx.params;
  const token = stripPlaceholder(raw);
  if (!(await rateLimitByIp("publicRating"))) return new Response("Too many requests", { status: 429 });
  const url = token.length >= 20 && token.length <= 100 ? await recordGoogleClick(token) : null;
  if (!url) return new Response("Link not found", { status: 404 });
  return NextResponse.redirect(url, { status: 303, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
