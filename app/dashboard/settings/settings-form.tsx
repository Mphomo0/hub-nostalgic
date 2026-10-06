"use client";
import { FieldError, FormMessage, SubmitButton } from "@/components/form-state";
import { Button, Card, Input, Label } from "@/components/ui";
import { businessProfileFormSchema } from "@/lib/schemas";
import { useActionForm } from "@/lib/use-action-form";
import { removeLogoAction, updateSettingsAction } from "./actions";

type Props = {
  client: { name: string; brandColor: string };
  logoUrl: string | null;
  disabled: boolean;
};

export function SettingsForm({ client, logoUrl, disabled }: Props) {
  const { register, state, pending, errors, formProps } = useActionForm({
    schema: businessProfileFormSchema,
    action: updateSettingsAction,
    defaultValues: { name: client.name, brandColor: client.brandColor },
  });

  return (
    <div className="max-w-2xl space-y-6">
      <form {...formProps}>
        <fieldset disabled={disabled}>
          <Card className="space-y-5">
            <div>
              <Label htmlFor="name">Business name</Label>
              <Input id="name" aria-invalid={!!errors.name} {...register("name")} />
              <FieldError error={errors.name} />
            </div>
            <div>
              <Label htmlFor="brandColor">Brand colour</Label>
              <Input id="brandColor" type="color" className="h-11 w-24 p-1" {...register("brandColor")} />
              <FieldError error={errors.brandColor} />
            </div>
            <div>
              <Label htmlFor="logo" hint="(PNG, JPG or WebP, max 500 KB; resized to 400px wide)">Logo</Label>
              <div className="flex items-center gap-4">
                {logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="Current logo" className="h-14 max-w-36 rounded border border-line bg-white object-contain p-1" />
                )}
                <Input id="logo" type="file" accept="image/png,image/jpeg,image/webp" aria-invalid={!!errors.logo} {...register("logo")} />
              </div>
              <FieldError error={errors.logo} />
            </div>
            <FormMessage state={state} />
            <SubmitButton pending={pending}>Save</SubmitButton>
          </Card>
        </fieldset>
      </form>
      {logoUrl && !disabled && (
        <form action={removeLogoAction}>
          <Button variant="ghost" className="text-danger">Remove logo</Button>
        </form>
      )}
    </div>
  );
}
