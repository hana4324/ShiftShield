"use client";

import { useActionState } from "react";
import { loginAdmin } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { fieldValue, initialFormState } from "@/lib/form-state";

export function LoginForm({
  next,
  configured,
  mode,
}: {
  next: string;
  configured: boolean;
  mode: "supabase" | "password";
}) {
  const [state, action, pending] = useActionState(loginAdmin, initialFormState);
  const error = state.status === "error" ? state.message : undefined;
  return (
    <form action={action} className="mt-6 space-y-4" aria-label="Admin sign in">
      <input type="hidden" name="next" value={next} />
      {mode === "supabase" ? (
        <TextField
          id="email"
          label="Email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          defaultValue={fieldValue(state.values, "email")}
        />
      ) : null}
      <TextField
        id="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        required
        autoFocus={mode === "password"}
        error={error}
      />
      {!configured ? (
        <p className="rounded-xl bg-status-amber/10 px-4 py-3 text-sm text-navy-950">
          {mode === "supabase" ? (
            <>
              Set <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in the server
              environment to enable sign in.
            </>
          ) : (
            <>
              Set <code className="font-mono">ADMIN_PASSWORD</code> in the server environment to
              enable sign in (or <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> to use
              Supabase Auth).
            </>
          )}
        </p>
      ) : null}
      <Button
        type="submit"
        className="w-full"
        disabled={pending || !configured}
        aria-busy={pending}
      >
        {pending ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}
