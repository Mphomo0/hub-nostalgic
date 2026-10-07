"use client";
import { useState } from "react";
import { FieldError, FormMessage, SubmitButton } from "@/components/form-state";
import { Card, Input, Label, Textarea } from "@/components/ui";
import { enquirySchema } from "@/lib/schemas";
import { AVAILABLE_MODULES } from "@/modules/catalog";
import { useActionForm } from "@/lib/use-action-form";
import { enquiryAction } from "./actions";

export function ContactForm({ initialProducts }: { initialProducts: string[] }) {
  const [startedAt] = useState(() => Date.now());
  const { form, register, state, pending, errors, formProps } = useActionForm({
    schema: enquirySchema,
    action: enquiryAction,
    defaultValues: { name: "", business: "", email: "", phone: "", message: "", website: "", startedAt, products: initialProducts.filter((p) => AVAILABLE_MODULES.some((m) => m.key === p)) },
  });

  if (state?.ok) {
    return (
      <Card className="flex items-center">
        <FormMessage state={state} />
      </Card>
    );
  }

  return (
    <form {...formProps}>
      <Card className="space-y-4">
        <input type="hidden" {...register("startedAt")} />
        {/* Honeypot: hidden from people, bots tend to fill it in. */}
        <div aria-hidden="true" className="absolute -left-[9999px]">
          <label htmlFor="website">Website</label>
          <input id="website" tabIndex={-1} autoComplete="off" {...register("website")} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="name">Your name</Label>
            <Input id="name" autoComplete="name" aria-invalid={!!errors.name} {...register("name")} />
            <FieldError error={errors.name} />
          </div>
          <div>
            <Label htmlFor="business">Business name</Label>
            <Input id="business" autoComplete="organization" {...register("business")} />
            <FieldError error={errors.business} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" spellCheck={false} aria-invalid={!!errors.email} {...register("email")} />
            <FieldError error={errors.email} />
          </div>
          <div>
            <Label htmlFor="phone" hint="(optional)">Phone</Label>
            <Input id="phone" type="tel" autoComplete="tel" {...register("phone")} />
            <FieldError error={errors.phone} />
          </div>
        </div>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Which tools are you interested in?</legend>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_MODULES.map((m) => (
              <label key={m.key} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                <input type="checkbox" value={m.key} defaultChecked={initialProducts.includes(m.key)} className="size-4 accent-brand" {...form.register("products")} />
                {m.name}
              </label>
            ))}
            <span className="self-center text-xs text-muted">Not sure? Leave blank.</span>
          </div>
        </fieldset>
        <div>
          <Label htmlFor="message">About your business</Label>
          <Textarea id="message" placeholder="What do you do, and roughly how many customers do you see a month…" aria-invalid={!!errors.message} {...register("message")} />
          <FieldError error={errors.message} />
        </div>
        <FormMessage state={state} />
        <SubmitButton pending={pending} pendingText="Sending…" className="w-full">Send enquiry</SubmitButton>
      </Card>
    </form>
  );
}
