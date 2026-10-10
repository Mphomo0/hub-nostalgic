import Link from "next/link";
import { ConfirmAction } from "@/components/confirm-action";
import { Badge, Button, buttonClass, Card, cx, EmptyState, Input, Notice, PageHeader, Stat } from "@/components/ui";
import { CONSENT_STATEMENT } from "@/lib/config";
import { formatDate, formatNumber } from "@/lib/dates";
import { requireModule } from "@/lib/session";
import { Stars } from "@/modules/reviews/components/request-status";
import {
  CUSTOMER_FILTERS,
  customerWhere,
  displayPhone,
  FILTER_LABELS,
  parseFilter,
  STATE_LABELS,
  summariseCustomer,
  type CustomerFilter,
  type CustomerState,
} from "@/modules/reviews/lib/customers";
import { SKIP_REASONS, type SkipReason } from "@/modules/reviews/lib/normalise";
import { sendToCustomerAction } from "./actions";

export const metadata = { title: "Customers" };
const PAGE_SIZE = 50;
const BASE = "/dashboard/reviews/customers";

const STATE_TONE: Record<CustomerState, "good" | "warn" | "neutral" | "bad"> = {
  reviewed: "good",
  rated: "warn",
  waiting: "neutral",
  "not-sent": "neutral",
};

const ERRORS: Record<string, string> = {
  rate: "You're sending too quickly. Please wait a minute and try again.",
  consent: "Please tick the consent box before sending.",
  missing: "That customer could not be found.",
  queue: "The request could not be added to the send queue. Please try again.",
};

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function CustomersPage({ searchParams }: PageProps<"/dashboard/reviews/customers">) {
  const { tdb } = await requireModule("reviews");
  const sp = await searchParams;
  const filter = parseFilter(first(sp.filter));
  const q = (first(sp.q) ?? "").slice(0, 80);
  const page = Math.min(10_000, Math.max(1, Math.floor(Number(first(sp.page))) || 1));
  const where = customerWhere(filter, q);

  const [total, customers, counts] = await Promise.all([
    tdb.customer.count({ where }),
    tdb.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, name: true, phoneE164: true, email: true, optedOutAt: true, createdAt: true,
        reviewRequests: { select: { createdAt: true, sentAt: true, ratedAt: true, rating: true, googleClickedAt: true, status: true } },
      },
    }),
    Promise.all(CUSTOMER_FILTERS.map((f) => tdb.customer.count({ where: customerWhere(f) }))),
  ]);
  const countOf = Object.fromEntries(CUSTOMER_FILTERS.map((f, i) => [f, counts[i]])) as Record<CustomerFilter, number>;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const now = new Date();

  const href = (p: { filter?: CustomerFilter; q?: string; page?: number }, path = BASE) => {
    const params = new URLSearchParams();
    if (p.filter && p.filter !== "all") params.set("filter", p.filter);
    if (p.q) params.set("q", p.q);
    if (p.page && p.page > 1) params.set("page", String(p.page));
    const s = params.toString();
    return `${path}${s ? `?${s}` : ""}`;
  };

  const sentNotice = first(sp.sent) === "1";
  const skipped = first(sp.skipped);
  const error = first(sp.error);

  return (
    <>
      <PageHeader
        title="Customers"
        description={`${formatNumber(countOf.all)} customer${countOf.all === 1 ? "" : "s"} you've added`}
        actions={
          <>
            <a href={href({ filter, q }, `${BASE}/export`)} download className={buttonClass("secondary")}>Export CSV</a>
            <Link href="/dashboard/reviews/send" className={buttonClass("primary")}>Add customers</Link>
          </>
        }
      />

      {sentNotice && <div className="mb-4"><Notice tone="success">Review request queued. It goes out within a minute.</Notice></div>}
      {skipped && (
        <div className="mb-4">
          <Notice tone="warn">Not sent: {skipped in SKIP_REASONS ? SKIP_REASONS[skipped as SkipReason] : "this customer could not be contacted."}</Notice>
        </div>
      )}
      {error && <div className="mb-4"><Notice tone="error">{ERRORS[error] ?? "Something went wrong. Please try again."}</Notice></div>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Customers" value={formatNumber(countOf.all)} />
        <Stat label="Went to Google" value={formatNumber(countOf.reviewed)} sub="Tapped through to leave a review" />
        <Stat label="Not reviewed yet" value={formatNumber(countOf["not-reviewed"])} sub="Sent, no Google visit yet" />
        <Stat label="Opted out" value={formatNumber(countOf["opted-out"])} sub="Will not be contacted again" />
      </div>

      <nav aria-label="Filter customers" className="mt-6 flex flex-wrap gap-2 text-sm">
        {CUSTOMER_FILTERS.map((f) => (
          <Link
            key={f}
            href={href({ filter: f, q })}
            aria-current={filter === f ? "page" : undefined}
            className={cx("rounded-full border px-3 py-1", filter === f ? "border-brand bg-brand-soft text-brand-strong" : "border-line bg-card")}
          >
            {FILTER_LABELS[f]} <span className="tabular-nums text-muted">({formatNumber(countOf[f])})</span>
          </Link>
        ))}
      </nav>

      <form action={BASE} method="get" role="search" className="mt-4 flex max-w-md gap-2">
        {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
        <Input name="q" defaultValue={q} type="search" aria-label="Search customers" placeholder="Search name, phone or email…" autoComplete="off" spellCheck={false} />
        <Button type="submit" variant="secondary">Search</Button>
        {q && <Link href={href({ filter })} className={buttonClass("ghost")}>Clear</Link>}
      </form>

      <p className="mt-3 text-xs text-muted">
        We can see who rated and who tapped through to your Google page, but not whether they finished posting a review there.
      </p>

      {customers.length === 0 ? (
        <div className="mt-4">
          <EmptyState title={q || filter !== "all" ? "No customers match" : "No customers yet"}>
            {q || filter !== "all" ? "Try a different filter or search." : "Customers you send review requests to will appear here."}
          </EmptyState>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {customers.map((c) => {
            const s = summariseCustomer(c, c.reviewRequests, now);
            const canSend = !s.optedOut && !s.nextEligibleAt && Boolean(c.phoneE164 || c.email);
            return (
              <li key={c.id}>
                <Card className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="break-words font-medium">{c.name}</div>
                      <div className="break-words text-sm text-muted">
                        {[displayPhone(c.phoneE164), c.email].filter(Boolean).join(" · ") || "No contact details"}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={STATE_TONE[s.state]}>{STATE_LABELS[s.state]}</Badge>
                      {s.optedOut && <Badge tone="bad">Opted out</Badge>}
                    </div>
                  </div>

                  <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
                    {s.rating !== null && (
                      <div className="flex items-center gap-1.5"><dt>Rating</dt><dd><Stars rating={s.rating} /></dd></div>
                    )}
                    <div className="flex gap-1.5"><dt>Last sent</dt><dd className="text-ink">{s.lastSentAt ? formatDate(s.lastSentAt) : "Never"}</dd></div>
                    {s.googleAt && <div className="flex gap-1.5"><dt>Went to Google</dt><dd className="text-ink">{formatDate(s.googleAt)}</dd></div>}
                    {s.optedOut && c.optedOutAt && <div className="flex gap-1.5"><dt>Opted out</dt><dd className="text-ink">{formatDate(c.optedOutAt)}</dd></div>}
                    <div className="flex gap-1.5"><dt>Requests</dt><dd className="tabular-nums text-ink">{s.requests}</dd></div>
                  </dl>

                  <div className="mt-4 text-sm">
                    {canSend ? (
                      <form action={sendToCustomerAction}>
                        <ConfirmAction
                          trigger={s.state === "not-sent" ? "Send request" : "Send another request"}
                          triggerLabel={`Send a review request to ${c.name}`}
                          triggerClassName="px-3 py-1.5"
                          message={`Send ${c.name} a review request?`}
                          className="relative inline-block"
                        >
                          <input type="hidden" name="customerId" value={c.id} />
                          <label className="flex items-start gap-2 text-xs text-muted">
                            <input type="checkbox" name="consent" required className="mt-0.5 size-4 shrink-0 accent-brand" />
                            <span>{CONSENT_STATEMENT}</span>
                          </label>
                          <Button type="submit" className="w-full">Send request</Button>
                        </ConfirmAction>
                      </form>
                    ) : s.optedOut ? (
                      <span className="text-muted">Opted out, so we will not contact them again.</span>
                    ) : s.nextEligibleAt ? (
                      <span className="text-muted">Contacted recently. Can be sent again from {formatDate(s.nextEligibleAt)}.</span>
                    ) : (
                      <span className="text-muted">No phone number or email on file.</span>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 && (
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
          {page > 1 ? <Link href={href({ filter, q, page: page - 1 })} className="font-semibold text-brand-strong">← Newer</Link> : <span />}
          <span className="text-muted">Page {page} of {pages}</span>
          {page < pages ? <Link href={href({ filter, q, page: page + 1 })} className="font-semibold text-brand-strong">Older →</Link> : <span />}
        </nav>
      )}
    </>
  );
}
