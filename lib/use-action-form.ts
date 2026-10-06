"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState, useEffect, useRef, type FormEvent } from "react";
import { useForm, type DefaultValues, type FieldValues, type Path, type RegisterOptions, type Resolver } from "react-hook-form";
import type { z } from "zod";
import type { FormState } from "@/components/form-state";

type Schema = z.ZodType<unknown, FieldValues>;

/**
 * react-hook-form + Zod in the browser, then submit to a server action.
 *
 * - The browser validates with the same schema the server uses (lib/schemas.ts).
 * - On submit we send the form's own FormData (so file inputs just work).
 * - Field errors returned by the server (e.g. "email already has a login")
 *   are shown on the matching field.
 * - `action` is also set on the <form>, so a submit before JavaScript has
 *   loaded still reaches the server (which validates everything again).
 */
export function useActionForm<S extends Schema>(opts: {
  schema: S;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  defaultValues?: DefaultValues<z.input<S>>;
  /** Clear the form after a successful submit. */
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(opts.action, null);
  const form = useForm<z.input<S>, unknown, z.output<S>>({
    resolver: zodResolver(opts.schema as never) as unknown as Resolver<z.input<S>, unknown, z.output<S>>,
    defaultValues: opts.defaultValues,
    mode: "onTouched",
  });
  const formRef = useRef<HTMLFormElement>(null);
  const { setError, reset } = form;

  useEffect(() => {
    if (!state) return;
    for (const [name, message] of Object.entries(state.errors ?? {})) {
      setError(name as Path<z.input<S>>, { type: "server", message });
    }
    if (state.ok && opts.resetOnSuccess) reset();
  }, [state, setError, reset, opts.resetOnSuccess]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    // Include the clicked button's name/value (e.g. a star rating button).
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    return form.handleSubmit(() => {
      const fd = new FormData(formRef.current!, submitter);
      startTransition(() => formAction(fd));
    })(event);
  }

  /**
   * Like form.register, but also renders the default value into the HTML
   * (react-hook-form only sets it after hydration), so edit forms aren't
   * blank before JavaScript loads.
   */
  function register(name: Path<z.input<S>>, options?: RegisterOptions<z.input<S>, Path<z.input<S>>>) {
    const value = (opts.defaultValues as Record<string, unknown> | undefined)?.[name as string];
    const field = form.register(name, options);
    if (typeof value === "boolean") return { ...field, defaultChecked: value };
    if (typeof value === "string" || typeof value === "number") return { ...field, defaultValue: value };
    return field;
  }

  return {
    form,
    register,
    state,
    pending,
    errors: form.formState.errors,
    /** Spread onto <form>. */
    formProps: { ref: formRef, action: formAction, onSubmit, noValidate: true },
  };
}
