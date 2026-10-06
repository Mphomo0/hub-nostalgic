"use server";
import { rateLimitByIp } from "@/lib/rate-limit";
import { optOutByToken } from "@/modules/reviews/lib/optout";

export async function unsubscribeAction(_prev: { done?: boolean; error?: string } | null, formData: FormData) {
  if (!(await rateLimitByIp("publicForm", "unsub"))) return { error: "Too many attempts. Please try again later." };
  const token = String(formData.get("token") ?? "");
  const res = await optOutByToken(token);
  return res ? { done: true } : { error: "This link isn't valid." };
}
