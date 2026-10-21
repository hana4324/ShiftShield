"use client";

import { useActionState, useState } from "react";
import { reviewLicense } from "@/app/actions/admin-ops";
import { buttonClasses } from "@/components/ui/button";
import { TextAreaField } from "@/components/ui/field";
import { initialFormState } from "@/lib/form-state";

/** Approve / Reject-with-reason. The clicked submit button carries `decision` in the FormData. */
export function ReviewForm({ licenseId, disabled }: { licenseId: string; disabled?: boolean }) {
  const [state, action, pending] = useActionState(reviewLicense, initialFormState);
  const [rejecting, setRejecting] = useState(false);
  const done = state.status === "success";
  const locked = pending || disabled || done;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={licenseId} />
      {rejecting ? (
        <TextAreaField
          id="reason"
          label="Reason sent to the officer"
          placeholder="e.g. The back photo is blurry; please re-upload both sides in good light."
          required
          minLength={3}
          maxLength={500}
          error={state.status === "error" ? state.message : undefined}
        />
      ) : null}
      <div className="flex flex-wrap gap-2">
        {rejecting ? (
          <>
            <button
              type="submit"
              name="decision"
              value="reject"
              disabled={locked}
              aria-busy={pending}
              className={buttonClasses("white", "md", "text-status-red ring-status-red/40")}
            >
              {pending ? "Rejecting..." : "Confirm rejection"}
            </button>
            <button type="button" onClick={() => setRejecting(false)} className={buttonClasses("ghost", "md")}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              type="submit"
              name="decision"
              value="approve"
              disabled={locked}
              aria-busy={pending}
              className={buttonClasses("primary", "md")}
            >
              {pending ? "Approving..." : "Approve"}
            </button>
            <button
              type="button"
              onClick={() => setRejecting(true)}
              disabled={locked}
              className={buttonClasses("white", "md", "text-status-red ring-status-red/40")}
            >
              Reject with reason
            </button>
          </>
        )}
      </div>
      {state.status === "error" && !rejecting ? (
        <p role="alert" className="text-sm font-medium text-status-red">
          {state.message}
        </p>
      ) : null}
      {done ? (
        <p role="status" className="text-sm font-medium text-status-green-700">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
