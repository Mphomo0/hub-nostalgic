"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { FieldError, SubmitButton } from "@/components/form-state";
import { Turnstile, turnstileEnabled, type TurnstileHandle } from "@/components/turnstile";
import { Input, Label } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { loginSchema } from "@/lib/schemas";

type LoginInput = z.input<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captcha = useRef<TurnstileHandle>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), mode: "onTouched", defaultValues: { email: "", password: "" } });

  const submit = async ({ email, password }: LoginInput) => {
    setError(null);
    if (turnstileEnabled && !captchaToken) {
      setError("Please complete the security check below.");
      return;
    }
    const { error } = await authClient.signIn.email({
      email,
      password,
      fetchOptions: captchaToken ? { headers: { "x-captcha-response": captchaToken } } : undefined,
    });
    if (error) {
      captcha.current?.reset(); // tokens are single-use
      // Only a 401 means wrong details; anything else is a problem on our side.
      setError(
        error.status === 401
          ? "That email and password don’t match."
          : error.status === 429
            ? "Too many attempts. Please wait a minute and try again."
            : error.status === 400 || error.status === 403
              ? "The security check didn’t go through. Please try again."
              : "Something went wrong on our side. Please try again in a moment.",
      );
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  };
  // Wrapped so the captcha ref is only read when the form is submitted.
  const onSubmit = (event: FormEvent<HTMLFormElement>) => handleSubmit(submit)(event);

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
      <Turnstile ref={captcha} action="auth" onToken={setCaptchaToken} />
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
