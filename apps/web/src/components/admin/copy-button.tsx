"use client";

import { useState } from "react";
import { buttonClasses } from "@/components/ui/button";

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={buttonClasses("white", "md", "h-9 px-3 text-sm")}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          window.prompt("Copy:", value);
        }
      }}
    >
      {done ? "Copied" : label}
    </button>
  );
}
