"use server";
import { rateLimitByIp } from "@/lib/rate-limit";
import { feedbackSchema, ratingSchema } from "@/modules/reviews/schemas";
import { isLowRating, submitFeedback, submitRating } from "@/modules/reviews/lib/rating";

export type RateState = { rating: number; low: boolean; feedbackSent?: boolean; error?: string } | null;

export async function rateAction(prev: RateState, formData: FormData): Promise<RateState> {
  if (!(await rateLimitByIp("publicRating"))) return { rating: prev?.rating ?? 0, low: false, error: "Too many attempts. Please try again in a minute." };
  const parsed = ratingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { rating: 0, low: false, error: "Please choose 1 to 5 stars." };
  const res = await submitRating(parsed.data.token, parsed.data.rating);
  if (!res.ok) return { rating: 0, low: false, error: "This link is no longer valid." };
  return { rating: res.rating, low: isLowRating(res.rating) };
}

export async function feedbackAction(prev: RateState, formData: FormData): Promise<RateState> {
  const base = prev ?? { rating: 0, low: true };
  if (!(await rateLimitByIp("publicForm"))) return { ...base, error: "Too many attempts. Please try again later." };
  const parsed = feedbackSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ...base, error: parsed.error.issues[0].message };
  const res = await submitFeedback(parsed.data.token, parsed.data.message);
  if (!res.ok) return { ...base, feedbackSent: res.error === "already-sent", error: res.error === "already-sent" ? undefined : "Sorry, we couldn't send that." };
  return { ...base, feedbackSent: true, error: undefined };
}
