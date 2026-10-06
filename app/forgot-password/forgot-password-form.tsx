"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { FieldError, SubmitButton } from "@/components/form-state";
import { Input, Label, Notice } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { forgotPasswordSchema } from "@/lib/schemas";

export function ForgotPasswordForm() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof forgotPasswordSchema>>({ resolver: zodResolver(forgotPasswordSchema), mode: "onTouched", defaultValues: { email: "" } });

  const onSubmit = handleSubmit(async ({ email }) => {
    setError(null);
    const { error } = await authClient.requestPasswordReset({ email });
    if (error) {
      setError(error.status === 429 ? "Too many requests. Please wait a few minutes and try again." : "Something went wrong. Please try again.");
      return;
    }
    // Same message whether or not the account exists, so emails can't be probed.
    setSentTo(email);
  });

  if (sentTo) {
    return (
      <div className="mt-6">
        <Notice tone="success">
          If an account exists for <strong>{sentTo}</strong>, we&apos;ve emailed a link to reset your password. It expires in 1 hour. Check your spam folder if it doesn&apos;t arrive.
        </Notice>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register("email")} />
        <FieldError error={errors.email} />
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <SubmitButton className="w-full" pending={isSubmitting} pendingText="Sending…">Send reset link</SubmitButton>
    </form>
  );
}
