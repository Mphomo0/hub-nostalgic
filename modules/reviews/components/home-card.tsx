import Link from "next/link";
import { Card } from "@/components/ui";
import { daysAgo } from "@/lib/dates";
import { tenantDb } from "@/lib/tenant";
import { reviewsModule } from "@/modules/reviews/module";

/** Reviews summary on the dashboard home page (last 30 days). */
export async function ReviewsHomeCard({ clientId }: { clientId: string }) {
  const tdb = tenantDb(clientId);
  const since = daysAgo(30);
  const [sent, ratings, clicks, openFeedback] = await Promise.all([
    tdb.reviewRequest.count({ where: { sentAt: { gte: since } } }),
    tdb.reviewRequest.aggregate({ where: { ratedAt: { gte: since } }, _count: { rating: true }, _avg: { rating: true } }),
    tdb.reviewRequest.count({ where: { googleClickedAt: { gte: since } } }),
    tdb.feedback.count({ where: { handledAt: null } }),
  ]);
  const Icon = reviewsModule.icon;
  const stats = [
    { label: "Requests sent", value: sent },
    { label: "Average rating", value: ratings._avg.rating ? ratings._avg.rating.toFixed(1) : "—" },
    { label: "Went to Google", value: clicks },
  ];

  return (
    <Card className="flex flex-col">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-lg bg-brand-soft text-brand-strong"><Icon className="size-5" aria-hidden="true" /></span>
        <div>
          <h2 className="font-semibold">{reviewsModule.name}</h2>
          <p className="text-xs text-muted">Last 30 days</p>
        </div>
      </div>
      <dl className="mt-5 grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label}>
            <dt className="text-xs text-muted">{s.label}</dt>
            <dd className="mt-0.5 text-2xl font-semibold tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>
      {openFeedback > 0 && (
        <Link href="/dashboard/reviews/feedback" className="mt-4 rounded-lg bg-warn-soft px-3 py-2 text-sm hover:brightness-95">
          {openFeedback} private feedback message{openFeedback === 1 ? "" : "s"} to handle →
        </Link>
      )}
      <div className="mt-auto flex gap-4 pt-5 text-sm font-semibold">
        <Link href="/dashboard/reviews/send" className="text-brand-strong hover:underline">Send requests</Link>
        <Link href="/dashboard/reviews" className="text-muted hover:text-ink">Open Reviews</Link>
      </div>
    </Card>
  );
}
