"use client";

import Link from "next/link";
import { Fragment, useActionState, useId } from "react";
import { LICENSE_LEVEL_OPTIONS } from "@shiftshield/shared";
import { submitOfficerLead } from "@/app/actions/waitlist";
import { Icons } from "@/components/icons";
import { AntiSpamFields } from "@/components/ui/anti-spam-fields";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/field";
import { fieldValue, initialFormState } from "@/lib/form-state";

export function OfficerForm() {
  const [state, action, pending] = useActionState(submitOfficerLead, initialFormState);
  const headingId = useId();
  const e = state.fieldErrors ?? {};
  const v = state.values;
  // React 19 resets the form after an action; remount the fields so selects and checkboxes
  // pick up the echoed values (their defaultValue only applies on mount).
  const fieldsKey = JSON.stringify(v ?? null);

  if (state.status === "success") {
    return (
      <div role="status" className="rounded-3xl bg-navy-900 p-8 text-center ring-1 ring-white/10">
        <div className="mx-auto mb-4 inline-flex size-14 items-center justify-center rounded-full bg-status-green/15 text-status-green">
          <Icons.Check size={28} />
        </div>
        <h3 className="text-2xl font-extrabold tracking-tight text-white">
          You&apos;re on the list.
        </h3>
        <p className="mx-auto mt-2 max-w-md text-steel-400">{state.message}</p>
      </div>
    );
  }

  return (
    <form
      action={action}
      aria-labelledby={headingId}
      noValidate
      className="relative rounded-3xl bg-white p-6 shadow-card ring-1 ring-navy-950/5 sm:p-8"
    >
      <h3 id={headingId} className="text-xl font-extrabold tracking-tight">
        Officers: get notified at launch
      </h3>
      <p className="mt-1 text-sm text-navy-950/60">
        Keep 100% of the posted rate. One-time $30 signup covers your background check.
      </p>

      <AntiSpamFields />

      <Fragment key={fieldsKey}>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <TextField
            id="o-contact_name"
            name="contact_name"
            defaultValue={fieldValue(v, "contact_name")}
            label="Full name"
            autoComplete="name"
            required
            error={e.contact_name}
          />
          <TextField
            id="o-city"
            name="city"
            defaultValue={fieldValue(v, "city")}
            label="City"
            autoComplete="address-level2"
            required
            error={e.city}
            placeholder="Arlington"
          />
          <TextField
            id="o-email"
            name="email"
            defaultValue={fieldValue(v, "email")}
            label="Email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            error={e.email}
          />
          <TextField
            id="o-phone"
            name="phone"
            defaultValue={fieldValue(v, "phone")}
            label="Mobile phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            required
            error={e.phone}
            hint="We text urgent shift alerts."
          />
          <SelectField
            id="o-license_level"
            name="license_level"
            defaultValue={fieldValue(v, "license_level")}
            label="Texas DPS license level"
            options={LICENSE_LEVEL_OPTIONS}
            required
            error={e.license_level}
            className="sm:col-span-2"
          />
        </div>
      </Fragment>

      {state.status === "error" && state.message ? (
        <p
          role="alert"
          className="mt-5 rounded-xl bg-status-red/10 px-4 py-3 text-sm font-medium text-status-red"
        >
          {state.message}
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-steel-400">
          Officers are independent contractors. See the{" "}
          <Link href="/legal/no-guarantee-of-work" className="underline underline-offset-2">
            no guarantee of work notice
          </Link>
          .
        </p>
        <Button type="submit" size="lg" disabled={pending} aria-busy={pending}>
          {pending ? "Sending..." : "Notify me at launch"}
        </Button>
      </div>
    </form>
  );
}
