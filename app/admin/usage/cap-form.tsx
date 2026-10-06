"use client";
import { FieldError } from "@/components/form-state";
import { Button, Input } from "@/components/ui";
import { monthlyCapSchema } from "@/lib/schemas";
import { useActionForm } from "@/lib/use-action-form";
import { setMonthlyCapAction } from "../actions";

export function CapForm({ clientId, clientName, monthlyCap }: { clientId: string; clientName: string; monthlyCap: number | null }) {
  const { form, register, state, pending, errors, formProps } = useActionForm({
    schema: monthlyCapSchema,
    action: setMonthlyCapAction,
    defaultValues: { clientId, monthlyCap: monthlyCap === null ? "" : String(monthlyCap) },
  });
  return (
    <form {...formProps}>
      <div className="flex items-center gap-2">
        <input type="hidden" {...register("clientId")} />
        <Input inputMode="numeric" placeholder="None" aria-label={`Monthly cap for ${clientName}`} aria-invalid={!!errors.monthlyCap} className="w-24 py-1.5" {...register("monthlyCap")} />
        <Button variant="secondary" className="px-3 py-1.5" disabled={pending}>{pending ? "…" : "Set"}</Button>
        {state?.ok && !form.formState.isDirty && <span className="text-xs text-brand-strong">Saved</span>}
      </div>
      <FieldError error={errors.monthlyCap} />
    </form>
  );
}
