"use client";
import { FormMessage, SubmitButton } from "@/components/form-state";
import { useActionForm } from "@/lib/use-action-form";
import { reviewSettingsSchema } from "@/modules/reviews/schemas";
import { saveReviewSettingsAdminAction } from "./actions";

/** Admin form for a client's Reviews reminders; also switches Reviews on once a branch exists. */
export function AdminReviewSettingsForm({ clientId, enabled, canEnable, defaults }: { clientId: string; enabled: boolean; canEnable: boolean; defaults: { remindersEnabled: boolean } }) {
  const { register, state, pending, formProps } = useActionForm({
    schema: reviewSettingsSchema,
    action: saveReviewSettingsAdminAction,
    defaultValues: defaults,
  });
  return (
    <form {...formProps} className="space-y-4">
      <input type="hidden" name="clientId" value={clientId} />
      {!enabled && <input type="hidden" name="enable" value="1" />}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-brand" {...register("remindersEnabled")} />
        Send one reminder after 3 days
      </label>
      <FormMessage state={state} />
      {(enabled || canEnable) && <SubmitButton pending={pending} variant={enabled ? "secondary" : "primary"}>{enabled ? "Save" : "Switch on Reviews"}</SubmitButton>}
    </form>
  );
}
