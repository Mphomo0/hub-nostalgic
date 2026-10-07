import Link from "next/link";
import { Stars } from "@/modules/reviews/components/request-status";
import { Badge, Button, Card, cx, EmptyState, PageHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/dates";
import { requireModule } from "@/lib/session";
import { toggleHandledAction } from "./actions";

export const metadata = { title: "Feedback" };

export default async function FeedbackPage({ searchParams }: PageProps<"/dashboard/reviews/feedback">) {
  const { tdb } = await requireModule("reviews");
  const sp = await searchParams;
  const show = sp.show === "handled" ? "handled" : sp.show === "all" ? "all" : "open";
  const where = show === "open" ? { handledAt: null } : show === "handled" ? { handledAt: { not: null } } : {};

  const items = await tdb.feedback.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      handledBy: { select: { name: true } },
      reviewRequest: { select: { rating: true, customer: { select: { name: true, phoneE164: true, email: true } } } },
    },
  });

  return (
    <>
      <PageHeader title="Feedback inbox" description="Private feedback from customers who rated 1–3 stars. They were still shown your Google link." />
      <nav aria-label="Filter" className="mb-4 flex gap-2 text-sm">
        {(["open", "handled", "all"] as const).map((s) => (
          <Link key={s} href={`/dashboard/reviews/feedback${s === "open" ? "" : `?show=${s}`}`} aria-current={show === s ? "page" : undefined} className={cx("rounded-full border px-3 py-1", show === s ? "border-brand bg-brand-soft text-brand-strong" : "border-line bg-card")}>
            {s === "open" ? "To handle" : s === "handled" ? "Handled" : "All"}
          </Link>
        ))}
      </nav>
      {items.length === 0 ? (
        <EmptyState title={show === "open" ? "Nothing to handle" : "No feedback yet"}>Feedback from unhappy customers will appear here so you can put things right.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {items.map((f) => {
            const c = f.reviewRequest.customer;
            return (
              <li key={f.id}>
                <Card className={cx("p-5", f.handledAt && "bg-paper")}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="break-words font-medium">{c.name} <span className="ml-1"><Stars rating={f.reviewRequest.rating} /></span></div>
                      <div className="break-words text-xs text-muted">
                        {[c.phoneE164, c.email].filter(Boolean).join(" · ")} · {formatDateTime(f.createdAt)}
                      </div>
                    </div>
                    <form action={toggleHandledAction}>
                      <input type="hidden" name="id" value={f.id} />
                      <input type="hidden" name="handled" value={f.handledAt ? "0" : "1"} />
                      <Button variant="secondary" className="py-1.5">{f.handledAt ? "Mark as open" : "Mark handled"}</Button>
                    </form>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm">{f.message}</p>
                  {f.handledAt && <div className="mt-3"><Badge tone="good">Handled by {f.handledBy?.name ?? "someone"} · {formatDateTime(f.handledAt)}</Badge></div>}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
