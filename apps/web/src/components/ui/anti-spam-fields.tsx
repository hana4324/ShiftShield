"use client";

import { useEffect, useRef } from "react";

/**
 * Honeypot + timing fields shared by every public form.
 * The timestamp is written to the DOM after commit (not during render) so the prerendered
 * static shell stays deterministic and the server can still reject sub-3-second submissions.
 * The effect has no dependency list on purpose: React 19 resets uncontrolled fields after a
 * form action settles, so the original timestamp is restored after every render.
 */
export function AntiSpamFields() {
  const startedAtRef = useRef<HTMLInputElement>(null);
  const startedAt = useRef("");
  useEffect(() => {
    if (!startedAt.current) startedAt.current = String(Date.now());
    if (startedAtRef.current) startedAtRef.current.value = startedAt.current;
  });
  return (
    <>
      <div aria-hidden="true" className="absolute top-0 -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <input ref={startedAtRef} type="hidden" name="started_at" defaultValue="" />
    </>
  );
}
