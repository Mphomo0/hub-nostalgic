"use client";
import { FieldError, FormMessage, SubmitButton } from "@/components/form-state";
import { Input, Label } from "@/components/ui";
import { useActionForm } from "@/lib/use-action-form";
import { reviewSettingsSchema } from "@/modules/reviews/schemas";
import { saveReviewSettingsAdminAction } from "./actions";

/** Admin form for a client's Reviews settings; also used to switch Reviews on. */
export function AdminReviewSettingsForm({ clientId, enabled, defaults }: { clientId: string; enabled: boolean; defaults: { googleReviewUrl: string; remindersEnabled: boolean } }) {
  const { register, state, pending, errors, formProps } = useActionForm({
    schema: reviewSettingsSchema,
    action: saveReviewSettingsAdminAction,
    defaultValues: defaults,
  });
  return (
    <form {...formProps} className="space-y-4">
      <input type="hidden" name="clientId" value={clientId} />
      {!enabled && <input type="hidden" name="enable" value="1" />}
      <div>
        <Label htmlFor="rv-googleReviewUrl">Google review link</Label>
        <Input id="rv-googleReviewUrl" type="url" placeholder="https://g.page/r/…/review" aria-invalid={!!errors.googleReviewUrl} {...register("googleReviewUrl")} />
        <FieldError error={errors.googleReviewUrl} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-brand" {...register("remindersEnabled")} />
        Send one reminder after 3 days
      </label>
      <FormMessage state={state} />
      <SubmitButton pending={pending} variant={enabled ? "secondary" : "primary"}>{enabled ? "Save" : "Switch on Reviews"}</SubmitButton>
    </form>
  );
}
