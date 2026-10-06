import { Badge, Button, Card, Notice, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import { requireMember } from "@/lib/session";
import { removeStaffAction, revokeInviteAction } from "./actions";
import { InviteStaffForm } from "./invite-form";

export const metadata = { title: "Team" };

export default async function TeamPage() {
  const { tdb, isOwner, user } = await requireMember();
  const [members, invites] = await Promise.all([
    tdb.membership.findMany({ orderBy: [{ role: "asc" }, { createdAt: "asc" }], include: { user: { select: { name: true, email: true } } } }),
    tdb.invite.findMany({ where: { acceptedAt: null }, orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <>
      <PageHeader title="Team" description="Everyone who can log in and send review requests. Each request records who sent it." />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card className="p-0">
          <ul className="divide-y divide-line">
            {members.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div>
                  <div className="font-medium">{m.user.name}{m.userId === user.id && <span className="text-muted"> (you)</span>}</div>
                  <div className="text-sm text-muted">{m.user.email} · joined {formatDate(m.createdAt)}</div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={m.role === "OWNER" ? "good" : "neutral"}>{m.role === "OWNER" ? "Owner" : "Staff"}</Badge>
                  {isOwner && m.role === "STAFF" && (
                    <form action={removeStaffAction}>
                      <input type="hidden" name="membershipId" value={m.id} />
                      <Button variant="ghost" className="px-2 py-1 text-danger">Remove</Button>
                    </form>
                  )}
                </div>
              </li>
            ))}
            {invites.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-muted">
                <div>
                  <div className="font-medium text-ink">{i.name}</div>
                  <div className="text-sm">{i.email}</div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={i.expiresAt < new Date() ? "bad" : "warn"}>{i.expiresAt < new Date() ? "Invite expired" : "Invite sent"}</Badge>
                  {isOwner && (
                    <form action={revokeInviteAction}>
                      <input type="hidden" name="inviteId" value={i.id} />
                      <Button variant="ghost" className="px-2 py-1">Cancel</Button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
        {isOwner ? (
          <Card>
            <h2 className="font-semibold">Invite staff</h2>
            <p className="mt-1 text-sm text-muted">They&apos;ll get an email to set their password. Re-inviting someone sends a fresh link.</p>
            <div className="mt-4"><InviteStaffForm /></div>
          </Card>
        ) : (
          <Notice>Only the account owner can invite or remove staff.</Notice>
        )}
      </div>
    </>
  );
}
