"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui";
import { unsubscribeAction } from "./actions";

export function UnsubscribeForm({ token, clientName, alreadyDone }: { token: string; clientName: string; alreadyDone: boolean }) {
  const [state, action, pending] = useActionState(unsubscribeAction, alreadyDone ? { done: true } : null);
  if (state?.done) {
    return (
      <>
        <h1 className="text-xl font-semibold">You&apos;re unsubscribed</h1>
        <p className="mt-2 text-sm text-muted">{clientName} won&apos;t send you review requests again.</p>
      </>
    );
  }
  return (
    <form action={action}>
      <input type="hidden" name="token" value={token} />
      <h1 className="text-xl font-semibold">Stop messages from {clientName}?</h1>
      <p className="mt-2 text-sm text-muted">You won&apos;t receive any more review requests or reminders from {clientName}.</p>
      {state?.error && <p role="alert" className="mt-3 text-sm text-danger">{state.error}</p>}
      <Button type="submit" disabled={pending} className="mt-6 w-full">{pending ? "Unsubscribing…" : "Unsubscribe"}</Button>
    </form>
  );
}
