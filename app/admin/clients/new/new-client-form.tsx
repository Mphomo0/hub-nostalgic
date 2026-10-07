"use client";
import { useWatch } from "react-hook-form";
import { FieldError, FormMessage, SubmitButton } from "@/components/form-state";
import { Card, Input, Label, Select } from "@/components/ui";
import { createClientFormSchema } from "@/lib/schemas";
import { AVAILABLE_MODULES } from "@/modules/catalog";
import { useActionForm } from "@/lib/use-action-form";
import { createClientAction } from "../../actions";

export function NewClientForm() {
  const { form, register, state, pending, errors, formProps } = useActionForm({
    schema: createClientFormSchema,
    action: createClientAction,
    defaultValues: { name: "", modules: ["reviews"], googleReviewUrl: "", ownerName: "", ownerEmail: "", brandColor: "#1f6f5c", status: "ACTIVE", contactEmail: "", contactPhone: "" },
  });
  const selected = useWatch({ control: form.control, name: "modules" });
  const has = (key: string) => (Array.isArray(selected) ? selected.includes(key) : selected === key);

  return (
    <form {...formProps}>
      <Card className="space-y-5">
        <h2 className="font-semibold">Business</h2>
        <div>
          <Label htmlFor="name">Business name</Label>
          <Input id="name" autoComplete="off" aria-invalid={!!errors.name} {...register("name")} />
          <FieldError error={errors.name} />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="brandColor">Brand colour</Label>
            <Input id="brandColor" type="color" className="h-11 p-1" {...register("brandColor")} />
            <FieldError error={errors.brandColor} />
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Select id="status" {...register("status")}>
              <option value="ACTIVE">Active (can send)</option>
              <option value="PAUSED">Paused (can log in, can’t send)</option>
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="logo" hint="(optional, PNG/JPG/WebP, max 500 KB)">Logo</Label>
          <Input id="logo" type="file" accept="image/png,image/jpeg,image/webp" aria-invalid={!!errors.logo} {...register("logo")} />
          <FieldError error={errors.logo} />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="contactEmail" hint="(optional)">Billing / contact email</Label>
            <Input id="contactEmail" type="email" autoComplete="off" spellCheck={false} aria-invalid={!!errors.contactEmail} {...register("contactEmail")} />
            <FieldError error={errors.contactEmail} />
          </div>
          <div>
            <Label htmlFor="contactPhone" hint="(optional)">Contact phone</Label>
            <Input id="contactPhone" type="tel" autoComplete="off" aria-invalid={!!errors.contactPhone} {...register("contactPhone")} />
            <FieldError error={errors.contactPhone} />
          </div>
        </div>

        <h2 className="border-t border-line pt-5 font-semibold">Modules</h2>
        <fieldset className="space-y-3">
          <legend className="sr-only">Modules to switch on</legend>
          {AVAILABLE_MODULES.map((m) => (
            <label key={m.key} className="flex items-start gap-3 rounded-lg border border-line p-3 text-sm">
              <input type="checkbox" value={m.key} defaultChecked={m.key === "reviews"} className="mt-0.5 size-4 accent-brand" {...form.register("modules")} />
              <span>
                <span className="font-medium">{m.name}</span>
                <span className="block text-muted">{m.tagline}</span>
              </span>
            </label>
          ))}
          <FieldError error={errors.modules as { message?: string } | undefined} />
        </fieldset>
        {has("reviews") && (
          <div>
            <Label htmlFor="googleReviewUrl" hint="(Reviews: from Google Business Profile → Ask for reviews)">Google review link</Label>
            <Input id="googleReviewUrl" type="url" autoComplete="off" spellCheck={false} placeholder="https://g.page/r/…/review" aria-invalid={!!errors.googleReviewUrl} {...register("googleReviewUrl")} />
            <FieldError error={errors.googleReviewUrl} />
          </div>
        )}

        <h2 className="border-t border-line pt-5 font-semibold">Owner login</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="ownerName">Owner name</Label>
            <Input id="ownerName" autoComplete="off" aria-invalid={!!errors.ownerName} {...register("ownerName")} />
            <FieldError error={errors.ownerName} />
          </div>
          <div>
            <Label htmlFor="ownerEmail">Owner email</Label>
            <Input id="ownerEmail" type="email" autoComplete="off" spellCheck={false} aria-invalid={!!errors.ownerEmail} {...register("ownerEmail")} />
            <FieldError error={errors.ownerEmail} />
          </div>
        </div>
        <FormMessage state={state} />
        <SubmitButton pending={pending} pendingText="Creating…">Create client and send invite</SubmitButton>
      </Card>
    </form>
  );
}
