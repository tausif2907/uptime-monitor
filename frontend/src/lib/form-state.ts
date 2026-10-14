import type { ZodError } from "zod";

/** What every server action returns to its form (via useActionState). */
export interface FormState {
  error?: string;
  /** Success message for forms that stay on the page after submitting. */
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
}

export const initialFormState: FormState = {};

export function fromZodError(error: ZodError): FormState {
  return { error: "Please fix the highlighted fields.", fieldErrors: error.flatten().fieldErrors };
}
