import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { COMPANY_NAME } from "@/lib/config";
import { getPublicRequest, isLowRating, markOpened } from "@/modules/reviews/lib/rating";
import { RatingFlow } from "./rating-flow";

export const metadata: Metadata = { title: "Rate your experience", robots: { index: false, follow: false }, referrer: "no-referrer" };

function safeColor(c: string) {
  return /^#[0-9a-fA-F]{6}$/.test(c) ? c : "#1f6f5c";
}

export default async function RatePage({ params }: PageProps<"/r/[token]">) {
  const { token } = await params;
  const req = await getPublicRequest(token);
  if (!req) notFound();
  await markOpened(req.id);

  const color = safeColor(req.client.brandColor);
  const firstName = req.customer.name.split(" ")[0];
  const logoUrl = req.client.logo ? `/api/logo/${req.client.id}?v=${req.client.logo.updatedAt.getTime()}` : null;

  return (
    <main className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center" style={{ ["--brand" as string]: color, ["--brand-strong" as string]: color, ["--brand-ink" as string]: "#ffffff" }}>
      <div className="w-full max-w-md">
        <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
          <div className="h-1.5 bg-brand" />
          <div className="p-6 sm:p-8">
            <div className="mb-6 flex justify-center">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={req.client.name} className="max-h-16 max-w-48 object-contain" />
              ) : (
                <p className="font-display text-2xl font-semibold text-brand-strong">{req.client.name}</p>
              )}
            </div>
            <RatingFlow
              token={token}
              firstName={firstName}
              businessName={req.client.name}
              initial={req.rating ? { rating: req.rating, low: isLowRating(req.rating), feedbackSent: req._count.feedback > 0 } : null}
            />
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-muted">Sent on behalf of {req.client.name} by {COMPANY_NAME}</p>
      </div>
    </main>
  );
}
