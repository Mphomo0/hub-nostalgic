"use client";
import { FormMessage, SubmitButton } from "@/components/form-state";
import { Card } from "@/components/ui";
import { useActionForm } from "@/lib/use-action-form";
import { reviewSettingsSchema } from "@/modules/reviews/schemas";
import { updateReviewSettingsAction } from "./actions";

export function ReviewSettingsForm({ defaults, disabled }: { defaults: { remindersEnabled: boolean }; disabled: boolean }) {
  const { register, state, pending, formProps } = useActionForm({
    schema: reviewSettingsSchema,
    action: updateReviewSettingsAction,
    defaultValues: defaults,
  });
  return (
    <form {...formProps}>
      <fieldset disabled={disabled}>
        <Card className="space-y-5">
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-0.5 size-4 accent-brand" {...register("remindersEnabled")} />
            <span>
              <span className="font-medium">Send one reminder</span>
              <span className="block text-muted">If a customer hasn’t rated after 3 days, send them one gentle reminder.</span>
            </span>
          </label>
          <FormMessage state={state} />
          <SubmitButton pending={pending}>Save</SubmitButton>
        </Card>
      </fieldset>
    </form>
  );
}
