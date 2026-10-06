import Link from "next/link";
import { notFound } from "next/navigation";
import { ClientStatusBadge } from "@/components/status";
import { Badge, Button, Card, Notice, PageHeader, Stat } from "@/components/ui";
import { formatDate, monthKey } from "@/lib/dates";
import { db } from "@/lib/db";
import { isModuleKey, MODULES } from "@/modules/catalog";
import { moduleAdminPanels } from "@/modules/server";
import { setClientStatusAction } from "../../actions";
import { DeleteCustomerForm, EditClientForm, InviteUserForm } from "./forms";

export default async function AdminClientPage({ params, searchParams }: PageProps<"/admin/clients/[id]">) {
  const { id } = await params;
  const { created } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const client = await db.client.findUnique({
    where: { id },
    include: {
      logo: { select: { updatedAt: true, sizeBytes: true } },
      memberships: { include: { user: { select: { name: true, email: true, createdAt: true } } }, orderBy: { createdAt: "asc" } },
      invites: { where: { acceptedAt: null }, orderBy: { createdAt: "desc" } },
      usageCounters: { where: { month: monthKey() } },
      modules: { select: { module: true } },
    },
  });
  if (!client) notFound();

  const enabled = new Set(client.modules.map((m) => m.module));
  const usage = client.usageCounters[0];

  return (
    <>
      <Link href="/admin" className="text-sm text-muted hover:text-ink">← Clients</Link>
      <PageHeader
        title={client.name}
        description={<span className="inline-flex items-center gap-2"><ClientStatusBadge status={client.status} /> Created {formatDate(client.createdAt)}</span>}
        actions={
          <form action={setClientStatusAction}>
            <input type="hidden" name="clientId" value={client.id} />
            <input type="hidden" name="status" value={client.status === "ACTIVE" ? "PAUSED" : "ACTIVE"} />
            <Button variant={client.status === "ACTIVE" ? "secondary" : "primary"}>{client.status === "ACTIVE" ? "Pause client" : "Activate client"}</Button>
          </form>
        }
      />
      {created && <div className="mb-6"><Notice tone="success">Client created and the owner invite has been emailed.</Notice></div>}

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Stat label="WhatsApp this month" value={usage?.whatsappCount ?? 0} />
        <Stat label="Emails this month" value={usage?.emailCount ?? 0} />
        <Stat label="Monthly message cap" value={client.monthlyCap ?? "None"} sub="All tools combined" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <EditClientForm client={client} logoUrl={client.logo ? `/api/logo/${client.id}?v=${client.logo.updatedAt.getTime()}` : null} />

          <section className="space-y-4">
            <h2 className="font-semibold">Modules</h2>
            {MODULES.map((m) => {
              const Panel = isModuleKey(m.key) ? moduleAdminPanels[m.key] : undefined;
              if (m.status !== "available" || !Panel) {
                return (
                  <Card key={m.key} className="flex items-center justify-between">
                    <span className="font-medium">{m.name}</span>
                    <Badge>Coming soon</Badge>
                  </Card>
                );
              }
              return <Panel key={m.key} clientId={client.id} enabled={enabled.has(m.key)} />;
            })}
          </section>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="font-semibold">Logins</h2>
            <ul className="mt-3 divide-y divide-line text-sm">
              {client.memberships.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 py-2">
                  <span>
                    {m.user.name}
                    <span className="block text-xs text-muted">{m.user.email}</span>
                  </span>
                  <Badge tone={m.role === "OWNER" ? "good" : "neutral"}>{m.role === "OWNER" ? "Owner" : "Staff"}</Badge>
                </li>
              ))}
              {client.invites.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-2 py-2 text-muted">
                  <span>
                    {i.name} <span className="block text-xs">{i.email}</span>
                  </span>
                  <Badge tone={i.expiresAt < new Date() ? "bad" : "warn"}>{i.expiresAt < new Date() ? "Invite expired" : "Invited"}</Badge>
                </li>
              ))}
            </ul>
            <div className="mt-4 border-t border-line pt-4">
              <h3 className="mb-2 text-sm font-medium">Invite or re-invite someone</h3>
              <InviteUserForm clientId={client.id} />
            </div>
          </Card>

          <Card>
            <h2 className="font-semibold">Delete a customer&apos;s data (POPIA)</h2>
            <p className="mt-1 text-sm text-muted">Permanently removes a customer, their review requests and feedback for this client.</p>
            <div className="mt-4"><DeleteCustomerForm clientId={client.id} /></div>
          </Card>
        </div>
      </div>
    </>
  );
}
