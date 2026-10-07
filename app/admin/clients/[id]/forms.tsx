"use client";
import { ConfirmAction } from "@/components/confirm-action";
import { FieldError, FormMessage, SubmitButton } from "@/components/form-state";
import { Card, Input, Label, Select } from "@/components/ui";
import { adminInviteSchema, deleteCustomerSchema, updateClientFormSchema } from "@/lib/schemas";
import { useActionForm } from "@/lib/use-action-form";
import { adminInviteAction, deleteCustomerDataAction, updateClientAction } from "../../actions";

type ClientData = {
  id: string;
  name: string;
  brandColor: string;
  monthlyCap: number | null;
  contactEmail: string | null;
  contactPhone: string | null;
};

export function EditClientForm({ client, logoUrl }: { client: ClientData; logoUrl: string | null }) {
  const { register, state, pending, errors, formProps } = useActionForm({
    schema: updateClientFormSchema,
    action: updateClientAction,
    defaultValues: {
      clientId: client.id,
      name: client.name,
      brandColor: client.brandColor,
      monthlyCap: client.monthlyCap === null ? "" : String(client.monthlyCap),
      contactEmail: client.contactEmail ?? "",
      contactPhone: client.contactPhone ?? "",
    },
  });

  return (
    <form {...formProps}>
      <input type="hidden" {...register("clientId")} />
      <Card className="space-y-5">
        <h2 className="font-semibold">Business details</h2>
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
            <Label htmlFor="monthlyCap" hint="(messages/month, all tools; blank = none)">Monthly message cap</Label>
            <Input id="monthlyCap" inputMode="numeric" aria-invalid={!!errors.monthlyCap} {...register("monthlyCap")} />
            <FieldError error={errors.monthlyCap} />
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="contactEmail">Contact email</Label>
            <Input id="contactEmail" type="email" autoComplete="off" spellCheck={false} aria-invalid={!!errors.contactEmail} {...register("contactEmail")} />
            <FieldError error={errors.contactEmail} />
          </div>
          <div>
            <Label htmlFor="contactPhone">Contact phone</Label>
            <Input id="contactPhone" type="tel" autoComplete="off" aria-invalid={!!errors.contactPhone} {...register("contactPhone")} />
            <FieldError error={errors.contactPhone} />
          </div>
        </div>
        <div className="flex items-center gap-4">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Current logo" width={128} height={48} className="h-12 max-w-32 rounded border border-line object-contain p-1" />
          )}
          <div className="flex-1">
            <Label htmlFor="logo" hint="(replace: PNG/JPG/WebP, max 500 KB)">Logo</Label>
            <Input id="logo" type="file" accept="image/png,image/jpeg,image/webp" aria-invalid={!!errors.logo} {...register("logo")} />
            <FieldError error={errors.logo} />
          </div>
        </div>
        <FormMessage state={state} />
        <SubmitButton pending={pending}>Save changes</SubmitButton>
      </Card>
    </form>
  );
}

export function InviteUserForm({ clientId }: { clientId: string }) {
  const { register, state, pending, errors, formProps } = useActionForm({
    schema: adminInviteSchema,
    action: adminInviteAction,
    defaultValues: { clientId, name: "", email: "", role: "STAFF" },
    resetOnSuccess: true,
  });
  return (
    <form {...formProps} className="space-y-3">
      <input type="hidden" {...register("clientId")} />
      <Input placeholder="Thandi Nkosi…" aria-label="Name" autoComplete="off" aria-invalid={!!errors.name} {...register("name")} />
      <FieldError error={errors.name} />
      <Input type="email" placeholder="thandi@example.co.za…" aria-label="Email" autoComplete="off" spellCheck={false} aria-invalid={!!errors.email} {...register("email")} />
      <FieldError error={errors.email} />
      <Select aria-label="Role" {...register("role")}>
        <option value="STAFF">Staff</option>
        <option value="OWNER">Owner</option>
      </Select>
      <FormMessage state={state} />
      <SubmitButton variant="secondary" pending={pending} pendingText="Sending…" className="w-full">Send invite</SubmitButton>
    </form>
  );
}

export function DeleteCustomerForm({ clientId }: { clientId: string }) {
  const { register, state, pending, errors, formProps } = useActionForm({
    schema: deleteCustomerSchema,
    action: deleteCustomerDataAction,
    defaultValues: { clientId, contact: "" },
    resetOnSuccess: true,
  });
  return (
    <form {...formProps} className="space-y-3">
      <input type="hidden" {...register("clientId")} />
      <Input placeholder="Customer email or phone…" aria-label="Customer email or phone" autoComplete="off" spellCheck={false} aria-invalid={!!errors.contact} {...register("contact")} />
      <FieldError error={errors.contact} />
      <FormMessage state={state} />
      {/* The delete button only exists once the warning is open, so it can't be hit by accident, with or without JavaScript. */}
      <ConfirmAction
        trigger="Delete customer data"
        triggerVariant="danger"
        triggerClassName="w-full"
        className="relative block"
        message="Permanently delete this customer’s data? This can’t be undone."
      >
        <SubmitButton variant="danger" pending={pending} pendingText="Deleting…" className="w-full">Yes, delete permanently</SubmitButton>
      </ConfirmAction>
    </form>
  );
}
