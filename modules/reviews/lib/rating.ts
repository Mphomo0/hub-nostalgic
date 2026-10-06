import { LOW_RATING_MAX } from "@/modules/reviews/config";
import { db } from "@/lib/db";

/**
 * Public rating flow (build plan 6.3): rate first, then EVERYONE sees the
 * Google link. Low raters are additionally offered private feedback.
 * Never hide the Google link (Google prohibits review gating).
 */

export function isLowRating(rating: number | null | undefined) {
  return typeof rating === "number" && rating <= LOW_RATING_MAX;
}

/** Only the fields the public page needs: never customer contact details. */
export async function getPublicRequest(token: string) {
  if (!token || token.length < 20 || token.length > 100) return null;
  return db.reviewRequest.findUnique({
    where: { token },
    select: {
      id: true,
      status: true,
      rating: true,
      customer: { select: { name: true } },
      client: { select: { id: true, name: true, brandColor: true, logo: { select: { updatedAt: true } } } },
      _count: { select: { feedback: true } },
    },
  });
}

/** First visit: SENT → OPENED. Never moves a request backwards. */
export async function markOpened(requestId: string, now = new Date()) {
  await db.reviewRequest.updateMany({ where: { id: requestId, status: { in: ["SENT", "QUEUED"] } }, data: { status: "OPENED", openedAt: now } });
}

/** Store a 1–5 rating. A token can only be rated once. */
export async function submitRating(token: string, rating: number, now = new Date()) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { ok: false as const, error: "invalid" };
  const updated = await db.reviewRequest.updateMany({
    where: { token, rating: null },
    data: { rating, status: "RATED", ratedAt: now },
  });
  // Backfill openedAt if they rated straight from a cached page.
  await db.reviewRequest.updateMany({ where: { token, openedAt: null }, data: { openedAt: now } });
  const req = await db.reviewRequest.findUnique({ where: { token }, select: { rating: true } });
  if (!req) return { ok: false as const, error: "not-found" };
  return { ok: true as const, alreadyRated: updated.count === 0, rating: req.rating! };
}

/** Customer clicked through to Google. Returns the URL to redirect to. */
export async function recordGoogleClick(token: string, now = new Date()) {
  const req = await db.reviewRequest.findUnique({
    where: { token },
    select: { id: true, googleClickedAt: true, client: { select: { reviewSettings: { select: { googleReviewUrl: true } } } } },
  });
  const url = req?.client.reviewSettings?.googleReviewUrl;
  if (!req || !url) return null;
  if (!req.googleClickedAt) {
    await db.reviewRequest.update({ where: { id: req.id }, data: { googleClickedAt: now, status: "CLICKED_GOOGLE" } });
  }
  return url;
}

/** Private feedback from a low rater. One message per request. */
export async function submitFeedback(token: string, message: string) {
  const text = message.trim().slice(0, 2000);
  if (!text) return { ok: false as const, error: "empty" };
  const req = await db.reviewRequest.findUnique({ where: { token }, select: { id: true, rating: true, _count: { select: { feedback: true } } } });
  if (!req) return { ok: false as const, error: "not-found" };
  if (!isLowRating(req.rating)) return { ok: false as const, error: "not-allowed" };
  if (req._count.feedback > 0) return { ok: false as const, error: "already-sent" };
  await db.feedback.create({ data: { reviewRequestId: req.id, message: text } });
  return { ok: true as const };
}
