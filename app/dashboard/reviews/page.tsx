import Link from "next/link";
import { ButtonLink, Card, cx, PageHeader, Stat } from "@/components/ui";
import { daysAgo } from "@/lib/dates";
import { requireModule } from "@/lib/session";

const RANGES = { "7": "Last 7 days", "30": "Last 30 days", "90": "Last 90 days", all: "All time" } as const;
type Range = keyof typeof RANGES;

export default async function OverviewPage({ searchParams }: PageProps<"/dashboard">) {
  const { tdb } = await requireModule("reviews");
  const sp = await searchParams;
  const range: Range = typeof sp.range === "string" && sp.range in RANGES ? (sp.range as Range) : "30";
  const since = range === "all" ? undefined : daysAgo(Number(range));
  const inRange = (field: "sentAt" | "ratedAt" | "googleClickedAt") => (since ? { [field]: { gte: since } } : { [field]: { not: null } });

  const [sent, ratings, clicks, distribution, unhandled] = await Promise.all([
    tdb.reviewRequest.count({ where: inRange("sentAt") }),
    tdb.reviewRequest.aggregate({ where: { rating: { not: null }, ...inRange("ratedAt") }, _count: { rating: true }, _avg: { rating: true } }),
    tdb.reviewRequest.count({ where: inRange("googleClickedAt") }),
    tdb.reviewRequest.groupBy({ by: ["rating"], where: { rating: { not: null }, ...inRange("ratedAt") }, _count: { _all: true } }),
    tdb.feedback.count({ where: { handledAt: null } }),
  ]);

  const rated = ratings._count.rating;
  const avg = ratings._avg.rating;
  const rateOf = (n: number, of: number) => (of > 0 ? `${Math.round((n / of) * 100)}%` : "—");
  const byStar = Object.fromEntries(distribution.map((d) => [d.rating, d._count._all]));

  return (
    <>
      <PageHeader title="Reviews" description="How your review requests are doing." actions={<ButtonLink href="/dashboard/reviews/send">Send requests</ButtonLink>} />
      <nav aria-label="Date range" className="mb-6 flex flex-wrap gap-2 text-sm">
        {(Object.keys(RANGES) as Range[]).map((r) => (
          <Link key={r} href={`/dashboard/reviews?range=${r}`} aria-current={r === range ? "true" : undefined} className={cx("rounded-full border px-3 py-1", r === range ? "border-brand bg-brand-soft text-brand-strong" : "border-line bg-card")}>
            {RANGES[r]}
          </Link>
        ))}
      </nav>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Requests sent" value={sent} />
        <Stat label="Ratings received" value={rated} sub={`${rateOf(rated, sent)} of requests sent`} />
        <Stat label="Average rating" value={avg ? avg.toFixed(1) : "—"} sub={avg ? "out of 5" : undefined} />
        <Stat label="Went to Google" value={clicks} sub={`${rateOf(clicks, rated)} of raters`} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <h2 className="font-semibold">Ratings breakdown</h2>
          <ul className="mt-4 space-y-2">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = byStar[star] ?? 0;
              const pct = rated ? (count / rated) * 100 : 0;
              return (
                <li key={star} className="flex items-center gap-3 text-sm">
                  <span className="w-10 tabular-nums">{star} ★</span>
                  <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-paper">
                    <span className="block h-full rounded-full bg-star" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="w-8 text-right tabular-nums text-muted">{count}</span>
                </li>
              );
            })}
          </ul>
        </Card>
        <Card>
          <h2 className="font-semibold">Private feedback</h2>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{unhandled}</p>
          <p className="text-sm text-muted">waiting to be handled</p>
          <Link href="/dashboard/reviews/feedback" className="mt-4 inline-block text-sm font-semibold text-brand-strong underline">Open feedback inbox</Link>
        </Card>
      </div>
    </>
  );
}
