import { optOutByToken } from "@/modules/reviews/lib/optout";

/** RFC 8058 one-click unsubscribe (Gmail / Outlook "Unsubscribe" button). */
export async function POST(_request: Request, ctx: RouteContext<"/api/unsubscribe/[token]">) {
  const { token } = await ctx.params;
  const res = await optOutByToken(token);
  return new Response(res ? "Unsubscribed" : "Not found", { status: res ? 200 : 404 });
}
