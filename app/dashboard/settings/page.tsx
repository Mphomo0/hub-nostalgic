import { Notice, PageHeader } from "@/components/ui";
import { requireMember } from "@/lib/session";
import { SettingsForm } from "./settings-form";

export const metadata = { title: "Business profile" };

export default async function SettingsPage() {
  const { tdb, isOwner } = await requireMember();
  const client = await tdb.client.findFirstOrThrow({
    select: { id: true, name: true, brandColor: true, logo: { select: { updatedAt: true } } },
  });
  const logoUrl = client.logo ? `/api/logo/${client.id}?v=${client.logo.updatedAt.getTime()}` : null;
  return (
    <>
      <PageHeader title="Business profile" description="Your business name, logo and brand colour, used across every tool (emails, rating pages and more)." />
      {!isOwner && <div className="mb-4"><Notice>Only the account owner can change settings.</Notice></div>}
      <SettingsForm client={client} logoUrl={logoUrl} disabled={!isOwner} />
    </>
  );
}
