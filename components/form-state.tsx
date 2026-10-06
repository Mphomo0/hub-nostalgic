"use client";
import type { ComponentProps } from "react";
import type { FieldError as RhfFieldError } from "react-hook-form";
import { Button, Notice } from "@/components/ui";

/** Shape returned by server actions used with forms. */
export type FormState = { ok?: boolean; message?: string; errors?: Record<string, string> } | null;

export function SubmitButton({ children, pending, pendingText = "Saving…", ...props }: ComponentProps<typeof Button> & { pending?: boolean; pendingText?: string }) {
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending} {...props}>
      {pending ? pendingText : children}
    </Button>
  );
}

/** Form-level message from the server (success or error). */
export function FormMessage({ state }: { state: FormState }) {
  if (!state?.message) return null;
  return <Notice tone={state.ok ? "success" : "error"}>{state.message}</Notice>;
}

/** Field-level error from react-hook-form (client or server). */
export function FieldError({ error, id }: { error?: RhfFieldError | { message?: string }; id?: string }) {
  if (!error?.message) return null;
  return (
    <p className="mt-1 text-xs text-danger" id={id} role="alert">
      {error.message}
    </p>
  );
}
