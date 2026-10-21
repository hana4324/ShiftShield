import type { ReactNode } from "react";

export function Container({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>
  );
}

export function Section({
  id,
  children,
  className = "",
  tone = "light",
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  tone?: "light" | "white" | "navy";
}) {
  const bg =
    tone === "navy" ? "bg-navy-950 text-white" : tone === "white" ? "bg-white" : "bg-slate-50";
  return (
    <section id={id} className={`scroll-mt-20 py-16 sm:py-24 ${bg} ${className}`}>
      <Container>{children}</Container>
    </section>
  );
}

export function Eyebrow({
  children,
  tone = "light",
}: {
  children: ReactNode;
  tone?: "light" | "navy";
}) {
  return (
    <p
      className={`mb-3 text-xs font-bold tracking-[0.18em] uppercase ${
        tone === "navy" ? "text-blue-600" : "text-blue-700"
      }`}
    >
      {children}
    </p>
  );
}

export function Heading({
  children,
  tone = "light",
  as: Tag = "h2",
  className = "",
}: {
  children: ReactNode;
  tone?: "light" | "navy";
  as?: "h1" | "h2" | "h3";
  className?: string;
}) {
  return (
    <Tag
      className={`text-3xl font-extrabold tracking-tight text-balance sm:text-4xl ${
        tone === "navy" ? "text-white" : "text-navy-950"
      } ${className}`}
    >
      {children}
    </Tag>
  );
}

export function Lede({
  children,
  tone = "light",
}: {
  children: ReactNode;
  tone?: "light" | "navy";
}) {
  return (
    <p
      className={`mt-4 max-w-2xl text-lg leading-relaxed text-pretty ${
        tone === "navy" ? "text-steel-400" : "text-navy-950/70"
      }`}
    >
      {children}
    </p>
  );
}
