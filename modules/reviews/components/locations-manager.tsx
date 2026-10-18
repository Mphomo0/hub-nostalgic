"use client";
import { useActionState } from "react";
import { FieldError, FormMessage, SubmitButton } from "@/components/form-state";
import type { FormState } from "@/components/form-state";
import { Button, Input, Label } from "@/components/ui";
import { useActionForm } from "@/lib/use-action-form";
import { locationSchema } from "@/modules/reviews/schemas";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;
type Location = { id: string; name: string; googleReviewUrl: string };
type Hidden = Record<string, string>;

/**
 * Branches and their Google review links. Used by the client's settings page
 * and the admin client page; each passes its own (authorised) server actions.
 */
export function LocationsManager({
  locations, saveAction, deleteAction, hidden = {}, disabled = false,
}: { locations: Location[]; saveAction: Action; deleteAction: Action; hidden?: Hidden; disabled?: boolean }) {
  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {locations.map((l) => (
          <li key={l.id}>
            <LocationRow location={l} saveAction={saveAction} deleteAction={deleteAction} hidden={hidden} disabled={disabled} canDelete={locations.length > 1} />
          </li>
        ))}
      </ul>
      <div className="border-t border-line pt-4">
        <h3 className="mb-2 text-sm font-medium">{locations.length ? "Add another branch" : "Add your first branch"}</h3>
        <LocationRow saveAction={saveAction} hidden={hidden} disabled={disabled} />
      </div>
    </div>
  );
}

function LocationRow({
  location, saveAction, deleteAction, hidden, disabled, canDelete,
}: { location?: Location; saveAction: Action; deleteAction?: Action; hidden: Hidden; disabled: boolean; canDelete?: boolean }) {
  const key = location?.id ?? "new";
  const { register, state, pending, errors, formProps } = useActionForm({
    schema: locationSchema,
    action: saveAction,
    defaultValues: { id: location?.id ?? "", name: location?.name ?? "", googleReviewUrl: location?.googleReviewUrl ?? "" },
    resetOnSuccess: !location,
  });
  return (
    <div className="rounded-lg border border-line p-3">
      <form {...formProps} className="space-y-3">
        <fieldset disabled={disabled} className="space-y-3">
          {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          {location && <input type="hidden" name="id" value={location.id} />}
          <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
            <div>
              <Label htmlFor={`loc-name-${key}`}>Branch name</Label>
              <Input id={`loc-name-${key}`} autoComplete="off" placeholder="e.g. Sandton" aria-invalid={!!errors.name} {...register("name")} />
              <FieldError error={errors.name} />
            </div>
            <div>
              <Label htmlFor={`loc-url-${key}`} hint="(Google Business Profile → Ask for reviews)">Google review link</Label>
              <Input id={`loc-url-${key}`} type="url" autoComplete="off" spellCheck={false} placeholder="https://g.page/r/…/review" aria-invalid={!!errors.googleReviewUrl} {...register("googleReviewUrl")} />
              <FieldError error={errors.googleReviewUrl} />
            </div>
          </div>
          <FormMessage state={state} />
          <SubmitButton pending={pending} variant={location ? "secondary" : "primary"}>{location ? "Save branch" : "Add branch"}</SubmitButton>
        </fieldset>
      </form>
      {location && deleteAction && canDelete && !disabled && <DeleteForm id={location.id} action={deleteAction} hidden={hidden} />}
    </div>
  );
}

function DeleteForm({ id, action, hidden }: { id: string; action: Action; hidden: Hidden }) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="mt-2 space-y-2">
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <input type="hidden" name="id" value={id} />
      <FormMessage state={state} />
      <Button variant="ghost" disabled={pending} className="px-2 py-1 text-sm text-danger">Remove branch</Button>
    </form>
  );
}
