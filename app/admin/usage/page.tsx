import Link from "next/link";
import { ClientStatusBadge } from "@/components/status";
import { cx, Notice, PageHeader, Table } from "@/components/ui";
import { formatMonth, formatNumber, monthKey } from "@/lib/dates";
import { inngestUsageEstimate } from "@/lib/inngest/usage";
import { db } from "@/lib/db";
import { CapForm } from "./cap-form";

function lastMonths(n: number) {
  const out: string[] = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    out.push(monthKey(new Date(d.getFullYear(), d.getMonth() - i, 15)));
  }
  return out;
}

export default async function UsagePage({ searchParams }: PageProps<"/admin/usage">) {
  const months = lastMonths(6);
  const { month: m } = await searchParams;
  const month = typeof m === "string" && months.includes(m) ? m : months[0];

  const clients = await db.client.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, status: true, monthlyCap: true, usageCounters: { where: { month } } },
  });
  const totals = clients.reduce(
    (t, c) => ({ wa: t.wa + (c.usageCounters[0]?.whatsappCount ?? 0), email: t.email + (c.usageCounters[0]?.emailCount ?? 0) }),
    { wa: 0, email: 0 },
  );

  // Only the current month is a live estimate; past months are finished.
  const inngest = month === months[0] ? inngestUsageEstimate(totals.wa + totals.email) : null;

  return (
    <>
      <PageHeader title="Usage" description="Messages sent per client (requests + reminders). Use this to watch WhatsApp costs and set caps." />
      {inngest && (
        <div className="mb-4">
          <Notice tone={inngest.level === "critical" ? "error" : inngest.level === "warning" ? "warn" : "info"}>
            <strong>Background jobs (Inngest):</strong> about {formatNumber(inngest.used)} of {formatNumber(inngest.limit)} runs and steps used this month ({inngest.percent}%).{" "}
            {inngest.level === "ok"
              ? "Plenty of room."
              : inngest.level === "warning"
                ? "Getting busy. Keep an eye on it."
                : "Almost full. If Inngest refuses events, requests are still sent directly, but without automatic retries."}{" "}
            <span className="text-muted">An estimate from messages sent; the real count is under Usage in the Inngest dashboard.</span>
          </Notice>
        </div>
      )}
      <nav aria-label="Month" className="mb-4 flex flex-wrap gap-2 text-sm">
        {months.map((mo) => (
          <Link key={mo} href={`/admin/usage?month=${mo}`} aria-current={mo === month ? "page" : undefined} className={cx("rounded-full border px-3 py-1", mo === month ? "border-brand bg-brand-soft text-brand-strong" : "border-line bg-card")}>
            {formatMonth(mo)}
          </Link>
        ))}
      </nav>
      <Table>
        <thead><tr><th scope="col">Client</th><th scope="col">Status</th><th scope="col">WhatsApp</th><th scope="col">Email</th><th scope="col">Total</th><th scope="col">Monthly cap</th></tr></thead>
        <tbody>
          {clients.map((c) => {
            const u = c.usageCounters[0];
            const total = (u?.whatsappCount ?? 0) + (u?.emailCount ?? 0);
            const over = c.monthlyCap !== null && total >= c.monthlyCap;
            return (
              <tr key={c.id}>
                <td><Link href={`/admin/clients/${c.id}`} className="font-medium text-brand-strong hover:underline">{c.name}</Link></td>
                <td><ClientStatusBadge status={c.status} /></td>
                <td className="tabular-nums">{u?.whatsappCount ?? 0}</td>
                <td className="tabular-nums">{u?.emailCount ?? 0}</td>
                <td className={cx("tabular-nums font-medium", over && "text-danger")}>{total}{over && <span className="ml-2 text-xs">Over cap</span>}</td>
                <td>
                  <CapForm clientId={c.id} clientName={c.name} monthlyCap={c.monthlyCap} />
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="font-medium">
            <td className="border-t border-line px-4 py-3">Total</td><td className="border-t border-line" />
            <td className="border-t border-line px-4 py-3 tabular-nums">{totals.wa}</td>
            <td className="border-t border-line px-4 py-3 tabular-nums">{totals.email}</td>
            <td className="border-t border-line px-4 py-3 tabular-nums">{totals.wa + totals.email}</td>
            <td className="border-t border-line" />
          </tr>
        </tfoot>
      </Table>
    </>
  );
}
