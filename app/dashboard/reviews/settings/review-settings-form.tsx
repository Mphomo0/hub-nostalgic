"use client";
import { FieldError, FormMessage, SubmitButton } from "@/components/form-state";
import { Card, Input, Label } from "@/components/ui";
import { useActionForm } from "@/lib/use-action-form";
import { reviewSettingsSchema } from "@/modules/reviews/schemas";
import { updateReviewSettingsAction } from "./actions";

export function ReviewSettingsForm({ defaults, disabled }: { defaults: { googleReviewUrl: string; remindersEnabled: boolean }; disabled: boolean }) {
  const { register, state, pending, errors, formProps } = useActionForm({
    schema: reviewSettingsSchema,
    action: updateReviewSettingsAction,
    defaultValues: defaults,
  });
  return (
    <form {...formProps} className="max-w-2xl">
      <fieldset disabled={disabled}>
        <Card className="space-y-5">
          <div>
            <Label htmlFor="googleReviewUrl" hint="(Google Business Profile → Ask for reviews)">Google review link</Label>
            <Input id="googleReviewUrl" type="url" aria-invalid={!!errors.googleReviewUrl} {...register("googleReviewUrl")} />
            <FieldError error={errors.googleReviewUrl} />
          </div>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-0.5 size-4 accent-brand" {...register("remindersEnabled")} />
            <span>
              <span className="font-medium">Send one reminder</span>
              <span className="block text-muted">If a customer hasn&apos;t rated after 3 days, send them one gentle reminder.</span>
            </span>
          </label>
          <FormMessage state={state} />
          <SubmitButton pending={pending}>Save</SubmitButton>
        </Card>
      </fieldset>
    </form>
  );
}
