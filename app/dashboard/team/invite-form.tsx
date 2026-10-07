"use client";
import { FieldError, FormMessage, SubmitButton } from "@/components/form-state";
import { Input, Label } from "@/components/ui";
import { inviteSchema } from "@/lib/schemas";
import { useActionForm } from "@/lib/use-action-form";
import { inviteStaffAction } from "./actions";

export function InviteStaffForm() {
  const { register, state, pending, errors, formProps } = useActionForm({
    schema: inviteSchema,
    action: inviteStaffAction,
    defaultValues: { name: "", email: "" },
    resetOnSuccess: true,
  });
  return (
    <form {...formProps} className="space-y-3">
      <div>
        <Label htmlFor="name">Name</Label>
        <Input id="name" autoComplete="off" aria-invalid={!!errors.name} {...register("name")} />
        <FieldError error={errors.name} />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="off" spellCheck={false} aria-invalid={!!errors.email} {...register("email")} />
        <FieldError error={errors.email} />
      </div>
      <FormMessage state={state} />
      <SubmitButton pending={pending} pendingText="Sending…" className="w-full">Send invite</SubmitButton>
    </form>
  );
}
