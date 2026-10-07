"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { FieldError, SubmitButton } from "@/components/form-state";
import { Input, Label } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { loginSchema } from "@/lib/schemas";

type LoginInput = z.input<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), mode: "onTouched", defaultValues: { email: "", password: "" } });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setError(null);
    const { error } = await authClient.signIn.email({ email, password });
    if (error) {
      // Only a 401 means wrong details; anything else is a problem on our side.
      setError(
        error.status === 401
          ? "That email and password don’t match."
          : error.status === 429
            ? "Too many attempts. Please wait a minute and try again."
            : "Something went wrong on our side. Please try again in a moment.",
      );
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" spellCheck={false} aria-invalid={!!errors.email} {...register("email")} />
        <FieldError error={errors.email} />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" autoComplete="current-password" aria-invalid={!!errors.password} {...register("password")} />
        <FieldError error={errors.password} />
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <SubmitButton className="w-full" pending={isSubmitting} pendingText="Logging in…">
        Log in
      </SubmitButton>
    </form>
  );
}
