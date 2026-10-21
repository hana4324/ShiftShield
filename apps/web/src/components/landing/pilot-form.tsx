"use client";

import Link from "next/link";
import { Fragment, useActionState, useId } from "react";
import { COMPANY_TYPES, COVERAGE_TIMELINES, SHIFT_TYPES } from "@shiftshield/shared";
import { submitEmployerLead } from "@/app/actions/waitlist";
import { Icons } from "@/components/icons";
import { AntiSpamFields } from "@/components/ui/anti-spam-fields";
import { Button } from "@/components/ui/button";
import { CheckboxGroup, SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { fieldValue, fieldValues, initialFormState } from "@/lib/form-state";

export function PilotForm() {
  const [state, action, pending] = useActionState(submitEmployerLead, initialFormState);
  const headingId = useId();
  const e = state.fieldErrors ?? {};
  const v = state.values;
  // React 19 resets the form after an action; remount the fields so selects and checkboxes
  // pick up the echoed values (their defaultValue only applies on mount).
  const fieldsKey = JSON.stringify(v ?? null);

  if (state.status === "success") {
    return (
      <div
        role="status"
        className="rounded-3xl bg-white p-8 text-center shadow-card ring-1 ring-navy-950/5"
      >
        <div className="mx-auto mb-4 inline-flex size-14 items-center justify-center rounded-full bg-status-green/15 text-status-green">
          <Icons.Check size={28} />
        </div>
        <h3 className="text-2xl font-extrabold tracking-tight">You&apos;re in.</h3>
        <p className="mx-auto mt-2 max-w-md text-navy-950/70">{state.message}</p>
        <p className="mt-6 text-sm text-steel-400">
          Need coverage sooner? Call{" "}
          <a className="font-semibold text-blue-700" href="tel:+12542764393">
            (254) 276-4393
          </a>
          .
        </p>
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
        Employer pilot application
      </h3>
      <p className="mt-1 text-sm text-navy-950/60">
        Takes about two minutes. No card required to apply.
      </p>

      <AntiSpamFields />

      <Fragment key={fieldsKey}>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <TextField
            id="company_name"
            defaultValue={fieldValue(v, "company_name")}
            label="Company name"
            autoComplete="organization"
            required
            error={e.company_name}
          />
          <SelectField
            id="company_type"
            defaultValue={fieldValue(v, "company_type")}
            label="Company type"
            options={COMPANY_TYPES}
            required
            error={e.company_type}
          />
          <TextField
            id="contact_name"
            defaultValue={fieldValue(v, "contact_name")}
            label="Your name"
            autoComplete="name"
            required
            error={e.contact_name}
          />
          <TextField
            id="title"
            defaultValue={fieldValue(v, "title")}
            label="Title"
            autoComplete="organization-title"
            optional
            error={e.title}
            placeholder="Security Director"
          />
          <TextField
            id="email"
            defaultValue={fieldValue(v, "email")}
            label="Work email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            error={e.email}
          />
          <TextField
            id="phone"
            defaultValue={fieldValue(v, "phone")}
            label="Phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            required
            error={e.phone}
            placeholder="(214) 555-0100"
          />
          <TextField
            id="city"
            defaultValue={fieldValue(v, "city")}
            label="City"
            autoComplete="address-level2"
            required
            error={e.city}
            placeholder="Dallas"
          />
          <TextField
            id="site_count"
            defaultValue={fieldValue(v, "site_count") ?? 1}
            label="Number of sites"
            type="number"
            inputMode="numeric"
            min={1}
            required
            error={e.site_count}
          />
          <TextField
            id="shifts_per_month"
            defaultValue={fieldValue(v, "shifts_per_month")}
            label="Approx. shifts needed per month"
            type="number"
            inputMode="numeric"
            min={0}
            required
            error={e.shifts_per_month}
            placeholder="20"
          />
          <SelectField
            id="coverage_timeline"
            defaultValue={fieldValue(v, "coverage_timeline")}
            label="How soon do you need coverage?"
            options={COVERAGE_TIMELINES}
            required
            error={e.coverage_timeline}
          />
        </div>

        <div className="mt-5">
          <CheckboxGroup
            name="shift_types"
            legend="Typical shift types"
            options={SHIFT_TYPES}
            defaultValues={fieldValues(v, "shift_types")}
            error={e.shift_types}
          />
        </div>

        <div className="mt-5">
          <TextAreaField
            id="notes"
            defaultValue={fieldValue(v, "notes")}
            label="Anything else we should know?"
            optional
            error={e.notes}
            placeholder="Post orders, uniform requirements, current pain points..."
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
          By applying you agree to be contacted about the pilot. See our{" "}
          <Link href="/legal/privacy" className="underline underline-offset-2">
            privacy policy
          </Link>
          .
        </p>
        <Button type="submit" size="lg" disabled={pending} aria-busy={pending}>
          {pending ? "Sending..." : "Join the 30-Day Pilot"}
          {!pending ? <Icons.ArrowRight size={18} /> : null}
        </Button>
      </div>
    </form>
  );
}
