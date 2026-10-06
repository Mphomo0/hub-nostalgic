import type { Metadata } from "next";
import Link from "next/link";
import { findValidInvite } from "@/lib/invites";
import { InviteForm } from "./invite-form";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Accept invite", robots: { index: false } };

export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const invite = await findValidInvite(token);

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center"><Logo className="h-9" priority /></div>
        <div className="rounded-xl border border-line bg-card p-6 shadow-sm">
          {invite ? (
            <>
              <h1 className="text-xl font-semibold">Welcome, {invite.name}</h1>
              <p className="mt-1 text-sm text-muted">
                Set a password to join <strong className="text-ink">{invite.client.name}</strong>. You&apos;ll log in with {invite.email}.
              </p>
              <InviteForm token={token} />
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold">This link has expired</h1>
              <p className="mt-2 text-sm text-muted">Invite links work once and expire after a week. Ask for a new invite, or log in if you&apos;ve already set your password.</p>
              <Link href="/login" className="mt-4 inline-block text-sm font-semibold text-brand-strong underline">
                Go to log in
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
