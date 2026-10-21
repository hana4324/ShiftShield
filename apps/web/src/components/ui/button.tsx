import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "white";
type Size = "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-700 shadow-[0_8px_24px_-8px_rgb(30_99_233/0.7)]",
  secondary:
    "bg-white/10 text-white ring-1 ring-inset ring-white/20 hover:bg-white/15 active:bg-white/20",
  ghost: "bg-transparent text-navy-950 hover:bg-navy-950/5 active:bg-navy-950/10",
  white:
    "bg-white text-navy-950 hover:bg-slate-50 active:bg-slate-50 ring-1 ring-inset ring-navy-950/10",
};

const sizes: Record<Size, string> = {
  md: "h-11 px-5 text-[15px]",
  lg: "h-13 px-7 text-base",
};

export function buttonClasses(variant: Variant = "primary", size: Size = "md", extra = ""): string {
  return [
    "focus-ring inline-flex items-center justify-center gap-2 rounded-xl font-semibold tracking-tight transition-colors disabled:cursor-not-allowed disabled:opacity-60",
    variants[variant],
    sizes[size],
    extra,
  ].join(" ");
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}) {
  return (
    <button className={buttonClasses(variant, size, className)} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className = "",
  children,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClasses(variant, size, className)}>
      {children}
    </Link>
  );
}
