"use client";

import { useActionState, type ReactNode } from "react";
import { buttonClasses } from "@/components/ui/button";
import { initialFormState, type FormState } from "@/lib/form-state";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

/**
 * Minimal mutation form for admin actions: hidden ids + optional fields as children, one submit
 * button, inline success/error message from the Server Action's FormState.
 */
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = "Working...",
  variant = "primary",
  confirm,
  className = "",
  inline = false,
}: {
  action: Action;
  children?: ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  variant?: "primary" | "white" | "ghost";
  /** Native confirm() prompt before submitting. */
  confirm?: string;
  className?: string;
  inline?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  return (
    <form
      action={formAction}
      className={`${inline ? "flex flex-wrap items-end gap-2" : "space-y-3"} ${className}`}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      <div className={inline ? "" : "flex flex-wrap items-center gap-3"}>
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className={buttonClasses(variant, "md")}
        >
          {pending ? pendingLabel : submitLabel}
        </button>
      </div>
      {state.status === "error" && state.message ? (
        <p role="alert" className="w-full text-sm font-medium text-status-red">
          {state.message}
        </p>
      ) : null}
      {state.status === "success" && state.message ? (
        <p role="status" className="w-full text-sm font-medium text-status-green-700">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
