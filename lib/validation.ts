import type { z } from "zod";

/** Helpers for validating FormData in server actions. Schemas live in lib/schemas.ts. */

/** Turn Zod issues into { field: message } for forms. */
export function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

/**
 * FormData → plain object of its text fields (files are read with fileFrom).
 * A key that appears more than once (e.g. several ticked checkboxes) becomes an array.
 */
export function formObject(formData: FormData) {
  const obj: Record<string, unknown> = {};
  for (const [k, v] of formData.entries()) {
    if (typeof v !== "string") continue;
    const prev = obj[k];
    obj[k] = prev === undefined ? v : Array.isArray(prev) ? [...prev, v] : [prev, v];
  }
  return obj;
}

export function fileFrom(formData: FormData, name: string): File | null {
  const f = formData.get(name);
  return f instanceof File && f.size > 0 ? f : null;
}
