import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { UnsubscribeForm } from "./unsubscribe-form";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false } };

/**
 * Shows a confirm button rather than unsubscribing on GET, because email
 * scanners open links automatically. (One-click unsubscribe from mail apps
 * uses POST /api/unsubscribe/[token].)
 */
export default async function UnsubscribePage({ params }: PageProps<"/unsubscribe/[token]">) {
  const { token } = await params;
  if (token.length < 20 || token.length > 100) notFound();
  const req = await db.reviewRequest.findUnique({ where: { token }, select: { client: { select: { name: true } }, customer: { select: { optedOutAt: true } } } });
  if (!req) notFound();

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-line bg-card p-8 text-center shadow-sm">
        <UnsubscribeForm token={token} clientName={req.client.name} alreadyDone={Boolean(req.customer.optedOutAt)} />
      </div>
    </main>
  );
}
