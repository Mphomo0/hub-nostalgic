"use client";
import { FieldError, FormMessage, SubmitButton } from "@/components/form-state";
import { Input, Label } from "@/components/ui";
import { acceptInviteSchema } from "@/lib/schemas";
import { useActionForm } from "@/lib/use-action-form";
import { acceptInviteAction } from "./actions";

export function InviteForm({ token }: { token: string }) {
  const { register, state, pending, errors, formProps } = useActionForm({
    schema: acceptInviteSchema,
    action: acceptInviteAction,
    defaultValues: { token, password: "", confirm: "" },
  });
  return (
    <form {...formProps} className="mt-6 space-y-4">
      <input type="hidden" {...register("token")} />
      <div>
        <Label htmlFor="password" hint="(at least 10 characters)">Password</Label>
        <Input id="password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...register("password")} />
        <FieldError error={errors.password} />
      </div>
      <div>
        <Label htmlFor="confirm">Confirm password</Label>
        <Input id="confirm" type="password" autoComplete="new-password" aria-invalid={!!errors.confirm} {...register("confirm")} />
        <FieldError error={errors.confirm} />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="w-full" pending={pending} pendingText="Setting up…">Set password and continue</SubmitButton>
    </form>
  );
}
