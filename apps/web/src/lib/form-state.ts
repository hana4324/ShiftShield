/** Shared shape returned by form server actions and consumed by useActionState. */
export type FormValues = Record<string, string | string[]>;

export interface FormState {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
  /**
   * What the user submitted, echoed back on a validation error. React 19 resets a form's
   * uncontrolled fields after a server action settles, so forms re-seed `defaultValue` from this.
   */
  values?: FormValues;
}

export const initialFormState: FormState = { status: "idle" };

/** Single-value field accessor for `defaultValue`. */
export function fieldValue(values: FormValues | undefined, key: string): string | undefined {
  const v = values?.[key];
  return typeof v === "string" ? v : undefined;
}

/** Multi-value (checkbox group) accessor for `defaultValues`. */
export function fieldValues(values: FormValues | undefined, key: string): string[] {
  const v = values?.[key];
  return Array.isArray(v) ? v : [];
}
