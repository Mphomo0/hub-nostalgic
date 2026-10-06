import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { NewClientForm } from "./new-client-form";

export default function NewClientPage() {
  return (
    <div className="max-w-2xl">
      <Link href="/admin" className="text-sm text-muted hover:text-ink">← Clients</Link>
      <PageHeader title="New client" description="Creates the client and emails the owner an invite to set their password." />
      <NewClientForm />
    </div>
  );
}
