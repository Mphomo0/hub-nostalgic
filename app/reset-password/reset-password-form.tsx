"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { FieldError, SubmitButton } from "@/components/form-state";
import { Input, Label, Notice } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { resetPasswordSchema } from "@/lib/schemas";

export function ResetPasswordForm({ token }: { token: string }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<"expired" | "other" | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof resetPasswordSchema>>({ resolver: zodResolver(resetPasswordSchema), mode: "onTouched", defaultValues: { password: "", confirm: "" } });

  const onSubmit = handleSubmit(async ({ password }) => {
    setError(null);
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    if (error) {
      setError(error.code === "INVALID_TOKEN" ? "expired" : "other");
      return;
    }
    setDone(true);
  });

  if (done) {
    return (
      <div className="mt-6 space-y-4">
        <Notice tone="success">Your password has been changed.</Notice>
        <Link href="/login" className="inline-flex w-full items-center justify-center rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink hover:brightness-110">
          Log in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
      <div>
        <Label htmlFor="password" hint="(at least 10 characters)">New password</Label>
        <Input id="password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...register("password")} />
        <FieldError error={errors.password} />
      </div>
      <div>
        <Label htmlFor="confirm">Confirm new password</Label>
        <Input id="confirm" type="password" autoComplete="new-password" aria-invalid={!!errors.confirm} {...register("confirm")} />
        <FieldError error={errors.confirm} />
      </div>
      {error === "expired" && (
        <p role="alert" className="text-sm text-danger">
          This link has expired or was already used. <Link href="/forgot-password" className="font-semibold underline">Send a new one</Link>.
        </p>
      )}
      {error === "other" && <p role="alert" className="text-sm text-danger">Something went wrong. Please try again in a few minutes.</p>}
      <SubmitButton className="w-full" pending={isSubmitting} pendingText="Saving…">Change password</SubmitButton>
    </form>
  );
}
